'use client'

import React, { useEffect } from 'react'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import { MetricsCollector } from '@/lib/performance/metrics-collector'
import { Activity } from 'lucide-react'

export default function PerformancePage() {
  useEffect(() => {
    // Start metrics collection when page loads (only on client side)
    if (typeof window !== 'undefined') {
      const collector = MetricsCollector.getInstance()
      collector.startCollection()

      return () => {
        collector.stopCollection()
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <Activity className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                パフォーマンス監視
              </h1>
              <p className="text-gray-600">
                リアルタイムアプリケーション性能監視ダッシュボード
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <PerformanceDashboard />
      </main>
    </div>
  )
}