'use client'

import React, { useState, useCallback } from 'react'
import { useCollaboration } from '@/hooks/use-collaboration'
import { CollaborationUser } from '@/lib/realtime/collaboration'
import { VoiceRecorderSupabase } from '@/components/voice-recorder-supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'

interface CollaborativeVoiceRoomProps {
  roomId: string
  currentUser: CollaborationUser
  onLeaveRoom?: () => void
}

export function CollaborativeVoiceRoom({
  roomId,
  currentUser,
  onLeaveRoom
}: CollaborativeVoiceRoomProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const {
    onlineUsers,
    typingUsers,
    messages,
    isConnected,
    sendVoiceMessage,
    startTyping,
    stopTyping,
    updateUserStatus,
    disconnect
  } = useCollaboration({
    roomId,
    user: currentUser,
    enabled: true
  })

  const handleVoiceRecordingComplete = useCallback(async (
    audioBlob: Blob,
    duration: number,
    transcription?: string
  ) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      await sendVoiceMessage(arrayBuffer, duration, transcription)
    } catch (error) {
      console.error('Failed to send voice message:', error)
    }
  }, [sendVoiceMessage])

  const handleRecordingStart = useCallback(async () => {
    setIsRecording(true)
    await startTyping()
  }, [startTyping])

  const handleRecordingStop = useCallback(async () => {
    setIsRecording(false)
    await stopTyping()
  }, [stopTyping])

  const handleLeaveRoom = useCallback(() => {
    disconnect()
    onLeaveRoom?.()
  }, [disconnect, onLeaveRoom])

  const playVoiceMessage = useCallback((audioBuffer: ArrayBuffer) => {
    try {
      const audioContext = new AudioContext()
      audioContext.decodeAudioData(audioBuffer.slice(0), (buffer) => {
        const source = audioContext.createBufferSource()
        source.buffer = buffer

        if (!isMuted) {
          source.connect(audioContext.destination)
        }

        source.start()
      })
    } catch (error) {
      console.error('Failed to play voice message:', error)
    }
  }, [isMuted])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Online Users */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold">参加者</h2>
          </div>
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'オンライン' : 'オフライン'}
          </Badge>
        </div>

        <div className="space-y-3">
          {onlineUsers.map((user) => {
            const isTyping = typingUsers.some(t => t.userId === user.id)

            return (
              <div key={user.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="text-xs">
                      {getUserInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(user.status)}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  {isTyping && (
                    <p className="text-xs text-blue-500 animate-pulse">
                      録音中...
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                ルーム: {roomId}
              </h1>
              <p className="text-sm text-gray-500">
                {onlineUsers.length}人が参加中
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {isMuted ? 'ミュート中' : '音声再生'}
              </Button>

              <Button variant="outline" onClick={handleLeaveRoom}>
                ルームを退出
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Mic className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p>まだメッセージがありません</p>
                <p className="text-sm">録音ボタンを押して最初のメッセージを送信してください</p>
              </div>
            ) : (
              messages.map((message) => {
                const user = onlineUsers.find(u => u.id === message.userId) ||
                            { name: 'Unknown User', id: message.userId }
                const isCurrentUser = message.userId === currentUser.id

                return (
                  <Card key={message.id} className={`${isCurrentUser ? 'ml-auto bg-blue-50' : 'mr-auto'} max-w-md`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getUserInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <CardTitle className="text-sm">
                            {isCurrentUser ? 'あなた' : user.name}
                          </CardTitle>
                        </div>
                        <span className="text-xs text-gray-500">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => playVoiceMessage(message.content)}
                            className="h-8"
                          >
                            <Volume2 className="h-4 w-4 mr-2" />
                            再生 ({Math.round(message.duration)}秒)
                          </Button>
                        </div>

                        {message.transcription && (
                          <div className="bg-gray-100 rounded p-2 text-sm">
                            <p className="text-gray-600 text-xs mb-1">テキスト変換:</p>
                            <p>{message.transcription}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>

        {/* Voice Recorder */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="max-w-3xl mx-auto">
            <VoiceRecorderSupabase
              onRecordingComplete={handleVoiceRecordingComplete}
              onRecordingStart={handleRecordingStart}
              onRecordingStop={handleRecordingStop}
              disabled={!isConnected}
              showTranscription={true}
            />

            {isRecording && (
              <div className="text-center text-sm text-blue-600 mt-2 animate-pulse">
                録音中... 他の参加者に通知されています
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}