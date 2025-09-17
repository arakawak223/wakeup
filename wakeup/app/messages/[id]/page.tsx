'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row'] & {
  sender: { display_name: string | null; email: string }
}

const categoryLabels: Record<string, string> = {
  thanks: '感謝',
  congratulation: 'お祝い',
  relief: '安心',
  empathy: '共感'
}

export default function SharedMessagePage() {
  const params = useParams()
  const messageId = params.id as string
  const [message, setMessage] = useState<VoiceMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadMessage = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('voice_messages')
        .select(`
          *,
          sender:profiles!voice_messages_sender_id_fkey(display_name, email)
        `)
        .eq('id', messageId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          setError('メッセージが見つかりません')
        } else {
          throw error
        }
        return
      }

      setMessage(data)
    } catch (error) {
      console.error('メッセージの読み込みエラー:', error)
      setError('メッセージの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [supabase, messageId])

  useEffect(() => {
    loadMessage()
  }, [loadMessage])

  const markAsRead = async () => {
    if (!message) return

    try {
      await supabase
        .from('voice_messages')
        .update({ is_read: true })
        .eq('id', message.id)

      setMessage(prev => prev ? { ...prev, is_read: true } : null)
    } catch (error) {
      console.error('既読マークエラー:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !message) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-xl font-semibold mb-2">メッセージが見つかりません</h2>
            <p className="text-gray-600">{error || 'このメッセージは削除されたか、アクセス権限がありません。'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="text-center">
              <div className="text-6xl mb-4">🎵</div>
              <CardTitle className="text-2xl mb-2">
                {message.title || '音声メッセージ'}
              </CardTitle>
              {message.category && (
                <Badge variant="secondary" className="mb-2">
                  {categoryLabels[message.category] || message.category}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-lg text-gray-700">
                <span className="font-semibold">{message.sender.display_name || message.sender.email}</span> からのメッセージ
              </p>
              <p className="text-sm text-gray-500">
                {new Date(message.created_at).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <div className="text-center">
              <audio
                controls
                className="w-full max-w-md mx-auto"
                onPlay={() => {
                  setPlaying(true)
                  if (!message.is_read) markAsRead()
                }}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              >
                <source src={message.audio_url} type="audio/wav" />
                お使いのブラウザは音声再生に対応していません。
              </audio>
            </div>

            {message.duration && (
              <div className="text-center text-sm text-gray-500">
                再生時間: {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
              </div>
            )}

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-gray-600 mb-4">
                このメッセージは WakeUp アプリで作成されました
              </p>
              <Button
                onClick={() => window.location.href = '/'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                WakeUp アプリを開く
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}