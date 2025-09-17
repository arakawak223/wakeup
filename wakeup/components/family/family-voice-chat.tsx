'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { VoiceRecorder } from '@/components/voice-recorder'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type VoiceMessage = Database['public']['Tables']['voice_messages']['Row'] & {
  sender: Profile
  receiver: Profile
}
type FamilyConnection = Database['public']['Tables']['family_connections']['Row'] & {
  user1: Profile
  user2: Profile
}

interface FamilyVoiceChatProps {
  userId: string
}

export function FamilyVoiceChat({ userId }: FamilyVoiceChatProps) {
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([])
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessageTitle, setNewMessageTitle] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadFamilyMembers()
  }, [userId])

  useEffect(() => {
    if (selectedMember) {
      loadMessages(selectedMember.id)
    }
  }, [selectedMember, userId])

  const loadFamilyMembers = async () => {
    try {
      setLoading(true)

      // 現在のユーザーの認証状態を確認
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('認証エラー:', authError)
        throw authError
      }
      if (!user) {
        console.error('ユーザーが認証されていません')
        throw new Error('ユーザーが認証されていません')
      }

      // 承認済みの家族関係を取得
      const { data, error } = await supabase
        .from('family_connections')
        .select(`
          *,
          user1:profiles!family_connections_user1_id_fkey(id, display_name, email),
          user2:profiles!family_connections_user2_id_fkey(id, display_name, email)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('status', 'accepted')

      if (error) throw error

      // 自分以外のユーザーを家族メンバーとして抽出
      const members: Profile[] = []
      data?.forEach((connection: FamilyConnection) => {
        const otherUser = connection.user1_id === userId ? connection.user2 : connection.user1
        members.push(otherUser)
      })

      setFamilyMembers(members)
    } catch (error) {
      console.error('家族メンバーの読み込みエラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (otherUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('voice_messages')
        .select(`
          *,
          sender:profiles!voice_messages_sender_id_fkey(id, display_name, email),
          receiver:profiles!voice_messages_receiver_id_fkey(id, display_name, email)
        `)
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
        .order('created_at', { ascending: false })

      if (error) throw error

      setMessages(data || [])
    } catch (error) {
      console.error('メッセージの読み込みエラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }
    }
  }

  const handleVoiceRecorded = async (audioBlob: Blob) => {
    if (!selectedMember) return

    try {
      // 音声ファイルをSupabase Storageにアップロード
      const fileName = `voice-messages/${userId}/${Date.now()}.webm`
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, audioBlob)

      if (uploadError) throw uploadError

      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName)

      // メッセージをデータベースに保存
      const { error: insertError } = await supabase
        .from('voice_messages')
        .insert({
          sender_id: userId,
          receiver_id: selectedMember.id,
          title: newMessageTitle || null,
          audio_url: publicUrl,
          duration: null, // 実際の実装では音声の長さを計算
        })

      if (insertError) throw insertError

      // メッセージリストを更新
      await loadMessages(selectedMember.id)
      setNewMessageTitle('')

      alert('音声メッセージを送信しました！')
    } catch (error) {
      console.error('音声メッセージ送信エラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }
      alert('音声メッセージの送信に失敗しました')
    }
  }

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('voice_messages')
        .update({ is_read: true })
        .eq('id', messageId)
        .eq('receiver_id', userId)

      if (error) throw error

      // メッセージリストを更新
      if (selectedMember) {
        await loadMessages(selectedMember.id)
      }
    } catch (error) {
      console.error('既読マークエラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('ja-JP', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  if (loading) {
    return <div className="text-center py-4">読み込み中...</div>
  }

  return (
    <div className="flex h-[600px] gap-4">
      {/* 家族メンバーリスト */}
      <div className="w-1/3 border-r pr-4">
        <h3 className="font-semibold text-lg mb-4">家族・友人</h3>
        {familyMembers.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-gray-500">
              家族・友人がいません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {familyMembers.map((member) => (
              <Card
                key={member.id}
                className={`cursor-pointer transition-colors ${
                  selectedMember?.id === member.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedMember(member)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{member.display_name || 'ユーザー'}</h4>
                      <p className="text-sm text-gray-600">{member.email}</p>
                    </div>
                    {/* 未読メッセージ数などをここに表示可能 */}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* チャット画面 */}
      <div className="flex-1 flex flex-col">
        {selectedMember ? (
          <>
            {/* チャットヘッダー */}
            <div className="border-b pb-4 mb-4">
              <h3 className="font-semibold text-lg">
                {selectedMember.display_name || 'ユーザー'} との音声チャット
              </h3>
            </div>

            {/* メッセージリスト */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  まだメッセージがありません。<br />
                  最初の音声メッセージを送ってみましょう！
                </div>
              ) : (
                messages.map((message) => {
                  const isFromMe = message.sender_id === userId
                  const isUnread = !message.is_read && !isFromMe

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <Card className={`max-w-xs ${isFromMe ? 'bg-blue-100' : isUnread ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            {message.title && (
                              <h5 className="font-medium text-sm">{message.title}</h5>
                            )}

                            <audio
                              controls
                              className="w-full"
                              onPlay={() => {
                                if (isUnread) {
                                  markAsRead(message.id)
                                }
                              }}
                            >
                              <source src={message.audio_url} type="audio/webm" />
                              お使いのブラウザは音声再生に対応していません。
                            </audio>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{formatDate(message.created_at)}</span>
                              {isUnread && <Badge variant="secondary" className="text-xs">新着</Badge>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })
              )}
            </div>

            {/* 音声メッセージ送信 */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Input
                    placeholder="メッセージのタイトル（任意）"
                    value={newMessageTitle}
                    onChange={(e) => setNewMessageTitle(e.target.value)}
                  />

                  <VoiceRecorder
                    onRecordingComplete={handleVoiceRecorded}
                    disabled={false}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            左から家族・友人を選択して音声チャットを始めましょう
          </div>
        )}
      </div>
    </div>
  )
}