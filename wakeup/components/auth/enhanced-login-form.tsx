'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface EnhancedLoginFormProps {
  redirectTo?: string
  title?: string
  description?: string
}

export function EnhancedLoginForm({
  redirectTo = '/',
  title = 'ログイン',
  description = '家族の音声メッセージアプリにログインしてください'
}: EnhancedLoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)

  const { signIn, sendPasswordReset } = useAuth()
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
        router.push(redirectTo)
      } else {
        setError(result.error || 'ログインに失敗しました')
      }
    } catch (error) {
      setError('ログイン中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError('パスワードリセット用のメールアドレスを入力してください')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await sendPasswordReset(email)

      if (result.success) {
        setResetEmailSent(true)
        setShowForgotPassword(false)
      } else {
        setError(result.error || 'パスワードリセットメールの送信に失敗しました')
      }
    } catch (error) {
      setError('パスワードリセット中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  if (showForgotPassword) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">🔑 パスワードリセット</CardTitle>
          <CardDescription className="text-center">
            登録したメールアドレスにリセット用のリンクを送信します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !email}
              >
                {isLoading ? '送信中...' : 'リセットメールを送信'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowForgotPassword(false)
                  setError(null)
                }}
              >
                ログインに戻る
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">👨‍👩‍👧‍👦 {title}</CardTitle>
        <CardDescription className="text-center">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {resetEmailSent && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-600">
              📧 パスワードリセット用のメールを送信しました。
              メールボックスをご確認ください。
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
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
              placeholder="パスワードを入力"
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

          <div className="space-y-2">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email || !password}
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={() => {
                setShowForgotPassword(true)
                setError(null)
              }}
            >
              パスワードを忘れた方はこちら
            </Button>
          </div>

          <div className="text-center text-sm text-gray-600 space-y-2">
            <p>アカウントをお持ちでない方は</p>
            <Link
              href="/auth/sign-up"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              新規登録はこちら
            </Link>
          </div>

          {/* 開発モード用の情報 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  開発モード
                </Badge>
              </div>
              <div className="text-xs text-yellow-700 space-y-1">
                <p>🧪 テスト用ログイン:</p>
                <p>メール: test@example.com</p>
                <p>パスワード: password123</p>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}