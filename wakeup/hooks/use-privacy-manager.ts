'use client'

import { useState, useEffect } from 'react'

interface PrivacySettings {
  dataRetention: number
  shareAnalytics: boolean
  thirdPartyAccess: boolean
  locationTracking: boolean
  voiceDataStorage: boolean
}

interface PrivacyHook {
  isAvailable: boolean
  settings: PrivacySettings
  updateSettings: (newSettings: Partial<PrivacySettings>) => Promise<void>
  exportData: () => Promise<Blob | null>
  deleteAllData: () => Promise<boolean>
  getDataUsage: () => Promise<any>
  error: string | null
}

export function usePrivacyManager(): PrivacyHook {
  const [isAvailable, setIsAvailable] = useState(false)
  const [settings, setSettings] = useState<PrivacySettings>({
    dataRetention: 365,
    shareAnalytics: false,
    thirdPartyAccess: false,
    locationTracking: false,
    voiceDataStorage: true
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // クライアントサイドでのみ利用可能性をチェック
    if (typeof window !== 'undefined') {
      setIsAvailable(true)
      loadSettings()
    }
  }, [])

  const loadSettings = async () => {
    try {
      const saved = localStorage.getItem('privacySettings')
      if (saved) {
        setSettings(JSON.parse(saved))
      }
    } catch (err) {
      console.error('プライバシー設定の読み込みに失敗:', err)
    }
  }

  const updateSettings = async (newSettings: Partial<PrivacySettings>) => {
    try {
      const updated = { ...settings, ...newSettings }
      setSettings(updated)
      localStorage.setItem('privacySettings', JSON.stringify(updated))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の更新に失敗しました')
    }
  }

  const exportData = async (): Promise<Blob | null> => {
    try {
      const data = {
        settings,
        exportedAt: new Date().toISOString(),
        // 実際の実装では、ユーザーの全データを含める
      }

      return new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データのエクスポートに失敗しました')
      return null
    }
  }

  const deleteAllData = async (): Promise<boolean> => {
    try {
      // 実際の実装では、すべてのユーザーデータを削除
      localStorage.removeItem('privacySettings')
      localStorage.removeItem('voiceRecordings')
      // その他のデータも削除

      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの削除に失敗しました')
      return false
    }
  }

  const getDataUsage = async () => {
    try {
      // 実際の実装では、データ使用量を計算
      return {
        voiceMessages: 0,
        totalStorageUsed: 0,
        lastActivity: new Date()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データ使用量の取得に失敗しました')
      return null
    }
  }

  return {
    isAvailable,
    settings,
    updateSettings,
    exportData,
    deleteAllData,
    getDataUsage,
    error
  }
}