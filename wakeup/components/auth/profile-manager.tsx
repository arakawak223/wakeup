'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'

export function ProfileManager() {
  const { user, profile, updateProfile, updateEmail, updatePassword, deleteAccount, refreshProfile } = useAuth()

  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // プロフィール編集用の状態
  const [profileData, setProfileData] = useState({
    displayName: profile?.display_name || '',
    email: user?.email || ''
  })

  // パスワード変更用の状態
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (profile) {
      setProfileData({
        displayName: profile.display_name || '',
        email: user?.email || ''
      })
    }
  }, [profile, user])

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  // プロフィール更新
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    clearMessages()

    try {
      const result = await updateProfile({
        displayName: profileData.displayName.trim()
      })

      if (result.success) {
        setSuccess('プロフィールを更新しました')
        setIsEditing(false)
        await refreshProfile()
      } else {
        setError(result.error || 'プロフィール更新に失敗しました')
      }
    } catch (error) {
      setError('プロフィール更新中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // メールアドレス更新
  const handleEmailUpdate = async () => {
    if (!profileData.email || profileData.email === user?.email) return

    setLoading(true)
    clearMessages()

    try {
      const result = await updateEmail(profileData.email)

      if (result.success) {
        setSuccess('確認メールを送信しました。新しいメールアドレスで確認してください')
      } else {
        setError(result.error || 'メールアドレス更新に失敗しました')
      }
    } catch (error) {
      setError('メールアドレス更新中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // パスワード更新
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('パスワードは6文字以上である必要があります')
      return
    }

    setLoading(true)
    clearMessages()

    try {
      const result = await updatePassword(passwordData.newPassword)

      if (result.success) {
        setSuccess('パスワードを更新しました')
        setPasswordData({ newPassword: '', confirmPassword: '' })
        setShowPasswordChange(false)
      } else {
        setError(result.error || 'パスワード更新に失敗しました')
      }
    } catch (error) {
      setError('パスワード更新中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // アカウント削除
  const handleAccountDelete = async () => {
    setLoading(true)
    clearMessages()

    try {
      const result = await deleteAccount()

      if (result.success) {
        // アカウント削除成功時は自動的にログアウトされる
      } else {
        setError(result.error || 'アカウント削除に失敗しました')
      }
    } catch (error) {
      setError('アカウント削除中にエラーが発生しました')
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  if (!user || !profile) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">プロフィール情報を読み込んでいます...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* プロフィール情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            👤 プロフィール情報
            {!profile.display_name && (
              <Badge variant="destructive" className="text-xs">
                設定が必要
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <Label htmlFor="displayName">表示名</Label>
                <Input
                  id="displayName"
                  value={profileData.displayName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="あなたの名前"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? '保存中...' : '保存'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setProfileData({
                      displayName: profile.display_name || '',
                      email: user.email || ''
                    })
                    clearMessages()
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>表示名</Label>
                <p className="text-lg font-medium">
                  {profile.display_name || (
                    <span className="text-gray-500 italic">未設定</span>
                  )}
                </p>
              </div>

              <div>
                <Label>メールアドレス</Label>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>

              <div>
                <Label>登録日</Label>
                <p className="text-sm text-gray-600">
                  {new Date(profile.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>

              <Button onClick={() => setIsEditing(true)}>
                編集
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* メールアドレス変更 */}
      <Card>
        <CardHeader>
          <CardTitle>📧 メールアドレス変更</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">新しいメールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="new@email.com"
              />
            </div>

            <Button
              onClick={handleEmailUpdate}
              disabled={loading || profileData.email === user.email}
            >
              {loading ? '送信中...' : 'メールアドレスを変更'}
            </Button>

            <p className="text-xs text-gray-500">
              新しいメールアドレスに確認メールが送信されます
            </p>
          </div>
        </CardContent>
      </Card>

      {/* パスワード変更 */}
      <Card>
        <CardHeader>
          <CardTitle>🔒 パスワード変更</CardTitle>
        </CardHeader>
        <CardContent>
          {!showPasswordChange ? (
            <Button onClick={() => setShowPasswordChange(true)}>
              パスワードを変更
            </Button>
          ) : (
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <Label htmlFor="newPassword">新しいパスワード</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="6文字以上"
                  required
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">パスワード確認</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="パスワードを再入力"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? '変更中...' : 'パスワードを変更'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordChange(false)
                    setPasswordData({ newPassword: '', confirmPassword: '' })
                    clearMessages()
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* アカウント削除 */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">⚠️ 危険な設定</CardTitle>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                アカウントを削除すると、すべての音声メッセージと家族の繋がりが永久に失われます。
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                アカウントを削除
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600 font-medium">
                  本当にアカウントを削除しますか？
                </p>
                <p className="text-xs text-red-500 mt-1">
                  この操作は取り消すことができません。
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleAccountDelete}
                  disabled={loading}
                >
                  {loading ? '削除中...' : '完全に削除する'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}