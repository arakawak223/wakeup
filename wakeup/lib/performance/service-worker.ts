/**
 * Advanced Service Worker with Smart Caching Strategy
 * インテリジェントキャッシュ戦略を持つ高度なService Worker
 */

const CACHE_NAME = 'wakeup-voice-app-v1'
const STATIC_CACHE_NAME = `${CACHE_NAME}-static`
const DYNAMIC_CACHE_NAME = `${CACHE_NAME}-dynamic`
const AUDIO_CACHE_NAME = `${CACHE_NAME}-audio`
const API_CACHE_NAME = `${CACHE_NAME}-api`

// キャッシュする静的リソース
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  // Next.js built assets will be added dynamically
]

// キャッシュ期間設定（秒）
const CACHE_STRATEGIES = {
  static: 7 * 24 * 60 * 60, // 1週間
  dynamic: 24 * 60 * 60,    // 1日
  audio: 30 * 24 * 60 * 60, // 30日
  api: 5 * 60               // 5分
}

/**
 * Service Worker Installation
 */
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Installing Service Worker...')

  event.waitUntil(
    Promise.all([
      // 静的リソースのプリキャッシュ
      caches.open(STATIC_CACHE_NAME).then(cache => {
        return cache.addAll(STATIC_ASSETS)
      }),

      // Service Workerの即座有効化
      self.skipWaiting()
    ])
  )
})

/**
 * Service Worker Activation
 */
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activating Service Worker...')

  event.waitUntil(
    Promise.all([
      // 古いキャッシュのクリーンアップ
      cleanupOldCaches(),

      // 全てのクライアントを制御下に
      self.clients.claim()
    ])
  )
})

/**
 * Fetch Event Handler with Smart Caching
 */
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event
  const url = new URL(request.url)

  // Chrome Extension requests are ignored
  if (url.protocol === 'chrome-extension:') {
    return
  }

  event.respondWith(handleRequest(request))
})

/**
 * Smart Request Handler
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname

  try {
    // API リクエストの処理
    if (pathname.startsWith('/api/')) {
      return await handleApiRequest(request)
    }

    // 音声ファイルの処理
    if (isAudioRequest(request)) {
      return await handleAudioRequest(request)
    }

    // 静的リソースの処理
    if (isStaticResource(pathname)) {
      return await handleStaticRequest(request)
    }

    // ページリクエストの処理
    return await handlePageRequest(request)

  } catch (error) {
    console.error('[SW] Request handling failed:', error)
    return await handleFallback(request)
  }
}

/**
 * API Request Handler - Stale While Revalidate
 */
async function handleApiRequest(request: Request): Promise<Response> {
  const cache = await caches.open(API_CACHE_NAME)
  const cachedResponse = await cache.match(request)

  // キャッシュがある場合は即座に返し、バックグラウンドで更新
  if (cachedResponse && !isExpired(cachedResponse, CACHE_STRATEGIES.api)) {
    // バックグラウンドで更新
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
    }).catch(() => {
      // ネットワークエラーは無視
    })

    return cachedResponse
  }

  // ネットワークから取得
  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    // ネットワークエラー時はキャッシュを返す（期限切れでも）
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

/**
 * Audio Request Handler - Cache First with Long TTL
 */
async function handleAudioRequest(request: Request): Promise<Response> {
  const cache = await caches.open(AUDIO_CACHE_NAME)
  const cachedResponse = await cache.match(request)

  // 音声ファイルは長期キャッシュ
  if (cachedResponse && !isExpired(cachedResponse, CACHE_STRATEGIES.audio)) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

/**
 * Static Resource Handler - Cache First
 */
async function handleStaticRequest(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE_NAME)
  const cachedResponse = await cache.match(request)

  if (cachedResponse && !isExpired(cachedResponse, CACHE_STRATEGIES.static)) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

/**
 * Page Request Handler - Network First with Fallback
 */
async function handlePageRequest(request: Request): Promise<Response> {
  const cache = await caches.open(DYNAMIC_CACHE_NAME)

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // オフライン時のフォールバック
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline')
      if (offlinePage) {
        return offlinePage
      }
    }

    throw error
  }
}

/**
 * Fallback Handler
 */
