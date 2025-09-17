'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EmotionAnalyzer, type EmotionAnalysisResult } from '@/lib/audio/emotion-analysis'

interface EmotionAnalysisViewerProps {
  audioBlob?: Blob
  onAnalysisComplete?: (result: EmotionAnalysisResult) => void
  className?: string
}

export function EmotionAnalysisViewer({
  audioBlob,
  onAnalysisComplete,
  className = ''
}: EmotionAnalysisViewerProps) {
  const [analysisService, setAnalysisService] = useState<EmotionAnalyzer | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<EmotionAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const service = new EmotionAnalyzer()
    setAnalysisService(service)

    return () => {
      service.dispose()
    }
  }, [])

  useEffect(() => {
    if (analysisResult) {
      onAnalysisComplete?.(analysisResult)
    }
  }, [analysisResult, onAnalysisComplete])

  const handleAnalysis = async () => {
    if (!audioBlob || !analysisService) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const result = await analysisService.analyzeEmotion(audioBlob)
      setAnalysisResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '感情分析に失敗しました')
    } finally {
      setIsAnalyzing(false)
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

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 0.8) return 'default'
    if (confidence >= 0.6) return 'secondary'
    return 'destructive'
  }

  const getArousalValenceColor = (arousal: number, valence: number): string => {
    if (arousal > 0.5 && valence > 0.5) return 'bg-yellow-100 text-yellow-800' // 高覚醒・ポジティブ
    if (arousal > 0.5 && valence < 0.5) return 'bg-red-100 text-red-800' // 高覚醒・ネガティブ
    if (arousal < 0.5 && valence > 0.5) return 'bg-green-100 text-green-800' // 低覚醒・ポジティブ
    return 'bg-blue-100 text-blue-800' // 低覚醒・ネガティブ
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 分析コントロール */}
      {audioBlob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎭 感情分析
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleAnalysis}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? '分析中...' : '感情を分析'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* エラー表示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 分析結果 */}
      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>感情分析結果</span>
              <Badge variant={getConfidenceBadgeVariant(analysisResult.confidence)}>
                信頼度: {Math.round(analysisResult.confidence * 100)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 主要感情 */}
            <div className="space-y-3">
              <h3 className="font-semibold">検出された感情</h3>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getEmotionEmoji(analysisResult.dominantEmotion)}</span>
                <Badge className={getEmotionColor(analysisResult.dominantEmotion)}>
                  {analysisResult.dominantEmotion}
                </Badge>
                <span className="text-sm text-gray-600">
                  {Math.round(analysisResult.emotions[analysisResult.dominantEmotion as keyof typeof analysisResult.emotions] * 100)}%
                </span>
              </div>
            </div>

            {/* 感情スコア */}
            <div className="space-y-3">
              <h3 className="font-semibold">感情スコア</h3>
              <div className="space-y-2">
                {Object.entries(analysisResult.emotions)
                  .sort(([, a], [, b]) => b - a)
                  .map(([emotion, score]) => (
                    <div key={emotion} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span>{getEmotionEmoji(emotion)}</span>
                          <span className="capitalize">{emotion}</span>
                        </span>
                        <span>{Math.round(score * 100)}%</span>
                      </div>
                      <Progress value={score * 100} className="h-2" />
                    </div>
                  ))}
              </div>
            </div>

            {/* 覚醒度・感情価 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">覚醒度</h3>
                <div className="flex items-center gap-2">
                  <Progress
                    value={analysisResult.arousal * 100}
                    className="flex-1"
                  />
                  <Badge variant="outline">
                    {analysisResult.arousal > 0.5 ? '高' : '低'}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">感情価</h3>
                <div className="flex items-center gap-2">
                  <Progress
                    value={analysisResult.valence * 100}
                    className="flex-1"
                  />
                  <Badge variant="outline">
                    {analysisResult.valence > 0.5 ? 'ポジティブ' : 'ネガティブ'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 感情の次元 */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">感情の状態</h3>
              <Badge className={getArousalValenceColor(analysisResult.arousal, analysisResult.valence)}>
                {analysisResult.arousal > 0.5 && analysisResult.valence > 0.5 && '活発・ポジティブ'}
                {analysisResult.arousal > 0.5 && analysisResult.valence < 0.5 && '活発・ネガティブ'}
                {analysisResult.arousal < 0.5 && analysisResult.valence > 0.5 && '穏やか・ポジティブ'}
                {analysisResult.arousal < 0.5 && analysisResult.valence < 0.5 && '穏やか・ネガティブ'}
              </Badge>
            </div>

            {/* 音響特徴 */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">音響特徴</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">平均ピッチ:</span>
                  <span className="ml-2 font-mono">{Math.round(analysisResult.features.pitch.mean)}Hz</span>
                </div>
                <div>
                  <span className="text-gray-600">エネルギー:</span>
                  <span className="ml-2 font-mono">{analysisResult.features.energy.mean.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-gray-600">信頼度:</span>
                  <Badge variant="outline">
                    {analysisResult.confidence > 0.8 ? '高' : analysisResult.confidence > 0.6 ? '中' : '低'}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-600">話速:</span>
                  <span className="ml-2 font-mono">{analysisResult.features.speakingRate.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* メタデータ */}
            <div className="text-sm text-gray-600 pt-4 border-t">
              <div>分析日時: {new Date(analysisResult.timestamp).toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}