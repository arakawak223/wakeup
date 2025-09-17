'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { realtimeService } from '@/lib/realtime'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type MessageRequest = Database['public']['Tables']['message_requests']['Row'] & {
  requester: Profile
  receiver: Profile
}

interface MessageRequestProps {
  userId: string
  familyMembers: Profile[]
}

const requestTemplates = [
  '今日どんな日だった？',
  '最近どう？元気にしてる？',
  '今度の予定について教えて',
  '今の気持ちを聞かせて',
  '近況報告をお願いします',
  'お疲れ様の気持ちを聞かせて',
  '今日の良かったことを教えて',
  'みんなに伝えたいことはある？',
  '応援メッセージをください',
  '励ましの言葉をください'
]

export function MessageRequest({ userId, familyMembers }: MessageRequestProps) {
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null)
  const [requestMessage, setRequestMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [useTemplate, setUseTemplate] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sentRequests, setSentRequests] = useState<MessageRequest[]>([])
  const [receivedRequests, setReceivedRequests] = useState<MessageRequest[]>([])
  const supabase = createClient()

  const loadRequests = useCallback(async () => {
    try {
      // 開発モードの場合はモックデータを使用
      if (process.env.NODE_ENV === 'development') {
        console.log('開発モード: メッセージリクエストのモックデータを使用')
        setSentRequests([])
        setReceivedRequests([])
        return
      }

      // 送信したリクエスト
      const { data: sent, error: sentError } = await supabase
        .from('message_requests')
        .select('*')
        .eq('requester_id', userId)
        .order('created_at', { ascending: false })

      if (sentError) {
        console.error('送信リクエスト取得エラー:', sentError)
        // エラーが発生した場合はモックデータを使用
        console.log('エラー発生のため空データを使用')
        setSentRequests([])
        setReceivedRequests([])
        return
      }

      // 受信したリクエスト
      const { data: received, error: receivedError } = await supabase
        .from('message_requests')
        .select('*')
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false })

      if (receivedError) {
        console.error('受信リクエスト取得エラー:', receivedError)
        // エラーが発生した場合はモックデータを使用
        console.log('エラー発生のため空データを使用')
        setSentRequests([])
        setReceivedRequests([])
        return
      }

      // プロファイル情報を別途取得
      const sentWithProfiles = await Promise.all(
        (sent || []).map(async (request) => {
          const { data: requesterProfile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', request.requester_id)
            .single()

          const { data: receiverProfile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', request.receiver_id)
            .single()

          return {
            ...request,
            requester: requesterProfile || { id: request.requester_id, display_name: 'ユーザー', email: '' },
            receiver: receiverProfile || { id: request.receiver_id, display_name: 'ユーザー', email: '' }
          }
        })
      )

      const receivedWithProfiles = await Promise.all(
        (received || []).map(async (request) => {
          const { data: requesterProfile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', request.requester_id)
            .single()

          const { data: receiverProfile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', request.receiver_id)
            .single()

          return {
            ...request,
            requester: requesterProfile || { id: request.requester_id, display_name: 'ユーザー', email: '' },
            receiver: receiverProfile || { id: request.receiver_id, display_name: 'ユーザー', email: '' }
          }
        })
      )

      setSentRequests(sentWithProfiles)
      setReceivedRequests(receivedWithProfiles)
    } catch (error) {
      console.error('リクエスト読み込みエラー:', error)
      // エラー時は空配列を設定
      setSentRequests([])
      setReceivedRequests([])
    }
  }, [userId, supabase])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  // リアルタイム更新を追加
  useEffect(() => {
    if (!userId) return

    const channelId = realtimeService.subscribeToMessageRequests(userId, () => {
      // 新しいリクエストが届いたら再読み込み
      loadRequests()
    })

    return () => {
      realtimeService.unsubscribe(channelId)
    }
  }, [userId, loadRequests])

  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template)
    setRequestMessage(template)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember || !requestMessage.trim()) return

    setLoading(true)
    try {
      // 開発モードの場合はモック処理
      if (process.env.NODE_ENV === 'development') {
        console.log('開発モード: メッセージリクエスト送信をシミュレート')
        // フォームリセット
        setSelectedMember(null)
        setRequestMessage('')
        setSelectedTemplate('')
        setCustomMessage('')
        setUseTemplate(true)
        alert('メッセージリクエストを送信しました！（開発モード）')
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('message_requests')
        .insert({
          requester_id: userId,
          receiver_id: selectedMember.id,
          message: requestMessage.trim(),
          status: 'pending'
        })

      if (error) {
        console.error('リクエスト送信エラー:', error)
        alert('リクエストの送信に失敗しました。開発モードでは正常動作します。')
        setLoading(false)
        return
      }

      // フォームリセット
      setSelectedMember(null)
      setRequestMessage('')
      setSelectedTemplate('')
      setCustomMessage('')
      setUseTemplate(true)

      // リクエスト一覧を更新
      await loadRequests()

      alert('メッセージリクエストを送信しました！')
    } catch (error) {
      console.error('リクエスト送信エラー:', error)
      alert('リクエストの送信に失敗しました。開発モードでは正常動作します。')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestResponse = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      // 開発モードの場合はモック処理
      if (process.env.NODE_ENV === 'development') {
        console.log(`開発モード: リクエスト${action}をシミュレート`)
        if (action === 'accept') {
          alert('リクエストを承認しました。音声メッセージを送信できます。（開発モード）')
        } else {
          alert('リクエストを辞退しました。（開発モード）')
        }
        return
      }

      const newStatus = action === 'accept' ? 'accepted' : 'declined'

      const { error } = await supabase
        .from('message_requests')
        .update({ status: newStatus })
        .eq('id', requestId)

      if (error) {
        console.error('リクエスト応答エラー:', error)
        alert('リクエストの応答に失敗しました。開発モードでは正常動作します。')
        return
      }

      await loadRequests()

      if (action === 'accept') {
        alert('リクエストを承認しました。音声メッセージを送信できます。')
      } else {
        alert('リクエストを辞退しました。')
      }
    } catch (error) {
      console.error('リクエスト応答エラー:', error)
      alert('リクエストの応答に失敗しました。開発モードでは正常動作します。')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">⏳ 承認待ち</Badge>
      case 'accepted':
        return <Badge className="bg-green-500">✅ 承認済み</Badge>
      case 'declined':
        return <Badge variant="destructive">❌ 辞退</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
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
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="space-y-6">
      {/* リクエスト作成フォーム */}
      <Card>
        <CardHeader>
          <CardTitle>📝 音声メッセージをリクエスト</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 家族メンバー選択 */}
            <div>
              <Label>誰にリクエストしますか？</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMember(member)}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      selectedMember?.id === member.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{member.display_name || 'ユーザー'}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{member.email}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* テンプレート切り替え */}
            <div>
              <div className="flex items-center justify-between">
                <Label>テンプレートを使用</Label>
                <button
                  type="button"
                  onClick={() => {
                    setUseTemplate(!useTemplate)
                    if (!useTemplate) {
                      setRequestMessage('')
                      setCustomMessage('')
                    }
                  }}
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
            </div>

            {/* テンプレート選択 */}
            {useTemplate ? (
              <div>
                <Label>リクエストテンプレート</Label>
                <div className="grid grid-cols-1 gap-2 mt-2 max-h-40 overflow-y-auto">
                  {requestTemplates.map((template, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        selectedTemplate === template
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-sm">{template}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label>カスタムメッセージ</Label>
                <Input
                  placeholder="「〜について話してください」"
                  value={customMessage}
                  onChange={(e) => {
                    setCustomMessage(e.target.value)
                    setRequestMessage(e.target.value)
                  }}
                />
              </div>
            )}

            {/* 選択されたメッセージ表示 */}
            {requestMessage && (
              <div className="p-3 border-l-4 border-blue-500 bg-blue-50 rounded">
                <p className="text-sm text-blue-800 font-medium">📝 リクエスト内容:</p>
                <p className="text-blue-700">{requestMessage}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={!selectedMember || !requestMessage.trim() || loading}
              className="w-full"
            >
              {loading ? 'リクエスト送信中...' : 'リクエストを送信'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 受信したリクエスト */}
      {receivedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📬 受信したリクエスト</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {receivedRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{request.requester.display_name}</h4>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{request.message}</p>
                      <p className="text-xs text-gray-500">{formatDate(request.created_at)}</p>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-2 ml-2">
                        <Button
                          size="sm"
                          onClick={() => handleRequestResponse(request.id, 'accept')}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          承認
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestResponse(request.id, 'decline')}
                        >
                          辞退
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 送信したリクエスト */}
      {sentRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📤 送信したリクエスト</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sentRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{request.receiver.display_name} へのリクエスト</h4>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{request.message}</p>
                      <p className="text-xs text-gray-500">{formatDate(request.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}