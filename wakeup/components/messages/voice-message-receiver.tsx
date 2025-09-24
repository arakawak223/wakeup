'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SupabaseAudioManager, type ReactionType } from '@/lib/audio/supabase-audio'
import { useAuth } from '@/contexts/hybrid-auth-context'
import { VoiceMessageReactions, type MessageReaction } from '@/components/messages/voice-message-reactions'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row'] & {
  sender?: { id: string; display_name: string | null; email: string }
  receiver?: { id: string; display_name: string | null; email: string }
}

interface VoiceMessageReceiverProps {
  className?: string
}

type TimeFilter = 'all' | 'today' | 'week' | 'month'
type CategoryFilter = 'all' | 'thanks' | 'congratulation' | 'relief' | 'empathy' | 'general'
type ReadFilter = 'all' | 'unread' | 'read'

export function VoiceMessageReceiver({ className }: VoiceMessageReceiverProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [filteredMessages, setFilteredMessages] = useState<VoiceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [playingProgress, setPlayingProgress] = useState(0)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [messageReactions, setMessageReactions] = useState<Record<string, MessageReaction[]>>({})

  // 音声再生用のref
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const audioManager = useMemo(() =>
    user ? new SupabaseAudioManager() : null, [user])

  // メッセージを読み込み
  const loadMessages = useCallback(async () => {
    if (!audioManager || !user) return

    try {
      setLoading(true)
      const data = await audioManager.getUserVoiceMessages(user.id, 'received')
      setMessages(data)

      // リアクションも一括取得
      if (data.length > 0) {
        loadReactions(data.map(msg => msg.id))
      }
    } catch (error) {
      console.error('受信メッセージ読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }, [audioManager, user])

  // リアクションを読み込み
  const loadReactions = useCallback(async (messageIds: string[]) => {
    if (!audioManager || messageIds.length === 0) return

    try {
      const reactions = await audioManager.getMultipleMessageReactions(messageIds)

      // フォーマットを変換
      const formattedReactions: Record<string, MessageReaction[]> = {}
      Object.entries(reactions).forEach(([messageId, reactionList]) => {
        formattedReactions[messageId] = reactionList.map(r => ({
          id: r.id,
          messageId: r.message_id,
          userId: r.user_id,
          reactionType: r.reaction_type as ReactionType,
          createdAt: r.created_at,
          user: r.user ? {
            id: r.user.id,
            displayName: r.user.display_name || undefined,
            email: r.user.email
          } : undefined
        }))
      })

      setMessageReactions(formattedReactions)
    } catch (error) {
      console.error('リアクション読み込みエラー:', error)
    }
  }, [audioManager])

  // フィルタリング
  useEffect(() => {
    let filtered = [...messages]

    // 時間フィルタ
    if (timeFilter !== 'all') {
      const now = new Date()
      let cutoffDate: Date

      switch (timeFilter) {
        case 'today':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          cutoffDate = new Date(0)
      }

      filtered = filtered.filter(msg => new Date(msg.created_at) > cutoffDate)
    }

    // カテゴリフィルタ
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(msg => (msg.category || 'general') === categoryFilter)
    }

    // 既読フィルタ
    if (readFilter !== 'all') {
      filtered = filtered.filter(msg => readFilter === 'read' ? msg.is_read : !msg.is_read)
    }

    // 検索フィルタ
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(msg =>
        msg.title?.toLowerCase().includes(term) ||
        msg.sender?.display_name?.toLowerCase().includes(term) ||
        msg.sender?.email?.toLowerCase().includes(term)
      )
    }

    setFilteredMessages(filtered)
  }, [messages, timeFilter, categoryFilter, readFilter, searchTerm])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // リアクション追加
  const handleReactionAdd = useCallback(async (messageId: string, reactionType: ReactionType) => {
    if (!audioManager || !user) return

    try {
      const newReaction = await audioManager.addReaction(messageId, user.id, reactionType)

      // フォーマットを変換してローカル状態を更新
      const formattedReaction: MessageReaction = {
        id: newReaction.id,
        messageId: newReaction.message_id,
        userId: newReaction.user_id,
        reactionType: newReaction.reaction_type as ReactionType,
        createdAt: newReaction.created_at,
        user: newReaction.user ? {
          id: newReaction.user.id,
          displayName: newReaction.user.display_name || undefined,
          email: newReaction.user.email
        } : undefined
      }

      setMessageReactions(prev => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), formattedReaction]
      }))
    } catch (error) {
      console.error('リアクション追加エラー:', error)
      alert('リアクションの追加に失敗しました')
    }
  }, [audioManager, user])

  // リアクション削除
  const handleReactionRemove = useCallback(async (messageId: string, reactionType: ReactionType) => {
    if (!audioManager || !user) return

    try {
      await audioManager.removeReaction(messageId, user.id, reactionType)

      // ローカル状態を更新
      setMessageReactions(prev => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter(
          r => !(r.userId === user.id && r.reactionType === reactionType)
        )
      }))
    } catch (error) {
      console.error('リアクション削除エラー:', error)
      alert('リアクションの削除に失敗しました')
    }
  }, [audioManager, user])

  // 音声再生
  const playAudio = async (message: VoiceMessage) => {
    try {
      // 既存の音声を停止
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }

      setPlayingMessageId(message.id)
      setPlayingProgress(0)

      // 音声ファイルを再生
      const audio = new Audio(message.audio_url)
      audioRef.current = audio

      audio.addEventListener('loadedmetadata', () => {
        // 再生時間の更新
        progressIntervalRef.current = setInterval(() => {
          if (audio.currentTime && audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100
            setPlayingProgress(progress)
          }
        }, 100)
      })

      audio.addEventListener('ended', () => {
        setPlayingMessageId(null)
        setPlayingProgress(0)
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
      })

      audio.addEventListener('error', (e) => {
        console.error('音声再生エラー:', e)
        setPlayingMessageId(null)
        setPlayingProgress(0)
      })

      await audio.play()

      // 再生開始時に既読マークを付ける
      if (!message.is_read) {
        await markAsRead(message.id)
      }
    } catch (error) {
      console.error('音声再生エラー:', error)
      setPlayingMessageId(null)
      setPlayingProgress(0)
    }
  }

  // 音声停止
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }

    setPlayingMessageId(null)
    setPlayingProgress(0)
  }

  // 既読マーク
  const markAsRead = async (messageId: string) => {
    if (!audioManager || !user) return

    try {
      await audioManager.markMessageAsRead(messageId)

      // ローカル状態を更新
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      )
    } catch (error) {
      console.error('既読マークエラー:', error)
    }
  }

  // 全て既読にする
  const markAllAsRead = async () => {
    const unreadMessages = messages.filter(msg => !msg.is_read)

    for (const message of unreadMessages) {
      await markAsRead(message.id)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      thanks: '感謝',
      congratulation: 'お祝い',
      relief: '安心',
      empathy: '共感',
      general: 'その他'
    }
    return labels[category] || category
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

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">ログインが必要です</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">受信メッセージを読み込み中...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const unreadCount = messages.filter(msg => !msg.is_read).length

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              📬 受信メッセージ
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}件未読
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllAsRead}>
                全て既読にする
              </Button>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* フィルタ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 メッセージを絞り込み</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="time-filter">期間</Label>
              <Select value={timeFilter} onValueChange={(value: TimeFilter) => setTimeFilter(value)}>
                <SelectTrigger id="time-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">1週間以内</SelectItem>
                  <SelectItem value="month">1ヶ月以内</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category-filter">カテゴリ</Label>
              <Select value={categoryFilter} onValueChange={(value: CategoryFilter) => setCategoryFilter(value)}>
                <SelectTrigger id="category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="thanks">感謝</SelectItem>
                  <SelectItem value="congratulation">お祝い</SelectItem>
                  <SelectItem value="relief">安心</SelectItem>
                  <SelectItem value="empathy">共感</SelectItem>
                  <SelectItem value="general">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="read-filter">既読状態</Label>
              <Select value={readFilter} onValueChange={(value: ReadFilter) => setReadFilter(value)}>
                <SelectTrigger id="read-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="unread">未読のみ</SelectItem>
                  <SelectItem value="read">既読のみ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">検索</Label>
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="タイトルや送信者で検索..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {filteredMessages.length}件のメッセージ
              {(timeFilter !== 'all' || categoryFilter !== 'all' || readFilter !== 'all' || searchTerm.trim()) &&
                ` (全${messages.length}件中)`
              }
            </div>

            {(timeFilter !== 'all' || categoryFilter !== 'all' || readFilter !== 'all' || searchTerm.trim()) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTimeFilter('all')
                  setCategoryFilter('all')
                  setReadFilter('all')
                  setSearchTerm('')
                }}
              >
                フィルタをリセット
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* メッセージ一覧 */}
      <div className="space-y-4">
        {filteredMessages.length > 0 ? (
          filteredMessages.map((message) => (
            <Card
              key={message.id}
              className={`transition-all hover:shadow-md ${
                !message.is_read ? 'border-blue-500 bg-blue-50' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {(message.sender?.display_name || message.sender?.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-sm">
                          {message.sender?.display_name || message.sender?.email || '不明'}
                        </span>
                        {!message.is_read && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            未読
                          </Badge>
                        )}
                      </div>
                    </div>

                    <h3 className="font-medium text-lg mb-2 truncate">
                      {getCategoryIcon(message.category || 'general')} {message.title || '無題の音声メッセージ'}
                    </h3>

                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-gray-100 text-gray-800">
                        {getCategoryLabel(message.category || 'general')}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {formatDuration(message.duration || 0)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(message.created_at).toLocaleString('ja-JP')}
                      </span>
                    </div>

                    {message.dominant_emotion && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500">感情:</span>
                        <Badge variant="outline" className="text-xs">
                          {message.dominant_emotion}
                        </Badge>
                        {message.emotion_confidence && (
                          <span className="text-xs text-gray-500">
                            {Math.round(message.emotion_confidence * 100)}%
                          </span>
                        )}
                      </div>
                    )}

                    {playingMessageId === message.id && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
                          <span>再生中...</span>
                          <span>{Math.round(playingProgress)}%</span>
                        </div>
                        <Progress value={playingProgress} className="h-2" />
                      </div>
                    )}

                    {/* リアクション */}
                    <div className="mt-3">
                      <VoiceMessageReactions
                        messageId={message.id}
                        currentUserId={user.id}
                        reactions={messageReactions[message.id] || []}
                        onReactionAdd={handleReactionAdd}
                        onReactionRemove={handleReactionRemove}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[120px]">
                    {playingMessageId === message.id ? (
                      <Button size="sm" variant="outline" onClick={stopAudio}>
                        ⏹️ 停止
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => playAudio(message)}>
                        ▶️ 再生
                      </Button>
                    )}

                    {!message.is_read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsRead(message.id)}
                      >
                        ✅ 既読
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-8 space-y-4">
              <div className="text-6xl">📭</div>
              <div className="text-gray-500">
                {messages.length === 0 ?
                  '受信した音声メッセージはありません' :
                  '条件に一致するメッセージが見つかりません'
                }
              </div>
              {messages.length === 0 && (
                <p className="text-sm text-gray-400">
                  家族からの音声メッセージがここに表示されます
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}