import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { smartNotificationSystem, type SmartNotificationRequest } from '@/lib/notifications/smart-notification-system'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row']
type MessageRequest = Database['public']['Tables']['message_requests']['Row']

// リアルタイム通知のタイプ
export type NotificationType =
  | 'new_voice_message'
  | 'new_message_request'
  | 'request_accepted'
  | 'request_declined'

export interface NotificationData {
  type: NotificationType
  title: string
  message: string
  data?: any
  timestamp: string
}

class RealtimeNotificationService {
  private supabase = createClient()
  private channels: Map<string, RealtimeChannel> = new Map()
  private listeners: Map<string, (notification: NotificationData) => void> = new Map()

  // 音声メッセージの受信を監視
  subscribeToVoiceMessages(userId: string, callback: (message: VoiceMessage) => void) {
    const channelName = `voice_messages_${userId}`

    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_messages',
          filter: `receiver_id=eq.${userId}`
        },
        async (payload) => {
          const newMessage = payload.new as VoiceMessage

          // 送信者の情報を取得
          const { data: sender } = await this.supabase
            .from('profiles')
            .select('display_name')
            .eq('id', newMessage.sender_id)
            .single()

          // 通知を表示
          this.showNotification({
            type: 'new_voice_message',
            title: '新しい音声メッセージ',
            message: `${sender?.display_name || '家族'}から「${newMessage.title}」が届きました`,
            data: newMessage,
            timestamp: new Date().toISOString()
          })

          callback(newMessage)
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return channelName
  }

  // メッセージリクエストの受信を監視
  subscribeToMessageRequests(userId: string, callback: (request: MessageRequest) => void) {
    const channelName = `message_requests_${userId}`

    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_requests',
          filter: `receiver_id=eq.${userId}`
        },
        async (payload) => {
          const newRequest = payload.new as MessageRequest

          // 送信者の情報を取得
          const { data: requester } = await this.supabase
            .from('profiles')
            .select('display_name')
            .eq('id', newRequest.requester_id)
            .single()

          // 通知を表示
          this.showNotification({
            type: 'new_message_request',
            title: '新しいメッセージリクエスト',
            message: `${requester?.display_name || '家族'}から「${newRequest.message}」のリクエストが届きました`,
            data: newRequest,
            timestamp: new Date().toISOString()
          })

          callback(newRequest)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_requests',
          filter: `requester_id=eq.${userId}`
        },
        async (payload) => {
          const updatedRequest = payload.new as MessageRequest

          if (updatedRequest.status === 'accepted') {
            const { data: receiver } = await this.supabase
              .from('profiles')
              .select('display_name')
              .eq('id', updatedRequest.receiver_id)
              .single()

            this.showNotification({
              type: 'request_accepted',
              title: 'リクエストが承認されました',
              message: `${receiver?.display_name || '家族'}があなたのリクエストを承認しました`,
              data: updatedRequest,
              timestamp: new Date().toISOString()
            })
          } else if (updatedRequest.status === 'declined') {
            const { data: receiver } = await this.supabase
              .from('profiles')
              .select('display_name')
              .eq('id', updatedRequest.receiver_id)
              .single()

            this.showNotification({
              type: 'request_declined',
              title: 'リクエストが辞退されました',
              message: `${receiver?.display_name || '家族'}がリクエストを辞退しました`,
              data: updatedRequest,
              timestamp: new Date().toISOString()
            })
          }

          callback(updatedRequest)
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return channelName
  }

  // 通知リスナーを追加
  addNotificationListener(id: string, callback: (notification: NotificationData) => void) {
    this.listeners.set(id, callback)
  }

  // 通知リスナーを削除
  removeNotificationListener(id: string) {
    this.listeners.delete(id)
  }

  // 通知を表示（スマート通知システム統合）
  private async showNotification(notification: NotificationData) {
    // スマート通知リクエストを作成
    const smartRequest: SmartNotificationRequest = {
      id: `notification-${Date.now()}`,
      userId: notification.userId || '',
      senderId: notification.senderId || '',
      type: this.mapNotificationType(notification.type),
      title: notification.title,
      message: notification.message,
      priority: this.mapPriority(notification.type),
      metadata: {
        senderName: notification.senderName,
        category: notification.category
      },
      createdAt: new Date()
    }

    // スマート通知システムで処理
    const deliveryResult = await smartNotificationSystem.processNotification(smartRequest)

    if (deliveryResult.delivered) {
      if (deliveryResult.method === 'immediate') {
        // 即座に配信
        this.deliverNotification(notification)
      }
      // delayed の場合は別途スケジュール処理が必要
    } else {
      console.log(`通知抑制: ${deliveryResult.reason}`)
    }

    // アプリ内通知は常に表示（UI上での制御）
    this.listeners.forEach(callback => {
      callback(notification)
    })
  }