async function handleFallback(request: Request): Promise<Response> {
  if (request.mode === 'navigate') {
    // ページリクエストの場合はオフラインページを返す
    const cache = await caches.open(DYNAMIC_CACHE_NAME)
    const offlinePage = await cache.match('/offline')

    if (offlinePage) {
      return offlinePage
    }
  }

  // 基本的なオフラインレスポンス
  return new Response(
    JSON.stringify({
      error: 'オフライン',
      message: 'ネットワークに接続されていません'
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

/**
 * Utility Functions
 */
function isAudioRequest(request: Request): boolean {
  const url = new URL(request.url)
  return /\.(mp3|wav|m4a|ogg|webm)$/i.test(url.pathname) ||
         url.pathname.includes('/audio/') ||
         request.headers.get('accept')?.includes('audio/')
}

function isStaticResource(pathname: string): boolean {
  return /\.(js|css|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|ico)$/i.test(pathname) ||
         pathname.startsWith('/_next/static/')
}

function isExpired(response: Response, maxAgeSeconds: number): boolean {
  const cachedTime = response.headers.get('sw-cached-time')
  if (!cachedTime) return true

  const age = (Date.now() - parseInt(cachedTime)) / 1000
  return age > maxAgeSeconds
}

async function cleanupOldCaches(): Promise<void> {
  const cacheNames = await caches.keys()
  const currentCaches = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME, AUDIO_CACHE_NAME, API_CACHE_NAME]

  const deletePromises = cacheNames
    .filter(name => !currentCaches.includes(name) && name.startsWith('wakeup-voice-app'))
    .map(name => caches.delete(name))

  await Promise.all(deletePromises)
  console.log('[SW] Old caches cleaned up')
}

/**
 * Background Sync for Offline Actions
 */
self.addEventListener('sync', (event: SyncEvent) => {
  console.log('[SW] Background sync:', event.tag)

  if (event.tag === 'upload-voice-message') {
    event.waitUntil(syncVoiceMessages())
  }
})

async function syncVoiceMessages(): Promise<void> {
  try {
    // IndexedDBから未送信の音声メッセージを取得
    const pendingMessages = await getPendingVoiceMessages()

    for (const message of pendingMessages) {
      try {
        const response = await fetch('/api/voice-messages', {
          method: 'POST',
          body: message.data
        })

        if (response.ok) {
          await removePendingMessage(message.id)
          console.log('[SW] Voice message synced:', message.id)
        }
      } catch (error) {
        console.error('[SW] Failed to sync message:', message.id, error)
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// IndexedDB操作のスタブ（実装は別ファイル）
async function getPendingVoiceMessages(): Promise<any[]> {
  // IndexedDBから未送信メッセージを取得
  return []
}

async function removePendingMessage(id: string): Promise<void> {
  // IndexedDBから指定されたメッセージを削除
}

/**
 * Push Notification Handler
 */
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  const data = event.data.json()
  const options: NotificationOptions = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'voice-message',
    data: data.data,
    actions: [
      {
        action: 'reply',
        title: '返信',
        icon: '/icons/reply.png'
      },
      {
        action: 'view',
        title: '表示',
        icon: '/icons/view.png'
      }
    ],
    vibrate: [200, 100, 200]
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '新しい音声メッセージ', options)
  )
})

/**
 * Notification Click Handler
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  const { action, data } = event

  event.notification.close()

  event.waitUntil(
    handleNotificationClick(action, data)
  )
})

async function handleNotificationClick(action: string, data: any): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' })

  switch (action) {
    case 'reply':
      // 返信画面を開く
      if (clients.length > 0) {
        clients[0].focus()
        clients[0].postMessage({
          type: 'open-reply',
          messageId: data?.messageId
        })
      } else {
        self.clients.openWindow(`/?reply=${data?.messageId}`)
      }
      break

    case 'view':
    default:
      // メッセージを表示
      if (clients.length > 0) {
        clients[0].focus()
        if (data?.messageId) {
          clients[0].postMessage({
            type: 'show-message',
            messageId: data.messageId
          })
        }
      } else {
        self.clients.openWindow(data?.url || '/')
      }
      break
  }
}

export {} // TypeScript module