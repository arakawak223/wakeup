/**
 * オフラインストレージ管理 - IndexedDB
 */

export interface OfflineVoiceMessage {
  id: string
  audioBlob: Blob
  title: string
  category?: string
  senderId: string
  receiverId?: string
  duration: number
  timestamp: number
  metadata: {
    size: number
    format: string
    compressed: boolean
  }
  syncStatus: 'pending' | 'syncing' | 'failed' | 'completed'
  retryCount: number
}

export interface Profile {
  id: string
  display_name?: string
  email?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
}

export interface FamilyConnection {
  id: string
  user_id: string
  family_member_id: string
  relationship?: string
  created_at: string
}

export interface OfflineData {
  voiceMessages: OfflineVoiceMessage[]
  profiles: Profile[]
  familyConnections: FamilyConnection[]
  lastSync: number
}

export class OfflineStorageManager {
  private dbName = 'wakeup-offline'
  private dbVersion = 1
  private db: IDBDatabase | null = null

  // IndexedDBを初期化
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => {
        reject(new Error('IndexedDBの初期化に失敗しました'))
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('オフラインストレージが初期化されました')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 音声メッセージストア
        if (!db.objectStoreNames.contains('voiceMessages')) {
          const voiceStore = db.createObjectStore('voiceMessages', { keyPath: 'id' })
          voiceStore.createIndex('syncStatus', 'syncStatus', { unique: false })
          voiceStore.createIndex('timestamp', 'timestamp', { unique: false })
          voiceStore.createIndex('senderId', 'senderId', { unique: false })
        }

        // プロファイルストア
        if (!db.objectStoreNames.contains('profiles')) {
          const profileStore = db.createObjectStore('profiles', { keyPath: 'id' })
          profileStore.createIndex('email', 'email', { unique: true })
        }

        // 家族接続ストア
        if (!db.objectStoreNames.contains('familyConnections')) {
          const connectionStore = db.createObjectStore('familyConnections', { keyPath: 'id' })
          connectionStore.createIndex('user1_id', 'user1_id', { unique: false })
          connectionStore.createIndex('user2_id', 'user2_id', { unique: false })
        }

        // 設定ストア
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }

        console.log('オフラインデータベースのスキーマを作成しました')
      }
    })
  }

  // 音声メッセージを保存（オフライン用）
  async saveVoiceMessageOffline(message: Omit<OfflineVoiceMessage, 'id'>): Promise<string> {
    if (!this.db) {
      await this.initialize()
    }

    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const offlineMessage: OfflineVoiceMessage = {
      ...message,
      id,
      syncStatus: 'pending',
      retryCount: 0
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['voiceMessages'], 'readwrite')
      const store = transaction.objectStore('voiceMessages')
      const request = store.add(offlineMessage)

      request.onsuccess = () => {
        console.log('オフライン音声メッセージを保存しました:', id)
        resolve(id)
      }

      request.onerror = () => {
        reject(new Error('オフラインメッセージの保存に失敗しました'))
      }
    })
  }

  // 未同期の音声メッセージを取得
  async getPendingVoiceMessages(): Promise<OfflineVoiceMessage[]> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['voiceMessages'], 'readonly')
      const store = transaction.objectStore('voiceMessages')
      const index = store.index('syncStatus')
      const request = index.getAll('pending')

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new Error('未同期メッセージの取得に失敗しました'))
      }
    })
  }

  // 音声メッセージの同期状態を更新
  async updateMessageSyncStatus(
    messageId: string,
    status: OfflineVoiceMessage['syncStatus'],
    serverMessageId?: string
  ): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['voiceMessages'], 'readwrite')
      const store = transaction.objectStore('voiceMessages')
      const getRequest = store.get(messageId)

      getRequest.onsuccess = () => {
        const message = getRequest.result
        if (message) {
          message.syncStatus = status
          if (serverMessageId) {
            message.serverMessageId = serverMessageId
          }
          if (status === 'failed') {
            message.retryCount = (message.retryCount || 0) + 1
          }

          const updateRequest = store.put(message)
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(new Error('同期状態の更新に失敗しました'))
        } else {
          reject(new Error('メッセージが見つかりません'))
        }
      }

      getRequest.onerror = () => {
        reject(new Error('メッセージの取得に失敗しました'))
      }
    })
  }

  // 完了した音声メッセージを削除
  async deleteCompletedMessage(messageId: string): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['voiceMessages'], 'readwrite')
      const store = transaction.objectStore('voiceMessages')
      const request = store.delete(messageId)

      request.onsuccess = () => {
        console.log('完了済みメッセージを削除しました:', messageId)
        resolve()
      }

      request.onerror = () => {
        reject(new Error('メッセージの削除に失敗しました'))
      }
    })
  }

  // プロファイルをキャッシュ
  async cacheProfile(profile: Profile): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['profiles'], 'readwrite')
      const store = transaction.objectStore('profiles')
      const request = store.put({
        ...profile,
        cachedAt: Date.now()
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('プロファイルのキャッシュに失敗しました'))
    })
  }

  // キャッシュされたプロファイルを取得
  async getCachedProfile(profileId: string): Promise<Profile | null> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['profiles'], 'readonly')
      const store = transaction.objectStore('profiles')
      const request = store.get(profileId)

      request.onsuccess = () => {
        const profile = request.result
        // 24時間以内のキャッシュのみ有効
        if (profile && profile.cachedAt && (Date.now() - profile.cachedAt) < 24 * 60 * 60 * 1000) {
          resolve(profile)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        reject(new Error('キャッシュプロファイルの取得に失敗しました'))
      }
    })
  }

  // 設定を保存
  async saveSetting(key: string, value: unknown): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite')
      const store = transaction.objectStore('settings')
      const request = store.put({ key, value, updatedAt: Date.now() })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('設定の保存に失敗しました'))
    })
  }

  // 設定を取得
  async getSetting(key: string): Promise<unknown> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly')
      const store = transaction.objectStore('settings')
      const request = store.get(key)

      request.onsuccess = () => {
        const setting = request.result
        resolve(setting ? setting.value : null)
      }

      request.onerror = () => {
        reject(new Error('設定の取得に失敗しました'))
      }
    })
  }

  // ストレージ使用量を取得
  async getStorageUsage(): Promise<{
    estimated: number
    quota: number
    usagePercentage: number
    details: {
      voiceMessages: number
      profiles: number
      settings: number
    }
  }> {
    const estimate = await navigator.storage?.estimate?.() || { usage: 0, quota: 0 }

    // 各ストアのサイズを計算
    const voiceMessages = await this.getStoreSize('voiceMessages')
    const profiles = await this.getStoreSize('profiles')
    const settings = await this.getStoreSize('settings')

    return {
      estimated: estimate.usage || 0,
      quota: estimate.quota || 0,
      usagePercentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0,
      details: {
        voiceMessages,
        profiles,
        settings
      }
    }
  }

  // 特定ストアのアイテム数を取得
  private async getStoreSize(storeName: string): Promise<number> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })
  }

  // オフラインデータをクリア
  async clearOfflineData(): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    const storeNames = ['voiceMessages', 'profiles', 'familyConnections', 'settings']

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeNames, 'readwrite')

      transaction.oncomplete = () => {
        console.log('オフラインデータをクリアしました')
        resolve()
      }

      transaction.onerror = () => {
        reject(new Error('オフラインデータのクリアに失敗しました'))
      }

      storeNames.forEach(storeName => {
        transaction.objectStore(storeName).clear()
      })
    })
  }

  // データベースを閉じる
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// グローバルインスタンス
export const offlineStorage = new OfflineStorageManager()

