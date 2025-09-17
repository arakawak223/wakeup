'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { realtimeService } from '@/lib/realtime'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row'] & {
  sender: { display_name: string | null }
}

const categoryLabels: Record<string, string> = {
  thanks: '感謝',
  congratulation: 'お祝い',
  relief: '安心',
  empathy: '共感'
}

interface MessageListProps {
  userId: string
  type: 'received' | 'sent'
}

export function MessageList({ userId, type }: MessageListProps) {
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [currentAudio, setCurrentAudio] = useState<string | null>(null)
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)

      const query = supabase
        .from('voice_messages')
        .select(`
          *,
          sender:profiles!sender_id(display_name)
        `)
        .order('created_at', { ascending: false })

      if (type === 'received') {
        query.eq('receiver_id', userId)
      } else {
        query.eq('sender_id', userId)
      }

      const { data, error } = await query

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('メッセージの読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, type, supabase])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // リアルタイム更新を追加
  useEffect(() => {
    if (!userId || type !== 'received') return

    const channelId = realtimeService.subscribeToVoiceMessages(userId, (newMessage) => {
      // 新着メッセージIDを追加
      setNewMessageIds(prev => new Set(prev).add(newMessage.id))

      // メッセージリストを再読み込み
      loadMessages()

      // 5秒後に新着バッジを自動削除
      setTimeout(() => {
        setNewMessageIds(prev => {
          const updated = new Set(prev)
          updated.delete(newMessage.id)
          return updated
        })
      }, 5000)
    })

    return () => {
      realtimeService.unsubscribe(channelId)
    }
  }, [userId, type, loadMessages])

  const playAudio = (audioUrl: string) => {
    if (currentAudio === audioUrl) {
      setCurrentAudio(null)
      return
    }
    setCurrentAudio(audioUrl)
  }

  const markAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('voice_messages')
        .update({ is_read: true })
        .eq('id', messageId)
        
      // ローカル状態も更新
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, is_read: true } : msg
      ))
    } catch (error) {
      console.error('既読マークエラー:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-700 dark:text-gray-300">読み込み中...</div>
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {type === 'received' ? 'まだ受信したメッセージがありません' : 'まだ送信したメッセージがありません'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isNew = newMessageIds.has(message.id)
        const isUnread = !message.is_read && type === 'received'

        return (
          <Card
            key={message.id}
            className={`relative ${isUnread ? 'border-blue-300 bg-blue-50' : ''} ${isNew ? 'animate-pulse border-green-400 bg-green-50' : ''}`}
          >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{message.title || '音声メッセージ'}</h3>
                  {isNew && (
                    <Badge variant="destructive" className="text-xs animate-bounce">
                      🎉 NEW
                    </Badge>
                  )}
                  {message.category && (
                    <Badge variant="secondary" className="text-xs">
                      {categoryLabels[message.category] || message.category}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {type === 'received' ? `送信者: ${message.sender.display_name}` : '送信済み'} •
                  {new Date(message.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
              {!message.is_read && type === 'received' && (
                <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs">未読</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  playAudio(message.audio_url)
                  if (!message.is_read && type === 'received') {
                    markAsRead(message.id)
                  }
                }}
                variant={currentAudio === message.audio_url ? "secondary" : "outline"}
              >
                {currentAudio === message.audio_url ? "⏸️ 停止" : "▶️ 再生"}
              </Button>

              {type === 'sent' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/messages/${message.id}`
                    navigator.clipboard.writeText(shareUrl).then(() => {
                      alert('共有リンクをコピーしました！')
                    }).catch(() => {
                      alert(`共有リンク: ${shareUrl}`)
                    })
                  }}
                >
                  🔗 共有
                </Button>
              )}

              {message.duration && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>

            {currentAudio === message.audio_url && (
              <audio 
                src={message.audio_url} 
                controls 
                autoPlay 
                className="w-full mt-2"
                onEnded={() => setCurrentAudio(null)}
              />
            )}
          </CardContent>
        </Card>
        )
      })}
    </div>
  )
}