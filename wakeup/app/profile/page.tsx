'use client'

import { ProfileManager } from '@/components/auth/profile-manager'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ProfilePage() {
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
          <p className="text-gray-600">プロフィール管理にはログインが必要です。</p>
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
          <h1 className="text-3xl font-bold">👤 プロフィール管理</h1>
          <p className="text-gray-600 mt-2">
            アカウント情報の確認・編集ができます。
          </p>
        </div>

        <ProfileManager />
      </div>
    </main>
  )
}