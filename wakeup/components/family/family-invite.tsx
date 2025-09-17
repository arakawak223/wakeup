'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FamilyManager } from '@/lib/family/family-manager'
import { useAuth } from '@/contexts/auth-context'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface FamilyInviteProps {
  onInviteSuccess?: () => void
}

export function FamilyInvite({ onInviteSuccess }: FamilyInviteProps) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const familyManager = user ? new FamilyManager(user.id) : null

  const handleSearch = async () => {
    if (!familyManager || !email.trim()) return

    setIsSearching(true)
    setError(null)
    setSearchResults([])

    try {
      const result = await familyManager.searchUsers(email.trim())

      if (result.success && result.data) {
        setSearchResults(result.data)
        if (result.data.length === 0) {
          setError('該当するユーザーが見つかりませんでした')
        }
      } else {
        setError(result.error || 'ユーザー検索に失敗しました')
      }
    } catch (error) {
      setError('検索中にエラーが発生しました')
    } finally {
      setIsSearching(false)
    }
  }

  const handleInvite = async (targetEmail: string) => {
    if (!familyManager) return

    setIsInviting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await familyManager.inviteFamilyMember(targetEmail)

      if (result.success) {
        setSuccess('招待を送信しました！')
        setEmail('')
        setSearchResults([])
        onInviteSuccess?.()
      } else {
        setError(result.error || '招待の送信に失敗しました')
      }
    } catch (error) {
      setError('招待送信中にエラーが発生しました')
    } finally {
      setIsInviting(false)
    }
  }

  const handleDirectInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    await handleInvite(email.trim())
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">ログインが必要です</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📧 家族を招待
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

        <form onSubmit={handleDirectInvite} className="space-y-4">
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="family@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isInviting || isSearching}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={!email.trim() || isSearching}
              >
                {isSearching ? '検索中...' : '検索'}
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label>検索結果:</Label>
              <div className="space-y-2">
                {searchResults.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {(profile.display_name || profile.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">
                          {profile.display_name || '名前未設定'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {profile.email}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleInvite(profile.email)}
                      disabled={isInviting}
                    >
                      {isInviting ? '招待中...' : '招待'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={!email.trim() || isInviting}
            >
              {isInviting ? '招待中...' : '直接招待'}
            </Button>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>• メールアドレスで直接招待するか、検索してから招待できます</p>
            <p>• 招待された方は承認後に家族メンバーになります</p>
            <p>• 招待を受けるには相手もアプリに登録している必要があります</p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}