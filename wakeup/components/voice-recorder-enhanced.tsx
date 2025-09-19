'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AudioAnalyzer, type AudioSettings, type AudioMetrics } from '@/lib/audio/audio-analyzer'
import { generateDummyAudioBlob } from '@/lib/dummy-audio'
import { isDevMode } from '@/lib/dev-mode'

interface VoiceRecording {
  id: string
  name: string
  url: string
  createdAt: Date
  qualityScore?: number
  settings?: AudioSettings
}

interface EnhancedVoiceRecorderProps {
  userId?: string
  mode?: 'standalone' | 'send'
  onRecordingComplete?: (audioBlob: Blob, metadata?: { qualityScore: number; settings: AudioSettings }) => void
  disabled?: boolean
  showQualityMetrics?: boolean
}

export function EnhancedVoiceRecorder(props: EnhancedVoiceRecorderProps = {}) {
  const {
    onRecordingComplete,
    disabled = false,
    showQualityMetrics = true
  } = props

  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [recordings, setRecordings] = useState<VoiceRecording[]>([])
  const [currentAudio, setCurrentAudio] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)

  // Audio analysis states
  const [currentMetrics, setCurrentMetrics] = useState<AudioMetrics | null>(null)
  const [qualityScore, setQualityScore] = useState(50)
  const [recommendedSettings, setRecommendedSettings] = useState<AudioSettings | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioAnalyzerRef.current) {
        audioAnalyzerRef.current.stopAnalysis()
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [])

  // Real-time metrics update
  useEffect(() => {
    if (!isAnalyzing || !audioAnalyzerRef.current) return

    const updateMetrics = () => {
      if (audioAnalyzerRef.current) {
        const metrics = audioAnalyzerRef.current.getCurrentMetrics()
        const score = audioAnalyzerRef.current.getQualityScore()
        const settings = audioAnalyzerRef.current.getRecommendedSettings()

        setCurrentMetrics(metrics)
        setQualityScore(score)
        setRecommendedSettings(settings)
      }
    }

    const interval = setInterval(updateMetrics, 100)
    return () => clearInterval(interval)
  }, [isAnalyzing])

  /**
   * 最適な設定を適用してストリームを再初期化
   */
  const applyOptimalSettings = useCallback(async () => {
    if (!audioAnalyzerRef.current) return

    try {
      const recommendations = audioAnalyzerRef.current.getRecommendedSettings()

      // 既存のストリームをクリーンアップ
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      // 推奨設定でストリームを再取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: recommendations.echoCancellation,
          noiseSuppression: recommendations.noiseSuppression,
          autoGainControl: recommendations.autoGainControl,
          sampleRate: recommendations.sampleRate,
          channelCount: 1
        }
      })

      streamRef.current = stream
      audioAnalyzerRef.current.startAnalysis(stream)

    } catch (error) {
      console.error('最適設定適用エラー:', error)
    }
  }, [])

  /**
   * 音声分析を開始
   */
  const startAnalysis = useCallback(async () => {
    try {
      setIsPreparing(true)
      setIsAnalyzing(true)

      // 既存のストリームをクリーンアップ
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      // 基本設定でストリームを取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      streamRef.current = stream

      // 音声分析を開始
      audioAnalyzerRef.current = new AudioAnalyzer()
      audioAnalyzerRef.current.startAnalysis(stream)

      setIsPreparing(false)

      // 3秒間分析してから推奨設定を適用
      setTimeout(() => {
        applyOptimalSettings()
      }, 3000)

    } catch (error) {
      console.error('音声分析開始エラー:', error)
      setIsPreparing(false)
      setIsAnalyzing(false)
    }
  }, [applyOptimalSettings])

  /**
   * 録音開始
   */
  const startRecording = useCallback(async () => {
    try {
      if (!streamRef.current) {
        await startAnalysis()
        // 分析開始後少し待ってから録音開始
        setTimeout(() => startRecording(), 1000)
        return
      }

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm;codecs=opus'
      })

      const audioChunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        const finalQualityScore = audioAnalyzerRef.current?.getQualityScore() || 50
        const finalSettings = audioAnalyzerRef.current?.getRecommendedSettings()

        // 録音を保存
        const recording: VoiceRecording = {
          id: Date.now().toString(),
          name: `録音_${new Date().toLocaleString('ja-JP')}`,
          url: URL.createObjectURL(audioBlob),
          createdAt: new Date(),
          qualityScore: finalQualityScore,
          settings: finalSettings
        }

        setRecordings(prev => [recording, ...prev])

        // コールバックを実行
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, {
            qualityScore: finalQualityScore,
            settings: finalSettings || audioAnalyzerRef.current?.getRecommendedSettings() || {
              sampleRate: 44100,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false,
              channelCount: 1,
              volume: 1.0
            }
          })
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // 100ms間隔でデータを取得

      setIsRecording(true)
      setRecordingDuration(0)

      // 録音時間をカウント
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)

    } catch (error) {
      console.error('録音開始エラー:', error)
    }
  }, [onRecordingComplete, startAnalysis])

  /**
   * 録音停止
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    }
  }, [isRecording])

  /**
   * 音声再生
   */
  const playAudio = useCallback((audioUrl: string) => {
    if (currentAudio === audioUrl) {
      setCurrentAudio(null)
      return
    }
    setCurrentAudio(audioUrl)
  }, [currentAudio])

  /**
   * 録音削除
   */
  const deleteRecording = useCallback((id: string) => {
    setRecordings(prev => {
      const recording = prev.find(r => r.id === id)
      if (recording) {
        URL.revokeObjectURL(recording.url)
      }
      return prev.filter(r => r.id !== id)
    })
  }, [])

  /**
   * 品質レベルの色を取得
   */
  const getQualityColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  /**
   * 品質レベルのテキストを取得
   */
  const getQualityText = (score: number) => {
    if (score >= 80) return '優秀'
    if (score >= 60) return '良好'
    if (score >= 40) return '普通'
    return '要改善'
  }

  /**
   * 開発モードでのダミー録音生成
   */
  const handleDevModeRecording = useCallback(() => {
    if (!isDevMode()) return

    const dummyBlob = generateDummyAudioBlob()
    const recording: VoiceRecording = {
      id: Date.now().toString(),
      name: `テスト録音_${new Date().toLocaleString('ja-JP')}`,
      url: URL.createObjectURL(dummyBlob),
      createdAt: new Date(),
      qualityScore: 75 + Math.random() * 20 // 75-95の品質スコア
    }

    setRecordings(prev => [recording, ...prev])

    if (onRecordingComplete) {
      onRecordingComplete(dummyBlob, {
        qualityScore: recording.qualityScore ?? 75,
        settings: {
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          volume: 1.0
        }
      })
    }
  }, [onRecordingComplete])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎤 スマート音声レコーダー
            {isDevMode() && (
              <Badge variant="outline" className="text-xs">
                🧪 開発モード
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 音声品質メトリクス */}
          {showQualityMetrics && isAnalyzing && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">音声品質</span>
                <Badge className={`${getQualityColor(qualityScore)} text-white`}>
                  {Math.round(qualityScore)}点 - {getQualityText(qualityScore)}
                </Badge>
              </div>

              <Progress value={qualityScore} className="w-full" />

              {currentMetrics && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-gray-600 dark:text-gray-400">
                    音量: {Math.round(currentMetrics.volume)}%
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    ノイズ: {Math.round(currentMetrics.noiseLevel)}%
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    明瞭度: {Math.round(currentMetrics.clarity)}%
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    周波数: {Math.round(currentMetrics.frequency)}Hz
                  </div>
                </div>
              )}

              {recommendedSettings && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  推奨設定: サンプルレート {recommendedSettings.sampleRate}Hz,
                  ノイズ抑制 {recommendedSettings.noiseSuppression ? 'ON' : 'OFF'}
                </div>
              )}
            </div>
          )}

          {/* 録音コントロール */}
          <div className="flex items-center gap-4">
            {!isRecording ? (
              <Button
                onClick={isDevMode() ? handleDevModeRecording : startRecording}
                disabled={disabled || isPreparing}
                className="flex items-center gap-2"
              >
                {isPreparing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    準備中...
                  </>
                ) : (
                  <>
                    🎤 {isDevMode() ? 'テスト録音生成' : '録音開始'}
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button onClick={stopRecording} variant="destructive" className="flex items-center gap-2">
                  ⏹️ 停止 ({recordingDuration}秒)
                </Button>
                <div className="flex items-center gap-2 text-red-500">
                  <div className="animate-pulse w-3 h-3 bg-red-500 rounded-full" />
                  録音中
                </div>
              </>
            )}

            {!isAnalyzing && !isRecording && (
              <Button onClick={startAnalysis} variant="outline" size="sm">
                🔍 音声分析開始
              </Button>
            )}
          </div>

          {/* 録音一覧 */}
          {recordings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">録音一覧</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {recordings.map((recording) => (
                  <div key={recording.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {recording.name}
                        </span>
                        {recording.qualityScore && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${getQualityColor(recording.qualityScore)} text-white`}
                          >
                            {Math.round(recording.qualityScore)}点
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {recording.createdAt.toLocaleString('ja-JP')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => playAudio(recording.url)}
                      >
                        {currentAudio === recording.url ? '⏸️' : '▶️'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteRecording(recording.id)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 音声プレイヤー */}
          {currentAudio && (
            <audio
              src={currentAudio}
              controls
              autoPlay
              className="w-full"
              onEnded={() => setCurrentAudio(null)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}