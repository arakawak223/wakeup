'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabaseAudioManager } from '@/lib/audio/supabase-audio'
import type { User } from '@supabase/supabase-js'

interface VoiceMessage {
  id: string
  sender_id: string
  receiver_id: string | null
  title: string | null
  audio_url: string
  duration: number | null
  category: string | null
  created_at: string
  is_read: boolean
  audio_metadata?: Record<string, unknown> | null
}

interface VoiceRecordingsListProps {
  user: User
  refreshTrigger?: number
}

export function VoiceRecordingsList({ user, refreshTrigger }: VoiceRecordingsListProps) {
  const [recordings, setRecordings] = useState<VoiceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  // 録音データを取得
  const loadRecordings = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 録音データ取得開始:', { userId: user.id, refreshTrigger })

      // 開発/テスト環境でのローカルストレージ優先チェック
      if (typeof window !== 'undefined') {
        const localStorageData = localStorage.getItem('wakeup-voice-messages')
        console.log('📱 ローカルストレージの生データ:', localStorageData)

        if (localStorageData) {
          const parsed = JSON.parse(localStorageData)
          console.log('📱 パースされたローカルデータ:', parsed)
          console.log('📱 ローカルデータ件数:', parsed.length)

          // ユーザー関連メッセージをフィルタリング
          const userMessages = parsed.filter((msg: VoiceMessage) =>
            msg.sender_id === user.id || msg.receiver_id === user.id
          )
          console.log('📱 ユーザー関連メッセージ:', userMessages)

          // ローカルストレージに有効なデータがある場合はそれを使用
          if (userMessages.length > 0) {
            console.log('✅ ローカルストレージからデータを取得しました')
            setRecordings(userMessages.map((msg: VoiceMessage) => ({
              ...msg,
              audio_metadata: msg.audio_metadata as Record<string, unknown> | null,
              emotion_analysis: null,
              emotion_analyzed_at: null,
              dominant_emotion: null,
              emotion_confidence: null,
              arousal_level: null,
              valence_level: null
            } as VoiceMessage)))
            setLoading(false)
            return
          }
        }
      }

      // Supabaseからデータを取得（フォールバック）
      const data = await supabaseAudioManager.getUserVoiceMessages(user.id, 'all')
      console.log('📊 Supabaseから取得した録音データ:', data)
      console.log('📊 データ件数:', data.length)

      // データの詳細をログ出力
      if (data.length > 0) {
        console.log('📊 最初のデータ例:', data[0])
      } else {
        console.warn('⚠️ Supabaseからのデータが0件です')
      }

      setRecordings(data)
    } catch (err) {
      console.error('録音データ取得エラー:', err)
      setError(err instanceof Error ? err.message : '録音データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 初回読み込みとリフレッシュトリガー
  useEffect(() => {
    loadRecordings()
  }, [user.id, refreshTrigger])

  // 音声再生処理
  const playAudio = async (audioUrl: string, messageId: string) => {
    try {
      // 既に再生中の音声があれば停止
      if (playingId) {
        const currentAudio = document.querySelector(`audio[data-message-id="${playingId}"]`) as HTMLAudioElement
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }
      }

      setPlayingId(messageId)

      // オフライン音声の場合は再生できない旨を表示
      if (audioUrl.startsWith('offline-audio-') || audioUrl.startsWith('data:audio/webm;base64,offline-audio-')) {
        alert('オフライン/開発モードで保存された音声は再生できません。実際のSupabaseストレージに保存された音声のみ再生可能です。')
        setPlayingId(null)
        return
      }

      // 音声要素を作成して再生
      const audio = new Audio(audioUrl)
      audio.setAttribute('data-message-id', messageId)

      audio.onended = () => {
        setPlayingId(null)
      }

      audio.onerror = () => {
        setPlayingId(null)
        alert('音声の再生に失敗しました。ファイルが存在しないか、アクセス権限がない可能性があります。')
      }

      await audio.play()
    } catch (err) {
      console.error('音声再生エラー:', err)
      setPlayingId(null)
      alert('音声の再生中にエラーが発生しました。')
    }
  }

  // 音声停止処理
  const stopAudio = () => {
    if (playingId) {
      const currentAudio = document.querySelector(`audio[data-message-id="${playingId}"]`) as HTMLAudioElement
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }
      setPlayingId(null)
    }
  }

  // 時間フォーマット
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '不明'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ファイルサイズフォーマット
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  // カテゴリラベル
  const getCategoryLabel = (category: string | null) => {
    const labels: Record<string, string> = {
      thanks: '感謝',
      congratulation: 'お祝い',
      relief: '安心',
      empathy: '共感',
      general: 'その他'
    }
    return category ? labels[category] || category : 'その他'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📼 保存された録音データ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">録音データを読み込み中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📼 保存された録音データ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">❌ {error}</p>
            <Button onClick={loadRecordings} variant="outline">
              再試行
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>📼 保存された録音データ</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{recordings.length}件</Badge>
            <Button onClick={loadRecordings} variant="outline" size="sm">
              🔄 更新
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recordings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>📭 まだ録音データがありません</p>
            <p className="text-sm mt-2">上の録音ボタンから音声メッセージを録音してみてください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-sm">
                        {recording.title || '音声メッセージ'}
                      </h3>
                      {recording.category && (
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryLabel(recording.category)}
                        </Badge>
                      )}
                      {!recording.is_read && (
                        <Badge variant="destructive" className="text-xs">
                          未読
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                      <div>🕒 {formatDuration(recording.duration)}</div>
                      <div>📅 {new Date(recording.created_at).toLocaleString('ja-JP')}</div>
                      {recording.audio_metadata && (
                        <>
                          <div>📦 {formatFileSize((recording.audio_metadata as Record<string, unknown>)?.size as number || 0)}</div>
                          <div>🎵 {(recording.audio_metadata as Record<string, unknown>)?.format as string || '不明'}</div>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 mb-3">
                      <div>ID: {recording.id}</div>
                      <div>URL: {recording.audio_url.length > 50
                        ? `${recording.audio_url.substring(0, 50)}...`
                        : recording.audio_url}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {playingId === recording.id ? (
                      <Button
                        onClick={stopAudio}
                        variant="destructive"
                        size="sm"
                        className="text-xs"
                      >
                        ⏹️ 停止
                      </Button>
                    ) : (
                      <Button
                        onClick={() => playAudio(recording.audio_url, recording.id)}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        ▶️ 再生
                      </Button>
                    )}

                    {recording.audio_url.startsWith('offline-audio-') ? (
                      <Badge variant="outline" className="text-xs">
                        オフライン
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">
                        オンライン
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}