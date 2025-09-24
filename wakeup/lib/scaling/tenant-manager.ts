/**
 * Multi-Tenant Scaling Manager
 * マルチテナント対応スケーリング管理システム
 */

import { createClient } from '@supabase/supabase-js'

// Tenant configuration interface
interface TenantConfig {
  id: string
  name: string
  domain: string
  subdomain: string
  plan: 'free' | 'pro' | 'enterprise'
  limits: {
    maxUsers: number
    maxStorage: number // in MB
    maxMessages: number
    maxVoiceMinutes: number
  }
  features: {
    encryption: boolean
    analytics: boolean
    customBranding: boolean
    apiAccess: boolean
    sso: boolean
  }
  database: {
    schema: string
    connectionString?: string
  }
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

// Resource usage tracking
interface TenantUsage {
  tenantId: string
  users: number
  storage: number
  messages: number
  voiceMinutes: number
  apiCalls: number
  lastUpdated: Date
}

// Scaling configuration
const SCALING_CONFIG = {
  plans: {
    free: {
      maxUsers: 10,
      maxStorage: 100, // 100MB
      maxMessages: 1000,
      maxVoiceMinutes: 60
    },
    pro: {
      maxUsers: 100,
      maxStorage: 10000, // 10GB
      maxMessages: 50000,
      maxVoiceMinutes: 1000
    },
    enterprise: {
      maxUsers: -1, // Unlimited
      maxStorage: -1, // Unlimited
      maxMessages: -1, // Unlimited
      maxVoiceMinutes: -1 // Unlimited
    }
  },
  autoScaling: {
    cpu: {
      targetUtilization: 70,
      scaleUpThreshold: 80,
      scaleDownThreshold: 30
    },
    memory: {
      targetUtilization: 75,
      scaleUpThreshold: 85,
      scaleDownThreshold: 40
    }
  },
  loadBalancing: {
    algorithm: 'round-robin' as 'round-robin' | 'least-connections' | 'ip-hash',
    healthCheckInterval: 30000, // 30 seconds
    maxRetries: 3
  }
}

/**
 * Multi-tenant manager class
 */
export class TenantManager {
  private static instance: TenantManager
  private tenants: Map<string, TenantConfig> = new Map()
  private usage: Map<string, TenantUsage> = new Map()
  private connections: Map<string, any> = new Map()

  private constructor() {}

  static getInstance(): TenantManager {
    if (!TenantManager.instance) {
      TenantManager.instance = new TenantManager()
    }
    return TenantManager.instance
  }

  /**
   * Initialize tenant from request
   */
  async initializeTenant(request: {
    hostname: string
    subdomain?: string
    tenantId?: string
  }): Promise<TenantConfig | null> {
    try {
      // Try to find tenant by subdomain or hostname
      let tenant: TenantConfig | null = null

      if (request.subdomain) {
        tenant = await this.getTenantBySubdomain(request.subdomain)
      } else if (request.tenantId) {
        tenant = await this.getTenantById(request.tenantId)
      } else {
        // Extract subdomain from hostname
        const subdomain = this.extractSubdomain(request.hostname)
        if (subdomain) {
          tenant = await this.getTenantBySubdomain(subdomain)
        }
      }

      if (tenant && tenant.isActive) {
        // Initialize tenant-specific resources
        await this.initializeTenantResources(tenant)
        return tenant
      }

      return null
    } catch (error) {
      console.error('Failed to initialize tenant:', error)
      return null
    }
  }

  /**
   * Create new tenant
   */
  async createTenant(config: Omit<TenantConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<TenantConfig> {
    const tenant: TenantConfig = {
      ...config,
      id: this.generateTenantId(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Create tenant-specific database schema
    await this.createTenantSchema(tenant)

    // Store tenant configuration
    this.tenants.set(tenant.id, tenant)

    // Initialize usage tracking
    this.usage.set(tenant.id, {
      tenantId: tenant.id,
      users: 0,
      storage: 0,
      messages: 0,
      voiceMinutes: 0,
      apiCalls: 0,
      lastUpdated: new Date()
    })

    return tenant
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId: string): Promise<TenantConfig | null> {
    // First check cache
    if (this.tenants.has(tenantId)) {
      return this.tenants.get(tenantId)!
    }

    // Load from database
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single()

      if (error || !data) return null

      const tenant = this.mapDatabaseToTenant(data)
      this.tenants.set(tenantId, tenant)
      return tenant
    } catch (error) {
      console.error('Failed to load tenant:', error)
      return null
    }
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string): Promise<TenantConfig | null> {
    // Check cached tenants
    for (const tenant of this.tenants.values()) {
      if (tenant.subdomain === subdomain) {
        return tenant
      }
    }

    // Load from database
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('subdomain', subdomain)
        .single()

      if (error || !data) return null

      const tenant = this.mapDatabaseToTenant(data)
      this.tenants.set(tenant.id, tenant)
      return tenant
    } catch (error) {
      console.error('Failed to load tenant by subdomain:', error)
      return null
    }
  }

  /**
   * Get tenant-specific database connection
   */
  getTenantConnection(tenantId: string): any {
    if (!this.connections.has(tenantId)) {
      const tenant = this.tenants.get(tenantId)
      if (!tenant) return null

      // Use tenant-specific connection or main connection with schema
      const connectionString = tenant.database.connectionString ||
                              process.env.DATABASE_URL!

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          db: {
            schema: tenant.database.schema
          }
        }
      )

      this.connections.set(tenantId, supabase)
    }

