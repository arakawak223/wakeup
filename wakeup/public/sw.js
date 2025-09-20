// Service Worker for Push Notifications and Offline Support
const CACHE_NAME = 'wakeup-app-v1'
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  // Add other static assets as needed
]

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache')
        return cache.addAll(urlsToCache)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
      })
  )
})

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event)

  let notificationData = {
    title: '新しい音声メッセージ',
    body: '家族から音声メッセージが届きました',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'voice-message',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: '開く',
        icon: '/icons/open.png'
      },
      {
        action: 'later',
        title: '後で',
        icon: '/icons/later.png'
      }
    ],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  }

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json()
      notificationData = {
        ...notificationData,
        ...pushData
      }
    } catch (error) {
      console.error('Error parsing push data:', error)
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event)

  event.notification.close()

  if (event.action === 'open' || !event.action) {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus()
          }
        }

        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || '/')
        }
      })
    )
  } else if (event.action === 'later') {
    // Handle "later" action - could store in localStorage or send to server
    console.log('User chose to view later')
  }
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'voice-message-upload') {
    event.waitUntil(syncVoiceMessages())
  }
})

// Function to sync voice messages when online
async function syncVoiceMessages() {
  console.log('Syncing voice messages...')

  try {
    // Get pending uploads from IndexedDB or localStorage
    const pendingUploads = await getPendingUploads()

    for (const upload of pendingUploads) {
      try {
        // Attempt to upload
        await uploadVoiceMessage(upload)

        // Remove from pending list on success
        await removePendingUpload(upload.id)

        console.log('Successfully synced voice message:', upload.id)
      } catch (error) {
        console.error('Failed to sync voice message:', upload.id, error)
      }
    }
  } catch (error) {
    console.error('Error during sync:', error)
  }
}

// Helper functions for offline storage
async function getPendingUploads() {
  // In a real implementation, this would read from IndexedDB
  const pending = self.localStorage?.getItem('pendingUploads')
  return pending ? JSON.parse(pending) : []
}

async function removePendingUpload(id) {
  // In a real implementation, this would remove from IndexedDB
  const pending = await getPendingUploads()
  const filtered = pending.filter(upload => upload.id !== id)
  self.localStorage?.setItem('pendingUploads', JSON.stringify(filtered))
}

async function uploadVoiceMessage(upload) {
  // This would contain the actual upload logic
  const response = await fetch('/api/voice-messages', {
    method: 'POST',
    body: upload.formData
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`)
  }

  return response.json()
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

console.log('Service Worker loaded successfully')