'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, AlertTriangle, Shield, Users, TrendingUp } from 'lucide-react'
import { productionMonitor } from '@/lib/monitoring/production-monitor'

interface SessionMetrics {
  sessionId: string
  eventCount: number
  errorCount: number
  warningCount: number
  lastActivity: number
}

export const MonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null)
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(false)

  useEffect(() => {
    setIsMonitoringEnabled(
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_ENABLE_MONITORING === 'true'
    )

    const updateMetrics = () => {
      const sessionMetrics = productionMonitor.getSessionMetrics()
      setMetrics(sessionMetrics)
    }

    updateMetrics()
    const interval = setInterval(updateMetrics, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const handleTestEvent = (type: string) => {
    switch (type) {
      case 'info':
        productionMonitor.logEvent({
          level: 'info',
          category: 'system',
          message: 'Test info event triggered',
          details: { testType: 'manual', timestamp: Date.now() }
        })
        break
      case 'warning':
        productionMonitor.logEvent({
          level: 'warn',
          category: 'performance',
          message: 'Test warning event triggered',
          details: { testType: 'manual', severity: 'medium' }
        })
        break
      case 'error':
        productionMonitor.logEvent({
          level: 'error',
          category: 'system',
          message: 'Test error event triggered',
          details: { testType: 'manual', error: 'Simulated error' }
        })
        break
      case 'user':
        productionMonitor.trackUserAction('test_action', {
          feature: 'monitoring_dashboard',
          action: 'button_click'
        })
        break
      case 'business':
        productionMonitor.trackBusinessEvent('test_conversion', {
          type: 'demo',
          value: 1
        })
        break
      case 'security':
        productionMonitor.trackSecurityEvent('test_security_event', 'low', {
          source: 'monitoring_dashboard',
          action: 'manual_test'
        })
        break
    }
  }

  if (!isMonitoringEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            監視システム
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              監視システムは現在無効です
            </p>
            <p className="text-sm text-gray-500">
              プロダクション環境または NEXT_PUBLIC_ENABLE_MONITORING=true で有効になります
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              セッション ID
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-mono break-all">
              {metrics?.sessionId.slice(0, 20)}...
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Activity className="h-4 w-4" />
              イベント数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {metrics?.eventCount || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              警告数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {metrics?.warningCount || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              エラー数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {metrics?.errorCount || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monitoring Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              監視機能
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-green-600 font-medium">パフォーマンス</div>
                <div className="text-lg font-bold text-green-800">✓</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-600 font-medium">エラー追跡</div>
                <div className="text-lg font-bold text-blue-800">✓</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-xs text-purple-600 font-medium">ユーザー行動</div>
                <div className="text-lg font-bold text-purple-800">✓</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-xs text-orange-600 font-medium">セキュリティ</div>
                <div className="text-lg font-bold text-orange-800">✓</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">自動監視項目:</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Core Web Vitals (LCP, FID, CLS)</li>
                <li>• JavaScript エラー・例外</li>
                <li>• Promise リジェクション</li>
                <li>• リソース読み込み時間</li>
                <li>• メモリ使用量</li>
                <li>• ユーザーセッション追跡</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              テストイベント
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestEvent('info')}
              >
                Info Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestEvent('warning')}
              >
                Warning Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestEvent('error')}
              >
                Error Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestEvent('user')}
              >
                User Action
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestEvent('business')}
              >
                Business Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestEvent('security')}
              >
                Security Event
              </Button>
            </div>

            <div className="text-xs text-gray-500">
              これらのボタンでテストイベントを生成できます。
              開発環境ではコンソールに、プロダクション環境では
              監視エンドポイントに送信されます。
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            リアルタイム状態
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-600">監視状態</div>
              <div className="text-lg font-bold text-green-600">アクティブ</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600">最終アクティビティ</div>
              <div className="text-sm">
                {metrics ? new Date(metrics.lastActivity).toLocaleTimeString() : '---'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600">データ送信</div>
              <div className="text-lg font-bold text-blue-600">30秒間隔</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}