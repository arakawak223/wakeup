'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FamilyManager, type ConnectionRequest } from '@/lib/family/family-manager'
import { useAuth } from '@/contexts/auth-context'

interface InvitationManagerProps {
  onRequestHandled?: () => void
  refreshTrigger?: number
}

export function InvitationManager({ onRequestHandled, refreshTrigger }: InvitationManagerProps) {
  const { user } = useAuth()
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const familyManager = user ? new FamilyManager(user.id) : null

  const loadPendingRequests = useCallback(async () => {
    if (!familyManager) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await familyManager.getPendingRequests()

      if (result.success && result.data) {
        setPendingRequests(result.data)
      } else {
        setError(result.error || '招待情報の取得に失敗しました')
      }
    } catch (error) {
      setError('招待情報取得中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }, [familyManager])

  useEffect(() => {
    loadPendingRequests()
  }, [loadPendingRequests, refreshTrigger])

  const handleAccept = async (request: ConnectionRequest) => {
    if (!familyManager) return

    setProcessingId(request.id)
    setError(null)

    try {
      const result = await familyManager.acceptInvitation(request.id)

      if (result.success) {
        await loadPendingRequests()
        onRequestHandled?.()
      } else {
        setError(result.error || '招待の承認に失敗しました')
      }
    } catch (error) {
      setError('招待承認中にエラーが発生しました')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (request: ConnectionRequest) => {
    if (!familyManager) return

    if (!confirm(`${request.requester.display_name || request.requester.email}からの招待を拒否しますか？`)) {
      return
    }

    setProcessingId(request.id)
    setError(null)

    try {
      const result = await familyManager.rejectInvitation(request.id)

      if (result.success) {
        await loadPendingRequests()
        onRequestHandled?.()
      } else {
        setError(result.error || '招待の拒否に失敗しました')
      }
    } catch (error) {
      setError('招待拒否中にエラーが発生しました')
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRequestType = (request: ConnectionRequest) => {
    if (!user) return { type: 'unknown', label: '不明' }

    if (request.requester.id === user.id) {
      return { type: 'sent', label: '送信済み' }
    } else {
      return { type: 'received', label: '受信' }
    }
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
            📬 招待管理
            {pendingRequests.length > 0 && (
              <Badge variant="destructive">{pendingRequests.length}</Badge>
            )}
          </span>
          <Button size="sm" variant="outline" onClick={loadPendingRequests}>
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
        ) : pendingRequests.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-600 mb-2">保留中の招待はありません</p>
            <p className="text-sm text-gray-500">
              新しい招待があると、ここに表示されます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => {
              const requestType = getRequestType(request)
              const isReceived = requestType.type === 'received'
              const displayPerson = isReceived ? request.requester : request.receiver

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-600 rounded-full flex items-center justify-center text-white font-medium">
                      {(displayPerson.display_name || displayPerson.email).charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {displayPerson.display_name || '名前未設定'}
                        </h3>
                        <Badge
                          variant={isReceived ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {requestType.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">{displayPerson.email}</p>
                      <p className="text-xs text-gray-400">
                        {formatDate(request.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isReceived ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(request)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? '処理中...' : '承認'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={processingId === request.id}
                        >
                          拒否
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          承認待ち
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleReject(request)}
                          disabled={processingId === request.id}
                        >
                          取消
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              招待を承認すると家族メンバーとして追加されます
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}