'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building,
  Users,
  Database,
  Cpu,
  MemoryStick,
  HardDrive,
  TrendingUp,
  TrendingDown,
  Activity,
  Settings,
  AlertTriangle,
  CheckCircle,
  Server,
  Globe
} from 'lucide-react'
import { tenantManager, type TenantConfig, type TenantUsage } from '@/lib/scaling/tenant-manager'

interface TenantMetrics {
  cpu: number
  memory: number
  storage: number
  connections: number
  responseTime: number
  throughput: number
}

interface ScalingRecommendation {
  type: 'scale-up' | 'scale-down' | 'optimize' | 'warning'
  resource: 'cpu' | 'memory' | 'storage' | 'connections'
  message: string
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export const TenantDashboard: React.FC = () => {
  const [tenant, setTenant] = useState<TenantConfig | null>(null)
  const [usage, setUsage] = useState<TenantUsage | null>(null)
  const [metrics, setMetrics] = useState<TenantMetrics>({
    cpu: 0,
    memory: 0,
    storage: 0,
    connections: 0,
    responseTime: 0,
    throughput: 0
  })
  const [recommendations, setRecommendations] = useState<ScalingRecommendation[]>([])
  const [isAutoScalingEnabled, setIsAutoScalingEnabled] = useState(true)
  const [scalingActions, setScalingActions] = useState<string[]>([])

  useEffect(() => {
    loadTenantData()
    startMetricsMonitoring()
  }, [])

  const loadTenantData = async () => {
    try {
      // In production, get tenant ID from auth context or URL
      const mockTenantId = 'tenant_demo_12345'

      // Mock tenant data
      const mockTenant: TenantConfig = {
        id: mockTenantId,
        name: 'Demo Corporation',
        domain: 'demo.wakeup.app',
        subdomain: 'demo',
        plan: 'pro',
        limits: {
          maxUsers: 100,
          maxStorage: 10000, // 10GB
          maxMessages: 50000,
          maxVoiceMinutes: 1000
        },
        features: {
          encryption: true,
          analytics: true,
          customBranding: true,
          apiAccess: true,
          sso: false
        },
        database: {
          schema: 'tenant_demo_12345'
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date(),
        isActive: true
      }

      const mockUsage: TenantUsage = {
        tenantId: mockTenantId,
        users: 67,
        storage: 7800, // MB
        messages: 28500,
        voiceMinutes: 420,
        apiCalls: 12000,
        lastUpdated: new Date()
      }

      setTenant(mockTenant)
      setUsage(mockUsage)

      // Load scaling recommendations
      const scalingRec = await tenantManager.getScalingRecommendations(mockTenantId)

      const mockRecommendations: ScalingRecommendation[] = [
        {
          type: 'warning',
          resource: 'storage',
          message: 'ストレージ使用量が制限の78%に達しています',
          priority: 'medium'
        },
        {
          type: 'optimize',
          resource: 'memory',
          message: 'メモリ使用量を最適化できます',
          priority: 'low'
        }
      ]

      setRecommendations(mockRecommendations)

    } catch (error) {
      console.error('Failed to load tenant data:', error)
    }
  }

  const startMetricsMonitoring = () => {
    const updateMetrics = () => {
      // Simulate real-time metrics
      setMetrics({
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        storage: usage ? (usage.storage / (tenant?.limits.maxStorage || 1000)) * 100 : 0,
        connections: (usage?.users || 0) * 2,
        responseTime: 150 + Math.random() * 100,
        throughput: 1000 + Math.random() * 500
      })
    }

    updateMetrics()
    const interval = setInterval(updateMetrics, 5000)
    return () => clearInterval(interval)
  }

  const handleAutoScale = async () => {
    if (!tenant) return

    try {
      const result = await tenantManager.autoScale(tenant.id)
      setScalingActions(result.actions)

      if (result.scaled) {
        console.log('Auto-scaling executed:', result.actions)
      }
    } catch (error) {
      console.error('Auto-scaling failed:', error)
    }
  }

  const getUsagePercentage = (current: number, limit: number): number => {
    if (limit <= 0) return 0
    return Math.min((current / limit) * 100, 100)
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <CheckCircle className="h-4 w-4 text-blue-600" />
    }
  }

  if (!tenant || !usage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">テナント情報を読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tenant Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold">{tenant.name}</h2>
            <p className="text-gray-600">{tenant.domain}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={tenant.isActive ? 'default' : 'destructive'}>
            {tenant.isActive ? 'アクティブ' : '非アクティブ'}
          </Badge>
          <Badge variant="outline">
            {tenant.plan.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Resource Usage Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Users className="h-4 w-4" />
              ユーザー数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{usage.users}</span>
                <span className="text-sm text-gray-500">/ {tenant.limits.maxUsers}</span>
              </div>
              <Progress
                value={getUsagePercentage(usage.users, tenant.limits.maxUsers)}
                className="h-2"
              />
              <div className={`text-xs ${getUsageColor(getUsagePercentage(usage.users, tenant.limits.maxUsers))}`}>
                {getUsagePercentage(usage.users, tenant.limits.maxUsers).toFixed(1)}% 使用中
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <HardDrive className="h-4 w-4" />
              ストレージ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{(usage.storage / 1000).toFixed(1)}GB</span>
                <span className="text-sm text-gray-500">/ {(tenant.limits.maxStorage / 1000).toFixed(1)}GB</span>
              </div>
              <Progress
                value={getUsagePercentage(usage.storage, tenant.limits.maxStorage)}
                className="h-2"
              />
              <div className={`text-xs ${getUsageColor(getUsagePercentage(usage.storage, tenant.limits.maxStorage))}`}>
                {getUsagePercentage(usage.storage, tenant.limits.maxStorage).toFixed(1)}% 使用中
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Activity className="h-4 w-4" />
              メッセージ数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{usage.messages.toLocaleString()}</span>
                <span className="text-sm text-gray-500">/ {tenant.limits.maxMessages.toLocaleString()}</span>
              </div>
              <Progress
                value={getUsagePercentage(usage.messages, tenant.limits.maxMessages)}
                className="h-2"
              />
              <div className={`text-xs ${getUsageColor(getUsagePercentage(usage.messages, tenant.limits.maxMessages))}`}>
                {getUsagePercentage(usage.messages, tenant.limits.maxMessages).toFixed(1)}% 使用中
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Globe className="h-4 w-4" />
              音声時間
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{usage.voiceMinutes}</span>
                <span className="text-sm text-gray-500">/ {tenant.limits.maxVoiceMinutes} 分</span>
              </div>
              <Progress
                value={getUsagePercentage(usage.voiceMinutes, tenant.limits.maxVoiceMinutes)}
                className="h-2"
              />
              <div className={`text-xs ${getUsageColor(getUsagePercentage(usage.voiceMinutes, tenant.limits.maxVoiceMinutes))}`}>
                {getUsagePercentage(usage.voiceMinutes, tenant.limits.maxVoiceMinutes).toFixed(1)}% 使用中
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Metrics */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              パフォーマンスメトリクス
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>CPU使用率</span>
                <span>{metrics.cpu.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.cpu} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>メモリ使用率</span>
                <span>{metrics.memory.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.memory} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>アクティブ接続</span>
                <span>{metrics.connections}</span>
              </div>
              <div className="text-xs text-gray-500">
                平均応答時間: {metrics.responseTime.toFixed(0)}ms
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              スケーリング設定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">自動スケーリング</span>
              <Button
                variant={isAutoScalingEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsAutoScalingEnabled(!isAutoScalingEnabled)}
              >
                {isAutoScalingEnabled ? '有効' : '無効'}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-600">
                CPU閾値: スケールアップ 80% / スケールダウン 30%
              </div>
              <div className="text-xs text-gray-600">
                メモリ閾値: スケールアップ 85% / スケールダウン 40%
              </div>
            </div>

            <Button
              onClick={handleAutoScale}
              className="w-full"
              variant="outline"
            >
              手動スケーリング実行
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              インフラ状態
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">データベース</span>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">ロードバランサー</span>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">キャッシュ</span>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">ストレージ</span>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scaling Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              スケーリング推奨事項
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <Alert key={index}>
                  {getPriorityIcon(rec.priority)}
                  <AlertDescription className="flex justify-between items-center">
                    <div>
                      <strong className="capitalize">{rec.resource}</strong>: {rec.message}
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {rec.priority}
                    </Badge>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scaling Actions */}
      {scalingActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              最近のスケーリングアクション
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scalingActions.map((action, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{action}</span>
                  <Badge variant="outline" className="ml-auto">
                    実行済み
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenant Features */}
      <Card>
        <CardHeader>
          <CardTitle>テナント機能設定</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">有効な機能</h4>
              <div className="space-y-2">
                {Object.entries(tenant.features).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center justify-between">
                    <span className="text-sm capitalize">
                      {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                    <Badge variant={enabled ? 'default' : 'secondary'}>
                      {enabled ? '有効' : '無効'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">データベース設定</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>スキーマ: {tenant.database.schema}</div>
                <div>作成日: {tenant.createdAt.toLocaleDateString()}</div>
                <div>最終更新: {tenant.updatedAt.toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}