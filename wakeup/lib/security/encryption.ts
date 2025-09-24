/**
 * End-to-End Encryption System for Voice Messages
 * 音声メッセージのエンドツーエンド暗号化システム
 */

interface KeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

interface EncryptedData {
  encryptedContent: ArrayBuffer
  iv: ArrayBuffer
  salt: ArrayBuffer
  keyInfo: {
    algorithm: string
    keyLength: number
    iterations: number
  }
}

interface EncryptedMessage {
  id: string
  senderId: string
  recipientIds: string[]
  encryptedData: EncryptedData
  encryptedKeys: Map<string, ArrayBuffer> // Recipient ID -> Encrypted symmetric key
  timestamp: number
  metadata: {
    duration: number
    format: string
    checksum: string
  }
}

export class E2EEncryption {
  private static instance: E2EEncryption
  private keyPair: KeyPair | null = null
  private symmetricKey: CryptoKey | null = null

  private constructor() {}

  static getInstance(): E2EEncryption {
    if (!E2EEncryption.instance) {
      E2EEncryption.instance = new E2EEncryption()
    }
    return E2EEncryption.instance
  }

  /**
   * Initialize encryption system with user's key pair
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Try to load existing key pair from IndexedDB
      const storedKeyPair = await this.loadKeyPairFromStorage(userId)

      if (storedKeyPair) {
        this.keyPair = storedKeyPair
      } else {
        // Generate new key pair
        this.keyPair = await this.generateKeyPair()
        await this.saveKeyPairToStorage(userId, this.keyPair)
      }

      console.log('[E2E] Encryption system initialized for user:', userId)
    } catch (error) {
      console.error('[E2E] Failed to initialize encryption:', error)
      throw new Error('暗号化システムの初期化に失敗しました')
    }
  }

  /**
   * Generate RSA key pair for asymmetric encryption
   */
  private async generateKeyPair(): Promise<KeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true, // extractable
      ['encrypt', 'decrypt']
    )

    return keyPair
  }

  /**
   * Generate symmetric key for bulk encryption
   */
  private async generateSymmetricKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Encrypt voice message for multiple recipients
   */
  async encryptVoiceMessage(
    audioBuffer: ArrayBuffer,
    senderId: string,
    recipientIds: string[],
    recipientPublicKeys: Map<string, CryptoKey>
  ): Promise<EncryptedMessage> {
    if (!this.keyPair) {
      throw new Error('暗号化システムが初期化されていません')
    }

    try {
      // Generate new symmetric key for this message
      const symmetricKey = await this.generateSymmetricKey()

      // Generate random IV and salt
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const salt = window.crypto.getRandomValues(new Uint8Array(16))

      // Encrypt audio data with symmetric key
      const encryptedContent = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        symmetricKey,
        audioBuffer
      )

      // Export symmetric key for encryption with recipient public keys
      const exportedSymmetricKey = await window.crypto.subtle.exportKey('raw', symmetricKey)

      // Encrypt symmetric key for each recipient
      const encryptedKeys = new Map<string, ArrayBuffer>()

      for (const [recipientId, publicKey] of recipientPublicKeys) {
        const encryptedKey = await window.crypto.subtle.encrypt(
          {
            name: 'RSA-OAEP'
          },
          publicKey,
          exportedSymmetricKey
        )
        encryptedKeys.set(recipientId, encryptedKey)
      }

      // Calculate checksum for integrity verification
      const checksum = await this.calculateChecksum(audioBuffer)

      const encryptedMessage: EncryptedMessage = {
        id: crypto.randomUUID(),
        senderId,
        recipientIds,
        encryptedData: {
          encryptedContent,
          iv,
          salt,
          keyInfo: {
            algorithm: 'AES-GCM',
            keyLength: 256,
            iterations: 100000
          }
        },
        encryptedKeys,
        timestamp: Date.now(),
        metadata: {
          duration: audioBuffer.byteLength / (44100 * 2), // Approximate duration
          format: 'encrypted-audio',
          checksum
        }
      }

      return encryptedMessage
    } catch (error) {
      console.error('[E2E] Encryption failed:', error)
      throw new Error('メッセージの暗号化に失敗しました')
    }
  }

  /**
   * Decrypt voice message
   */
  async decryptVoiceMessage(
    encryptedMessage: EncryptedMessage,
    userId: string
  ): Promise<ArrayBuffer> {
    if (!this.keyPair) {
      throw new Error('暗号化システムが初期化されていません')
    }

    try {
      // Get encrypted symmetric key for this user
      const encryptedSymmetricKey = encryptedMessage.encryptedKeys.get(userId)
      if (!encryptedSymmetricKey) {
        throw new Error('このメッセージを復号する権限がありません')
      }

      // Decrypt symmetric key with private key
      const decryptedSymmetricKey = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP'
        },
        this.keyPair.privateKey,
        encryptedSymmetricKey
      )

      // Import symmetric key
      const symmetricKey = await window.crypto.subtle.importKey(
        'raw',
        decryptedSymmetricKey,
        {
          name: 'AES-GCM'
        },
        false,
        ['decrypt']
      )

      // Decrypt message content
      const decryptedContent = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: encryptedMessage.encryptedData.iv
        },
        symmetricKey,
        encryptedMessage.encryptedData.encryptedContent
      )

      // Verify integrity
      const calculatedChecksum = await this.calculateChecksum(decryptedContent)
      if (calculatedChecksum !== encryptedMessage.metadata.checksum) {
        throw new Error('メッセージの整合性検証に失敗しました')
      }

      return decryptedContent
    } catch (error) {
      console.error('[E2E] Decryption failed:', error)
      throw new Error('メッセージの復号に失敗しました')
    }
  }

  /**
   * Export public key for sharing
   */
  async exportPublicKey(): Promise<JsonWebKey> {
    if (!this.keyPair) {
      throw new Error('キーペアが生成されていません')
    }

    return await window.crypto.subtle.exportKey('jwk', this.keyPair.publicKey)
  }

  /**
   * Import recipient's public key
   */
  async importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    )
  }

  /**
   * Generate secure password for additional protection
   */
  async generateSecurePassword(length: number = 32): Promise<string> {
    const array = new Uint8Array(length)
    window.crypto.getRandomValues(array)

    return Array.from(array, byte =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'[byte % 70]
    ).join('')
  }

  /**
   * Key derivation for password-based encryption
   */
  async deriveKeyFromPassword(
    password: string,
    salt: ArrayBuffer,
    iterations: number = 100000
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const passwordBuffer = encoder.encode(password)

    // Import password as base key
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    )

    // Derive encryption key
    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Calculate SHA-256 checksum
   */
  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Save key pair to IndexedDB
   */
  private async saveKeyPairToStorage(userId: string, keyPair: KeyPair): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('WakeupSecurity', 1)

      request.onerror = () => reject(request.error)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('keyPairs')) {
          db.createObjectStore('keyPairs', { keyPath: 'userId' })
        }
      }

      request.onsuccess = async () => {
        try {
          const db = request.result
          const transaction = db.transaction(['keyPairs'], 'readwrite')
          const store = transaction.objectStore('keyPairs')

          // Export keys for storage
          const exportedPublicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey)
          const exportedPrivateKey = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey)

          await store.put({
            userId,
            publicKey: exportedPublicKey,
            privateKey: exportedPrivateKey,
            timestamp: Date.now()
          })

          resolve()
        } catch (error) {
          reject(error)
        }
      }
    })
  }

  /**
   * Load key pair from IndexedDB
   */
  private async loadKeyPairFromStorage(userId: string): Promise<KeyPair | null> {
    return new Promise<KeyPair | null>((resolve, reject) => {
      const request = indexedDB.open('WakeupSecurity', 1)

      request.onerror = () => reject(request.error)

      request.onsuccess = async () => {
        try {
          const db = request.result

          if (!db.objectStoreNames.contains('keyPairs')) {
            resolve(null)
            return
          }

          const transaction = db.transaction(['keyPairs'], 'readonly')
          const store = transaction.objectStore('keyPairs')
          const result = await store.get(userId)

          if (!result) {
            resolve(null)
            return
          }

          // Import keys from storage
          const publicKey = await window.crypto.subtle.importKey(
            'jwk',
            result.publicKey,
            {
              name: 'RSA-OAEP',
              hash: 'SHA-256'
            },
            true,
            ['encrypt']
          )

          const privateKey = await window.crypto.subtle.importKey(
            'jwk',
            result.privateKey,
            {
              name: 'RSA-OAEP',
              hash: 'SHA-256'
            },
            true,
            ['decrypt']
          )

          resolve({ publicKey, privateKey })
        } catch (error) {
          reject(error)
        }
      }
    })
  }

  /**
   * Securely wipe key from memory (best effort)
   */
  async wipeKeys(): Promise<void> {
    this.keyPair = null
    this.symmetricKey = null

    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc()
    }
  }

  /**
   * Verify if encryption is available
   */
  static isAvailable(): boolean {
    return !!(window.crypto && window.crypto.subtle &&
              typeof window.crypto.subtle.generateKey === 'function')
  }
}

// React Hook for encryption operations
export function useE2EEncryption() {
  const encryption = E2EEncryption.getInstance()

  return {
    initialize: (userId: string) => encryption.initialize(userId),
    encryptVoiceMessage: (
      audioBuffer: ArrayBuffer,
      senderId: string,
      recipientIds: string[],
      recipientPublicKeys: Map<string, CryptoKey>
    ) => encryption.encryptVoiceMessage(audioBuffer, senderId, recipientIds, recipientPublicKeys),
    decryptVoiceMessage: (encryptedMessage: EncryptedMessage, userId: string) =>
      encryption.decryptVoiceMessage(encryptedMessage, userId),
    exportPublicKey: () => encryption.exportPublicKey(),
    importPublicKey: (jwk: JsonWebKey) => encryption.importPublicKey(jwk),
    generateSecurePassword: (length?: number) => encryption.generateSecurePassword(length),
    wipeKeys: () => encryption.wipeKeys(),
    isAvailable: E2EEncryption.isAvailable()
  }
}