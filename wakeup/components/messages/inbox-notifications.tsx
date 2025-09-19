'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SupabaseAudioManager } from '@/lib/audio/supabase-audio'
import { RealtimeManager } from '@/lib/realtime'
import { useAuth } from '@/contexts/auth-context'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row'] & {
  sender?: { id: string; display_name: string | null; email: string }
}

interface InboxNotificationsProps {
  onMessageClick?: (messageId: string) => void
  className?: string
}

export function InboxNotifications({ onMessageClick, className }: InboxNotificationsProps) {
  const { user } = useAuth()
  const [recentMessages, setRecentMessages] = useState<VoiceMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [loading, setLoading] = useState(false)

  const audioManager = useMemo(() =>
    user ? new SupabaseAudioManager() : null, [user])
  const realtimeManager = useMemo(() =>
    user ? new RealtimeManager(user.id) : null, [user])

  // 最近のメッセージを読み込み
  const loadRecentMessages = useCallback(async () => {
    if (!audioManager || !user) return

    try {
      setLoading(true)
      const messages = await audioManager.getUserVoiceMessages(user.id, 'received')

      // 最新5件の未読メッセージを取得
      const unreadMessages = messages
        .filter(msg => !msg.is_read)
        .slice(0, 5)

      setRecentMessages(unreadMessages)
      setUnreadCount(messages.filter(msg => !msg.is_read).length)
    } catch (error) {
      console.error('最近のメッセージ読み込みエラー:', error)
      // ユーザーに分かりやすいエラーメッセージを表示
      if (error instanceof Error) {
        if (error.message.includes('ネットワーク接続エラー')) {
          // ネットワークエラーの場合は通知を控えめに
          console.warn('Supabase接続エラー - ネットワークを確認してください')
        } else if (error.message.includes('ログインが必要')) {
          console.warn('認証が必要です')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [audioManager, user])

  // 新着メッセージのリアルタイム監視
  useEffect(() => {
    if (!realtimeManager || !user) return

    const handleNewMessage = (message: VoiceMessage) => {
      if (message.receiver_id === user.id) {
        setRecentMessages(prev => [message, ...prev.slice(0, 4)])
        setUnreadCount(prev => prev + 1)

        // 通知音を再生（オプション）
        playNotificationSound()
      }
    }

    const handleMessageRead = (messageId: string) => {
      setRecentMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        ).filter(msg => !msg.is_read)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    // リアルタイムイベントリスナーを設定
    realtimeManager.subscribeToVoiceMessages({
      onNewMessage: handleNewMessage,
      onMessageUpdate: (messageId, updates) => {
        if (updates.is_read) {
          handleMessageRead(messageId)
        }
      }
    })

    return () => {
      realtimeManager.unsubscribe()
    }
  }, [realtimeManager, user])

  // 初回読み込み
  useEffect(() => {
    loadRecentMessages()
  }, [loadRecentMessages])

  // 通知音再生
  const playNotificationSound = () => {
    try {
      // 簡単な通知音（実際の実装では音声ファイルを使用）
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.warn('通知音再生エラー:', error)
    }
  }

  // 全て既読にする
  const markAllAsRead = async () => {
    if (!audioManager) return

    try {
      for (const message of recentMessages) {
        if (!message.is_read) {
          await audioManager.markMessageAsRead(message.id)
        }
      }

      setRecentMessages([])
      setUnreadCount(0)
    } catch (error) {
      console.error('一括既読エラー:', error)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'たった今'
    if (diffInMinutes < 60) return `${diffInMinutes}分前`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}時間前`

    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}日前`
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      thanks: '🙏',
      congratulation: '🎉',
      relief: '😌',
      empathy: '🤗',
      general: '💬'
    }
    return icons[category] || '💬'
  }

  if (!user) return null

  return (
    <div className={`relative ${className}`}>
      {/* 通知ベル */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative"
        >
          📬 受信箱
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* 通知ドロップダウン */}
      {showNotifications && (
        <Card className="absolute top-full right-0 mt-2 w-80 z-50 shadow-lg border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>📬 新着メッセージ</span>
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={markAllAsRead}
                  className="text-xs h-6"
                >
                  全て既読
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : recentMessages.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentMessages.map((message) => (
                  <div
                    key={message.id}
                    className="p-2 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => {
                      onMessageClick?.(message.id)
                      setShowNotifications(false)
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {(message.sender?.display_name || message.sender?.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs font-medium truncate">
                            {message.sender?.display_name || message.sender?.email || '不明'}
                          </span>
                          <Badge variant="destructive" className="text-xs h-4">
                            NEW
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-700 truncate">
                          {getCategoryIcon(message.category || 'general')} {message.title || '音声メッセージ'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatTimeAgo(message.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                新着メッセージはありません
              </div>
            )}

            {unreadCount > recentMessages.length && (
              <div className="text-center pt-2 border-t mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // 受信箱の全体表示に移動
                    setShowNotifications(false)
                  }}
                  className="text-xs"
                >
                  他 {unreadCount - recentMessages.length} 件のメッセージを表示
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 背景クリック用のオーバーレイ */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </div>
  )
}