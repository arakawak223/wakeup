'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row']

interface EmotionInsightsProps {
  userId: string
  timeRange?: '1d' | '7d' | '30d'
}

interface EmotionStats {
  totalMessages: number
  emotionBreakdown: Record<string, number>
  averageConfidence: number
  averageArousal: number
  averageValence: number
  topEmotions: Array<{ emotion: string; count: number; percentage: number }>
  moodTrend: Array<{ date: string; dominantEmotion: string; confidence: number }>
}

export function EmotionInsights({ userId, timeRange = '7d' }: EmotionInsightsProps) {
  const [stats, setStats] = useState<EmotionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'overview' | 'trends' | 'details'>('overview')
  const supabase = createClient()

  useEffect(() => {
    loadEmotionStats()
  }, [userId, timeRange])

  const loadEmotionStats = async () => {
    try {
      setLoading(true)

      const daysAgo = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : 30
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysAgo)

      const { data: messages, error } = await supabase
        .from('voice_messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .not('emotion_analysis', 'is', null)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      if (!messages || messages.length === 0) {
        setStats({
          totalMessages: 0,
          emotionBreakdown: {},
          averageConfidence: 0,
          averageArousal: 0,
          averageValence: 0,
          topEmotions: [],
          moodTrend: []
        })
        return
      }

      const emotionBreakdown: Record<string, number> = {}
      let totalConfidence = 0
      let totalArousal = 0
      let totalValence = 0
      const moodTrend: Array<{ date: string; dominantEmotion: string; confidence: number }> = []

      messages.forEach(message => {
        if (message.dominant_emotion) {
          emotionBreakdown[message.dominant_emotion] =
            (emotionBreakdown[message.dominant_emotion] || 0) + 1
        }

        if (message.emotion_confidence) {
          totalConfidence += message.emotion_confidence
        }

        if (message.arousal_level) {
          totalArousal += message.arousal_level
        }

        if (message.valence_level) {
          totalValence += message.valence_level
        }

        if (message.dominant_emotion && message.emotion_confidence) {
          moodTrend.push({
            date: message.created_at,
            dominantEmotion: message.dominant_emotion,
            confidence: message.emotion_confidence
          })
        }
      })

      const topEmotions = Object.entries(emotionBreakdown)
        .map(([emotion, count]) => ({
          emotion,
          count,
          percentage: (count / messages.length) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      setStats({
        totalMessages: messages.length,
        emotionBreakdown,
        averageConfidence: totalConfidence / messages.length,
        averageArousal: totalArousal / messages.length,
        averageValence: totalValence / messages.length,
        topEmotions,
        moodTrend
      })
    } catch (error) {
      console.error('感情統計の読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEmotionEmoji = (emotion: string): string => {
    const emojiMap: Record<string, string> = {
      happiness: '😊',
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      surprise: '😲',
      disgust: '😤',
      neutral: '😐'
    }
    return emojiMap[emotion] || '😐'
  }

  const getEmotionColor = (emotion: string): string => {
    const colorMap: Record<string, string> = {
      happiness: 'bg-yellow-100 text-yellow-800',
      sadness: 'bg-blue-100 text-blue-800',
      anger: 'bg-red-100 text-red-800',
      fear: 'bg-purple-100 text-purple-800',
      surprise: 'bg-orange-100 text-orange-800',
      disgust: 'bg-green-100 text-green-800',
      neutral: 'bg-gray-100 text-gray-800'
    }
    return colorMap[emotion] || 'bg-gray-100 text-gray-800'
  }

  const getTimeRangeLabel = (range: string): string => {
    switch (range) {
      case '1d': return '過去24時間'
      case '7d': return '過去1週間'
      case '30d': return '過去30日'
      default: return '過去1週間'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">感情分析データを読み込み中...</p>
        </CardContent>
      </Card>
    )
  }

  if (!stats || stats.totalMessages === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎭 感情分析インサイト
            <Badge variant="outline">{getTimeRangeLabel(timeRange)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">
            {getTimeRangeLabel(timeRange)}に感情分析済みのメッセージがありません
          </p>
          <p className="text-sm text-gray-400 mt-2">
            音声メッセージを送受信すると、ここに感情データが表示されます
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              🎭 感情分析インサイト
              <Badge variant="outline">{getTimeRangeLabel(timeRange)}</Badge>
            </span>
            <Badge variant="secondary">
              {stats.totalMessages} メッセージ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={view} onValueChange={(value) => setView(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">概要</TabsTrigger>
              <TabsTrigger value="trends">感情傾向</TabsTrigger>
              <TabsTrigger value="details">詳細データ</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* 感情の概要 */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold">{Math.round(stats.averageConfidence * 100)}%</div>
                    <p className="text-sm text-gray-600">平均信頼度</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold">
                      {stats.averageArousal > 0.5 ? '🔥' : '😌'}
                    </div>
                    <p className="text-sm text-gray-600">
                      {stats.averageArousal > 0.5 ? '活発' : '穏やか'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold">
                      {stats.averageValence > 0.5 ? '😊' : '😔'}
                    </div>
                    <p className="text-sm text-gray-600">
                      {stats.averageValence > 0.5 ? 'ポジティブ' : 'ネガティブ'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* トップ感情 */}
              <div className="space-y-4">
                <h3 className="font-semibold">よく検出される感情</h3>
                <div className="space-y-3">
                  {stats.topEmotions.map((item, index) => (
                    <div key={item.emotion} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <span className="text-lg">{getEmotionEmoji(item.emotion)}</span>
                        <span className="text-sm font-medium capitalize">{item.emotion}</span>
                      </div>
                      <div className="flex-1">
                        <Progress value={item.percentage} className="h-3" />
                      </div>
                      <div className="min-w-[80px] text-right">
                        <Badge className={getEmotionColor(item.emotion)}>
                          {Math.round(item.percentage)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              {/* 感情の時系列変化 */}
              <div className="space-y-4">
                <h3 className="font-semibold">感情の変化</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {stats.moodTrend.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getEmotionEmoji(trend.dominantEmotion)}</span>
                        <div>
                          <span className="font-medium capitalize">{trend.dominantEmotion}</span>
                          <p className="text-sm text-gray-500">
                            {new Date(trend.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {Math.round(trend.confidence * 100)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-6">
              {/* 詳細統計 */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold">覚醒度（活発さ）</h3>
                  <div className="flex items-center gap-3">
                    <Progress value={stats.averageArousal * 100} className="flex-1" />
                    <Badge variant="outline">
                      {Math.round(stats.averageArousal * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {stats.averageArousal > 0.7 ? '非常に活発' :
                     stats.averageArousal > 0.5 ? '活発' :
                     stats.averageArousal > 0.3 ? 'やや穏やか' : '穏やか'}
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">感情価（ポジティブ度）</h3>
                  <div className="flex items-center gap-3">
                    <Progress value={stats.averageValence * 100} className="flex-1" />
                    <Badge variant="outline">
                      {Math.round(stats.averageValence * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {stats.averageValence > 0.7 ? '非常にポジティブ' :
                     stats.averageValence > 0.5 ? 'ポジティブ' :
                     stats.averageValence > 0.3 ? 'やや ネガティブ' : 'ネガティブ'}
                  </p>
                </div>
              </div>

              {/* 全感情の詳細 */}
              <div className="space-y-3">
                <h3 className="font-semibold">感情別メッセージ数</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(stats.emotionBreakdown).map(([emotion, count]) => (
                    <div key={emotion} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <span>{getEmotionEmoji(emotion)}</span>
                        <span className="capitalize">{emotion}</span>
                      </div>
                      <Badge variant="outline">{count}件</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}