/**
 * Supabase音声ファイル管理システム
 */

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row']
type VoiceMessageInsert = Database['public']['Tables']['voice_messages']['Insert']

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

      // ファイルをアップロード
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('voice-messages')
        .upload(finalFileName, audioBlob, {
          contentType: audioBlob.type || 'audio/webm',
          metadata: metadata as Record<string, string>
        })

      if (uploadError) {
        throw new Error(`ファイルアップロードエラー: ${uploadError.message}`)
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
      const messageInsert: VoiceMessageInsert = {
        sender_id: messageData.senderId,
        receiver_id: messageData.receiverId,
        title: messageData.title,
        audio_url: audioUrl,
        duration: messageData.duration,
        category: messageData.category,
        request_id: messageData.requestId,
        audio_metadata: messageData.audioMetadata as any,
        emotion_analysis: messageData.emotionAnalysis as any
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
      // 1. ファイルをアップロード
      const { audioUrl, publicUrl } = await this.uploadAudioFile(
        audioBlob,
        fileName,
        metadata
      )

      // 2. メッセージをデータベースに保存
      const savedMessage = await this.saveVoiceMessage(audioUrl, {
        ...messageData,
        audioMetadata: metadata
      })

      return {
        success: true,
        audioUrl,
        publicUrl,
        messageId: savedMessage.id
      }
    } catch (error) {
      console.error('音声メッセージの保存に失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '音声メッセージの保存に失敗しました'
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
        throw new Error(`メッセージ取得エラー: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('音声メッセージ取得エラー:', error)
      throw error
    }
  }

  /**
   * 音声メッセージを既読にする
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('voice_messages')
        .update({ is_read: true })
        .eq('id', messageId)
        .eq('receiver_id', userId)

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
          emotion_analysis: emotionData.emotionAnalysis as any,
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
}

// シングルトンインスタンス
export const supabaseAudioManager = new SupabaseAudioManager()