import { useState, useEffect, useCallback, useRef } from 'react'
import { CollaborationManager, CollaborationUser, VoiceMessage, TypingIndicator } from '@/lib/realtime/collaboration'

interface UseCollaborationOptions {
  roomId: string
  user: CollaborationUser
  enabled?: boolean
}

interface UseCollaborationReturn {
  onlineUsers: CollaborationUser[]
  typingUsers: TypingIndicator[]
  messages: VoiceMessage[]
  isConnected: boolean
  sendVoiceMessage: (audioBuffer: ArrayBuffer, duration: number, transcription?: string) => Promise<void>
  startTyping: () => Promise<void>
  stopTyping: () => Promise<void>
  updateUserStatus: (status: 'online' | 'away' | 'offline') => void
  connect: () => void
  disconnect: () => void
}

export function useCollaboration({
  roomId,
  user,
  enabled = true
}: UseCollaborationOptions): UseCollaborationReturn {
  const [onlineUsers, setOnlineUsers] = useState<CollaborationUser[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const collaborationManagerRef = useRef<CollaborationManager | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (!enabled || collaborationManagerRef.current) return

    try {
      const manager = new CollaborationManager(roomId, user)
      collaborationManagerRef.current = manager

      // Set up event listeners
      manager.onUsersChange((users) => {
        setOnlineUsers(users)
      })

      manager.onMessageReceive((message) => {
        setMessages(prev => [...prev, message])
      })

      manager.onTypingChange((typing) => {
        // Filter out current user from typing indicators
        const filteredTyping = typing.filter(t => t.userId !== user.id)
        setTypingUsers(filteredTyping)
      })

      setIsConnected(true)
    } catch (error) {
      console.error('Failed to connect to collaboration:', error)
      setIsConnected(false)
    }
  }, [roomId, user, enabled])

  const disconnect = useCallback(() => {
    if (collaborationManagerRef.current) {
      collaborationManagerRef.current.disconnect()
      collaborationManagerRef.current = null
    }
    setIsConnected(false)
    setOnlineUsers([])
    setTypingUsers([])
  }, [])

  const sendVoiceMessage = useCallback(async (
    audioBuffer: ArrayBuffer,
    duration: number,
    transcription?: string
  ) => {
    if (!collaborationManagerRef.current) return

    try {
      await collaborationManagerRef.current.sendVoiceMessage(audioBuffer, duration, transcription)
    } catch (error) {
      console.error('Failed to send voice message:', error)
    }
  }, [])

  const startTyping = useCallback(async () => {
    if (!collaborationManagerRef.current) return

    try {
      await collaborationManagerRef.current.startTyping()

      // Auto-stop typing after 3 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTyping()
      }, 3000)
    } catch (error) {
      console.error('Failed to start typing indicator:', error)
    }
  }, [])

  const stopTyping = useCallback(async () => {
    if (!collaborationManagerRef.current) return

    try {
      await collaborationManagerRef.current.stopTyping()

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    } catch (error) {
      console.error('Failed to stop typing indicator:', error)
    }
  }, [])

  const updateUserStatus = useCallback((status: 'online' | 'away' | 'offline') => {
    if (collaborationManagerRef.current) {
      collaborationManagerRef.current.updateUserStatus(status)
    }
  }, [])

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [connect, disconnect, enabled])

  // Handle window focus/blur for away status
  useEffect(() => {
    if (!enabled) return

    const handleFocus = () => updateUserStatus('online')
    const handleBlur = () => updateUserStatus('away')

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [enabled, updateUserStatus])

  // Handle page unload for offline status
  useEffect(() => {
    if (!enabled) return

    const handleUnload = () => updateUserStatus('offline')

    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [enabled, updateUserStatus])

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return {
    onlineUsers,
    typingUsers,
    messages,
    isConnected,
    sendVoiceMessage,
    startTyping,
    stopTyping,
    updateUserStatus,
    connect,
    disconnect
  }
}