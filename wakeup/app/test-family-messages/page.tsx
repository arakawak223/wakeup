'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/hybrid-auth-context'
import { VoiceRecorderSupabase } from '@/components/voice-recorder-supabase'
import { FamilyVoiceChat } from '@/components/family/family-voice-chat'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type VoiceMessage = {
  id: string
  title?: string
  duration?: number
  dominant_emotion?: string
  emotion_confidence?: number
  created_at: string
  sender?: { display_name?: string; email?: string }
  receiver?: { display_name?: string; email?: string }
}
import Link from 'next/link'

export default function TestFamilyMessagesPage() {
  const { user, loading } = useAuth()
  const [testMessages, setTestMessages] = useState<VoiceMessage[]>([])
  const [isCreatingTest, setIsCreatingTest] = useState(false)

  const loadTestData = useCallback(async () => {
    if (!user || user.isOffline) return

    try {
      const supabase = createClient()

      // 音声メッセージの確認
      const { data: messages, error } = await supabase
        .from('voice_messages')
        .select(`
          *,
          sender:profiles!voice_messages_sender_id_fkey(display_name, email),
          receiver:profiles!voice_messages_receiver_id_fkey(display_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && messages) {
        setTestMessages(messages)
      }
    } catch (error) {
      console.error('テストデータ読み込みエラー:', error)
    }
  }, [user])

  useEffect(() => {
    if (user && !user.isOffline) {
      loadTestData()
    }
  }, [user, loadTestData])

  const createTestVoiceMessage = async () => {
    if (!user || user.isOffline) return

    setIsCreatingTest(true)
    try {
      const supabase = createClient()

      // テスト用音声メッセージを作成
      const testMessage = {
        sender_id: user.id,
        receiver_id: user.id, // 自分宛てのテストメッセージ
        title: 'テスト音声メッセージ',
        audio_url: 'https://example.com/test-audio.mp3',
        duration: 5,
        category: 'general',
        message_type: 'direct',
        emotion_analysis: {
          dominant_emotion: 'joy',
          confidence: 0.85,
          emotions: { joy: 0.85, neutral: 0.15 }
        },
        dominant_emotion: 'joy',
        emotion_confidence: 0.85
      }

      const { data, error } = await supabase
        .from('voice_messages')
        .insert(testMessage)
        .select()

      if (error) {
        console.error('テストメッセージ作成エラー:', error)
        alert('テストメッセージ作成に失敗しました: ' + error.message)
      } else {
        console.log('テストメッセージ作成成功:', data)
        alert('テストメッセージを作成しました！')
        loadTestData()
      }
    } catch (error) {
      console.error('テストメッセージ作成例外:', error)
    } finally {
      setIsCreatingTest(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>認証情報を確認中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>🔒 ログインが必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">家族メッセージ機能をテストするにはログインしてください。</p>
            <Button asChild>
              <Link href="/auth/login">ログインページへ</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">🎵 家族音声メッセージテスト</h1>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge variant={user.isOffline ? "secondary" : "default"}>
              {user.isOffline ? '📱 オフラインモード' : '☁️ オンラインモード'}
            </Badge>
            <Badge variant="outline">
              ユーザー: {user.name || user.email}
            </Badge>
          </div>
          <p className="text-gray-600">
            音声録音からメッセージ送信までの完全なフローをテストできます
          </p>
        </div>

        <Tabs defaultValue="record" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="record">🎤 音声録音</TabsTrigger>
            <TabsTrigger value="chat">💬 家族チャット</TabsTrigger>
            <TabsTrigger value="messages">📨 メッセージ一覧</TabsTrigger>
            <TabsTrigger value="test">🧪 テスト機能</TabsTrigger>
          </TabsList>

          <TabsContent value="record">
            <Card>
              <CardHeader>
                <CardTitle>🎤 音声録音テスト</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    音声を録音して、感情分析や品質評価をテストできます。
                  </p>
                  <VoiceRecorderSupabase
                    user={{
                      id: user.id,
                      email: user.email,
                      app_metadata: {},
                      user_metadata: {},
                      aud: 'authenticated',
                      created_at: new Date().toISOString()
                    } as User}
                    onRecordingComplete={(messageId) => {
                      console.log('録音完了:', messageId)
                      alert(`録音が完了しました！メッセージID: ${messageId}`)
                      loadTestData()
                    }}
                    showQualityMetrics={true}
                    mode="standalone"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card>
              <CardHeader>
                <CardTitle>💬 家族音声チャット</CardTitle>
              </CardHeader>
              <CardContent>
                {!user.isOffline ? (
                  <FamilyVoiceChat userId={user.id} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      家族チャット機能はオンラインモードでのみ利用可能です。
                    </p>
                    <Badge variant="secondary">オフラインモード</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>📨 音声メッセージ一覧</CardTitle>
              </CardHeader>
              <CardContent>
                {user.isOffline ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      メッセージ一覧はオンラインモードでのみ表示できます。
                    </p>
                    <Badge variant="secondary">オフラインモード</Badge>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">
                        最新のメッセージ {testMessages.length}件
                      </p>
                      <Button onClick={loadTestData} size="sm" variant="outline">
                        🔄 更新
                      </Button>
                    </div>

                    {testMessages.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">まだメッセージがありません</p>
                        <p className="text-sm text-gray-400 mt-2">
                          音声録音でメッセージを作成してみてください
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {testMessages.map((message, index) => (
                          <div
                            key={message.id || index}
                            className="border rounded-lg p-4 bg-white"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{message.title || '無題'}</h4>
                              <Badge variant="outline">
                                {message.duration || 0}秒
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>
                                送信者: {message.sender?.display_name || message.sender?.email || '不明'}
                              </p>
                              <p>
                                受信者: {message.receiver?.display_name || message.receiver?.email || '不明'}
                              </p>
                              {message.dominant_emotion && (
                                <p>
                                  感情: {message.dominant_emotion}
                                  ({Math.round((message.emotion_confidence || 0) * 100)}%)
                                </p>
                              )}
                              <p className="text-xs">
                                作成日時: {new Date(message.created_at).toLocaleString('ja-JP')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test">
            <Card>
              <CardHeader>
                <CardTitle>🧪 テスト機能</CardTitle>
              </CardHeader>
              <CardContent>
                {user.isOffline ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      テスト機能はオンラインモードでのみ利用可能です。
                    </p>
                    <Badge variant="secondary">オフラインモード</Badge>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">データベーステスト</h3>
                      <p className="text-sm text-gray-600">
                        テスト用の音声メッセージを作成して、データベース機能を確認できます。
                      </p>
                      <Button
                        onClick={createTestVoiceMessage}
                        disabled={isCreatingTest}
                        className="w-full sm:w-auto"
                      >
                        {isCreatingTest ? '作成中...' : '📝 テストメッセージを作成'}
                      </Button>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-2">機能チェックリスト</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>✅</span>
                          <span>ハイブリッド認証システム</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>✅</span>
                          <span>Supabaseデータベース接続</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>🔄</span>
                          <span>音声録音機能</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>🔄</span>
                          <span>感情分析機能</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>🔄</span>
                          <span>家族メッセージ送信</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href="/">🏠 ホームに戻る</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}