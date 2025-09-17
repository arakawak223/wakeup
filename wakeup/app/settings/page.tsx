'use client'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        <p className="mt-4 text-gray-600">読み込み中...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">ログインが必要です</h1>
          <p className="text-gray-600">設定画面にはログインが必要です。</p>
          <Button asChild>
            <Link href="/auth/login">ログイン</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8">
          <Button asChild variant="outline" className="mb-4">
            <Link href="/">← ホームに戻る</Link>
          </Button>
          <h1 className="text-3xl font-bold">⚙️ 設定</h1>
          <p className="text-gray-600 mt-2">
            アプリケーションの各種設定を管理できます。
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🔔 通知設定</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">通知設定は近日実装予定です。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🎨 表示設定</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">テーマやレイアウトの設定は近日実装予定です。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔐 プライバシー設定</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">プライバシー関連の設定は近日実装予定です。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}