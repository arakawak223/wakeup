'use client'

import { useState, useEffect } from 'react'
import { E2EEncryption } from '@/lib/security/encryption'

interface EncryptionHook {
  isAvailable: boolean
  isInitialized: boolean
  initialize: (userId: string) => Promise<void>
  encrypt: (data: ArrayBuffer, recipientIds: string[]) => Promise<any>
  decrypt: (encryptedMessage: any) => Promise<ArrayBuffer | null>
  error: string | null
}

export function useE2EEncryption(): EncryptionHook {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // クライアントサイドでのみ暗号化機能をチェック
    if (typeof window !== 'undefined') {
      const available = 'crypto' in window && 'subtle' in window.crypto
      setIsAvailable(available)
    }
  }, [])

  const initialize = async (userId: string) => {
    if (!isAvailable) {
      setError('暗号化機能がサポートされていません')
      return
    }

    try {
      const encryption = E2EEncryption.getInstance()
      await encryption.initialize(userId)
      setIsInitialized(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '暗号化の初期化に失敗しました')
    }
  }

  const encrypt = async (data: ArrayBuffer, recipientIds: string[]) => {
    if (!isInitialized) {
      throw new Error('暗号化システムが初期化されていません')
    }

    try {
      const encryption = E2EEncryption.getInstance()
      return await encryption.encryptMessage(data, recipientIds, {
        duration: 0,
        format: 'audio/webm',
        checksum: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '暗号化に失敗しました')
      return null
    }
  }

  const decrypt = async (encryptedMessage: any): Promise<ArrayBuffer | null> => {
    if (!isInitialized) {
      throw new Error('暗号化システムが初期化されていません')
    }

    try {
      const encryption = E2EEncryption.getInstance()
      return await encryption.decryptMessage(encryptedMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : '復号化に失敗しました')
      return null
    }
  }

  return {
    isAvailable,
    isInitialized,
    initialize,
    encrypt,
    decrypt,
    error
  }
}