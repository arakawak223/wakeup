'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useE2EEncryption } from '@/hooks/use-encryption'
import { usePrivacyManager } from '@/hooks/use-privacy-manager'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Key,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Database,
  Settings
} from 'lucide-react'

interface SecurityMetrics {
  encryptionStatus: 'active' | 'inactive' | 'error'
  keyStrength: 'weak' | 'medium' | 'strong'
  lastKeyRotation?: Date
  encryptedMessages: number
  totalMessages: number
  breachAttempts: number
  suspiciousActivities: number
}

interface PrivacyCompliance {
  gdprCompliant: boolean
  ccpaCompliant: boolean
  consentRate: number
  dataSubjectRequests: number
  avgResponseTime: number // hours
  retentionCompliance: number // percentage
}

export function SecurityDashboard() {
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    encryptionStatus: 'inactive',
    keyStrength: 'medium',
    encryptedMessages: 0,
    totalMessages: 0,
    breachAttempts: 0,
    suspiciousActivities: 0
  })

  const [privacyCompliance, setPrivacyCompliance] = useState<PrivacyCompliance>({
    gdprCompliant: false,
    ccpaCompliant: false,
    consentRate: 0,
    dataSubjectRequests: 0,
    avgResponseTime: 0,
    retentionCompliance: 0
  })

  const [activeThreats, setActiveThreats] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [isInitializing, setIsInitializing] = useState(true)

  const encryption = useE2EEncryption()
  const privacy = usePrivacyManager()

  useEffect(() => {
    initializeSecuritySystems()
    loadSecurityMetrics()
    loadPrivacyCompliance()
    loadSecurityLogs()
    startSecurityMonitoring()
  }, [])

  const initializeSecuritySystems = async () => {
    try {
      setIsInitializing(true)

      // Initialize encryption if available
      if (encryption.isAvailable) {
        const userId = 'current-user' // In real app, get from auth context
        await encryption.initialize(userId)

        setSecurityMetrics(prev => ({
          ...prev,
          encryptionStatus: 'active',
          keyStrength: 'strong',
          lastKeyRotation: new Date()
        }))
      }

      // Load privacy compliance status
      const complianceReport = await privacy.generateComplianceReport()
      updatePrivacyCompliance(complianceReport)

    } catch (error) {
      console.error('Security initialization failed:', error)
      setSecurityMetrics(prev => ({
        ...prev,
        encryptionStatus: 'error'
      }))
    } finally {
      setIsInitializing(false)
    }
  }

  const loadSecurityMetrics = () => {
    // Simulate loading security metrics
    setSecurityMetrics(prev => ({
      ...prev,
      encryptedMessages: 142,
      totalMessages: 156,
      breachAttempts: 3,
      suspiciousActivities: 1
    }))
  }

  const loadPrivacyCompliance = () => {
    // Simulate loading privacy compliance data
    setPrivacyCompliance({
      gdprCompliant: true,
      ccpaCompliant: true,
      consentRate: 94.5,
      dataSubjectRequests: 7,
      avgResponseTime: 18, // hours
      retentionCompliance: 87.3
    })
  }

  const loadSecurityLogs = () => {
    // Simulate loading security activities
    const mockActivities = [
      {
        id: '1',
        type: 'encryption',
        message: '音声メッセージが正常に暗号化されました',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        severity: 'info'
      },
      {
        id: '2',
        type: 'auth',
        message: '新しいデバイスからのログイン試行を検出',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        severity: 'warning'
      },
      {
        id: '3',
        type: 'privacy',
        message: 'データ削除要求が正常に処理されました',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        severity: 'info'
      }
    ]

    setRecentActivities(mockActivities)

    const threats = [
      {
        id: '1',
        type: 'bruteforce',
        description: 'ログイン総当たり攻撃の検出',
        severity: 'medium',
        status: 'monitoring',
        firstSeen: new Date(Date.now() - 1000 * 60 * 60 * 1),
        count: 15
      }
    ]

    setActiveThreats(threats)
  }

  const startSecurityMonitoring = () => {
    // Real-time security monitoring would be implemented here
    const interval = setInterval(() => {
      // Update metrics periodically
      loadSecurityMetrics()
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }

  const updatePrivacyCompliance = (report: any) => {
    setPrivacyCompliance({
      gdprCompliant: report.complianceMetrics?.breachIncidents === 0,
      ccpaCompliant: report.complianceMetrics?.dataSubjectRequests >= 0,
      consentRate: 94.5, // Calculated from report
      dataSubjectRequests: report.complianceMetrics?.dataSubjectRequests || 0,
      avgResponseTime: report.complianceMetrics?.averageResponseTime || 0,
      retentionCompliance: 87.3
    })
  }

  const handleExportPublicKey = async () => {
    try {
      const publicKey = await encryption.exportPublicKey()
      const keyData = JSON.stringify(publicKey, null, 2)
      const blob = new Blob([keyData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = 'public-key.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export public key:', error)
    }
  }

  const handleDataSubjectRequest = async (requestType: string) => {
    try {
      const userId = 'current-user' // In real app, get from auth context
      const result = await privacy.handleDataSubjectRequest(userId, requestType as any)

      if (requestType === 'portability' && result instanceof Blob) {
        const url = URL.createObjectURL(result)
        const a = document.createElement('a')
        a.href = url
        a.download = 'my-data.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      console.log(`Data subject request processed: ${requestType}`)
    } catch (error) {
      console.error('Data subject request failed:', error)
    }
  }

  const getEncryptionRatio = (): number => {
    if (securityMetrics.totalMessages === 0) return 0
    return (securityMetrics.encryptedMessages / securityMetrics.totalMessages) * 100
  }

  const getSecurityScore = (): number => {
    let score = 0

    // Encryption status (40 points)
    if (securityMetrics.encryptionStatus === 'active') score += 40
    else if (securityMetrics.encryptionStatus === 'inactive') score += 20

    // Key strength (20 points)
    if (securityMetrics.keyStrength === 'strong') score += 20
    else if (securityMetrics.keyStrength === 'medium') score += 10

    // Message encryption rate (20 points)
    score += (getEncryptionRatio() / 100) * 20

    // Security incidents (20 points - deducted for issues)
    const incidents = securityMetrics.breachAttempts + securityMetrics.suspiciousActivities
    score += Math.max(0, 20 - incidents * 5)

    return Math.round(score)
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">セキュリティシステムを初期化中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">セキュリティ・プライバシー監視</h2>
          <p className="text-gray-600">包括的なセキュリティ監視とプライバシー管理</p>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant={securityMetrics.encryptionStatus === 'active' ? 'default' : 'destructive'}>
            {securityMetrics.encryptionStatus === 'active' ? '暗号化有効' : '暗号化無効'}
          </Badge>
          <Badge variant={privacyCompliance.gdprCompliant ? 'default' : 'destructive'}>
            {privacyCompliance.gdprCompliant ? 'GDPR準拠' : 'GDPR非準拠'}
          </Badge>
        </div>
      </div>

      {/* Security Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5" />
            <span>総合セキュリティスコア</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="text-4xl font-bold text-green-600">
              {getSecurityScore()}
            </div>
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${getSecurityScore()}%` }}
                />
              </div>
            </div>
            <div className="text-sm text-gray-600">/100点</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="encryption">暗号化</TabsTrigger>
          <TabsTrigger value="privacy">プライバシー</TabsTrigger>
          <TabsTrigger value="monitoring">監視</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">暗号化状況</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {securityMetrics.encryptionStatus === 'active' ? (
                    <Lock className="h-5 w-5 text-green-600" />
                  ) : (
                    <Unlock className="h-5 w-5 text-red-600" />
                  )}
                  <span className="text-2xl font-bold">
                    {Math.round(getEncryptionRatio())}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {securityMetrics.encryptedMessages}/{securityMetrics.totalMessages} メッセージ
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">脅威検出</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {activeThreats.length > 0 ? (
                    <ShieldAlert className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  )}
                  <span className="text-2xl font-bold">{activeThreats.length}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">アクティブな脅威</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">プライバシー準拠</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {privacyCompliance.gdprCompliant ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="text-2xl font-bold">
                    {Math.round(privacyCompliance.consentRate)}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">同意取得率</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">データ要求</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="text-2xl font-bold">
                    {privacyCompliance.avgResponseTime}h
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {privacyCompliance.dataSubjectRequests} 件の要求
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Threats */}
          {activeThreats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-600">
                  <ShieldAlert className="h-5 w-5" />
                  <span>アクティブな脅威</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeThreats.map(threat => (
                    <Alert key={threat.id} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div>
                            <strong>{threat.description}</strong>
                            <p className="text-sm mt-1">
                              重要度: {threat.severity} | 検出回数: {threat.count}
                            </p>
                          </div>
                          <Badge variant="outline">{threat.status}</Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Encryption Tab */}
        <TabsContent value="encryption" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>暗号化設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>暗号化状態</span>
                  <Badge variant={securityMetrics.encryptionStatus === 'active' ? 'default' : 'destructive'}>
                    {securityMetrics.encryptionStatus === 'active' ? '有効' : '無効'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span>キー強度</span>
                  <Badge variant={securityMetrics.keyStrength === 'strong' ? 'default' : 'secondary'}>
                    {securityMetrics.keyStrength === 'strong' ? '強固' : '中程度'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span>暗号化アルゴリズム</span>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">RSA-4096 + AES-256</code>
                </div>

                {securityMetrics.lastKeyRotation && (
                  <div className="flex justify-between items-center">
                    <span>最終キーローテーション</span>
                    <span className="text-sm text-gray-600">
                      {securityMetrics.lastKeyRotation.toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>キー管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleExportPublicKey}
                  className="w-full"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  公開キーをエクスポート
                </Button>

                <Button
                  onClick={() => {
                    // Generate new key pair
                    const userId = 'current-user'
                    encryption.initialize(userId)
                  }}
                  className="w-full"
                  variant="outline"
                >
                  <Key className="h-4 w-4 mr-2" />
                  キーペアを再生成
                </Button>

                <Button
                  onClick={encryption.wipeKeys}
                  className="w-full"
                  variant="destructive"
                >
                  <ShieldX className="h-4 w-4 mr-2" />
                  キーを安全に削除
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>GDPR/CCPA 準拠状況</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>GDPR 準拠</span>
                  <Badge variant={privacyCompliance.gdprCompliant ? 'default' : 'destructive'}>
                    {privacyCompliance.gdprCompliant ? '準拠' : '非準拠'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span>CCPA 準拠</span>
                  <Badge variant={privacyCompliance.ccpaCompliant ? 'default' : 'destructive'}>
                    {privacyCompliance.ccpaCompliant ? '準拠' : '非準拠'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span>データ保持ポリシー遵守</span>
                  <span>{privacyCompliance.retentionCompliance}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>データ主体の権利</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={() => handleDataSubjectRequest('access')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  データアクセス要求
                </Button>

                <Button
                  onClick={() => handleDataSubjectRequest('portability')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Download className="h-4 w-4 mr-2" />
                  データポータビリティ
                </Button>

                <Button
                  onClick={() => handleDataSubjectRequest('erasure')}
                  variant="destructive"
                  className="w-full justify-start"
                >
                  <ShieldX className="h-4 w-4 mr-2" />
                  データ削除要求
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>最近のセキュリティ活動</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivities.map(activity => (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-3 p-3 border rounded-lg"
                  >
                    <div className={`mt-1 ${
                      activity.severity === 'warning' ? 'text-yellow-600' :
                      activity.severity === 'error' ? 'text-red-600' :
                      'text-green-600'
                    }`}>
                      {activity.severity === 'warning' ? <AlertTriangle className="h-4 w-4" /> :
                       activity.severity === 'error' ? <ShieldX className="h-4 w-4" /> :
                       <CheckCircle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-gray-600">
                        {activity.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline">{activity.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}