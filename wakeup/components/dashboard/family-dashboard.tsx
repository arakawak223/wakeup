'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FamilyInvite } from '@/components/family/family-invite'
import { FamilyList } from '@/components/family/family-list'
import { InvitationManager } from '@/components/family/invitation-manager'
import { FamilyVoiceChat } from '@/components/family/family-voice-chat'
import { IntegratedVoiceSender } from '@/components/messages/integrated-voice-sender'
import { MessageRequest } from '@/components/messages/message-request'
import { VoiceMessageComposer } from '@/components/messages/voice-message-composer'
import { SentHistory } from '@/components/messages/sent-history'
import { VoiceMessageReceiver } from '@/components/messages/voice-message-receiver'
import { InboxNotifications } from '@/components/messages/inbox-notifications'
import { VoiceFunctionalityTest } from '@/components/test/voice-functionality-test'
import { E2EVoiceTest } from '@/components/test/e2e-voice-test'
import { NotificationSettingsComponent } from '@/components/notifications/notification-settings'
import { DevControls } from '@/components/dev-mode/dev-controls'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { ToastNotifications } from '@/components/notifications/toast-notifications'
import { OnlineStatus } from '@/components/presence/online-status'
import { getMockFamilyMembers } from '@/lib/dev-mode'
import { createClient } from '@/lib/supabase/client'
import { realtimeService } from '@/lib/realtime'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface FamilyDashboardProps {
  user: User
  profile: Profile
}

type DashboardTab = 'chat' | 'family' | 'requests' | 'send' | 'advanced' | 'received' | 'sent' | 'settings' | 'test'

