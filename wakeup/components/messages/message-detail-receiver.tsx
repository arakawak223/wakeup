'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { SupabaseAudioManager } from '@/lib/audio/supabase-audio'
import { useAuth } from '@/contexts/auth-context'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row'] & {
  sender?: { id: string; display_name: string | null; email: string }
  receiver?: { id: string; display_name: string | null; email: string }
}

interface MessageDetailReceiverProps {
  messageId: string
  onBack?: () => void
  onReply?: (senderId: string) => void
  className?: string
}

export function MessageDetailReceiver({
  messageId,
  onBack,
  onReply,
  className
}: MessageDetailReceiverProps) {
  const { user } = useAuth()
  const [message, setMessage] = useState<VoiceMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [playingProgress, setPlayingProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // 音声再生用のref
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const audioManager = user ? new SupabaseAudioManager() : null

  // メッセージ詳細を読み込み
  useEffect(() => {
    const loadMessage = async () => {
      if (!audioManager || !user) return

      try {
        setLoading(true)
        const messages = await audioManager.getUserVoiceMessages(user.id, 'received')
        const foundMessage = messages.find(msg => msg.id === messageId)

        if (foundMessage) {
          setMessage(foundMessage)

          // 未読の場合は既読にする
          if (!foundMessage.is_read) {
            await audioManager.markMessageAsRead(messageId)
            setMessage(prev => prev ? { ...prev, is_read: true } : null)
          }
        }
      } catch (error) {
        console.error('メッセージ詳細読み込みエラー:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMessage()
  }, [audioManager, user, messageId])

  // 音声再生
  const playAudio = async () => {
    if (!message) return

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

      setIsPlaying(true)
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
        setIsPlaying(false)
        setPlayingProgress(0)
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
      })

      audio.addEventListener('error', (e) => {
        console.error('音声再生エラー:', e)
        setIsPlaying(false)
        setPlayingProgress(0)
      })

      await audio.play()
    } catch (error) {
      console.error('音声再生エラー:', error)
      setIsPlaying(false)
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

    setIsPlaying(false)
    setPlayingProgress(0)
  }

  // テキスト返信送信
  const sendReply = async () => {
    if (!message || !replyText.trim() || !user) return

    try {
      setSendingReply(true)

      // ここでテキスト返信の送信処理を実装
      // 実際の実装では、メッセージリクエストシステムや通知システムを使用
      console.log('テキスト返信:', {
        to: message.sender_id,
        message: replyText,
        replyTo: message.id
      })

      setReplyText('')
      alert('返信を送信しました')
    } catch (error) {
      console.error('返信送信エラー:', error)
      alert('返信の送信に失敗しました')
    } finally {
      setSendingReply(false)
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
            <p className="text-gray-600">メッセージを読み込み中...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!message) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-6xl">❌</div>
            <p className="text-gray-500">メッセージが見つかりません</p>
            {onBack && (
              <Button onClick={onBack} variant="outline">
                戻る
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <Button size="sm" variant="outline" onClick={onBack}>
                  ← 戻る
                </Button>
              )}
              <span>メッセージ詳細</span>
            </div>
            <Badge variant={message.is_read ? "secondary" : "destructive"}>
              {message.is_read ? "既読" : "未読"}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* メッセージ詳細 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-medium">
              {(message.sender?.display_name || message.sender?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-lg">
                {message.sender?.display_name || message.sender?.email || '不明な送信者'}
              </div>
              <div className="text-sm text-gray-500 font-normal">
                {new Date(message.created_at).toLocaleString('ja-JP')}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* メッセージタイトル */}
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {getCategoryIcon(message.category || 'general')} {message.title || '無題の音声メッセージ'}
            </h2>

            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-gray-100 text-gray-800">
                {getCategoryLabel(message.category || 'general')}
              </Badge>
              <span className="text-sm text-gray-500">
                時間: {formatDuration(message.duration || 0)}
              </span>
              {message.quality_score && (
                <span className="text-sm text-gray-500">
                  品質: {Math.round(message.quality_score)}/100
                </span>
              )}
            </div>
          </div>

          {/* 音声再生 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">音声メッセージ</span>
              <div className="flex items-center gap-2">
                {isPlaying ? (
                  <Button size="sm" variant="outline" onClick={stopAudio}>
                    ⏹️ 停止
                  </Button>
                ) : (
                  <Button size="sm" onClick={playAudio}>
                    ▶️ 再生
                  </Button>
                )}
              </div>
            </div>

            {isPlaying && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-blue-600">
                  <span>再生中...</span>
                  <span>{Math.round(playingProgress)}%</span>
                </div>
                <Progress value={playingProgress} className="h-2" />
              </div>
            )}
          </div>

          {/* 感情分析結果 */}
          {message.dominant_emotion && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">感情分析</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {message.dominant_emotion}
                </Badge>
                {message.emotion_confidence && (
                  <span className="text-sm text-gray-600">
                    信頼度: {Math.round(message.emotion_confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 音声解析情報 */}
          {message.transcription && (
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">音声テキスト化</h3>
              <p className="text-sm text-gray-700">{message.transcription}</p>
              {message.transcription_confidence && (
                <p className="text-xs text-gray-500 mt-1">
                  精度: {Math.round(message.transcription_confidence * 100)}%
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 返信機能 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💬 返信する</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => onReply?.(message.sender_id)}
              className="flex-1"
            >
              🎤 音声で返信
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">テキストで返信</h4>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="返信メッセージを入力してください..."
              rows={3}
              maxLength={500}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">
                {replyText.length}/500文字
              </span>
              <Button
                size="sm"
                onClick={sendReply}
                disabled={!replyText.trim() || sendingReply}
              >
                {sendingReply ? '送信中...' : '返信送信'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}