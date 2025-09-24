'use client'

import { memo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// メモ化された音声メッセージカード
interface VoiceMessageCardProps {
  id: string
  title: string | null
  duration: number | null
  category: string | null
  createdAt: string
  isPlaying: boolean
  onPlay: (id: string) => void
  onStop: (id: string) => void
}

export const MemoizedVoiceMessageCard = memo<VoiceMessageCardProps>(({
  id,
  title,
  duration,
  category,
  createdAt,
  isPlaying,
  onPlay,
  onStop
}) => {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getCategoryColor = (cat: string | null) => {
    switch (cat) {
      case 'thanks': return 'bg-green-100 text-green-800'
      case 'congratulation': return 'bg-yellow-100 text-yellow-800'
      case 'relief': return 'bg-blue-100 text-blue-800'
      case 'empathy': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryLabel = (cat: string | null) => {
    switch (cat) {
      case 'thanks': return '感謝'
      case 'congratulation': return 'お祝い'
      case 'relief': return '安心'
      case 'empathy': return '共感'
      default: return 'その他'
    }
  }

  return (
    <Card key={id} className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">
            {title || '無題のメッセージ'}
          </CardTitle>
          <Badge className={getCategoryColor(category)} variant="secondary">
            {getCategoryLabel(category)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Button
              variant={isPlaying ? "destructive" : "default"}
              size="sm"
              onClick={() => isPlaying ? onStop(id) : onPlay(id)}
              className="flex items-center gap-2"
            >
              {isPlaying ? (
                <>
                  <span className="w-2 h-2 bg-current rounded-full"></span>
                  停止
                </>
              ) : (
                <>
                  ▶️ 再生
                </>
              )}
            </Button>
            <span className="text-sm text-gray-600">
              {formatDuration(duration)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500">
            <div>📅 {new Date(createdAt).toLocaleString('ja-JP')}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

MemoizedVoiceMessageCard.displayName = 'MemoizedVoiceMessageCard'

// メモ化された音声品質メトリクス
interface AudioQualityMetricsProps {
  volume: number
  clarity: number
  noiseLevel: number
}

export const MemoizedAudioQualityMetrics = memo<AudioQualityMetricsProps>(({
  volume,
  clarity,
  noiseLevel
}) => {
  const getQualityColor = (value: number) => {
    if (value >= 80) return 'text-green-600'
    if (value >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
      <div className="text-center">
        <div className="text-2xl font-bold">
          <span className={getQualityColor(volume)}>{Math.round(volume)}%</span>
        </div>
        <div className="text-xs text-gray-600">音量</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">
          <span className={getQualityColor(clarity)}>{Math.round(clarity)}%</span>
        </div>
        <div className="text-xs text-gray-600">明瞭度</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">
          <span className={getQualityColor(100 - noiseLevel)}>{Math.round(100 - noiseLevel)}%</span>
        </div>
        <div className="text-xs text-gray-600">静穏性</div>
      </div>
    </div>
  )
})

MemoizedAudioQualityMetrics.displayName = 'MemoizedAudioQualityMetrics'

// メモ化された感情分析結果
interface EmotionAnalysisProps {
  emotion: string
  confidence: number
  arousal: number
  valence: number
}

export const MemoizedEmotionAnalysis = memo<EmotionAnalysisProps>(({
  emotion,
  confidence,
  arousal,
  valence
}) => {
  const getEmotionEmoji = (emotion: string) => {
    switch (emotion.toLowerCase()) {
      case 'joy':
      case 'happiness': return '😊'
      case 'sadness': return '😢'
      case 'anger': return '😠'
      case 'fear': return '😨'
      case 'surprise': return '😲'
      case 'calm': return '😌'
      default: return '😐'
    }
  }

  const getEmotionLabel = (emotion: string) => {
    switch (emotion.toLowerCase()) {
      case 'joy':
      case 'happiness': return '喜び'
      case 'sadness': return '悲しみ'
      case 'anger': return '怒り'
      case 'fear': return '不安'
      case 'surprise': return '驚き'
      case 'calm': return '落ち着き'
      default: return '中立'
    }
  }

  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{getEmotionEmoji(emotion)}</span>
        <div>
          <div className="font-bold text-lg">{getEmotionLabel(emotion)}</div>
          <div className="text-sm text-gray-600">信頼度: {Math.round(confidence * 100)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-600">覚醒度:</span>
          <span className="ml-2 font-medium">{Math.round(arousal * 100)}%</span>
        </div>
        <div>
          <span className="text-gray-600">感情価:</span>
          <span className="ml-2 font-medium">{Math.round(valence * 100)}%</span>
        </div>
      </div>
    </div>
  )
})

MemoizedEmotionAnalysis.displayName = 'MemoizedEmotionAnalysis'