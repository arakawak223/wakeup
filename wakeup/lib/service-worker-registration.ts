/**
 * Service Worker Registration
 * PWAとオフライン機能のためのService Worker登録
 */

export async function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      console.log('[SW] Service Workerの登録を開始します...')

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      console.log('[SW] Service Worker登録成功:', registration.scope)

      // Service Workerの更新をチェック
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          console.log('[SW] 新しいService Workerが利用可能です')

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新バージョンが利用可能
              console.log('[SW] アプリの新しいバージョンが利用可能です')

              // ユーザーに更新を通知する（オプション）
              if (confirm('アプリの新しいバージョンが利用可能です。更新しますか？')) {
                window.location.reload()
              }
            }
          })
        }
      })

      return registration
    } catch (error) {
      console.error('[SW] Service Worker登録に失敗:', error)
      return null
    }
  }
  return null
}

export async function unregisterServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.unregister()
      console.log('[SW] Service Worker登録を解除しました')
      return true
    } catch (error) {
      console.error('[SW] Service Worker登録解除に失敗:', error)
      return false
    }
  }
  return false
}

export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator
}

export async function getServiceWorkerRegistration() {
  if (isServiceWorkerSupported()) {
    try {
      return await navigator.serviceWorker.ready
    } catch (error) {
      console.error('[SW] Service Worker取得に失敗:', error)
      return null
    }
  }
  return null
}