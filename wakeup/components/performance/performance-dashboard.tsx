'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { usePerformanceMetrics } from '@/lib/performance/metrics-collector'
import { useMediaOptimizer } from '@/lib/performance/media-optimizer'
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  Timer,
  Zap,
  Wifi,
  WifiOff,
  Smartphone,
  Monitor,
  Gauge
} from 'lucide-react'

interface PerformanceMetrics {
  lcp?: number
  fid?: number
  cls?: number
  fcp?: number
  ttfb?: number
  memoryUsage?: number
  networkLatency?: number
  cacheHitRate?: number
  serviceWorkerActive?: boolean
}

interface RealTimeMetric {
  name: string
  value: number
  unit: string
  status: 'excellent' | 'good' | 'needs-improvement' | 'poor'
  threshold: { excellent: number; good: number; poor: number }
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({})
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [deviceInfo, setDeviceInfo] = useState<any>({})
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealTimeMetric[]>([])

  const metricsCollector = usePerformanceMetrics()
  const mediaOptimizer = useMediaOptimizer()

  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Initial metrics collection
    const currentMetrics = metricsCollector.getMetrics()
    setMetrics(currentMetrics)

    // Device information
    collectDeviceInfo()

    // Real-time metrics monitoring
    intervalRef.current = setInterval(updateRealtimeMetrics, 2000)

    // Online/offline status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Performance metrics listener
    const handleMetricRecorded = (event: CustomEvent) => {
      const { name, value } = event.detail
      updateMetricInState(name, value)
    }

