import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'

export interface PresenceState {
  user_id: string
  display_name: string
  online_at: string
}

class PresenceService {
  private supabase = createClient()
  private presenceChannel: RealtimeChannel | null = null
  private presenceStates = new Map<string, PresenceState[]>()
  private listeners = new Map<string, (states: PresenceState[]) => void>()

  // プレゼンス情報を監視開始
  subscribeToPresence(roomId: string = 'general') {
    if (this.presenceChannel) {
      this.unsubscribe()
    }

    this.presenceChannel = this.supabase.channel(`presence-${roomId}`, {
      config: {
        presence: {
          key: 'user_id'
        }
      }
    })

    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = this.presenceChannel?.presenceState()
        if (newState) {
          const presenceArray = this.transformPresenceState(newState)
          this.presenceStates.set(roomId, presenceArray)
          this.notifyListeners(roomId, presenceArray)
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences)
        this.updatePresenceState(roomId)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences)
        this.updatePresenceState(roomId)
      })

    this.presenceChannel.subscribe()
    return roomId
  }

  // ユーザーのプレゼンス状態を設定
  async setPresence(userId: string, displayName: string, roomId: string = 'general') {
    if (!this.presenceChannel) {
      this.subscribeToPresence(roomId)
    }

    await this.presenceChannel?.track({
      user_id: userId,
      display_name: displayName,
      online_at: new Date().toISOString()
    })
  }

  // プレゼンス状態を解除
  async unsetPresence() {
    await this.presenceChannel?.untrack()
  }

  // リスナーを追加
  addPresenceListener(roomId: string, listenerId: string, callback: (states: PresenceState[]) => void) {
    this.listeners.set(`${roomId}-${listenerId}`, callback)

    // 既存の状態があれば即座に通知
    const existingState = this.presenceStates.get(roomId)
    if (existingState) {
      callback(existingState)
    }
  }

  // リスナーを削除
  removePresenceListener(roomId: string, listenerId: string) {
    this.listeners.delete(`${roomId}-${listenerId}`)
  }

  // プレゼンス監視を停止
  unsubscribe() {
    if (this.presenceChannel) {
      this.supabase.removeChannel(this.presenceChannel)
      this.presenceChannel = null
    }
    this.presenceStates.clear()
    this.listeners.clear()
  }

  // プレゼンス状態を変換
  private transformPresenceState(state: Record<string, any[]>): PresenceState[] {
    return Object.values(state).flat()
  }

  // プレゼンス状態を更新
  private updatePresenceState(roomId: string) {
    if (!this.presenceChannel) return

    const newState = this.presenceChannel.presenceState()
    if (newState) {
      const presenceArray = this.transformPresenceState(newState)
      this.presenceStates.set(roomId, presenceArray)
      this.notifyListeners(roomId, presenceArray)
    }
  }

  // リスナーに通知
  private notifyListeners(roomId: string, states: PresenceState[]) {
    this.listeners.forEach((callback, key) => {
      if (key.startsWith(`${roomId}-`)) {
        callback(states)
      }
    })
  }
}

// シングルトンインスタンス
export const presenceService = new PresenceService()

// React Hook
export function usePresence(userId: string, displayName: string, roomId: string = 'general') {
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([])
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    if (!userId || !displayName) return

    const listenerId = `presence_${userId}_${Date.now()}`

    // プレゼンス監視開始
    presenceService.subscribeToPresence(roomId)

    // リスナー追加
    presenceService.addPresenceListener(roomId, listenerId, (states) => {
      setOnlineUsers(states)
    })

    // 自分のプレゼンス設定
    presenceService.setPresence(userId, displayName, roomId)
    setIsOnline(true)

    // ページを離れる時の処理
    const handleBeforeUnload = () => {
      presenceService.unsetPresence()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        presenceService.unsetPresence()
        setIsOnline(false)
      } else {
        presenceService.setPresence(userId, displayName, roomId)
        setIsOnline(true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      presenceService.removePresenceListener(roomId, listenerId)
      presenceService.unsetPresence()
      setIsOnline(false)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userId, displayName, roomId])

  // オンライン状態を手動で切り替え
  const toggleOnlineStatus = async () => {
    if (isOnline) {
      await presenceService.unsetPresence()
      setIsOnline(false)
    } else {
      await presenceService.setPresence(userId, displayName, roomId)
      setIsOnline(true)
    }
  }

  // 特定のユーザーがオンラインかチェック
  const isUserOnline = (targetUserId: string): boolean => {
    return onlineUsers.some(user => user.user_id === targetUserId)
  }

  // 自分以外のオンラインユーザー取得
  const getOtherOnlineUsers = (): PresenceState[] => {
    return onlineUsers.filter(user => user.user_id !== userId)
  }

  return {
    onlineUsers,
    otherOnlineUsers: getOtherOnlineUsers(),
    isOnline,
    isUserOnline,
    toggleOnlineStatus,
    onlineCount: onlineUsers.length
  }
}