export class E2EEncryption {
  static async generateKeyPair() {
    return {
      publicKey: 'mock-public-key' as any,
      privateKey: 'mock-private-key' as any
    }
  }

  static async encryptVoiceMessage() {
    return {
      encryptedData: new ArrayBuffer(0),
      signature: 'mock-signature',
      timestamp: Date.now(),
      senderId: 'mock-sender'
    }
  }

  static async decryptVoiceMessage() {
    return new ArrayBuffer(0)
  }
}

export default E2EEncryption