    return this.connections.get(tenantId)
  }

  /**
   * Check resource usage and limits
   */
  async checkResourceLimits(tenantId: string, resource: keyof TenantUsage, amount: number = 1): Promise<{
    allowed: boolean
    usage: number
    limit: number
    remaining: number
  }> {
    const tenant = this.tenants.get(tenantId)
    const usage = this.usage.get(tenantId)

    if (!tenant || !usage) {
      return { allowed: false, usage: 0, limit: 0, remaining: 0 }
    }

    const planLimits = SCALING_CONFIG.plans[tenant.plan]
    let limit: number

    switch (resource) {
      case 'users':
        limit = planLimits.maxUsers
        break
      case 'storage':
        limit = planLimits.maxStorage
        break
      case 'messages':
        limit = planLimits.maxMessages
        break
      case 'voiceMinutes':
        limit = planLimits.maxVoiceMinutes
        break
      default:
        return { allowed: false, usage: 0, limit: 0, remaining: 0 }
    }

    // Unlimited for enterprise plan
    if (limit === -1) {
      return { allowed: true, usage: usage[resource] as number, limit: -1, remaining: -1 }
    }

    const currentUsage = usage[resource] as number
    const newUsage = currentUsage + amount
    const allowed = newUsage <= limit
    const remaining = Math.max(0, limit - currentUsage)

    return { allowed, usage: currentUsage, limit, remaining }
  }

