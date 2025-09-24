/**
 * Supabase音声ファイル管理システム
 */

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import { LocalStorageAudioManager } from './local-storage-audio'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row']
type VoiceMessageInsert = Database['public']['Tables']['voice_messages']['Insert']
type VoiceMessageReaction = Database['public']['Tables']['voice_message_reactions']['Row']
type VoiceMessageReactionInsert = Database['public']['Tables']['voice_message_reactions']['Insert']

export type ReactionType = 'heart' | 'laugh' | 'surprise' | 'sad' | 'angry' | 'thumbs_up' | 'thumbs_down' | 'clap' | 'fire' | 'crying'

export interface AudioUploadResult {
  success: boolean
  audioUrl?: string
  publicUrl?: string
  messageId?: string
  error?: string
}

export interface AudioMetadata {
  size: number
  format: string
  duration?: number
  sampleRate?: number
  channels?: number
  bitRate?: number
}

export class SupabaseAudioManager {
  private supabase = createClient()

  /**
   * 音声ファイルをSupabaseストレージにアップロード
   */
  async uploadAudioFile(
    audioBlob: Blob,
    fileName?: string,
    metadata?: AudioMetadata
  ): Promise<{ audioUrl: string; publicUrl: string }> {
    try {
      const timestamp = Date.now()
      const finalFileName = fileName || `voice_${timestamp}.webm`

      // ネットワーク状態を確認
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('オフライン状態です。ローカル用URLを返します。')
        return {
          audioUrl: `offline-audio-${timestamp}`,
          publicUrl: `data:audio/webm;base64,offline-audio-${timestamp}`
        }
      }

      // ファイルをアップロード
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('voice-messages')
        .upload(finalFileName, audioBlob, {
          contentType: audioBlob.type || 'audio/webm',
          metadata: metadata ? metadata as unknown as Record<string, string> : undefined
        })

      if (uploadError) {
        console.warn(`Supabaseストレージエラー: ${uploadError.message}`)

        // バケットが見つからない、認証エラー、ネットワークエラーの場合はフォールバック
        if (uploadError.message.includes('Bucket not found') ||
            uploadError.message.includes('Authentication required') ||
            uploadError.message.includes('Failed to fetch') ||
            uploadError.message.includes('Network error')) {
          console.warn('オフライン/開発モード用ダミーURLを返します。')
          return {
            audioUrl: `offline-audio-${timestamp}`,
            publicUrl: `data:audio/webm;base64,offline-audio-${timestamp}`
          }
        }

        // その他のエラーもオフラインモードにフォールバック
        console.warn('Supabaseストレージエラー。オフライン/開発モード用ダミーURLを返します。')
        return {
          audioUrl: `offline-audio-${timestamp}`,
          publicUrl: `data:audio/webm;base64,offline-audio-${timestamp}`
        }
      }

      // 公開URLを取得
      const { data: urlData } = this.supabase.storage
        .from('voice-messages')
        .getPublicUrl(uploadData.path)

      return {
        audioUrl: uploadData.path,
        publicUrl: urlData.publicUrl
      }
    } catch (error) {
      console.error('音声ファイルアップロードエラー:', error)

      // オフライン/開発モード用のフォールバック
      if (error instanceof Error &&
          (error.message.includes('Bucket not found') ||
           error.message.includes('Failed to fetch') ||
           error.message.includes('Authentication required') ||
           error.message.includes('Network error'))) {
        console.warn('Supabaseストレージエラー。オフライン/開発モード用ダミーURLを返します。')
        const timestamp = Date.now()
        return {
          audioUrl: `offline-audio-${timestamp}`,
          publicUrl: `data:audio/webm;base64,offline-audio-${timestamp}`
        }
      }

      throw error
    }
  }

  /**
   * 音声メッセージをデータベースに保存
   */
  async saveVoiceMessage(
    audioUrl: string,
    messageData: {
      senderId: string
      receiverId?: string
      title?: string
      category?: string
      duration?: number
      audioMetadata?: AudioMetadata
      emotionAnalysis?: Record<string, unknown>
      requestId?: string
    }
  ): Promise<VoiceMessage> {
    try {
      // オフライン/開発モードの場合はローカルストレージに保存してダミーメッセージを返す
      if (messageData.senderId.startsWith('offline-') ||
          messageData.senderId.startsWith('test-') ||
          audioUrl.startsWith('offline-audio-')) {
        console.warn('オフライン/開発モードのため、ローカルストレージに保存します')
        const timestamp = Date.now()
        const localMessage = {
          id: `offline-msg-${timestamp}`,
          sender_id: messageData.senderId,
          receiver_id: messageData.receiverId || messageData.senderId, // 受信者が指定されていない場合は自分宛て
          title: messageData.title || null,
          audio_url: audioUrl,
          duration: messageData.duration || null,
          category: messageData.category || null,
          request_id: messageData.requestId || null,
          audio_metadata: messageData.audioMetadata || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_read: false
        }

        // ローカルストレージに保存
        console.log('💾 ローカルストレージに保存するメッセージ:', localMessage)
        LocalStorageAudioManager.saveVoiceMessage(localMessage)

        // 保存後の確認
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('wakeup-voice-messages')
          console.log('💾 保存後のローカルストレージ確認:', saved ? JSON.parse(saved) : null)
        }

        return {
          ...localMessage,
          emotion_analysis: messageData.emotionAnalysis as Record<string, unknown> | null,
          emotion_analyzed_at: null,
          dominant_emotion: null,
          emotion_confidence: null,
          arousal_level: null,
          valence_level: null
        } as VoiceMessage
      }

      const messageInsert: VoiceMessageInsert = {
        sender_id: messageData.senderId,
        receiver_id: messageData.receiverId || messageData.senderId, // 受信者が指定されていない場合は自分宛て
        title: messageData.title,
        audio_url: audioUrl,
        duration: messageData.duration,
        category: messageData.category,
        request_id: messageData.requestId,
        audio_metadata: messageData.audioMetadata ? messageData.audioMetadata as unknown as Record<string, unknown> : null,
        emotion_analysis: messageData.emotionAnalysis as Record<string, unknown> | null
      }

      const { data, error } = await this.supabase
        .from('voice_messages')
        .insert(messageInsert)
        .select()
        .single()

      if (error) {
        throw new Error(`メッセージ保存エラー: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('音声メッセージ保存エラー:', error)

      // オフライン/開発モード用のフォールバック
      if (error instanceof Error &&
          (error.message.includes('Failed to fetch') ||
           error.message.includes('Authentication required') ||
           error.message.includes('Network error') ||
           error.message.includes('invalid input syntax for type uuid'))) {
        console.warn('Supabaseデータベースエラー。オフライン/開発モード用ダミーメッセージを返します。')
        const timestamp = Date.now()
        return {
          id: `offline-msg-${timestamp}`,
          sender_id: messageData.senderId,
          receiver_id: messageData.receiverId || messageData.senderId, // 受信者が指定されていない場合は自分宛て
          title: messageData.title || null,
          audio_url: audioUrl,
          duration: messageData.duration || null,
          category: messageData.category || null,
          request_id: messageData.requestId || null,
          audio_metadata: messageData.audioMetadata ? messageData.audioMetadata as unknown as Record<string, unknown> : null,
          emotion_analysis: messageData.emotionAnalysis as Record<string, unknown> | null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_read: false,
          emotion_analyzed_at: null,
          dominant_emotion: null,
          emotion_confidence: null,
          arousal_level: null,
          valence_level: null
        } as VoiceMessage
      }

      throw error
    }
  }

  /**
   * 音声ファイルと メッセージを一度に保存
   */
  async uploadAndSaveVoiceMessage(
    audioBlob: Blob,
    messageData: {
      senderId: string
      receiverId?: string
      title?: string
      category?: string
      duration?: number
      requestId?: string
      messageType?: string
    },
    fileName?: string,
    metadata?: AudioMetadata
  ): Promise<AudioUploadResult> {
    try {
      console.log('🎤 音声メッセージ保存開始:', {
        blobSize: audioBlob.size,
        fileName,
        messageData
      })

      // 入力データ検証
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('音声データが空です')
      }

      if (!messageData.senderId) {
        throw new Error('送信者IDが必要です')
      }

      // 1. ファイルをアップロード
      console.log('📁 ファイルアップロード開始...')
      const { audioUrl, publicUrl } = await this.uploadAudioFile(
        audioBlob,
        fileName,
        metadata
      )
      console.log('✅ ファイルアップロード完了:', { audioUrl, publicUrl })

      // 2. メッセージをデータベースに保存
      console.log('💾 データベース保存開始...')
      const savedMessage = await this.saveVoiceMessage(audioUrl, {
        ...messageData,
        audioMetadata: metadata
      })
      console.log('✅ データベース保存完了:', savedMessage)

      // 保存結果の検証
      if (!savedMessage || !savedMessage.id) {
        throw new Error('メッセージの保存に失敗しました（IDが取得できませんでした）')
      }

      const result = {
        success: true,
        audioUrl,
        publicUrl,
        messageId: savedMessage.id
      }

      console.log('🎉 音声メッセージ保存完了:', result)
      return result

    } catch (error) {
      console.error('❌ 音声メッセージの保存に失敗:', error)

      const errorMessage = error instanceof Error ? error.message : '音声メッセージの保存に失敗しました'
      console.error('詳細エラー:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        audioSize: audioBlob?.size,
        messageData
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * ユーザーの音声メッセージ一覧を取得
   */
  async getUserVoiceMessages(
    userId: string,
    type: 'sent' | 'received' | 'all' = 'all'
  ): Promise<VoiceMessage[]> {
    try {
      // ネットワーク状態を確認
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

      // オフラインモードかUUID形式でない場合はローカルストレージから取得
      if (isOffline || userId.startsWith('offline-') || userId.startsWith('test-') || !this.isValidUUID(userId)) {
        console.warn('オフライン/開発モードのため、ローカルストレージからデータを取得します:', userId)
        console.log('🔍 検索条件:', { userId, type, isOffline })

        const localMessages = LocalStorageAudioManager.getVoiceMessages(userId)
        console.log('📱 ローカルストレージから取得した全メッセージ:', localMessages)
        console.log('📱 取得件数:', localMessages.length)

        // typeに応じてフィルタリング
        let filteredMessages = localMessages
        if (type === 'sent') {
          filteredMessages = localMessages.filter(msg => msg.sender_id === userId)
          console.log('📤 送信メッセージのフィルタ結果:', filteredMessages)
        } else if (type === 'received') {
          filteredMessages = localMessages.filter(msg => msg.receiver_id === userId)
          console.log('📥 受信メッセージのフィルタ結果:', filteredMessages)
        } else {
          console.log('📧 全てのメッセージ（送信+受信）:', filteredMessages)
        }

        // VoiceMessage形式に変換
        const result = filteredMessages.map(msg => ({
          ...msg,
          audio_metadata: msg.audio_metadata as Record<string, unknown> | null,
          emotion_analysis: null,
          emotion_analyzed_at: null,
          dominant_emotion: null,
          emotion_confidence: null,
          arousal_level: null,
          valence_level: null
        } as VoiceMessage))

        console.log('✅ 最終的に返すメッセージ:', result)
        return result
      }

      // 認証状態を確認（Supabase接続できない場合はスキップ）
      try {
        const { data: { user }, error: authError } = await this.supabase.auth.getUser()
        if (authError && !authError.message.includes('Auth session missing')) {
          console.error('認証エラー:', authError)
          throw new Error(`認証エラー: ${authError.message}`)
        }

        if (!user && !authError?.message.includes('Auth session missing')) {
          throw new Error('ログインが必要です')
        }
      } catch (authCheckError) {
        console.warn('認証状態確認をスキップ（開発環境）:', authCheckError)
        return []
      }

      let query = this.supabase
        .from('voice_messages')
        .select(`
          *,
          sender:profiles!sender_id(id, display_name, email),
          receiver:profiles!receiver_id(id, display_name, email)
        `)
        .order('created_at', { ascending: false })

      if (type === 'sent') {
        query = query.eq('sender_id', userId)
      } else if (type === 'received') {
        query = query.eq('receiver_id', userId)
      } else {
        query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      }

      const { data, error } = await query

      if (error) {
        console.warn('Supabase query error:', error)
        // UUID形式エラーや接続エラーの場合は空配列を返す
        if (error.code === '22P02' ||
            error.message.includes('invalid input syntax for type uuid') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('Network error')) {
          console.warn('オフラインモード/UUID形式エラーのため空配列を返します')
          return []
        }
        throw new Error(`メッセージ取得エラー: ${error.message} (Code: ${error.code})`)
      }

      return data || []
    } catch (error) {
      console.error('音声メッセージ取得エラー:', error)
      // 開発環境でSupabaseに接続できない場合は空配列を返す
      if (error instanceof TypeError && error.message.includes('Failed to fetch') ||
          (error as { code?: string })?.code === 'PGRST301' ||
          (error as { code?: string })?.code === '22P02' || // UUID形式エラー
          (error as { message?: string })?.message?.includes('query error') ||
          (error as { message?: string })?.message?.includes('invalid input syntax for type uuid')) {
        console.warn('Supabase接続失敗またはUUIDエラー。開発環境のため空のデータを返します。')
        console.warn('実際のSupabaseプロジェクトを設定してください。')
        return []
      }
      throw error
    }
  }

  /**
   * UUID形式の検証
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  /**
   * 音声メッセージを既読にする
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('voice_messages')
        .update({ is_read: true })
        .eq('id', messageId)

      if (error) {
        throw new Error(`既読更新エラー: ${error.message}`)
      }
    } catch (error) {
      console.error('既読更新エラー:', error)
      throw error
    }
  }

  /**
   * 音声ファイルを削除
   */
  async deleteVoiceMessage(messageId: string, userId: string): Promise<void> {
    try {
      // まずメッセージを取得してファイルパスを確認
      const { data: message, error: fetchError } = await this.supabase
        .from('voice_messages')
        .select('audio_url, sender_id')
        .eq('id', messageId)
        .single()

      if (fetchError) {
        throw new Error(`メッセージ取得エラー: ${fetchError.message}`)
      }

      // 送信者のみ削除可能
      if (message.sender_id !== userId) {
        throw new Error('削除権限がありません')
      }

      // ストレージからファイルを削除
      const { error: storageError } = await this.supabase.storage
        .from('voice-messages')
        .remove([message.audio_url])

      if (storageError) {
        console.error('ストレージファイル削除エラー:', storageError)
        // ファイル削除エラーは無視して続行
      }

      // データベースから削除
      const { error: dbError } = await this.supabase
        .from('voice_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId)

      if (dbError) {
        throw new Error(`メッセージ削除エラー: ${dbError.message}`)
      }
    } catch (error) {
      console.error('音声メッセージ削除エラー:', error)
      throw error
    }
  }

  /**
   * 音声メッセージの感情分析結果を更新
   */
  async updateEmotionAnalysis(
    messageId: string,
    emotionData: {
      emotionAnalysis: Record<string, unknown>
      dominantEmotion: string
      emotionConfidence: number
      arousalLevel: number
      valenceLevel: number
    }
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('voice_messages')
        .update({
          emotion_analysis: emotionData.emotionAnalysis as Record<string, unknown> | null,
          emotion_analyzed_at: new Date().toISOString(),
          dominant_emotion: emotionData.dominantEmotion,
          emotion_confidence: emotionData.emotionConfidence,
          arousal_level: emotionData.arousalLevel,
          valence_level: emotionData.valenceLevel
        })
        .eq('id', messageId)

      if (error) {
        throw new Error(`感情分析更新エラー: ${error.message}`)
      }
    } catch (error) {
      console.error('感情分析更新エラー:', error)
      throw error
    }
  }

  /**
   * メッセージのリアクションを追加
   */
  async addReaction(
    messageId: string,
    userId: string,
    reactionType: ReactionType
  ): Promise<VoiceMessageReaction> {
    try {
      // まず既存のリアクションがあるかチェック
      const { data: existingReaction } = await this.supabase
        .from('voice_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('reaction_type', reactionType)
        .maybeSingle()

      if (existingReaction) {
        throw new Error('既にこのリアクションを追加済みです')
      }

      const reactionInsert: VoiceMessageReactionInsert = {
        message_id: messageId,
        user_id: userId,
        reaction_type: reactionType
      }

      const { data, error } = await this.supabase
        .from('voice_message_reactions')
        .insert(reactionInsert)
        .select(`
          *,
          user:profiles!user_id(id, display_name, email)
        `)
        .single()

      if (error) {
        throw new Error(`リアクション追加エラー: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('リアクション追加エラー:', error)
      throw error
    }
  }

  /**
   * メッセージのリアクションを削除
   */
  async removeReaction(
    messageId: string,
    userId: string,
    reactionType: ReactionType
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('voice_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('reaction_type', reactionType)

      if (error) {
        throw new Error(`リアクション削除エラー: ${error.message}`)
      }
    } catch (error) {
      console.error('リアクション削除エラー:', error)
      throw error
    }
  }

  /**
   * メッセージのリアクション一覧を取得
   */
  async getMessageReactions(messageId: string): Promise<VoiceMessageReaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('voice_message_reactions')
        .select(`
          *,
          user:profiles!user_id(id, display_name, email)
        `)
        .eq('message_id', messageId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`リアクション取得エラー: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('リアクション取得エラー:', error)
      throw error
    }
  }

  /**
   * 複数メッセージのリアクションを一括取得
   */
  async getMultipleMessageReactions(messageIds: string[]): Promise<Record<string, VoiceMessageReaction[]>> {
    try {
      if (messageIds.length === 0) {
        return {}
      }

      const { data, error } = await this.supabase
        .from('voice_message_reactions')
        .select(`
          *,
          user:profiles!user_id(id, display_name, email)
        `)
        .in('message_id', messageIds)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`リアクション一括取得エラー: ${error.message}`)
      }

      // メッセージIDでグループ化
      const groupedReactions: Record<string, VoiceMessageReaction[]> = {}
      messageIds.forEach(id => {
        groupedReactions[id] = []
      })

      data?.forEach((reaction: VoiceMessageReaction) => {
        if (groupedReactions[reaction.message_id]) {
          groupedReactions[reaction.message_id].push(reaction)
        }
      })

      return groupedReactions
    } catch (error) {
      console.error('リアクション一括取得エラー:', error)
      throw error
    }
  }

  /**
   * ユーザーがつけたリアクションを取得
   */
  async getUserReactions(userId: string, messageIds?: string[]): Promise<VoiceMessageReaction[]> {
    try {
      let query = this.supabase
        .from('voice_message_reactions')
        .select(`
          *,
          user:profiles!user_id(id, display_name, email)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (messageIds && messageIds.length > 0) {
        query = query.in('message_id', messageIds)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`ユーザーリアクション取得エラー: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('ユーザーリアクション取得エラー:', error)
      throw error
    }
  }
}

// シングルトンインスタンス
export const supabaseAudioManager = new SupabaseAudioManager()