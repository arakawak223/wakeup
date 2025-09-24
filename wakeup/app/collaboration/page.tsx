'use client'

// Dynamic rendering for real-time features
export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { CollaborativeVoiceRoom } from '@/components/collaboration/collaborative-voice-room'
import { CollaborationUser } from '@/lib/realtime/collaboration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Plus } from 'lucide-react'

export default function CollaborationPage() {
  const [currentRoom, setCurrentRoom] = useState<string | null>(null)
  const [roomInput, setRoomInput] = useState('')
  const [userName, setUserName] = useState('')

  // Mock current user - in real app this would come from authentication
  const currentUser: CollaborationUser = {
    id: 'user-' + Math.random().toString(36).substr(2, 9),
    name: userName || 'Guest User',
    status: 'online',
    lastSeen: new Date()
  }

  const handleJoinRoom = () => {
    if (roomInput.trim() && userName.trim()) {
      setCurrentRoom(roomInput.trim())
    }
  }

  const handleLeaveRoom = () => {
    setCurrentRoom(null)
    setRoomInput('')
  }

  const predefinedRooms = [
    { id: 'general', name: 'General Discussion', users: 3 },
    { id: 'team-meeting', name: 'Team Meeting', users: 5 },
    { id: 'project-alpha', name: 'Project Alpha', users: 2 },
  ]

  if (currentRoom) {
    return (
      <CollaborativeVoiceRoom
        roomId={currentRoom}
        currentUser={currentUser}
        onLeaveRoom={handleLeaveRoom}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            リアルタイム音声コラボレーション
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            音声メッセージを使ってリアルタイムでチームメンバーとコラボレーションしましょう。
            複数人が同時に参加でき、音声の録音、再生、テキスト変換機能が利用できます。
          </p>
        </div>

        {/* User Setup */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>ユーザー設定</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-2">
                  表示名
                </label>
                <Input
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="あなたの名前を入力してください"
                  className="max-w-md"
                />
              </div>

              {userName && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">プレビュー:</span>
                  <Badge variant="outline">{userName}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Room Management */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>ルームに参加</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="ルーム名を入力"
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
                <Button
                  onClick={handleJoinRoom}
                  disabled={!roomInput.trim() || !userName.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  参加
                </Button>
              </div>

              {!userName.trim() && (
                <p className="text-sm text-yellow-600">
                  ルームに参加するには、まず表示名を入力してください。
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Predefined Rooms */}
        <Card>
          <CardHeader>
            <CardTitle>利用可能なルーム</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {predefinedRooms.map((room) => (
                <div
                  key={room.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (userName.trim()) {
                      setRoomInput(room.id)
                      setCurrentRoom(room.id)
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{room.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {room.users}人
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    ルーム ID: {room.id}
                  </p>

                  {!userName.trim() && (
                    <p className="text-xs text-yellow-600 mt-2">
                      参加するには表示名が必要です
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Feature List */}
        <div className="mt-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">機能</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              '音声録音・再生',
              'リアルタイム配信',
              'テキスト変換',
              '参加者表示'
            ].map((feature, index) => (
              <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm font-medium text-gray-900">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}