'use client'

// Dynamic rendering for monitoring features
export const dynamic = 'force-dynamic'

import React from 'react'
import { MonitoringDashboard } from '@/components/monitoring/monitoring-dashboard'
import { BarChart3 } from 'lucide-react'

export default function MonitoringPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                プロダクション監視システム
              </h1>
              <p className="text-gray-600">
                リアルタイム監視・ログ収集・パフォーマンス分析
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <MonitoringDashboard />
      </main>
    </div>
  )
}