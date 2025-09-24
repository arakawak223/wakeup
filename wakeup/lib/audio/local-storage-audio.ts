/**
 * 開発モード用のローカルストレージ音声管理
 */

interface LocalVoiceMessage {
  id: string
  sender_id: string
  receiver_id: string | null
  title: string | null
  audio_url: string
  duration: number | null
  category: string | null
  request_id: string | null
  audio_metadata: {
    size: number
    format: string
    duration?: number
    sampleRate?: number
    channels?: number
  } | null
  created_at: string
  updated_at: string
  is_read: boolean
}

export class LocalStorageAudioManager {
  private static readonly STORAGE_KEY = 'wakeup-voice-messages'

  /**
   * ローカルストレージから音声メッセージを取得
   */
  static getVoiceMessages(userId: string): LocalVoiceMessage[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      const allMessages: LocalVoiceMessage[] = JSON.parse(stored)

      // 指定されたユーザーに関連するメッセージのみを返す
      return allMessages.filter(msg =>
        msg.sender_id === userId || msg.receiver_id === userId
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } catch (error) {
      console.error('ローカルストレージ読み込みエラー:', error)
      return []
    }
  }

  /**
   * ローカルストレージに音声メッセージを保存
   */
  static saveVoiceMessage(message: LocalVoiceMessage): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      const allMessages: LocalVoiceMessage[] = stored ? JSON.parse(stored) : []

      // 新しいメッセージを追加
      allMessages.push(message)

      // 最新100件のみ保持（ストレージ容量を節約）
      const limitedMessages = allMessages
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 100)

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedMessages))
      console.log('📱 ローカルストレージに保存しました:', message.id)
    } catch (error) {
      console.error('ローカルストレージ保存エラー:', error)
    }
  }

  /**
   * メッセージを削除
   */
  static deleteVoiceMessage(messageId: string): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return

      const allMessages: LocalVoiceMessage[] = JSON.parse(stored)
      const filteredMessages = allMessages.filter(msg => msg.id !== messageId)

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredMessages))
      console.log('🗑️ メッセージを削除しました:', messageId)
    } catch (error) {
      console.error('ローカルストレージ削除エラー:', error)
    }
  }

  /**
   * 全てのメッセージをクリア
   */
  static clearAllMessages(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('🧹 全てのローカルメッセージをクリアしました')
    } catch (error) {
      console.error('ローカルストレージクリアエラー:', error)
    }
  }

  /**
   * メッセージ統計を取得
   */
  static getMessageStats(): { total: number; users: string[] } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return { total: 0, users: [] }

      const allMessages: LocalVoiceMessage[] = JSON.parse(stored)
      const uniqueUsers = [...new Set(allMessages.map(msg => msg.sender_id))]

      return {
        total: allMessages.length,
        users: uniqueUsers
      }
    } catch (error) {
      console.error('統計取得エラー:', error)
      return { total: 0, users: [] }
    }
  }
}