'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MessageList } from '@/components/messages/message-list'
import { MessageComposer } from '@/components/messages/message-composer'
import { RelationshipManager } from '@/components/relationships/relationship-manager'
import { RequestManager } from '@/components/requests/request-manager'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface DashboardProps {
  user: User
  profile: Profile
}

type DashboardTab = 'messages' | 'send' | 'relationships' | 'requests'

export function Dashboard({ user, profile }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('messages')
  const [selectedReceiver] = useState<string | null>(null)

  const canGive = profile.role === 'giver' || profile.role === 'both'
  const canReceive = profile.role === 'receiver' || profile.role === 'both'

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          こんにちは、{profile.display_name}さん
        </h1>
        <p className="text-gray-600">
          {profile.role === 'giver' && '応援メッセージを送って誰かを元気にしましょう'}
          {profile.role === 'receiver' && '大切な人からの応援メッセージをお楽しみください'}
          {profile.role === 'both' && '応援メッセージを送ったり受け取ったりできます'}
        </p>
      </div>

      {/* タブナビゲーション */}
      <div className="flex flex-wrap gap-2 mb-6 border-b">
        <Button
          variant={activeTab === 'messages' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('messages')}
        >
          📥 メッセージ
        </Button>
        
        {canGive && (
          <Button
            variant={activeTab === 'send' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('send')}
          >
            🎤 送信
          </Button>
        )}
        
        <Button
          variant={activeTab === 'relationships' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('relationships')}
        >
          👥 関係管理
        </Button>
        
        <Button
          variant={activeTab === 'requests' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('requests')}
        >
          📝 リクエスト
        </Button>
      </div>

      {/* タブコンテンツ */}
      <div className="space-y-6">
        {activeTab === 'messages' && (
          <Card>
            <CardHeader>
              <CardTitle>受信メッセージ</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageList userId={user.id} type="received" />
            </CardContent>
          </Card>
        )}

        {activeTab === 'send' && canGive && (
          <div className="space-y-4">
            <MessageComposer
              userId={user.id}
              receiverId={selectedReceiver || undefined}
              onMessageSent={() => {
                // メッセージ送信後の処理
                setActiveTab('messages')
              }}
            />

            {!selectedReceiver && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600">
                    💡 関係管理タブで受信者との関係を確立してからメッセージを送信してください
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'relationships' && (
          <Card>
            <CardHeader>
              <CardTitle>関係管理</CardTitle>
            </CardHeader>
            <CardContent>
              <RelationshipManager userId={user.id} userRole={profile.role} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'requests' && (
          <Card>
            <CardHeader>
              <CardTitle>
                {canReceive ? '応援をリクエスト' : 'リクエスト管理'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RequestManager userId={user.id} userRole={profile.role} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}