/**
 * メッセージ検索・分析システム
 * 転写データ、感情分析、音響特徴を活用したインテリジェント検索
 */

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

export interface SearchFilters {
  // 基本フィルター
  dateRange?: {
    start: Date
    end: Date
  }
  senders?: string[]
  receivers?: string[]
  categories?: string[]

  // 音響品質フィルター
  qualityScore?: {
    min: number
    max: number
  }

  // 感情フィルター
  emotions?: string[]
  emotionConfidence?: {
    min: number
    max: number
  }
  arousal?: {
    min: number
    max: number
  }
  valence?: {
    min: number
    max: number
  }

  // テキスト検索
  textQuery?: string
  transcriptionConfidence?: {
    min: number
    max: number
  }
}

export interface SearchOptions {
  limit?: number
  offset?: number
  sortBy?: 'created_at' | 'quality_score' | 'emotion_confidence' | 'transcription_confidence'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchResult {
  message: VoiceMessage
  senderProfile?: Profile
  receiverProfile?: Profile
  relevanceScore: number
  matchReasons: string[]
}

export interface MessageStatistics {
  totalMessages: number
  averageQuality: number
  emotionBreakdown: Record<string, number>
  categoryBreakdown: Record<string, number>
  monthlyTrends: Array<{
    month: string
    count: number
    averageQuality: number
    topEmotion: string
  }>
}

export interface PersonalizedInsights {
  mostCommonEmotion: string
  averageArousal: number
  averageValence: number
  qualityImprovement: number
  topCategories: Array<{
    category: string
    count: number
    percentage: number
  }>
  emotionalTrends: Array<{
    date: string
    happiness: number
    sadness: number
    energy: number
  }>
}

export class MessageSearchService {
  private supabase = createClient()

  /**
   * メッセージを検索
   */
  async searchMessages(
    userId: string,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options

    let query = this.supabase
      .from('voice_messages')
      .select(`
        *,
        sender:profiles!voice_messages_sender_id_fkey(id, display_name, avatar_url),
        receiver:profiles!voice_messages_receiver_id_fkey(id, display_name, avatar_url)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

    // 日付範囲フィルター
    if (filters.dateRange) {
      query = query
        .gte('created_at', filters.dateRange.start.toISOString())
        .lte('created_at', filters.dateRange.end.toISOString())
    }

    // 送信者・受信者フィルター
    if (filters.senders?.length) {
      query = query.in('sender_id', filters.senders)
    }
    if (filters.receivers?.length) {
      query = query.in('receiver_id', filters.receivers)
    }

    // カテゴリフィルター
    if (filters.categories?.length) {
      query = query.in('category', filters.categories)
    }

    // 品質スコアフィルター
    if (filters.qualityScore) {
      query = query
        .gte('quality_score', filters.qualityScore.min)
        .lte('quality_score', filters.qualityScore.max)
    }

    // 感情フィルター
    if (filters.emotions?.length) {
      query = query.in('emotion_primary', filters.emotions)
    }
    if (filters.emotionConfidence) {
      query = query
        .gte('emotion_confidence', filters.emotionConfidence.min)
        .lte('emotion_confidence', filters.emotionConfidence.max)
    }
    if (filters.arousal) {
      query = query
        .gte('emotion_arousal', filters.arousal.min)
        .lte('emotion_arousal', filters.arousal.max)
    }
    if (filters.valence) {
      query = query
        .gte('emotion_valence', filters.valence.min)
        .lte('emotion_valence', filters.valence.max)
    }

    // 転写信頼度フィルター
    if (filters.transcriptionConfidence) {
      query = query
        .gte('transcription_confidence', filters.transcriptionConfidence.min)
        .lte('transcription_confidence', filters.transcriptionConfidence.max)
    }

    // テキスト検索（転写データから）
    if (filters.textQuery) {
      query = query.ilike('transcription', `%${filters.textQuery}%`)
    }

    // ソートと制限
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      throw new Error(`検索エラー: ${error.message}`)
    }

    // 結果を SearchResult 形式に変換
    const results: SearchResult[] = data?.map(message => ({
      message,
      senderProfile: message.sender,
      receiverProfile: message.receiver,
      relevanceScore: this.calculateRelevanceScore(message, filters),
      matchReasons: this.generateMatchReasons(message, filters)
    })) || []

    return results
  }

  /**
   * メッセージの統計情報を取得
   */
  async getMessageStatistics(userId: string): Promise<MessageStatistics> {
    const { data, error } = await this.supabase
      .from('voice_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

    if (error) {
      throw new Error(`統計取得エラー: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return {
        totalMessages: 0,
        averageQuality: 0,
        emotionBreakdown: {},
        categoryBreakdown: {},
        monthlyTrends: []
      }
    }

    const totalMessages = data.length
    const averageQuality = data.reduce((sum, m) => sum + (m.quality_score || 0), 0) / totalMessages

    // 感情の内訳
    const emotionBreakdown: Record<string, number> = {}
    data.forEach(message => {
      if (message.emotion_primary) {
        emotionBreakdown[message.emotion_primary] = (emotionBreakdown[message.emotion_primary] || 0) + 1
      }
    })

    // カテゴリの内訳
    const categoryBreakdown: Record<string, number> = {}
    data.forEach(message => {
      if (message.category) {
        categoryBreakdown[message.category] = (categoryBreakdown[message.category] || 0) + 1
      }
    })

    // 月次トレンド
    const monthlyData = new Map<string, { count: number; qualitySum: number; emotions: string[] }>()
    data.forEach(message => {
      const month = new Date(message.created_at).toISOString().slice(0, 7) // YYYY-MM
      const current = monthlyData.get(month) || { count: 0, qualitySum: 0, emotions: [] }
      current.count++
      current.qualitySum += message.quality_score || 0
      if (message.emotion_primary) {
        current.emotions.push(message.emotion_primary)
      }
      monthlyData.set(month, current)
    })

    const monthlyTrends = Array.from(monthlyData.entries()).map(([month, data]) => {
      const topEmotion = this.getTopEmotion(data.emotions)
      return {
        month,
        count: data.count,
        averageQuality: data.qualitySum / data.count,
        topEmotion
      }
    }).sort((a, b) => a.month.localeCompare(b.month))

    return {
      totalMessages,
      averageQuality,
      emotionBreakdown,
      categoryBreakdown,
      monthlyTrends
    }
  }

