import { createClient } from '@supabase/supabase-js'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface CollaborationUser {
  id: string
  name: string
  avatar?: string
  status: 'online' | 'away' | 'offline'
  lastSeen: Date
}

export interface VoiceMessage {
  id: string
  userId: string
  content: ArrayBuffer
  duration: number
  timestamp: Date
  transcription?: string
  emotions?: {
    joy: number
    sadness: number
    anger: number
    fear: number
    surprise: number
    disgust: number
  }
}

export interface TypingIndicator {
  userId: string
  timestamp: Date
}

export class CollaborationManager {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  private channel: RealtimeChannel | null = null
  private currentUser: CollaborationUser | null = null
  private onlineUsers: Map<string, CollaborationUser> = new Map()

  private onUsersUpdated: ((users: CollaborationUser[]) => void) | null = null
  private onMessageReceived: ((message: VoiceMessage) => void) | null = null
  private onTypingUpdated: ((typing: TypingIndicator[]) => void) | null = null

  constructor(roomId: string, user: CollaborationUser) {
    this.currentUser = user
    this.initializeChannel(roomId)
  }

  private initializeChannel(roomId: string) {
    this.channel = this.supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: this.currentUser!.id }
      }
    })

    // Handle user presence (online/offline status)
    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState()
        this.onlineUsers.clear()

        Object.entries(state).forEach(([userId, presences]) => {
          const presence = presences[0] as any
          this.onlineUsers.set(userId, {
            id: userId,
            name: presence.name,
            avatar: presence.avatar,
            status: 'online',
            lastSeen: new Date()
          })
        })

        this.notifyUsersUpdated()
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const presence = newPresences[0] as any
        this.onlineUsers.set(key, {
          id: key,
          name: presence.name,
          avatar: presence.avatar,
          status: 'online',
          lastSeen: new Date()
        })
        this.notifyUsersUpdated()
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        const user = this.onlineUsers.get(key)
        if (user) {
          user.status = 'offline'
          user.lastSeen = new Date()
        }
        this.notifyUsersUpdated()
      })

    // Handle voice message broadcasting
    this.channel
      .on('broadcast', { event: 'voice_message' }, (payload) => {
        if (this.onMessageReceived) {
          this.onMessageReceived(payload.message)
        }
      })

    // Handle typing indicators
    this.channel
      .on('broadcast', { event: 'typing_start' }, (payload) => {
        this.notifyTypingUpdated('start', payload.userId)
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        this.notifyTypingUpdated('stop', payload.userId)
      })

    // Subscribe to channel
    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel!.track({
          name: this.currentUser!.name,
          avatar: this.currentUser!.avatar,
          online_at: new Date().toISOString()
        })
      }
    })
  }

  private typingUsers: Map<string, Date> = new Map()

  private notifyTypingUpdated(action: 'start' | 'stop', userId: string) {
    if (action === 'start') {
      this.typingUsers.set(userId, new Date())
    } else {
      this.typingUsers.delete(userId)
    }

    if (this.onTypingUpdated) {
      const typing = Array.from(this.typingUsers.entries()).map(([userId, timestamp]) => ({
        userId,
        timestamp
      }))
      this.onTypingUpdated(typing)
    }
  }

  private notifyUsersUpdated() {
    if (this.onUsersUpdated) {
      this.onUsersUpdated(Array.from(this.onlineUsers.values()))
    }
  }

  // Public methods
  async sendVoiceMessage(audioBuffer: ArrayBuffer, duration: number, transcription?: string) {
    const message: VoiceMessage = {
      id: crypto.randomUUID(),
      userId: this.currentUser!.id,
      content: audioBuffer,
      duration,
      timestamp: new Date(),
      transcription
    }

    await this.channel?.send({
      type: 'broadcast',
      event: 'voice_message',
      message
    })
  }

  async startTyping() {
    await this.channel?.send({
      type: 'broadcast',
      event: 'typing_start',
      userId: this.currentUser!.id
    })
  }

  async stopTyping() {
    await this.channel?.send({
      type: 'broadcast',
      event: 'typing_stop',
      userId: this.currentUser!.id
    })
  }

  updateUserStatus(status: 'online' | 'away' | 'offline') {
    if (this.currentUser) {
      this.currentUser.status = status
    }

    if (status === 'offline') {
      this.disconnect()
    } else {
      this.channel?.track({
        name: this.currentUser!.name,
        avatar: this.currentUser!.avatar,
        status,
        online_at: new Date().toISOString()
      })
    }
  }

  getOnlineUsers(): CollaborationUser[] {
    return Array.from(this.onlineUsers.values())
  }

  onUsersChange(callback: (users: CollaborationUser[]) => void) {
    this.onUsersUpdated = callback
  }

  onMessageReceive(callback: (message: VoiceMessage) => void) {
    this.onMessageReceived = callback
  }

  onTypingChange(callback: (typing: TypingIndicator[]) => void) {
    this.onTypingUpdated = callback
  }

  disconnect() {
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
    this.onlineUsers.clear()
  }
}