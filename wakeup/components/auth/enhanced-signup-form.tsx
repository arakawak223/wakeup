'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface EnhancedSignupFormProps {
  redirectTo?: string
  title?: string
  description?: string
}

export function EnhancedSignupForm({
  redirectTo = '/auth/verify-email',
  title = '新規登録',
  description = '家族の音声メッセージアプリに参加しましょう'
}: EnhancedSignupFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    agreeToTerms: false
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const { signUp } = useAuth()
  const router = useRouter()

  // パスワード強度をチェック
  const getPasswordStrength = (password: string) => {
    if (password.length < 6) return { score: 0, label: '短すぎます', color: 'text-red-500' }
    if (password.length < 8) return { score: 1, label: '弱い', color: 'text-orange-500' }

    let score = 1
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score === 2) return { score: 2, label: '普通', color: 'text-yellow-500' }
    if (score === 3) return { score: 3, label: '強い', color: 'text-green-500' }
    if (score === 4) return { score: 4, label: 'とても強い', color: 'text-green-600' }

    return { score: 1, label: '弱い', color: 'text-orange-500' }
  }

  const passwordStrength = getPasswordStrength(formData.password)

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const validateForm = (): string | null => {
    if (!formData.email || !formData.password || !formData.displayName) {
      return '全ての必須項目を入力してください'
    }

    if (formData.password.length < 6) {
      return 'パスワードは6文字以上である必要があります'
    }

    if (formData.password !== formData.confirmPassword) {
      return 'パスワードが一致しません'
    }

    if (!formData.agreeToTerms) {
      return '利用規約に同意してください'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      return 'メールアドレスの形式が正しくありません'
    }

    return null
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await signUp(formData.email, formData.password)

      if (result.success) {
        setSignupSuccess(true)
        // 少し待ってからリダイレクト
        setTimeout(() => {
          router.push(redirectTo)
        }, 2000)
      } else {
        setError(result.error || 'サインアップに失敗しました')
      }
    } catch (error) {
      setError('サインアップ中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  if (signupSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">🎉 登録完了</CardTitle>
          <CardDescription className="text-center">
            アカウントが正常に作成されました
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-700">
                📧 確認メールを送信しました。
                メールボックスをご確認の上、メール内のリンクをクリックしてアカウントを有効化してください。
              </p>
            </div>
            <p className="text-sm text-gray-600">
              数秒後にリダイレクトされます...
            </p>
          </div>
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
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <Label htmlFor="displayName">表示名 *</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="あなたの名前"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              required
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              家族や友人に表示される名前です
            </p>
          </div>

          <div>
            <Label htmlFor="email">メールアドレス *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">パスワード *</Label>
            <Input
              id="password"
              type="password"
              placeholder="6文字以上のパスワード"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              required
              className="mt-1"
            />
            {formData.password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        passwordStrength.score === 1 ? 'bg-orange-500 w-1/4' :
                        passwordStrength.score === 2 ? 'bg-yellow-500 w-2/4' :
                        passwordStrength.score === 3 ? 'bg-green-500 w-3/4' :
                        passwordStrength.score === 4 ? 'bg-green-600 w-full' : 'w-0'
                      }`}
                    />
                  </div>
                  <span className={`text-xs ${passwordStrength.color}`}>
                    {passwordStrength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">パスワード確認 *</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="パスワードを再入力"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              required
              className="mt-1"
            />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">
                パスワードが一致しません
              </p>
            )}
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="agreeToTerms"
              checked={formData.agreeToTerms}
              onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked === true)}
              className="mt-1"
            />
            <Label htmlFor="agreeToTerms" className="text-sm leading-relaxed">
              <Link href="/terms" className="text-blue-600 hover:underline">
                利用規約
              </Link>
              {' '}および{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                プライバシーポリシー
              </Link>
              に同意します *
            </Label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !formData.agreeToTerms}
          >
            {isLoading ? '登録中...' : 'アカウントを作成'}
          </Button>

          <div className="text-center text-sm text-gray-600 space-y-2">
            <p>既にアカウントをお持ちの方は</p>
            <Link
              href="/auth/login"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              ログインはこちら
            </Link>
          </div>

          {/* 開発モード用の情報 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  開発モード
                </Badge>
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <p>🧪 テスト用サインアップ: メール確認なしで即座にログイン可能</p>
                <p>プライベートアプリのため、招待制です</p>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}