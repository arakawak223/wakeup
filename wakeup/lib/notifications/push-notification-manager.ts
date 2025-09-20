/**
 * プッシュ通知管理システム
 */

export interface PushNotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  vibrate?: number[]
  actions?: NotificationAction[]
  data?: any
}

export interface NotificationSubscriptionInfo {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export class PushNotificationManager {
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null
  private pushSubscription: PushSubscription | null = null

  constructor() {
    this.initializeServiceWorker()
  }

  // Service Workerの初期化
  private async initializeServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Workerはサポートされていません')
    }

    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('Service Worker registered successfully')

      // Service Worker更新の監視
      this.serviceWorkerRegistration.addEventListener('updatefound', () => {
        const newWorker = this.serviceWorkerRegistration?.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新しいService Workerが利用可能
              this.notifyNewVersionAvailable()
            }
          })
        }
      })

    } catch (error) {
      console.error('Service Worker registration failed:', error)
      throw error
    }
  }

  // プッシュ通知の許可を要求
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      throw new Error('このブラウザは通知をサポートしていません')
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  // 通知権限の状態を取得
  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied'
    }
    return Notification.permission
  }

  // プッシュ通知のサブスクリプションを取得
  async subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.serviceWorkerRegistration) {
      await this.initializeServiceWorker()
    }

    if (!this.serviceWorkerRegistration) {
      throw new Error('Service Workerが利用できません')
    }

    try {
      // 既存のサブスクリプションを確認
      let subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()

      if (!subscription) {
        // 新しいサブスクリプションを作成
        subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        })
      }

      this.pushSubscription = subscription
      console.log('プッシュ通知にサブスクライブしました')

      return subscription
    } catch (error) {
      console.error('プッシュサブスクリプション失敗:', error)
      throw error
    }
  }

  // サブスクリプションの解除
  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.pushSubscription) {
      return true
    }

    try {
      const result = await this.pushSubscription.unsubscribe()
      this.pushSubscription = null
      console.log('プッシュ通知のサブスクリプションを解除しました')
      return result
    } catch (error) {
      console.error('サブスクリプション解除失敗:', error)
      return false
    }
  }

  // ローカル通知を表示
  async showLocalNotification(options: PushNotificationOptions): Promise<void> {
    if (this.getPermissionStatus() !== 'granted') {
      throw new Error('通知の許可が必要です')
    }

    if (!this.serviceWorkerRegistration) {
      // Service Workerが利用できない場合はブラウザ標準の通知を使用
      new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        badge: options.badge,
        tag: options.tag,
        requireInteraction: options.requireInteraction,
        silent: options.silent,
        vibrate: options.vibrate,
        data: options.data
      })
      return
    }

    // Service Worker経由で通知を表示
    await this.serviceWorkerRegistration.showNotification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      badge: options.badge || '/favicon.ico',
      tag: options.tag || 'default',
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      vibrate: options.vibrate || [200, 100, 200],
      actions: options.actions || [],
      data: options.data || {}
    })
  }

  // 音声メッセージ専用の通知
  async showVoiceMessageNotification(senderName: string, messageTitle?: string): Promise<void> {
    const options: PushNotificationOptions = {
      title: `🎵 ${senderName}からの音声メッセージ`,
      body: messageTitle || '新しい音声メッセージが届きました',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'voice-message',
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      actions: [
        {
          action: 'play',
          title: '再生',
          icon: '/icons/play.png'
        },
        {
          action: 'later',
          title: '後で',
          icon: '/icons/later.png'
        }
      ],
      data: {
        type: 'voice_message',
        sender: senderName,
        timestamp: Date.now()
      }
    }

    await this.showLocalNotification(options)
  }

  // サブスクリプション情報をサーバーに送信用の形式で取得
  getSubscriptionInfo(): NotificationSubscriptionInfo | null {
    if (!this.pushSubscription) {
      return null
    }

    const p256dhKey = this.pushSubscription.getKey('p256dh')
    const authKey = this.pushSubscription.getKey('auth')

    if (!p256dhKey || !authKey) {
      return null
    }

    return {
      endpoint: this.pushSubscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(p256dhKey),
        auth: this.arrayBufferToBase64(authKey)
      }
    }
  }

  // 通知機能のサポート状況をチェック
  static checkSupport(): {
    notifications: boolean
    serviceWorker: boolean
    pushManager: boolean
    vibration: boolean
  } {
    return {
      notifications: 'Notification' in window,
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      vibration: 'vibrate' in navigator
    }
  }

  // 新しいバージョンが利用可能であることを通知
  private notifyNewVersionAvailable(): void {
    this.showLocalNotification({
      title: 'アプリが更新されました',
      body: 'ページを再読み込みして最新版をご利用ください',
      tag: 'app-update',
      requireInteraction: true,
      actions: [
        {
          action: 'reload',
          title: '再読み込み',
          icon: '/icons/reload.png'
        },
        {
          action: 'dismiss',
          title: '後で',
          icon: '/icons/dismiss.png'
        }
      ]
    }).catch(console.error)
  }

  // ユーティリティメソッド
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer))
    return window.btoa(binary)
  }
}

// グローバルインスタンス
export const pushNotificationManager = new PushNotificationManager()

// React Hook for push notifications
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    const support = PushNotificationManager.checkSupport()
    setIsSupported(support.notifications && support.serviceWorker && support.pushManager)
    setPermission(pushNotificationManager.getPermissionStatus())
  }, [])

  const requestPermission = async (): Promise<boolean> => {
    try {
      const granted = await pushNotificationManager.requestPermission()
      setPermission(pushNotificationManager.getPermissionStatus())
      return granted
    } catch (error) {
      console.error('通知許可要求エラー:', error)
      return false
    }
  }

  const subscribe = async (vapidPublicKey: string): Promise<boolean> => {
    try {
      const subscription = await pushNotificationManager.subscribeToPush(vapidPublicKey)
      setIsSubscribed(!!subscription)
      return !!subscription
    } catch (error) {
      console.error('プッシュサブスクリプションエラー:', error)
      return false
    }
  }

  const unsubscribe = async (): Promise<boolean> => {
    try {
      const result = await pushNotificationManager.unsubscribeFromPush()
      setIsSubscribed(!result)
      return result
    } catch (error) {
      console.error('サブスクリプション解除エラー:', error)
      return false
    }
  }

  const showNotification = async (options: PushNotificationOptions): Promise<void> => {
    await pushNotificationManager.showLocalNotification(options)
  }

  const showVoiceMessageNotification = async (senderName: string, messageTitle?: string): Promise<void> => {
    await pushNotificationManager.showVoiceMessageNotification(senderName, messageTitle)
  }

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    showVoiceMessageNotification
  }
}

// React imports for the hook
import { useState, useEffect } from 'react'