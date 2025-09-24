'use client'

// Dynamic rendering for client-side features
export const dynamic = 'force-dynamic'

import React from 'react'
import { SecurityDashboard } from '@/components/security/security-dashboard'
import { Shield } from 'lucide-react'

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                セキュリティ・プライバシー管理
              </h1>
              <p className="text-gray-600">
                エンドツーエンド暗号化とGDPR/CCPA準拠のプライバシー保護
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <SecurityDashboard />
      </main>
    </div>
  )
}