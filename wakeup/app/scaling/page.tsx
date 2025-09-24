'use client'

// Dynamic rendering for scaling features
export const dynamic = 'force-dynamic'

import React from 'react'
import { TenantDashboard } from '@/components/scaling/tenant-dashboard'
import { TrendingUp } from 'lucide-react'

export default function ScalingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                マルチテナント・スケーリング管理
              </h1>
              <p className="text-gray-600">
                自動スケーリング・リソース管理・パフォーマンス最適化
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <TenantDashboard />
      </main>
    </div>
  )
}