  /**
   * パーソナライズされた分析結果を取得
   */
  async getPersonalizedInsights(userId: string): Promise<PersonalizedInsights> {
    const { data, error } = await this.supabase
      .from('voice_messages')
      .select('*')
      .eq('sender_id', userId) // 送信メッセージのみ分析
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`分析エラー: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return {
        mostCommonEmotion: 'neutral',
        averageArousal: 0,
        averageValence: 0,
        qualityImprovement: 0,
        topCategories: [],
        emotionalTrends: []
      }
    }

    // 最も多い感情
    const emotionCounts: Record<string, number> = {}
    let arousalSum = 0
    let valenceSum = 0
    let emotionCount = 0

    data.forEach(message => {
      if (message.emotion_primary) {
        emotionCounts[message.emotion_primary] = (emotionCounts[message.emotion_primary] || 0) + 1
        if (message.emotion_arousal !== null) {
          arousalSum += message.emotion_arousal
          emotionCount++
        }
        if (message.emotion_valence !== null) {
          valenceSum += message.emotion_valence
        }
      }
    })

    const mostCommonEmotion = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral'

    const averageArousal = emotionCount > 0 ? arousalSum / emotionCount : 0
    const averageValence = emotionCount > 0 ? valenceSum / emotionCount : 0

    // 品質改善の計算
    const recentMessages = data.slice(0, Math.min(10, data.length))
    const oldMessages = data.slice(-Math.min(10, data.length))
    const recentQuality = recentMessages.reduce((sum, m) => sum + (m.quality_score || 0), 0) / recentMessages.length
    const oldQuality = oldMessages.reduce((sum, m) => sum + (m.quality_score || 0), 0) / oldMessages.length
    const qualityImprovement = recentQuality - oldQuality

    // トップカテゴリ
    const categoryCounts: Record<string, number> = {}
    data.forEach(message => {
      if (message.category) {
        categoryCounts[message.category] = (categoryCounts[message.category] || 0) + 1
      }
    })

    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / data.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // 感情トレンド（過去30日）
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentEmotionalData = data
      .filter(m => new Date(m.created_at) >= thirtyDaysAgo)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const emotionalTrends = this.calculateEmotionalTrends(recentEmotionalData)

    return {
      mostCommonEmotion,
      averageArousal,
      averageValence,
      qualityImprovement,
      topCategories,
      emotionalTrends
    }
  }

  /**
   * 類似メッセージを検索
   */
  async findSimilarMessages(
    messageId: string,
    userId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    // 基準メッセージを取得
    const { data: baseMessage, error } = await this.supabase
      .from('voice_messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (error || !baseMessage) {
      throw new Error('基準メッセージが見つかりません')
    }

    // 類似度を計算するための検索
    const filters: SearchFilters = {}

    // 感情が近い
    if (baseMessage.emotion_primary) {
      filters.emotions = [baseMessage.emotion_primary]
    }

    // カテゴリが同じ
    if (baseMessage.category) {
      filters.categories = [baseMessage.category]
    }

    const results = await this.searchMessages(userId, filters, { limit: limit + 1 })

    // 基準メッセージを除外
    return results
      .filter(result => result.message.id !== messageId)
      .slice(0, limit)
  }

  /**
   * 関連性スコアを計算
   */
  private calculateRelevanceScore(message: VoiceMessage, filters: SearchFilters): number {
    let score = 0

    // 品質スコア（0-30点）
    score += (message.quality_score || 0) * 0.3

    // 感情信頼度（0-20点）
    if (message.emotion_confidence) {
      score += (message.emotion_confidence / 100) * 20
    }

    // 転写信頼度（0-20点）
    if (message.transcription_confidence) {
      score += (message.transcription_confidence / 100) * 20
    }

    // フィルター一致度（0-30点）
    if (filters.emotions?.includes(message.emotion_primary || '')) score += 10
    if (filters.categories?.includes(message.category || '')) score += 10
    if (filters.textQuery && message.transcription?.includes(filters.textQuery)) score += 10

    return Math.min(score, 100)
  }

  /**
   * マッチ理由を生成
   */
  private generateMatchReasons(message: VoiceMessage, filters: SearchFilters): string[] {
    const reasons: string[] = []

    if (filters.emotions?.includes(message.emotion_primary || '')) {
      reasons.push(`感情: ${message.emotion_primary}`)
    }
    if (filters.categories?.includes(message.category || '')) {
      reasons.push(`カテゴリ: ${message.category}`)
    }
    if (filters.textQuery && message.transcription?.includes(filters.textQuery)) {
      reasons.push(`テキスト一致: "${filters.textQuery}"`)
    }
    if (message.quality_score && message.quality_score >= 80) {
      reasons.push('高品質')
    }
    if (message.emotion_confidence && message.emotion_confidence >= 80) {
      reasons.push('高感情信頼度')
    }

    return reasons
  }

  /**
   * 最も多い感情を取得
   */
  private getTopEmotion(emotions: string[]): string {
    if (emotions.length === 0) return 'neutral'

    const counts: Record<string, number> = {}
    emotions.forEach(emotion => {
      counts[emotion] = (counts[emotion] || 0) + 1
    })

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral'
  }

  /**
   * 感情トレンドを計算
   */
  private calculateEmotionalTrends(messages: VoiceMessage[]): Array<{
    date: string
    happiness: number
    sadness: number
    energy: number
  }> {
    const dailyData = new Map<string, { happiness: number; sadness: number; arousal: number; count: number }>()

    messages.forEach(message => {
      const date = new Date(message.created_at).toISOString().split('T')[0]
      const current = dailyData.get(date) || { happiness: 0, sadness: 0, arousal: 0, count: 0 }

      if (message.emotion_primary === 'happiness') current.happiness++
      if (message.emotion_primary === 'sadness') current.sadness++
      if (message.emotion_arousal !== null) current.arousal += message.emotion_arousal

      current.count++
      dailyData.set(date, current)
    })

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        happiness: (data.happiness / data.count) * 100,
        sadness: (data.sadness / data.count) * 100,
        energy: data.count > 0 ? ((data.arousal / data.count) + 1) * 50 : 0 // -1~1を0~100に変換
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}