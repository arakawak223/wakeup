'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabaseAudioManager, type AudioMetadata } from '@/lib/audio/supabase-audio'
import { AudioAnalyzer, type AudioMetrics } from '@/lib/audio/audio-analyzer'
import { generateDummyAudioBlob } from '@/lib/dummy-audio'
import { isDevMode } from '@/lib/dev-mode'
import type { User } from '@supabase/supabase-js'

interface VoiceRecorderSupabaseProps {
  user: User
  receiverId?: string
  requestId?: string
  onRecordingComplete?: (messageId: string) => void
  disabled?: boolean
  showQualityMetrics?: boolean
  mode?: 'standalone' | 'message'
}

type AudioFormat = 'audio/webm' | 'audio/mp4' | 'audio/wav'
type MessageCategory = 'thanks' | 'congratulation' | 'relief' | 'empathy' | 'general'

const categoryLabels: Record<MessageCategory, string> = {
  thanks: '感謝',
  congratulation: 'お祝い',
  relief: '安心',
  empathy: '共感',
  general: 'その他'
}

export function VoiceRecorderSupabase({
  user,
  receiverId,
  requestId,
  onRecordingComplete,
  disabled = false,
  showQualityMetrics = true,
  mode = 'standalone'
}: VoiceRecorderSupabaseProps) {
  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioFormat, setAudioFormat] = useState<AudioFormat>('audio/webm')

  // Message data
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<MessageCategory>('general')

  // Audio analysis states
  const [currentMetrics, setCurrentMetrics] = useState<AudioMetrics | null>(null)
  const [qualityScore, setQualityScore] = useState(50)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // サポートされている音声形式を検出
  const getSupportedFormat = useCallback((): AudioFormat => {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm'
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return 'audio/mp4'
    } else {
      return 'audio/wav'
    }
  }, [])

  // コンポーネントマウント時の初期化
  useEffect(() => {
    setAudioFormat(getSupportedFormat())

    return () => {
      // クリーンアップ
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
  }, [getSupportedFormat])

  // 録音開始
  const startRecording = async () => {
    try {
      setIsPreparing(true)

      // マイクアクセスを取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      streamRef.current = stream

      // 音声分析の開始
      if (showQualityMetrics) {
        audioAnalyzerRef.current = new AudioAnalyzer()
        await audioAnalyzerRef.current.initializeFromStream(stream)
        setIsAnalyzing(true)
        startMetricsUpdate()
      }

      // MediaRecorderの設定
      const options: MediaRecorderOptions = {}
      if (MediaRecorder.isTypeSupported(audioFormat)) {
        options.mimeType = audioFormat
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = handleRecordingStop

      // 録音開始
      mediaRecorder.start(100) // 100msごとにデータを取得
      setIsRecording(true)
      setIsPreparing(false)
      setRecordingDuration(0)

      // 録音時間をカウント
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)

    } catch (error) {
      console.error('録音開始エラー:', error)
      setIsPreparing(false)
      handleRecordingError(error)
    }
  }

  // 録音停止
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsAnalyzing(false)

      // ストリームを停止
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      // 音声分析を停止
      if (audioAnalyzerRef.current) {
        audioAnalyzerRef.current.stopAnalysis()
      }

      // 録音時間カウントを停止
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    }
  }

  // 録音停止時の処理
  const handleRecordingStop = async () => {
    try {
      setIsUploading(true)
      setUploadProgress(0)

      // 音声データを作成
      const audioBlob = new Blob(audioChunksRef.current, {
        type: audioChunksRef.current[0]?.type || audioFormat
      })

      // ファイル名を生成
      const timestamp = Date.now()
      const extension = audioFormat.split('/')[1]
      const fileName = `voice_${user.id}_${timestamp}.${extension}`

      // 音声メタデータを作成
      const metadata: AudioMetadata = {
        size: audioBlob.size,
        format: audioFormat,
        duration: recordingDuration,
        channels: 1,
        sampleRate: 44100
      }

      setUploadProgress(25)

      // Supabaseに保存
      const result = await supabaseAudioManager.uploadAndSaveVoiceMessage(
        audioBlob,
        {
          senderId: user.id,
          receiverId,
          title: title || `音声メッセージ ${new Date().toLocaleString('ja-JP')}`,
          category: category === 'general' ? undefined : category,
          duration: recordingDuration,
          requestId
        },
        fileName,
        metadata
      )

      setUploadProgress(100)

      // 成功コールバック
      if (onRecordingComplete && result.messageId) {
        onRecordingComplete(result.messageId)
      }

      // フォームをリセット
      resetForm()

      console.log('音声メッセージが保存されました:', result)

    } catch (error) {
      console.error('音声保存エラー:', error)
      alert('音声メッセージの保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // エラーハンドリング
  const handleRecordingError = (error: unknown) => {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        alert('マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。')
      } else if (error.name === 'NotFoundError') {
        alert('マイクが見つかりませんでした。マイクが接続されているか確認してください。')
      } else if (error.name === 'NotSupportedError') {
        alert('お使いのブラウザは音声録音をサポートしていません。')
      } else {
        alert(`録音エラー: ${error.message}`)
      }
    } else {
      alert('録音中にエラーが発生しました。')
    }
  }

  // メトリクス更新の開始
  const startMetricsUpdate = () => {
    const updateMetrics = () => {
      if (audioAnalyzerRef.current && isAnalyzing) {
        const metrics = audioAnalyzerRef.current.getCurrentMetrics()
        setCurrentMetrics(metrics)
        setQualityScore(audioAnalyzerRef.current.getQualityScore())
      }
    }

    const interval = setInterval(updateMetrics, 100)
    setTimeout(() => clearInterval(interval), recordingDuration * 1000 + 1000)
  }

  // フォームリセット
  const resetForm = () => {
    setTitle('')
    setCategory('general')
    setRecordingDuration(0)
    setCurrentMetrics(null)
    setQualityScore(50)
  }

  // 開発モードでのダミー録音
  const handleDevModeRecording = useCallback(() => {
    if (!isDevMode()) return

    const dummyBlob = generateDummyAudioBlob()

    // ダミーデータで保存をテスト
    supabaseAudioManager.uploadAndSaveVoiceMessage(
      dummyBlob,
      {
        senderId: user.id,
        receiverId,
        title: title || `テスト音声メッセージ ${new Date().toLocaleString('ja-JP')}`,
        category: category === 'general' ? undefined : category,
        duration: 5,
        requestId
      },
      `test_voice_${Date.now()}.webm`,
      {
        size: dummyBlob.size,
        format: 'audio/webm',
        duration: 5,
        channels: 1,
        sampleRate: 44100
      }
    ).then((result) => {
      console.log('テスト音声が保存されました:', result)
      if (onRecordingComplete && result.messageId) {
        onRecordingComplete(result.messageId)
      }
      resetForm()
    }).catch((error) => {
      console.error('テスト音声保存エラー:', error)
    })
  }, [user.id, receiverId, title, category, requestId, onRecordingComplete])

  // 録音時間のフォーマット
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 品質スコアの色を取得
  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎤 音声録音
          {mode === 'message' && receiverId && (
            <Badge variant="outline">メッセージ送信</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* タイトル入力 */}
        <div className="space-y-2">
          <Label htmlFor="title">タイトル (任意)</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="音声メッセージのタイトル"
            disabled={isRecording || isUploading}
          />
        </div>

        {/* カテゴリ選択 */}
        <div className="space-y-2">
          <Label htmlFor="category">カテゴリ</Label>
          <Select
            value={category}
            onValueChange={(value: MessageCategory) => setCategory(value)}
            disabled={isRecording || isUploading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 録音中の情報表示 */}
        {isRecording && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">録音中...</span>
              <Badge variant="destructive" className="animate-pulse">
                🔴 REC
              </Badge>
            </div>
            <div className="text-center">
              <span className="text-2xl font-mono">
                {formatDuration(recordingDuration)}
              </span>
            </div>

            {/* 品質メトリクス */}
            {showQualityMetrics && currentMetrics && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm">音質スコア</span>
                  <span className={`font-bold ${getQualityColor(qualityScore)}`}>
                    {qualityScore}%
                  </span>
                </div>
                <Progress value={qualityScore} className="h-2" />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>音量: {Math.round(currentMetrics.volume)}%</div>
                  <div>明瞭度: {Math.round(currentMetrics.clarity)}%</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* アップロード中の表示 */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">保存中...</span>
              <span className="text-sm">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* 録音ボタン */}
        <div className="flex gap-2">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={disabled || isPreparing || isUploading}
              className="flex-1"
              size="lg"
            >
              {isPreparing ? '準備中...' : '🎤 録音開始'}
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="flex-1"
              size="lg"
            >
              ⏹️ 録音停止
            </Button>
          )}
        </div>

        {/* 開発モード用のテストボタン */}
        {isDevMode() && (
          <Button
            onClick={handleDevModeRecording}
            variant="outline"
            className="w-full"
            disabled={isRecording || isUploading}
          >
            🧪 テスト音声を生成
          </Button>
        )}

        {/* 音声形式の表示 */}
        <div className="text-xs text-gray-500 text-center">
          録音形式: {audioFormat}
        </div>
      </CardContent>
    </Card>
  )
}