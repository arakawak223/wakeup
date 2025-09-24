/**
 * Privacy Manager for GDPR/CCPA Compliance
 * GDPR/CCPA準拠のプライバシー管理システム
 */

interface UserConsent {
  userId: string
  consentId: string
  consentType: 'essential' | 'analytics' | 'marketing' | 'personalization'
  granted: boolean
  timestamp: Date
  ipAddress?: string
  userAgent?: string
  version: string
}

interface DataProcessingPurpose {
  purpose: string
  description: string
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests'
  dataTypes: string[]
  retentionPeriod: number // days
  required: boolean
}

interface PersonalDataRecord {
  dataId: string
  userId: string
  dataType: 'audio' | 'metadata' | 'analytics' | 'profile' | 'usage'
  content: any
  purposes: string[]
  createdAt: Date
  lastAccessedAt: Date
  expiresAt?: Date
  encrypted: boolean
  location?: string
}

interface PrivacySettings {
  userId: string
  dataMinimization: boolean
  automaticDeletion: boolean
  anonymization: boolean
  dataPortability: boolean
  restrictProcessing: boolean
  marketingOptOut: boolean
  analyticsOptOut: boolean
  shareWithThirdParties: boolean
  retentionOverride?: number // days
}

export class PrivacyManager {
  private static instance: PrivacyManager
  private dataProcessingPurposes: DataProcessingPurpose[] = [
    {
      purpose: 'voice_messaging',
      description: '音声メッセージの送受信と保存',
      legalBasis: 'contract',
      dataTypes: ['audio', 'metadata'],
      retentionPeriod: 365,
      required: true
    },
    {
      purpose: 'collaboration',
      description: 'リアルタイムコラボレーション機能',
      legalBasis: 'consent',
      dataTypes: ['audio', 'metadata', 'usage'],
      retentionPeriod: 90,
      required: false
    },
    {
      purpose: 'performance_analytics',
      description: 'アプリケーション性能の分析と改善',
      legalBasis: 'legitimate_interests',
      dataTypes: ['analytics', 'usage'],
      retentionPeriod: 730,
      required: false
    },
    {
      purpose: 'accessibility_support',
      description: 'アクセシビリティ機能の提供',
      legalBasis: 'consent',
      dataTypes: ['profile', 'usage'],
      retentionPeriod: 365,
      required: false
    }
  ]

  private constructor() {}

