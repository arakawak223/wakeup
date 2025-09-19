'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  isDevMode,
  setupDevMode,
  cleanupMockData,
  setupDummyFamily
} from '@/lib/dev-mode'


interface DevControlsProps {
  userId: string
  onDataChanged?: () => void
}

export function DevControls({ userId, onDataChanged }: DevControlsProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')

  if (!isDevMode()) {
    return null
  }

  const handleSetupDevMode = async () => {
    setLoading(true)
    setMessage('')

    try {
      const dummyProfiles = await setupDevMode(userId)
      setMessage(`✅ 開発モードをセットアップしました！ダミー家族メンバー ${dummyProfiles.length} 人を追加しました。`)

      if (onDataChanged) {
        setTimeout(onDataChanged, 1000)
      }
    } catch (error) {
      console.error('開発モードセットアップエラー:', error)
      setMessage('❌ 開発モードのセットアップに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!confirm('すべてのモックデータを削除しますか？')) {
      return
    }

    setLoading(true)
    setMessage('')

    try {
      await cleanupMockData()
      setMessage('✅ モックデータをクリーンアップしました')

      if (onDataChanged) {
        setTimeout(onDataChanged, 1000)
      }
    } catch (error) {
      console.error('クリーンアップエラー:', error)
      setMessage('❌ モックデータのクリーンアップに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleAddDummyFamily = async () => {
    setLoading(true)
    setMessage('')

    try {
      const dummyProfiles = await setupDummyFamily(userId)
      setMessage(`✅ ダミー家族メンバー ${dummyProfiles.length} 人を追加しました (モック)`)

      if (onDataChanged) {
        setTimeout(onDataChanged, 1000)
      }
    } catch (error) {
      console.error('ダミー家族追加エラー:', error)
      setMessage('❌ ダミー家族メンバーの追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-orange-800">🧪 開発モード</CardTitle>
          <Badge variant="secondary" className="bg-orange-200 text-orange-800">
            DEV ONLY
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-orange-700 mb-4">
          開発・テスト用の機能です。本番環境では表示されません。
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSetupDevMode}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            {loading ? '設定中...' : '🚀 開発モード完全セットアップ'}
          </Button>

          <Button
            onClick={handleAddDummyFamily}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? '追加中...' : '👨‍👩‍👧‍👦 ダミー家族を追加'}
          </Button>

          <Button
            onClick={handleCleanup}
            disabled={loading}
            variant="destructive"
            size="sm"
          >
            {loading ? '削除中...' : '🗑️ ダミーデータ削除'}
          </Button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.startsWith('✅')
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <div className="text-xs text-orange-600 space-y-1">
          <p><strong>開発モード完全セットアップ:</strong> ダミー家族メンバー + ダミーメッセージを一括作成 (フロントエンドでモック)</p>
          <p><strong>ダミー家族を追加:</strong> テスト用の家族メンバーのみ追加 (フロントエンドでモック)</p>
          <p><strong>モックデータ削除:</strong> ローカルストレージのテストデータを削除</p>
        </div>
      </CardContent>
    </Card>
  )
}