export function FamilyDashboard({ user, profile }: FamilyDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('chat')
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const supabase = createClient()

  // 承認済みの家族メンバーを取得
  const loadFamilyMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('family_connections')
        .select(`
          *,
          user1:profiles!user1_id(id, display_name, email),
          user2:profiles!user2_id(id, display_name, email)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq('status', 'accepted')

      if (error) throw error

      // 自分以外のユーザーを家族メンバーとして抽出
      const members: Profile[] = []
      data?.forEach((connection: Database['public']['Tables']['family_connections']['Row'] & { user1: Profile; user2: Profile }) => {
        const otherUser = connection.user1_id === user.id ? connection.user2 : connection.user1
        members.push(otherUser)
      })

      // 開発モードの場合、モックデータを追加
      const mockMembers = getMockFamilyMembers(user.id)
      const allMembers = [...members, ...mockMembers]

      setFamilyMembers(allMembers)
    } catch (error) {
      console.error('家族メンバーの読み込みエラー:', error)

      // エラーが発生した場合でも、開発モードではモックデータを表示
      const mockMembers = getMockFamilyMembers(user.id)
      setFamilyMembers(mockMembers)
    }
  }, [user.id, supabase])

  useEffect(() => {
    loadFamilyMembers()
  }, [loadFamilyMembers])

  // リアルタイム通知を設定
  useEffect(() => {
    // 音声メッセージの受信を監視
    const voiceChannelId = realtimeService.subscribeToVoiceMessages(user.id, () => {
      setRefreshTrigger((prev: number) => prev + 1)
    })

    // メッセージリクエストの受信を監視
    const requestChannelId = realtimeService.subscribeToMessageRequests(user.id, () => {
      setRefreshTrigger(prev => prev + 1)
    })

    return () => {
      realtimeService.unsubscribe(voiceChannelId)
      realtimeService.unsubscribe(requestChannelId)
    }
  }, [user.id])

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              こんにちは、{profile.display_name}さん 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              家族や親しい友人と音声メッセージでつながりましょう
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InboxNotifications
              onMessageClick={(messageId) => {
                // メッセージ詳細表示の実装
                console.log('メッセージクリック:', messageId)
              }}
            />
            <OnlineStatus
              userId={user.id}
              displayName={profile.display_name || 'ユーザー'}
              familyMembers={familyMembers}
            />
            <NotificationCenter userId={user.id} />
          </div>
        </div>
      </div>

      {/* 開発モードコントロール */}
      <div className="mb-6">
        <DevControls userId={user.id} onDataChanged={loadFamilyMembers} />
      </div>

      {/* タブナビゲーション */}
      <div className="flex gap-2 mb-6 border-b">
        <Button
          variant={activeTab === 'chat' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('chat')}
          className="text-lg"
        >
          💬 音声チャット
        </Button>

        <Button
          variant={activeTab === 'family' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('family')}
          className="text-lg"
        >
          👨‍👩‍👧‍👦 家族管理
        </Button>

        <Button
          variant={activeTab === 'requests' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('requests')}
          className="text-lg"
        >
          📝 リクエスト
        </Button>

        <Button
          variant={activeTab === 'send' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('send')}
          className="text-lg"
        >
          🎤 簡単送信
        </Button>

        <Button
          variant={activeTab === 'advanced' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('advanced')}
          className="text-lg"
        >
          🎛️ 高品質録音
        </Button>

        <Button
          variant={activeTab === 'received' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('received')}
          className="text-lg"
          data-tab="received"
        >
          📥 受信済み
        </Button>

        <Button
          variant={activeTab === 'sent' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('sent')}
          className="text-lg"
        >
          📤 送信済み
        </Button>

        <Button
          variant={activeTab === 'settings' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('settings')}
          className="text-lg"
        >
          ⚙️ 設定
        </Button>

        <Button
          variant={activeTab === 'test' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('test')}
          className="text-lg"
        >
          🧪 テスト
        </Button>
      </div>

      {/* タブコンテンツ */}
      <div className="space-y-6">
        {activeTab === 'chat' && (
          <Card>
            <CardHeader>
              <CardTitle>音声メッセージチャット</CardTitle>
            </CardHeader>
            <CardContent>
              <FamilyVoiceChat userId={user.id} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'family' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
              <FamilyInvite onInviteSuccess={() => {
                loadFamilyMembers()
                setRefreshTrigger(prev => prev + 1)
              }} />
              <InvitationManager
                onRequestHandled={() => {
                  loadFamilyMembers()
                  setRefreshTrigger(prev => prev + 1)
                }}
                refreshTrigger={refreshTrigger}
              />
            </div>
            <FamilyList refreshTrigger={refreshTrigger} />
          </div>
        )}

        {activeTab === 'requests' && (
          <Card>
            <CardHeader>
              <CardTitle>メッセージリクエスト</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageRequest userId={user.id} familyMembers={familyMembers} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'send' && (
          <IntegratedVoiceSender
            onMessageSent={(messageId) => {
              console.log('音声メッセージが送信されました:', messageId)
              // 送信履歴やメッセージ一覧を更新
              loadFamilyMembers()
            }}
          />
        )}

        {activeTab === 'received' && (
          <VoiceMessageReceiver />
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-4">
            {familyMembers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    高品質音声メッセージを送信するには、まず家族・友人を追加してください
                  </p>
                  <Button onClick={() => setActiveTab('family')}>
                    👨‍👩‍👧‍👦 家族管理へ
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🎛️ 高品質音声メッセージ作成
                      <Badge variant="outline" className="text-xs">
                        NEW
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      音声品質の自動調整、プレビュー、フィルター機能を使って
                      より良い音声メッセージを作成できます
                    </p>
                  </CardHeader>
                </Card>
                {familyMembers.map((member) => (
                  <VoiceMessageComposer
                    key={member.id}
                    userId={user.id}
                    receiverId={member.id}
                    receiver={member}
                    onMessageSent={() => {
                      setActiveTab('sent')
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sent' && (
          <SentHistory user={user} />
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <NotificationSettingsComponent
              userId={user.id}
              onSettingsChanged={(settings) => {
                console.log('通知設定が更新されました:', settings)
              }}
            />
          </div>
        )}

        {activeTab === 'test' && (
          <div className="space-y-6">
            <VoiceFunctionalityTest />
            <E2EVoiceTest />
          </div>
        )}
      </div>

      {/* トースト通知 */}
      <ToastNotifications userId={user.id} />
    </div>
  )
}