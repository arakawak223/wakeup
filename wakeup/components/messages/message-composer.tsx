'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

type MessageCategory = 'thanks' | 'congratulation' | 'relief' | 'empathy'

interface MessageComposerProps {
  userId: string
  receiverId?: string
  requestId?: string
  requestMessage?: string
  onMessageSent?: () => void
}

const categoryLabels: Record<MessageCategory, string> = {
  thanks: '感謝',
  congratulation: 'お祝い',
  relief: '安心',
  empathy: '共感'
}

const categoryDescriptions: Record<MessageCategory, string> = {
  thanks: 'ありがとうの気持ちを込めて',
  congratulation: 'おめでとうの気持ちを込めて',
  relief: 'ほっとした気持ちを込めて',
  empathy: '共感の気持ちを込めて'
}

const messageTemplates: Record<MessageCategory, string[]> = {
  thanks: [
    'ありがとう',
    'ありがとうございました',
    '感謝しています',
    '感謝申し上げます'
  ],
  congratulation: [
    'おめでとう',
    'おめでとうございます'
  ],
  relief: [
    '大丈夫だよ',
    'まあ何とかなるよ'
  ],
  empathy: [
    'そうなんや',
    'なるほど',
    'そうやなあ'
  ]
}

type MessageMode = 'select' | 'template' | 'direct'

export function MessageComposer({ userId, receiverId, requestId, requestMessage, onMessageSent }: MessageComposerProps) {
  const [, setMessageMode] = useState<MessageMode>('direct')
  const [useTemplate, setUseTemplate] = useState(false)
  const [, setTitle] = useState('')
  const [category, setCategory] = useState<MessageCategory>('thanks')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const supabase = createClient()

  // カテゴリ変更時にテンプレート選択をリセット
  const handleCategoryChange = (newCategory: MessageCategory) => {
    setCategory(newCategory)
    setSelectedTemplate('')
    setTitle('')
  }

  // テンプレート選択時にタイトルを自動設定
  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template)
    setTitle(template)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('録音開始エラー:', error)
      alert('録音を開始できませんでした。マイクへのアクセスを許可してください。')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!audioBlob || !receiverId) return

    const messageTitle = useTemplate && selectedTemplate ? selectedTemplate : `音声メッセージ_${new Date().toLocaleDateString()}`

    setLoading(true)
    try {
      // 音声ファイルをアップロード
      const fileName = `voice_message_${Date.now()}.wav`
      const { error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob)

      if (uploadError) throw uploadError

      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName)

      // データベースに保存
      const { error: insertError } = await supabase
        .from('voice_messages')
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          title: messageTitle,
          audio_url: publicUrl,
          category: useTemplate ? category : null,
          message_type: requestId ? 'requested' : 'direct',
          request_id: requestId || null
        })

      if (insertError) throw insertError

      // リクエストの場合は、リクエストのステータスを更新
      if (requestId) {
        const { error: updateError } = await supabase
          .from('message_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId)

        if (updateError) throw updateError
      }

      // フォームをリセット
      setMessageMode('direct')
      setUseTemplate(false)
      setTitle('')
      setSelectedTemplate('')
      setAudioBlob(null)
      setCategory('thanks')
      onMessageSent?.()

      alert('メッセージを送信しました！')
    } catch (error) {
      console.error('メッセージ送信エラー:', error)
      alert('メッセージの送信に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>メッセージを作成</CardTitle>
      </CardHeader>
      <CardContent>
        {requestMessage && (
          <div className="mb-4 p-3 border-l-4 border-blue-500 bg-blue-50 rounded">
            <p className="text-sm text-blue-800 font-medium">📝 リクエスト内容:</p>
            <p className="text-blue-700">{requestMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <div className="flex items-center justify-between">
              <Label>テンプレートを使用</Label>
              <button
                type="button"
                onClick={() => setUseTemplate(!useTemplate)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useTemplate ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useTemplate ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {useTemplate && (
              <div className="mt-4 space-y-4">
                <div>
                  <Label>メッセージの分類</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCategoryChange(key as MessageCategory)}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          category === key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium">{label}</div>
                        <div className="text-sm text-gray-600">
                          {categoryDescriptions[key as MessageCategory]}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>メッセージテンプレート</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {messageTemplates[category].map((template, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleTemplateSelect(template)}
                        className={`p-3 border rounded-lg text-center transition-colors ${
                          selectedTemplate === template
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium text-lg">{template}</div>
                      </button>
                    ))}
                  </div>
                  {selectedTemplate && (
                    <p className="text-sm text-green-600 mt-2">
                      ✅ 選択中: {selectedTemplate}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>音声メッセージ</Label>
            <div className="mt-2 space-y-2">
              {!audioBlob ? (
                <Button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  className="w-full"
                >
                  {isRecording ? "⏹️ 録音停止" : "🎤 録音開始"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <audio controls className="w-full">
                    <source src={URL.createObjectURL(audioBlob)} type="audio/wav" />
                  </audio>
                  <Button
                    type="button"
                    onClick={() => setAudioBlob(null)}
                    variant="outline"
                    size="sm"
                  >
                    録音し直す
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            {useTemplate && (
              <Badge variant="secondary">
                {categoryLabels[category]}
              </Badge>
            )}
            <Button
              type="submit"
              disabled={!audioBlob || loading || !receiverId}
            >
              {loading ? '送信中...' : 'メッセージを送信'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}