  static getInstance(): PrivacyManager {
    if (!PrivacyManager.instance) {
      PrivacyManager.instance = new PrivacyManager()
    }
    return PrivacyManager.instance
  }

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    consentType: UserConsent['consentType'],
    granted: boolean,
    version: string = '1.0'
  ): Promise<string> {
    const consent: UserConsent = {
      userId,
      consentId: crypto.randomUUID(),
      consentType,
      granted,
      timestamp: new Date(),
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      version
    }

    await this.storeConsent(consent)

    // Update privacy settings based on consent
    await this.updatePrivacySettings(userId, consentType, granted)

    console.log(`[Privacy] Consent recorded: ${consentType} = ${granted}`)
    return consent.consentId
  }

  /**
   * Get user consent status
   */
  async getConsentStatus(userId: string): Promise<Map<string, UserConsent>> {
    const consents = await this.loadConsents(userId)
    const currentConsents = new Map<string, UserConsent>()

    // Get latest consent for each type
    consents.forEach(consent => {
      const existing = currentConsents.get(consent.consentType)
      if (!existing || existing.timestamp < consent.timestamp) {
        currentConsents.set(consent.consentType, consent)
      }
    })

    return currentConsents
  }

  /**
   * Check if processing is allowed for specific purpose
   */
  async canProcessData(userId: string, purpose: string): Promise<boolean> {
    const processingPurpose = this.dataProcessingPurposes.find(p => p.purpose === purpose)
    if (!processingPurpose) {
      console.warn(`[Privacy] Unknown processing purpose: ${purpose}`)
      return false
    }

    // Required purposes are always allowed
    if (processingPurpose.required) {
      return true
    }

    // Check based on legal basis
    switch (processingPurpose.legalBasis) {
      case 'consent':
        return await this.hasValidConsent(userId, purpose)

      case 'legitimate_interests':
        const privacySettings = await this.getPrivacySettings(userId)
        return !privacySettings?.restrictProcessing

      case 'contract':
      case 'legal_obligation':
      case 'vital_interests':
      case 'public_task':
        return true

      default:
        return false
    }
  }

  /**
   * Record personal data processing
   */
  async recordDataProcessing(
    userId: string,
    dataType: PersonalDataRecord['dataType'],
    content: any,
    purposes: string[],
    encrypted: boolean = false,
    location?: string
  ): Promise<string> {
    const record: PersonalDataRecord = {
      dataId: crypto.randomUUID(),
      userId,
      dataType,
      content,
      purposes,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      encrypted,
      location
    }

    // Set expiration based on purposes
    const maxRetentionDays = Math.max(
      ...purposes.map(purpose => {
        const processingPurpose = this.dataProcessingPurposes.find(p => p.purpose === purpose)
        return processingPurpose?.retentionPeriod || 30
      })
    )

    record.expiresAt = new Date(Date.now() + maxRetentionDays * 24 * 60 * 60 * 1000)

    await this.storeDataRecord(record)
    return record.dataId
  }

  /**
   * Handle data subject rights requests
   */
  async handleDataSubjectRequest(
    userId: string,
    requestType: 'access' | 'portability' | 'rectification' | 'erasure' | 'restrict' | 'object'
  ): Promise<any> {
    console.log(`[Privacy] Processing ${requestType} request for user: ${userId}`)

    switch (requestType) {
      case 'access':
        return await this.handleAccessRequest(userId)

      case 'portability':
        return await this.handlePortabilityRequest(userId)

      case 'rectification':
        return await this.handleRectificationRequest(userId)

      case 'erasure':
        return await this.handleErasureRequest(userId)

      case 'restrict':
        return await this.handleRestrictionRequest(userId)

      case 'object':
        return await this.handleObjectionRequest(userId)

      default:
        throw new Error(`Unknown request type: ${requestType}`)
    }
  }

  /**
   * Handle data access request (Article 15)
   */
  private async handleAccessRequest(userId: string): Promise<any> {
    const [personalData, consents, privacySettings] = await Promise.all([
      this.loadUserData(userId),
      this.loadConsents(userId),
      this.getPrivacySettings(userId)
    ])

    return {
      personalData: personalData.map(record => ({
        dataId: record.dataId,
        dataType: record.dataType,
        purposes: record.purposes,
        createdAt: record.createdAt,
        lastAccessedAt: record.lastAccessedAt,
        expiresAt: record.expiresAt,
        location: record.location
      })),
      consents,
      privacySettings,
      processingPurposes: this.dataProcessingPurposes,
      generatedAt: new Date()
    }
  }

  /**
   * Handle data portability request (Article 20)
   */
  private async handlePortabilityRequest(userId: string): Promise<Blob> {
    const userData = await this.handleAccessRequest(userId)
    const jsonData = JSON.stringify(userData, null, 2)

    return new Blob([jsonData], { type: 'application/json' })
  }

  /**
   * Handle rectification request (Article 16)
   */
  private async handleRectificationRequest(userId: string): Promise<void> {
    // Implementation would depend on specific data correction needs
    console.log(`[Privacy] Rectification request processed for user: ${userId}`)
  }

  /**
   * Handle erasure request (Article 17)
   */
  private async handleErasureRequest(userId: string): Promise<void> {
    // Delete all personal data
    await Promise.all([
      this.deleteUserData(userId),
      this.deleteConsents(userId),
      this.deletePrivacySettings(userId)
    ])

    // Create tombstone record for audit
    await this.createTombstoneRecord(userId)

    console.log(`[Privacy] Erasure completed for user: ${userId}`)
  }

  /**
   * Handle processing restriction request (Article 18)
   */
  private async handleRestrictionRequest(userId: string): Promise<void> {
    const settings = await this.getPrivacySettings(userId) || this.getDefaultPrivacySettings(userId)
    settings.restrictProcessing = true

    await this.savePrivacySettings(settings)
    console.log(`[Privacy] Processing restricted for user: ${userId}`)
  }

  /**
   * Handle objection request (Article 21)
   */
  private async handleObjectionRequest(userId: string): Promise<void> {
    const settings = await this.getPrivacySettings(userId) || this.getDefaultPrivacySettings(userId)
    settings.marketingOptOut = true
    settings.analyticsOptOut = true

    await this.savePrivacySettings(settings)
    console.log(`[Privacy] Objection processed for user: ${userId}`)
  }

  /**
   * Automatic data cleanup based on retention policies
   */
  async performDataCleanup(): Promise<{
    deletedRecords: number
    anonymizedRecords: number
  }> {
    const now = new Date()
    let deletedRecords = 0
    let anonymizedRecords = 0

    // Get all expired data records
    const expiredRecords = await this.getExpiredDataRecords(now)

    for (const record of expiredRecords) {
      const privacySettings = await this.getPrivacySettings(record.userId)

      if (privacySettings?.automaticDeletion) {
        await this.deleteDataRecord(record.dataId)
        deletedRecords++
      } else if (privacySettings?.anonymization) {
        await this.anonymizeDataRecord(record.dataId)
        anonymizedRecords++
      }
    }

    console.log(`[Privacy] Cleanup completed: ${deletedRecords} deleted, ${anonymizedRecords} anonymized`)

    return { deletedRecords, anonymizedRecords }
  }

  /**
   * Generate privacy compliance report
   */
  async generateComplianceReport(): Promise<any> {
    const [totalUsers, totalRecords, consentStats] = await Promise.all([
      this.getTotalUsers(),
      this.getTotalDataRecords(),
      this.getConsentStatistics()
    ])

    return {
      generatedAt: new Date(),
      userStatistics: {
        totalUsers,
        activeUsers: await this.getActiveUsers(),
        usersWithConsent: consentStats.withConsent,
        usersWithoutConsent: consentStats.withoutConsent
      },
      dataStatistics: {
        totalRecords,
        recordsByType: await this.getRecordsByType(),
        encryptedRecords: await this.getEncryptedRecordCount(),
        expiredRecords: await this.getExpiredRecordCount()
      },
      complianceMetrics: {
        dataSubjectRequests: await this.getDataSubjectRequestCount(),
        averageResponseTime: await this.getAverageResponseTime(),
        breachIncidents: await this.getBreachIncidentCount()
      },
      recommendations: await this.generateRecommendations()
    }
  }

  /**
   * Check privacy settings validity
   */
  async validatePrivacySettings(userId: string): Promise<{
    valid: boolean
    warnings: string[]
    recommendations: string[]
  }> {
    const settings = await this.getPrivacySettings(userId)
    const warnings: string[] = []
    const recommendations: string[] = []

    if (!settings) {
      warnings.push('プライバシー設定が未設定です')
      recommendations.push('プライバシー設定を構成してください')
    }

    if (settings && !settings.dataMinimization) {
      recommendations.push('データ最小化を有効にすることを推奨します')
    }

    if (settings && !settings.automaticDeletion) {
      recommendations.push('自動削除機能を有効にすることを推奨します')
    }

    return {
      valid: warnings.length === 0,
      warnings,
      recommendations
    }
  }

  // Private helper methods
  private async hasValidConsent(userId: string, purpose: string): Promise<boolean> {
    const consents = await this.getConsentStatus(userId)

    // Check for purpose-specific consent or general consent
    const purposeConsent = consents.get(purpose as any)
    const generalConsent = consents.get('essential')

    return (purposeConsent?.granted || generalConsent?.granted) === true
  }

  private async getClientIP(): Promise<string | undefined> {
    // In production, this would come from server-side
    return undefined
  }

  private getDefaultPrivacySettings(userId: string): PrivacySettings {
    return {
      userId,
      dataMinimization: true,
      automaticDeletion: true,
      anonymization: true,
      dataPortability: true,
      restrictProcessing: false,
      marketingOptOut: false,
      analyticsOptOut: false,
      shareWithThirdParties: false
    }
  }

  private async updatePrivacySettings(
    userId: string,
    consentType: UserConsent['consentType'],
    granted: boolean
  ): Promise<void> {
    const settings = await this.getPrivacySettings(userId) || this.getDefaultPrivacySettings(userId)

    switch (consentType) {
      case 'analytics':
        settings.analyticsOptOut = !granted
        break
      case 'marketing':
        settings.marketingOptOut = !granted
        break
    }

    await this.savePrivacySettings(settings)
  }

  // IndexedDB operations (simplified implementations)
  private async storeConsent(consent: UserConsent): Promise<void> {
    // Implementation would store in IndexedDB
    console.log('[Privacy] Storing consent:', consent.consentId)
  }

  private async loadConsents(userId: string): Promise<UserConsent[]> {
    // Implementation would load from IndexedDB
    return []
  }

  private async storeDataRecord(record: PersonalDataRecord): Promise<void> {
    // Implementation would store in IndexedDB
    console.log('[Privacy] Storing data record:', record.dataId)
  }

  private async loadUserData(userId: string): Promise<PersonalDataRecord[]> {
    // Implementation would load from IndexedDB
    return []
  }

  private async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    // Implementation would load from IndexedDB
    return null
  }

  private async savePrivacySettings(settings: PrivacySettings): Promise<void> {
    // Implementation would save to IndexedDB
    console.log('[Privacy] Saving privacy settings for user:', settings.userId)
  }

  private async deleteUserData(userId: string): Promise<void> {
    // Implementation would delete from IndexedDB
    console.log('[Privacy] Deleting user data:', userId)
  }

  private async deleteConsents(userId: string): Promise<void> {
    // Implementation would delete from IndexedDB
    console.log('[Privacy] Deleting consents:', userId)
  }

  private async deletePrivacySettings(userId: string): Promise<void> {
    // Implementation would delete from IndexedDB
    console.log('[Privacy] Deleting privacy settings:', userId)
  }

  private async createTombstoneRecord(userId: string): Promise<void> {
    // Implementation would create tombstone record
    console.log('[Privacy] Creating tombstone record:', userId)
  }

  private async getExpiredDataRecords(now: Date): Promise<PersonalDataRecord[]> {
    // Implementation would query IndexedDB
    return []
  }

  private async deleteDataRecord(dataId: string): Promise<void> {
    // Implementation would delete from IndexedDB
    console.log('[Privacy] Deleting data record:', dataId)
  }

  private async anonymizeDataRecord(dataId: string): Promise<void> {
    // Implementation would anonymize record
    console.log('[Privacy] Anonymizing data record:', dataId)
  }

  // Statistics methods (simplified)
  private async getTotalUsers(): Promise<number> { return 0 }
  private async getTotalDataRecords(): Promise<number> { return 0 }
  private async getConsentStatistics(): Promise<any> { return { withConsent: 0, withoutConsent: 0 } }
  private async getActiveUsers(): Promise<number> { return 0 }
  private async getRecordsByType(): Promise<any> { return {} }
  private async getEncryptedRecordCount(): Promise<number> { return 0 }
  private async getExpiredRecordCount(): Promise<number> { return 0 }
  private async getDataSubjectRequestCount(): Promise<number> { return 0 }
  private async getAverageResponseTime(): Promise<number> { return 0 }
  private async getBreachIncidentCount(): Promise<number> { return 0 }
  private async generateRecommendations(): Promise<string[]> { return [] }
}

// React Hook for privacy management
export function usePrivacyManager() {
  const privacy = PrivacyManager.getInstance()

  return {
    recordConsent: (userId: string, consentType: UserConsent['consentType'], granted: boolean, version?: string) =>
      privacy.recordConsent(userId, consentType, granted, version),
    getConsentStatus: (userId: string) => privacy.getConsentStatus(userId),
    canProcessData: (userId: string, purpose: string) => privacy.canProcessData(userId, purpose),
    recordDataProcessing: (userId: string, dataType: PersonalDataRecord['dataType'], content: any, purposes: string[], encrypted?: boolean, location?: string) =>
      privacy.recordDataProcessing(userId, dataType, content, purposes, encrypted, location),
    handleDataSubjectRequest: (userId: string, requestType: 'access' | 'portability' | 'rectification' | 'erasure' | 'restrict' | 'object') =>
      privacy.handleDataSubjectRequest(userId, requestType),
    validatePrivacySettings: (userId: string) => privacy.validatePrivacySettings(userId),
    generateComplianceReport: () => privacy.generateComplianceReport()
  }
}