  /**
   * Update resource usage
   */
  async updateUsage(tenantId: string, updates: Partial<Omit<TenantUsage, 'tenantId' | 'lastUpdated'>>): Promise<void> {
    const currentUsage = this.usage.get(tenantId)
    if (!currentUsage) return

    const newUsage: TenantUsage = {
      ...currentUsage,
      ...updates,
      lastUpdated: new Date()
    }

    this.usage.set(tenantId, newUsage)

    // Persist to database
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      await supabase
        .from('tenant_usage')
        .upsert({
          tenant_id: tenantId,
          users: newUsage.users,
          storage: newUsage.storage,
          messages: newUsage.messages,
          voice_minutes: newUsage.voiceMinutes,
          api_calls: newUsage.apiCalls,
          last_updated: newUsage.lastUpdated.toISOString()
        })
    } catch (error) {
      console.error('Failed to update usage:', error)
    }
  }

  /**
   * Get scaling recommendations
   */
  async getScalingRecommendations(tenantId: string): Promise<{
    recommendations: string[]
    metrics: {
      cpu: number
      memory: number
      storage: number
      connections: number
    }
    suggestedActions: string[]
  }> {
    const usage = this.usage.get(tenantId)
    const tenant = this.tenants.get(tenantId)

    if (!usage || !tenant) {
      return { recommendations: [], metrics: { cpu: 0, memory: 0, storage: 0, connections: 0 }, suggestedActions: [] }
    }

    const recommendations: string[] = []
    const suggestedActions: string[] = []

    // Analyze usage patterns
    const planLimits = SCALING_CONFIG.plans[tenant.plan]

    // Storage analysis
    if (planLimits.maxStorage > 0) {
      const storageUsagePercent = (usage.storage / planLimits.maxStorage) * 100
      if (storageUsagePercent > 80) {
        recommendations.push(`ストレージ使用量が ${storageUsagePercent.toFixed(1)}% に達しています`)
        suggestedActions.push('ストレージクリーンアップまたはプラン升级を検討してください')
      }
    }

    // User analysis
    if (planLimits.maxUsers > 0) {
      const userUsagePercent = (usage.users / planLimits.maxUsers) * 100
      if (userUsagePercent > 80) {
        recommendations.push(`ユーザー数が制限の ${userUsagePercent.toFixed(1)}% に達しています`)
        suggestedActions.push('上位プランへのアップグレードを検討してください')
      }
    }

    // Message volume analysis
    if (planLimits.maxMessages > 0) {
      const messageUsagePercent = (usage.messages / planLimits.maxMessages) * 100
      if (messageUsagePercent > 80) {
        recommendations.push(`メッセージ数が制限の ${messageUsagePercent.toFixed(1)}% に達しています`)
        suggestedActions.push('メッセージアーカイブまたはプラン升级を検討してください')
      }
    }

    // Simulated metrics (in production, get from monitoring system)
    const metrics = {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      storage: (usage.storage / (planLimits.maxStorage > 0 ? planLimits.maxStorage : 1000)) * 100,
      connections: usage.users * 2 // Approximate
    }

    return { recommendations, metrics, suggestedActions }
  }

  /**
   * Auto-scale tenant resources
   */
  async autoScale(tenantId: string): Promise<{
    scaled: boolean
    actions: string[]
    newLimits?: any
  }> {
    const recommendations = await this.getScalingRecommendations(tenantId)
    const actions: string[] = []
    let scaled = false

    // CPU scaling
    if (recommendations.metrics.cpu > SCALING_CONFIG.autoScaling.cpu.scaleUpThreshold) {
      actions.push('CPU リソースをスケールアップ')
      scaled = true
    } else if (recommendations.metrics.cpu < SCALING_CONFIG.autoScaling.cpu.scaleDownThreshold) {
      actions.push('CPU リソースをスケールダウン')
      scaled = true
    }

    // Memory scaling
    if (recommendations.metrics.memory > SCALING_CONFIG.autoScaling.memory.scaleUpThreshold) {
      actions.push('メモリリソースをスケールアップ')
      scaled = true
    } else if (recommendations.metrics.memory < SCALING_CONFIG.autoScaling.memory.scaleDownThreshold) {
      actions.push('メモリリソースをスケールダウン')
      scaled = true
    }

    return { scaled, actions }
  }

  /**
   * Private helper methods
   */
  private extractSubdomain(hostname: string): string | null {
    if (hostname === 'localhost' || hostname.includes('localhost')) {
      return null
    }

    const parts = hostname.split('.')
    if (parts.length >= 3) {
      return parts[0]
    }

    return null
  }

  private generateTenantId(): string {
    return 'tenant_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  private async createTenantSchema(tenant: TenantConfig): Promise<void> {
    // In production, create tenant-specific database schema
    console.log(`Creating schema for tenant: ${tenant.id}`)

    // This would involve creating schema, tables, indexes, etc.
    // For now, we just set the schema name
    tenant.database.schema = `tenant_${tenant.id.replace('tenant_', '')}`
  }

  private async initializeTenantResources(tenant: TenantConfig): Promise<void> {
    // Initialize tenant-specific resources like connections, cache, etc.
    console.log(`Initializing resources for tenant: ${tenant.id}`)
  }

  private mapDatabaseToTenant(data: any): TenantConfig {
    return {
      id: data.id,
      name: data.name,
      domain: data.domain,
      subdomain: data.subdomain,
      plan: data.plan,
      limits: data.limits,
      features: data.features,
      database: data.database,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      isActive: data.is_active
    }
  }
}

/**
 * Load balancing utilities
 */
export class LoadBalancer {
  private servers: Array<{ id: string; url: string; isHealthy: boolean; connections: number }> = []
  private currentIndex = 0

  addServer(id: string, url: string): void {
    this.servers.push({ id, url, isHealthy: true, connections: 0 })
  }

  getNextServer(): { id: string; url: string } | null {
    if (this.servers.length === 0) return null

    const healthyServers = this.servers.filter(s => s.isHealthy)
    if (healthyServers.length === 0) return null

    let selected: { id: string; url: string; isHealthy: boolean; connections: number }

    switch (SCALING_CONFIG.loadBalancing.algorithm) {
      case 'round-robin':
        selected = healthyServers[this.currentIndex % healthyServers.length]
        this.currentIndex++
        break

      case 'least-connections':
        selected = healthyServers.reduce((min, server) =>
          server.connections < min.connections ? server : min
        )
        break

      case 'ip-hash':
      default:
        selected = healthyServers[0]
        break
    }

    selected.connections++
    return { id: selected.id, url: selected.url }
  }

  releaseConnection(serverId: string): void {
    const server = this.servers.find(s => s.id === serverId)
    if (server && server.connections > 0) {
      server.connections--
    }
  }

  async performHealthChecks(): Promise<void> {
    for (const server of this.servers) {
      try {
        const response = await fetch(`${server.url}/health`, {
          method: 'GET',
          timeout: 5000
        } as any)
        server.isHealthy = response.ok
      } catch (error) {
        server.isHealthy = false
      }
    }
  }

  startHealthCheckMonitoring(): void {
    setInterval(() => {
      this.performHealthChecks()
    }, SCALING_CONFIG.loadBalancing.healthCheckInterval)
  }
}

// Export singleton instance
export const tenantManager = TenantManager.getInstance()
export const loadBalancer = new LoadBalancer()

// Export types and configuration
export type { TenantConfig, TenantUsage }
export { SCALING_CONFIG }