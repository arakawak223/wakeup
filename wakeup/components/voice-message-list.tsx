'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { supabaseAudioManager } from '@/lib/audio/supabase-audio'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row'] & {
  sender?: { id: string; display_name: string | null; email: string }
  receiver?: { id: string; display_name: string | null; email: string }
}

interface VoiceMessageListProps {
  user: User
  type?: 'sent' | 'received' | 'all'
  onMessageSelect?: (message: VoiceMessage) => void
}

export function VoiceMessageList({
  user,
  type = 'all',
  onMessageSelect
}: VoiceMessageListProps) {
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [playProgress, setPlayProgress] = useState<{ [key: string]: number }>({})

  // メッセージ一覧を読み込み
  const loadMessages = async () => {
    try {
      setLoading(true)
      const data = await supabaseAudioManager.getUserVoiceMessages(user.id, type)
      setMessages(data)
    } catch (error) {
      console.error('メッセージ読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [user.id, type])

  // 音声再生
  const playAudio = async (message: VoiceMessage) => {
    try {
      // 既に再生中の音声を停止
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }

      if (playingId === message.id) {
        // 同じメッセージの場合は停止
        setPlayingId(null)
        setCurrentAudio(null)
        return
      }

      // 新しい音声を再生
      const audio = new Audio(message.audio_url)
      setCurrentAudio(audio)
      setPlayingId(message.id)

      // 再生進行状況を更新
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          const progress = (audio.currentTime / audio.duration) * 100
          setPlayProgress(prev => ({
            ...prev,
            [message.id]: progress
          }))
        }
      })

      // 再生終了時の処理
      audio.addEventListener('ended', () => {
        setPlayingId(null)
        setCurrentAudio(null)
        setPlayProgress(prev => ({
          ...prev,
          [message.id]: 0
        }))
      })

      // エラーハンドリング
      audio.addEventListener('error', (error) => {
        console.error('音声再生エラー:', error)
        alert('音声の再生に失敗しました。')
        setPlayingId(null)
        setCurrentAudio(null)
      })

      await audio.play()

      // 受信したメッセージの場合は既読にする
      if (message.receiver_id === user.id && !message.is_read) {
        await supabaseAudioManager.markMessageAsRead(message.id, user.id)
        // メッセージリストを更新
        setMessages(prev => prev.map(msg =>
          msg.id === message.id ? { ...msg, is_read: true } : msg
        ))
      }

    } catch (error) {
      console.error('音声再生エラー:', error)
      alert('音声の再生に失敗しました。')
      setPlayingId(null)
      setCurrentAudio(null)
    }
  }

  // 音声停止
  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setPlayingId(null)
      setCurrentAudio(null)
      setPlayProgress({})
    }
  }

  // メッセージ削除
  const deleteMessage = async (message: VoiceMessage) => {
    if (!confirm('この音声メッセージを削除しますか？')) return

    try {
      await supabaseAudioManager.deleteVoiceMessage(message.id, user.id)
      setMessages(prev => prev.filter(msg => msg.id !== message.id))
    } catch (error) {
      console.error('メッセージ削除エラー:', error)
      alert('メッセージの削除に失敗しました。')
    }
  }

  // カテゴリのラベル
  const getCategoryLabel = (category: string | null) => {
    const labels: Record<string, string> = {
      thanks: '感謝',
      congratulation: 'お祝い',
      relief: '安心',
      empathy: '共感'
    }
    return category ? labels[category] || category : 'その他'
  }

  // カテゴリの色
  const getCategoryColor = (category: string | null) => {
    const colors: Record<string, string> = {
      thanks: 'bg-green-100 text-green-800',
      congratulation: 'bg-yellow-100 text-yellow-800',
      relief: 'bg-blue-100 text-blue-800',
      empathy: 'bg-purple-100 text-purple-800'
    }
    return category ? colors[category] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'
  }

  // 再生時間のフォーマット
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">読み込み中...</div>
        </CardContent>
      </Card>
    )
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            {type === 'sent' ? '送信した音声メッセージはありません' :
             type === 'received' ? '受信した音声メッセージはありません' :
             '音声メッセージはありません'}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isPlaying = playingId === message.id
        const progress = playProgress[message.id] || 0
        const isSent = message.sender_id === user.id
        const isUnread = !message.is_read && message.receiver_id === user.id

        return (
          <Card
            key={message.id}
            className={`cursor-pointer transition-all hover:shadow-md ${isUnread ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => onMessageSelect?.(message)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* ヘッダー情報 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">
                      {isSent ? '送信先: ' : '送信者: '}
                      {isSent
                        ? message.receiver?.display_name || message.receiver?.email || '不明'
                        : message.sender?.display_name || message.sender?.email || '不明'
                      }
                    </span>
                    {isUnread && (
                      <Badge variant="destructive" className="text-xs">
                        未読
                      </Badge>
                    )}
                  </div>

                  {/* タイトル */}
                  <h3 className="font-medium text-lg mb-2 truncate">
                    {message.title || '無題の音声メッセージ'}
                  </h3>

                  {/* カテゴリと時間 */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={getCategoryColor(message.category)}>
                      {getCategoryLabel(message.category)}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {formatDuration(message.duration)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(message.created_at).toLocaleString('ja-JP')}
                    </span>
                  </div>

                  {/* 再生進行状況 */}
                  {isPlaying && (
                    <div className="mb-3">
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  {/* 感情分析結果 */}
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
                </div>

                {/* 操作ボタン */}
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant={isPlaying ? "destructive" : "default"}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isPlaying) {
                        stopAudio()
                      } else {
                        playAudio(message)
                      }
                    }}
                  >
                    {isPlaying ? '⏹️ 停止' : '▶️ 再生'}
                  </Button>

                  {isSent && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteMessage(message)
                      }}
                    >
                      🗑️ 削除
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}