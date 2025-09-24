'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/hybrid-auth-context'

export function SimpleOfflineAuth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn, isOfflineMode } = useAuth()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn(email, password)

      if (result.success) {
        router.push('/')
      } else {
        setError(result.error || 'ログインに失敗しました')
      }
    } catch {
      setError('ログイン中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">
          👨‍👩‍👧‍👦 ログイン {isOfflineMode ? '(オフライン)' : '(ハイブリッド)'}
        </CardTitle>
        <CardDescription className="text-center">
          {isOfflineMode
            ? 'オフラインモードでの家族音声メッセージアプリ'
            : 'Supabase/オフライン対応の家族音声メッセージアプリ'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="test@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="password123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !email || !password}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </Button>

          <div className={`mt-4 p-3 rounded-md ${
            isOfflineMode
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-green-50 border border-green-200'
          }`}>
            <p className={`text-xs mb-2 ${
              isOfflineMode ? 'text-blue-700' : 'text-green-700'
            }`}>
              {isOfflineMode ? '🔌 オフライン' : '☁️ ハイブリッド'}テスト用:
            </p>
            <div className={`text-xs ${
              isOfflineMode ? 'text-blue-600' : 'text-green-600'
            }`}>
              <p>メール: test@example.com</p>
              <p>パスワード: password123</p>
              {!isOfflineMode && <p>または wakeuptest@gmail.com</p>}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => {
                setEmail('test@example.com')
                setPassword('password123')
              }}
            >
              テスト情報を入力
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}