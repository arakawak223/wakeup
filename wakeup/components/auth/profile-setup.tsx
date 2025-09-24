'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'

interface HybridUser {
  id: string
  email?: string
  name?: string
  isOffline?: boolean
}

interface ProfileSetupProps {
  user: HybridUser | null
}

export function ProfileSetup({ user }: ProfileSetupProps) {
  const [loading, setLoading] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { updateProfile, refreshProfile } = useAuth()

  if (!user) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await updateProfile({
        displayName: displayName.trim()
      })

      if (result.success) {
        await refreshProfile()
        window.location.reload()
      } else {
        setError(result.error || 'プロフィールの設定に失敗しました。')
      }
    } catch (error) {
      console.error('プロフィール作成エラー:', error)
      setError('プロフィールの設定に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">👋 プロフィール設定</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={user.email || ''}
              disabled
              className="bg-gray-100"
            />
          </div>

          <div>
            <Label htmlFor="displayName">表示名 *</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="あなたの名前を入力してください"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="text-center text-gray-600">
            <p>家族や親しい友人と音声メッセージでつながるプライベートなアプリです。</p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !displayName.trim()}
          >
            {loading ? '設定中...' : 'プロフィールを設定'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}