'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { EnhancedAudioMetrics } from '@/lib/audio/enhanced-audio-analyzer'

interface EmotionData {
  emotion: string
  confidence: number
  arousal: number
  valence: number
  color: string
  emoji: string
  description: string
}

interface EmotionVisualizationProps {
  metrics?: EnhancedAudioMetrics | null
  emotionData?: EmotionData | null
  isRealtime?: boolean
  showDetails?: boolean
}

// 感情マッピング関数
const analyzeEmotion = (metrics: EnhancedAudioMetrics): EmotionData => {
  const { spectralCentroid, volume, clarity, dynamicRange } = metrics

  // スペクトル重心と音量から感情を推定
  let emotion = 'neutral'
  let arousal = 0.5 // 覚醒度 (0-1)
  let valence = 0.5 // 感情価 (0=negative, 1=positive)

  // 音量と動的範囲から覚醒度を計算
  arousal = Math.min(1, (volume / 100 + dynamicRange / 50) / 2)

  // スペクトル重心と明瞭度から感情価を計算
  valence = Math.min(1, (clarity / 100 + (spectralCentroid > 1500 ? 0.7 : 0.3)))

  // 感情カテゴリの決定
  if (arousal > 0.7 && valence > 0.7) {
    emotion = 'joy'
  } else if (arousal > 0.7 && valence < 0.3) {
    emotion = 'anger'
  } else if (arousal < 0.3 && valence < 0.3) {
    emotion = 'sadness'
  } else if (arousal < 0.3 && valence > 0.7) {
    emotion = 'calm'
  } else if (arousal > 0.5 && valence < 0.4) {
    emotion = 'stress'
  } else if (arousal < 0.4 && valence > 0.6) {
    emotion = 'peaceful'
  } else {
    emotion = 'neutral'
  }

  const emotionConfig = getEmotionConfig(emotion)

  return {
    emotion,
    confidence: Math.min(1, Math.max(0.3, clarity / 100)),
    arousal,
    valence,
    ...emotionConfig
  }
}

// 感情設定を取得
const getEmotionConfig = (emotion: string) => {
  const configs: Record<string, { color: string; emoji: string; description: string }> = {
    joy: {
      color: 'bg-yellow-400',
      emoji: '😊',
      description: '喜びや楽しさ'
    },
    anger: {
      color: 'bg-red-500',
      emoji: '😠',
      description: '怒りや興奮'
    },
    sadness: {
      color: 'bg-blue-400',
      emoji: '😢',
      description: '悲しみや落ち込み'
    },
    calm: {
      color: 'bg-green-400',
      emoji: '😌',
      description: '落ち着きや安らぎ'
    },
    stress: {
      color: 'bg-orange-500',
      emoji: '😰',
      description: 'ストレスや緊張'
    },
    peaceful: {
      color: 'bg-purple-400',
      emoji: '🕊️',
      description: '平和や静寂'
    },
    neutral: {
      color: 'bg-gray-400',
      emoji: '😐',
      description: '中性的'
    }
  }

  return configs[emotion] || configs.neutral
}