// オフライン状態の監視
export class OfflineStateManager {
  private isOnline = navigator.onLine
  private listeners: ((isOnline: boolean) => void)[] = []

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      console.log('オンラインになりました')
      this.notifyListeners()
      this.triggerSync()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      console.log('オフラインになりました')
      this.notifyListeners()
    })
  }

  getIsOnline(): boolean {
    return this.isOnline
  }

  addListener(callback: (isOnline: boolean) => void): void {
    this.listeners.push(callback)
  }

  removeListener(callback: (isOnline: boolean) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback)
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.isOnline))
  }

  private triggerSync(): void {
    // Service Workerにバックグラウンド同期を要求
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        return registration.sync.register('voice-message-upload')
      }).catch(error => {
        console.error('バックグラウンド同期の登録に失敗:', error)
      })
    }
  }
}

export const offlineStateManager = new OfflineStateManager()

// React Hook for offline functionality
export function useOfflineStorage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingMessages, setPendingMessages] = useState<OfflineVoiceMessage[]>([])
  const [storageUsage, setStorageUsage] = useState<{
    estimated: number;
    quota: number;
    usagePercentage: number;
    details: {
      voiceMessages: number;
      profiles: number;
      settings: number;
    };
  } | null>(null)

  useEffect(() => {
    const handleOnlineStatusChange = (online: boolean) => {
      setIsOnline(online)
      if (online) {
        loadPendingMessages()
      }
    }

    offlineStateManager.addListener(handleOnlineStatusChange)
    loadPendingMessages()
    loadStorageUsage()

    return () => {
      offlineStateManager.removeListener(handleOnlineStatusChange)
    }
  }, [])

  const loadPendingMessages = async () => {
    try {
      const messages = await offlineStorage.getPendingVoiceMessages()
      setPendingMessages(messages)
    } catch (error) {
      console.error('未同期メッセージの読み込みに失敗:', error)
    }
  }

  const loadStorageUsage = async () => {
    try {
      const usage = await offlineStorage.getStorageUsage()
      setStorageUsage(usage)
    } catch (error) {
      console.error('ストレージ使用量の取得に失敗:', error)
    }
  }

  const saveMessageOffline = async (messageData: Omit<OfflineVoiceMessage, 'id'>) => {
    try {
      const messageId = await offlineStorage.saveVoiceMessageOffline(messageData)
      await loadPendingMessages()
      return messageId
    } catch (error) {
      console.error('オフラインメッセージの保存に失敗:', error)
      throw error
    }
  }

  const clearOfflineData = async () => {
    try {
      await offlineStorage.clearOfflineData()
      await loadPendingMessages()
      await loadStorageUsage()
    } catch (error) {
      console.error('オフラインデータのクリアに失敗:', error)
      throw error
    }
  }

  return {
    isOnline,
    pendingMessages,
    storageUsage,
    saveMessageOffline,
    clearOfflineData,
    refreshPendingMessages: loadPendingMessages,
    refreshStorageUsage: loadStorageUsage
  }
}

// React imports for the hook
import { useState, useEffect } from 'react'