  // 実際の通知配信
  private deliverNotification(notification: NotificationData) {
    // ブラウザの通知API
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.type, // 同じタイプの通知を重複させない
        requireInteraction: notification.type === 'new_voice_message', // 音声メッセージは要インタラクション
        silent: false
      })

      // クリック時の処理
      browserNotification.onclick = () => {
        window.focus()
        browserNotification.close()

        // タイプに応じてページ内の適切なセクションにフォーカス
        if (notification.type === 'new_voice_message') {
          // 受信メッセージタブに切り替える
          const receivedTab = document.querySelector('[data-tab="received"]') as HTMLButtonElement
          receivedTab?.click()
        }
      }

      // 自動的に5秒後に閉じる（音声メッセージ以外）
      if (notification.type !== 'new_voice_message') {
        setTimeout(() => {
          browserNotification.close()
        }, 5000)
      }
    }

    // サウンド通知を再生
    this.playSoundNotification(notification.type)
  }

  // サウンド通知の再生
  private playSoundNotification(type: string) {
    try {
      // 簡単なビープ音を生成
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      let frequency: number
      switch (type) {
        case 'new_voice_message':
          frequency = 800 // 高めの音
          break
        case 'new_message_request':
          frequency = 600 // 中程度の音
          break
        case 'request_accepted':
          frequency = 1000 // さらに高い音
          break
        default:
          frequency = 400 // 低めの音
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
      // サウンド再生に失敗してもエラーを無視
      console.warn('サウンド通知の再生に失敗:', error)
    }
  }

  // 通知タイプのマッピング
  private mapNotificationType(type: string): SmartNotificationRequest['type'] {
    switch (type) {
      case 'new_voice_message':
        return 'voice_message'
      case 'new_message_request':
      case 'request_accepted':
      case 'request_declined':
        return 'message_request'
      default:
        return 'system'
    }
  }

  // 優先度のマッピング
  private mapPriority(type: string): SmartNotificationRequest['priority'] {
    switch (type) {
      case 'new_voice_message':
        return 'normal'
      case 'new_message_request':
        return 'normal'
      case 'request_accepted':
        return 'high'
      case 'request_declined':
        return 'low'
      default:
        return 'low'
    }
  }

  // 通知権限をリクエスト
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  // 購読を解除
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName)
    if (channel) {
      this.supabase.removeChannel(channel)
      this.channels.delete(channelName)
    }
  }

  // 全ての購読を解除
  unsubscribeAll() {
    this.channels.forEach((channel, channelName) => {
      this.supabase.removeChannel(channel)
    })
    this.channels.clear()
    this.listeners.clear()
  }
}

// シングルトンインスタンス
export const realtimeService = new RealtimeNotificationService()

// React Hook
export function useRealtimeNotifications(userId: string) {
  const [notifications, setNotifications] = useState<NotificationData[]>([])

  useEffect(() => {
    if (!userId) return

    const listenerId = `notifications_${userId}_${Date.now()}`

    // 通知リスナーを追加
    realtimeService.addNotificationListener(listenerId, (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 50)) // 最新50件まで保持
    })

    // 音声メッセージとリクエストを監視
    const voiceChannelId = realtimeService.subscribeToVoiceMessages(userId, () => {
      // メッセージリストの再読み込みは各コンポーネントで処理
    })

    const requestChannelId = realtimeService.subscribeToMessageRequests(userId, () => {
      // リクエストリストの再読み込みは各コンポーネントで処理
    })

    // 通知権限をリクエスト
    realtimeService.requestNotificationPermission()

    return () => {
      realtimeService.removeNotificationListener(listenerId)
      realtimeService.unsubscribe(voiceChannelId)
      realtimeService.unsubscribe(requestChannelId)
    }
  }, [userId])

  const clearNotifications = () => setNotifications([])
  const removeNotification = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index))
  }

  return {
    notifications,
    clearNotifications,
    removeNotification
  }
}

// React Hookのインポート
import { useState, useEffect } from 'react'