    window.addEventListener('metric-recorded', handleMetricRecorded as EventListener)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('metric-recorded', handleMetricRecorded as EventListener)
    }
  }, [])

  const collectDeviceInfo = () => {
    const nav = navigator as any

    setDeviceInfo({
      userAgent: nav.userAgent,
      deviceMemory: nav.deviceMemory || 'Unknown',
      hardwareConcurrency: nav.hardwareConcurrency || 'Unknown',
      connectionType: nav.connection?.effectiveType || 'Unknown',
      cookieEnabled: nav.cookieEnabled,
      language: nav.language,
      platform: nav.platform,
      onLine: nav.onLine
    })
  }

  const updateRealtimeMetrics = () => {
    const currentMetrics = metricsCollector.getMetrics()

    const newRealtimeMetrics: RealTimeMetric[] = [
      {
        name: 'Largest Contentful Paint',
        value: currentMetrics.lcp || 0,
        unit: 'ms',
        status: getWebVitalStatus(currentMetrics.lcp, { excellent: 2500, good: 4000, poor: 6000 }),
        threshold: { excellent: 2500, good: 4000, poor: 6000 }
      },
      {
        name: 'First Input Delay',
        value: currentMetrics.fid || 0,
        unit: 'ms',
        status: getWebVitalStatus(currentMetrics.fid, { excellent: 100, good: 300, poor: 500 }),
        threshold: { excellent: 100, good: 300, poor: 500 }
      },
      {
        name: 'Cumulative Layout Shift',
        value: (currentMetrics.cls || 0) * 100,
        unit: '%',
        status: getWebVitalStatus((currentMetrics.cls || 0) * 100, { excellent: 10, good: 25, poor: 50 }),
        threshold: { excellent: 10, good: 25, poor: 50 }
      },
      {
        name: 'Memory Usage',
        value: Math.round((currentMetrics.memoryUsage || 0) / 1024 / 1024),
        unit: 'MB',
        status: getMemoryStatus(currentMetrics.memoryUsage || 0),
        threshold: { excellent: 50, good: 100, poor: 200 }
      },
      {
        name: 'Network Latency',
        value: currentMetrics.networkLatency || 0,
        unit: 'ms',
        status: getNetworkStatus(currentMetrics.networkLatency || 0),
        threshold: { excellent: 100, good: 300, poor: 1000 }
      },
      {
        name: 'Cache Hit Rate',
        value: Math.round((currentMetrics.cacheHitRate || 0) * 100),
        unit: '%',
        status: getCacheStatus((currentMetrics.cacheHitRate || 0) * 100),
        threshold: { excellent: 80, good: 60, poor: 40 }
      }
    ]

    setRealtimeMetrics(newRealtimeMetrics)
    setMetrics(currentMetrics)
  }

  const updateMetricInState = (name: string, value: number) => {
    setMetrics(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const getWebVitalStatus = (
    value: number = 0,
    thresholds: { excellent: number; good: number; poor: number }
  ): 'excellent' | 'good' | 'needs-improvement' | 'poor' => {
    if (value <= thresholds.excellent) return 'excellent'
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.poor) return 'needs-improvement'
    return 'poor'
  }

  const getMemoryStatus = (memoryUsage: number): 'excellent' | 'good' | 'needs-improvement' | 'poor' => {
    const mb = memoryUsage / 1024 / 1024
    if (mb < 50) return 'excellent'
    if (mb < 100) return 'good'
    if (mb < 200) return 'needs-improvement'
    return 'poor'
  }

  const getNetworkStatus = (latency: number): 'excellent' | 'good' | 'needs-improvement' | 'poor' => {
    if (latency < 100) return 'excellent'
    if (latency < 300) return 'good'
    if (latency < 1000) return 'needs-improvement'
    return 'poor'
  }

  const getCacheStatus = (hitRate: number): 'excellent' | 'good' | 'needs-improvement' | 'poor' => {
    if (hitRate >= 80) return 'excellent'
    if (hitRate >= 60) return 'good'
    if (hitRate >= 40) return 'needs-improvement'
    return 'poor'
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'needs-improvement': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'excellent': return 'default'
      case 'good': return 'secondary'
      case 'needs-improvement': return 'outline'
      case 'poor': return 'destructive'
      default: return 'outline'
    }
  }

  const calculateOverallScore = (): number => {
    if (realtimeMetrics.length === 0) return 0

    const statusScores = {
      excellent: 100,
      good: 75,
      'needs-improvement': 50,
      poor: 25
    }

    const totalScore = realtimeMetrics.reduce((sum, metric) => {
      return sum + statusScores[metric.status]
    }, 0)

    return Math.round(totalScore / realtimeMetrics.length)
  }

  const supportedFormats = mediaOptimizer.getSupportedFormats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">パフォーマンス監視</h2>
          <p className="text-gray-600">リアルタイムのアプリケーション性能指標</p>
        </div>

        <div className="flex items-center space-x-2">
          {isOnline ? (
            <Badge variant="default" className="flex items-center space-x-1">
              <Wifi className="h-3 w-3" />
              <span>オンライン</span>
            </Badge>
          ) : (
            <Badge variant="destructive" className="flex items-center space-x-1">
              <WifiOff className="h-3 w-3" />
              <span>オフライン</span>
            </Badge>
          )}

          {metrics.serviceWorkerActive && (
            <Badge variant="outline">SW有効</Badge>
          )}
        </div>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="h-5 w-5" />
            <span>総合パフォーマンススコア</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="text-4xl font-bold">
              {calculateOverallScore()}
            </div>
            <div className="flex-1">
              <Progress value={calculateOverallScore()} className="h-3" />
            </div>
            <div className="text-sm text-gray-600">
              /100点
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {realtimeMetrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{metric.name}</CardTitle>
                <Badge variant={getStatusBadgeVariant(metric.status)}>
                  {metric.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {metric.value.toFixed(metric.name.includes('Layout') ? 2 : 0)} {metric.unit}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>優秀</span>
                    <span>良好</span>
                    <span>改善必要</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full relative">
                    <div
                      className="absolute h-2 bg-green-500 rounded-l-full"
                      style={{ width: `${(metric.threshold.excellent / (metric.threshold.poor * 1.2)) * 100}%` }}
                    />
                    <div
                      className="absolute h-2 bg-yellow-500"
                      style={{
                        left: `${(metric.threshold.excellent / (metric.threshold.poor * 1.2)) * 100}%`,
                        width: `${((metric.threshold.good - metric.threshold.excellent) / (metric.threshold.poor * 1.2)) * 100}%`
                      }}
                    />
                    <div
                      className="absolute h-2 bg-orange-500"
                      style={{
                        left: `${(metric.threshold.good / (metric.threshold.poor * 1.2)) * 100}%`,
                        width: `${((metric.threshold.poor - metric.threshold.good) / (metric.threshold.poor * 1.2)) * 100}%`
                      }}
                    />
                    <div
                      className="absolute w-1 h-3 bg-gray-800 rounded -top-0.5 transform -translate-x-0.5"
                      style={{ left: `${Math.min(95, (metric.value / (metric.threshold.poor * 1.2)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Information */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>デバイス情報</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">メモリ</span>
                <span>{deviceInfo.deviceMemory} GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">CPUコア数</span>
                <span>{deviceInfo.hardwareConcurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">接続タイプ</span>
                <span>{deviceInfo.connectionType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">プラットフォーム</span>
                <span>{deviceInfo.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">言語</span>
                <span>{deviceInfo.language}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>対応フォーマット</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">音声フォーマット</h4>
                <div className="flex flex-wrap gap-1">
                  {supportedFormats.audio.map(format => (
                    <Badge key={format} variant="outline">{format}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">画像フォーマット</h4>
                <div className="flex flex-wrap gap-1">
                  {supportedFormats.image.map(format => (
                    <Badge key={format} variant="outline">{format}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>最適化アクション</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(registrations => {
                      registrations.forEach(registration => registration.update())
                    })
                  }
                }}
              >
                <Zap className="h-4 w-4 mr-2" />
                SW更新
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if ('caches' in window) {
                    caches.keys().then(cacheNames => {
                      cacheNames.forEach(cacheName => {
                        caches.delete(cacheName)
                      })
                    })
                  }
                }}
              >
                <HardDrive className="h-4 w-4 mr-2" />
                キャッシュクリア
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <Timer className="h-4 w-4 mr-2" />
                リロード
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const metrics = metricsCollector.getMetrics()
                  const dataStr = JSON.stringify(metrics, null, 2)
                  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

                  const exportFileDefaultName = `performance-metrics-${Date.now()}.json`

                  const linkElement = document.createElement('a')
                  linkElement.setAttribute('href', dataUri)
                  linkElement.setAttribute('download', exportFileDefaultName)
                  linkElement.click()
                }}
              >
                <Network className="h-4 w-4 mr-2" />
                エクスポート
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}