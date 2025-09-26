'use client'

import { useEffect, useState } from 'react'
import { registerServiceWorker, isServiceWorkerSupported } from '@/lib/service-worker-registration'

interface PWAProviderProps {
  children: React.ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isInstallable, setIsInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Service Worker登録
    const initServiceWorker = async () => {
      if (process.env.NEXT_PUBLIC_ENABLE_PWA === 'true' && isServiceWorkerSupported()) {
        await registerServiceWorker()
      }
    }

    initServiceWorker()

    // PWAインストールプロンプト処理
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // アプリがインストールされた後の処理
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] アプリがインストールされました')
      setIsInstallable(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    console.log(`[PWA] インストール結果: ${outcome}`)
    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  // PWAコンテキストを提供（将来的な拡張用）
  const pwaContext = {
    isInstallable,
    handleInstallClick,
    isServiceWorkerSupported: isServiceWorkerSupported(),
  }

  return (
    <>
      {children}
      {/* PWA関連のUI要素があればここに追加 */}
    </>
  )
}

export default PWAProvider