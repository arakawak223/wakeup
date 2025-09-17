'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FamilyManager, type FamilyMember } from '@/lib/family/family-manager'
import { useAuth } from '@/contexts/auth-context'

interface FamilyListProps {
  onMemberSelect?: (member: FamilyMember) => void
  refreshTrigger?: number
}

export function FamilyList({ onMemberSelect, refreshTrigger }: FamilyListProps) {
  const { user } = useAuth()
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const familyManager = user ? new FamilyManager(user.id) : null

  const loadFamilyMembers = useCallback(async () => {
    if (!familyManager) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await familyManager.getFamilyMembers()

      if (result.success && result.data) {
        setFamilyMembers(result.data)
      } else {
        setError(result.error || '家族メンバーの取得に失敗しました')
      }
    } catch (error) {
      setError('家族メンバー取得中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }, [familyManager])

  useEffect(() => {
    loadFamilyMembers()
  }, [loadFamilyMembers, refreshTrigger])

  const handleRemoveMember = async (member: FamilyMember) => {
    if (!familyManager) return

    if (!confirm(`${member.display_name || member.email}との家族関係を解除しますか？`)) {
      return
    }

    try {
      const result = await familyManager.removeFamilyMember(member.connection_id)

      if (result.success) {
        await loadFamilyMembers()
      } else {
        setError(result.error || 'メンバー削除に失敗しました')
      }
    } catch (error) {
      setError('メンバー削除中にエラーが発生しました')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            👨‍👩‍👧‍👦 家族メンバー
            {familyMembers.length > 0 && (
              <Badge variant="secondary">{familyMembers.length}</Badge>
            )}
          </span>
          <Button size="sm" variant="outline" onClick={loadFamilyMembers}>
            更新
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-gray-600">読み込み中...</span>
          </div>
        ) : familyMembers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-gray-600 mb-2">まだ家族メンバーがいません</p>
            <p className="text-sm text-gray-500">
              「家族を招待」から家族を追加してください
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {familyMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                    {(member.display_name || member.email).charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">
                        {member.display_name || '名前未設定'}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        家族
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    <p className="text-xs text-gray-400">
                      つながった日: {formatDate(member.connected_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onMemberSelect && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMemberSelect(member)}
                    >
                      メッセージ
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveMember(member)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {familyMembers.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              家族メンバーと音声メッセージでつながれます
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}