export function EmotionVisualization({
  metrics,
  emotionData,
  isRealtime = false,
  showDetails = true
}: EmotionVisualizationProps) {
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData | null>(null)
  const [emotionHistory, setEmotionHistory] = useState<EmotionData[]>([])

  useEffect(() => {
    if (metrics) {
      const emotion = analyzeEmotion(metrics)
      setCurrentEmotion(emotion)

      if (isRealtime) {
        setEmotionHistory(prev => [emotion, ...prev].slice(0, 10))
      }
    } else if (emotionData) {
      setCurrentEmotion(emotionData)
    }
  }, [metrics, emotionData, isRealtime])

  if (!currentEmotion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">🎭 感情分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">
            分析データがありません
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          🎭 感情分析
          {isRealtime && (
            <Badge variant="outline" className="text-xs">
              リアルタイム
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* メイン感情表示 */}
        <div className="text-center space-y-2">
          <div className="text-4xl">{currentEmotion.emoji}</div>
          <div className="font-medium capitalize">{currentEmotion.emotion}</div>
          <div className="text-sm text-gray-600">{currentEmotion.description}</div>
          <div className="flex items-center gap-2 justify-center">
            <div className={`w-3 h-3 rounded-full ${currentEmotion.color}`}></div>
            <span className="text-sm">
              信頼度: {(currentEmotion.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {showDetails && (
          <>
            {/* 覚醒度と感情価 */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>覚醒度 (エネルギー)</span>
                  <span>{(currentEmotion.arousal * 100).toFixed(0)}%</span>
                </div>
                <Progress value={currentEmotion.arousal * 100} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>感情価 (ポジティブ度)</span>
                  <span>{(currentEmotion.valence * 100).toFixed(0)}%</span>
                </div>
                <Progress value={currentEmotion.valence * 100} className="h-2" />
              </div>
            </div>

            {/* 感情の説明 */}
            <div className="text-xs text-gray-600 space-y-1">
              <p>• 覚醒度: 声の活発さやエネルギーレベル</p>
              <p>• 感情価: ポジティブ(高) vs ネガティブ(低)</p>
            </div>
          </>
        )}

        {/* リアルタイム履歴 */}
        {isRealtime && emotionHistory.length > 1 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-700">最近の感情変化</div>
            <div className="flex gap-1 justify-center flex-wrap">
              {emotionHistory.slice(0, 5).map((emotion, index) => (
                <div
                  key={index}
                  className="text-lg opacity-75"
                  style={{ opacity: 1 - (index * 0.15) }}
                  title={`${emotion.emotion} (${(emotion.confidence * 100).toFixed(0)}%)`}
                >
                  {emotion.emoji}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 感情マップ */}
        {showDetails && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-700">感情マップ</div>
            <div className="relative w-full h-24 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-lg border">
              {/* 現在位置のマーカー */}
              <div
                className="absolute w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${currentEmotion.valence * 100}%`,
                  top: `${(1 - currentEmotion.arousal) * 100}%`
                }}
              />

              {/* 軸ラベル */}
              <div className="absolute inset-0 flex items-end justify-between text-xs text-gray-600 p-1">
                <span>ネガティブ</span>
                <span>ポジティブ</span>
              </div>
              <div className="absolute inset-0 flex flex-col justify-between items-start text-xs text-gray-600 p-1">
                <span>活発</span>
                <span>穏やか</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 音声メッセージの感情分析サマリー
export function EmotionSummary({
  emotionData,
  duration
}: {
  emotionData: EmotionData[],
  duration: number
}) {
  if (!emotionData.length) return null

  // 主要感情を計算
  const emotionCounts = emotionData.reduce((acc, emotion) => {
    acc[emotion.emotion] = (acc[emotion.emotion] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const dominantEmotion = Object.entries(emotionCounts)
    .sort(([,a], [,b]) => b - a)[0]

  const averageArousal = emotionData.reduce((sum, e) => sum + e.arousal, 0) / emotionData.length
  const averageValence = emotionData.reduce((sum, e) => sum + e.valence, 0) / emotionData.length

  const config = getEmotionConfig(dominantEmotion[0])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">📊 感情分析サマリー</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.emoji}</span>
          <div>
            <div className="font-medium capitalize">{dominantEmotion[0]}</div>
            <div className="text-sm text-gray-600">
              {duration}秒間の主要感情
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            平均覚醒度: {(averageArousal * 100).toFixed(0)}% |
            平均感情価: {(averageValence * 100).toFixed(0)}%
          </div>

          <div className="flex gap-1">
            {Object.entries(emotionCounts)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 3)
              .map(([emotion, count]) => {
                const emotionConfig = getEmotionConfig(emotion)
                return (
                  <Badge key={emotion} variant="outline" className="text-xs">
                    {emotionConfig.emoji} {emotion} ({count})
                  </Badge>
                )
              })
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}