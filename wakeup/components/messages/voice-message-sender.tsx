'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VoiceRecorder } from '@/components/voice-recorder'
import { uploadVoiceMessage } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface VoiceMessageSenderProps {
  userId: string
  receiverId: string
  receiver: Profile
  onMessageSent?: () => void
  requestId?: string
}

export function VoiceMessageSender({
  userId,
  receiverId,
  receiver,
  onMessageSent,
  requestId
}: VoiceMessageSenderProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState<number>(0)
  const supabase = createClient()

  const handleRecordingComplete = (audioBlob: Blob) => {
    setRecordedAudio(audioBlob)

    // 録音時間を計算（概算）
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)
    audio.addEventListener('loadedmetadata', () => {
      setRecordingDuration(audio.duration)
      URL.revokeObjectURL(url)
    })
  }

  const handleSendMessage = async () => {
    if (!recordedAudio || !title.trim()) {
      alert('タイトルと音声録音が必要です')
      return
    }

    setIsUploading(true)
    try {
      // 音声ファイルをSupabase Storageにアップロード
      const uploadResult = await uploadVoiceMessage(
        recordedAudio,
        title.replace(/[^a-zA-Z0-9\-_]/g, ''), // ファイル名から特殊文字を除去
        userId
      )

      if (!uploadResult) {
        throw new Error('音声ファイルのアップロードに失敗しました')
      }

      // データベースに音声メッセージレコードを保存
      const { error } = await supabase
        .from('voice_messages')
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          title: title.trim(),
          audio_url: uploadResult.url,
          duration: Math.round(recordingDuration),
          category: category.trim() || null,
          message_type: requestId ? 'response' : 'direct',
          request_id: requestId || null
        })

      if (error) throw error

      // リクエストに対する返信の場合、リクエストのステータスを更新
      if (requestId) {
        await supabase
          .from('message_requests')
          .update({ status: 'completed' })
          .eq('id', requestId)
      }

      // フォームをリセット
      setTitle('')
      setCategory('')
      setRecordedAudio(null)
      setRecordingDuration(0)

      alert('音声メッセージを送信しました！')

      if (onMessageSent) {
        onMessageSent()
      }

    } catch (error) {
      console.error('メッセージ送信エラー:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setIsUploading(false)
    }
  }

  const categories = [
    '日常',
    '応援',
    '感謝',
    'お疲れ様',
    '近況報告',
    '相談',
    'その他'
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          🎤 {receiver.display_name}さんに音声メッセージを送信
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="title">メッセージタイトル *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 今日のお疲れ様メッセージ"
            maxLength={100}
          />
        </div>

        <div>
          <Label htmlFor="category">カテゴリー</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">カテゴリーを選択</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>音声録音 *</Label>
          <VoiceRecorder
            userId={userId}
            mode="send"
            onRecordingComplete={handleRecordingComplete}
            disabled={isUploading}
          />
          {recordedAudio && (
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                ✅ 音声が録音されました
                {recordingDuration > 0 && (
                  <span className="ml-2">
                    ({Math.round(recordingDuration)}秒)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSendMessage}
            disabled={!recordedAudio || !title.trim() || isUploading}
            className="flex-1"
          >
            {isUploading ? '送信中...' : '🎵 音声メッセージを送信'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setTitle('')
              setCategory('')
              setRecordedAudio(null)
              setRecordingDuration(0)
            }}
            disabled={isUploading}
          >
            リセット
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}