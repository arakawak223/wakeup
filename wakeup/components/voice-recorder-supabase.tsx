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
import { AudioCompressor, type CompressionResult } from '@/lib/audio/audio-compression'
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
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)

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

  // 安全なクリーンアップ関数
  const safeCleanup = useCallback(() => {
    console.log('安全なクリーンアップを実行中...')

    // MediaRecorderを停止
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
        console.log('MediaRecorderを停止しました')
      } catch (error) {
        console.warn('MediaRecorder停止エラー:', error)
      }
      mediaRecorderRef.current = null
    }

    // ストリームを停止
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop()
          console.log(`トラック停止: ${track.label || track.kind}`)
        }
      })
      streamRef.current = null
    }

    // 音声分析を停止
    if (audioAnalyzerRef.current) {
      audioAnalyzerRef.current.stopAnalysis()
      audioAnalyzerRef.current = null
      console.log('音声分析を停止しました')
    }

    // タイマーを停止
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
      console.log('録音時間タイマーを停止しました')
    }

    // 状態をリセット
    setIsRecording(false)
    setIsPreparing(false)
    setIsAnalyzing(false)
    setIsCompressing(false)
    setRecordingDuration(0)
    setCurrentMetrics(null)
    setQualityScore(50)

    // 音声データをクリア
    audioChunksRef.current = []

    console.log('クリーンアップ完了')
  }, [])

  // ページ離脱時の処理
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isRecording || isUploading) {
        event.preventDefault()
        event.returnValue = '録音中またはアップロード中です。ページを離れますか？'
        return '録音中またはアップロード中です。ページを離れますか？'
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isRecording) {
        console.log('ページが非表示になりました。録音を継続します。')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isRecording, isUploading])

  // コンポーネントマウント時の初期化
  useEffect(() => {
    setAudioFormat(getSupportedFormat())

    return () => {
      console.log('コンポーネントアンマウント: クリーンアップを実行')
      safeCleanup()
    }
  }, [getSupportedFormat, safeCleanup])

  // 録音開始
  const startRecording = async () => {
    try {
      setIsPreparing(true)

      // ブラウザ対応チェック
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('お使いのブラウザは音声録音をサポートしていません。')
      }

      // MediaRecorder対応チェック
      if (!window.MediaRecorder) {
        throw new Error('お使いのブラウザはMediaRecorderをサポートしていません。')
      }

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

      // ストリームの品質を検証
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        throw new Error('音声トラックが見つかりませんでした。')
      }

      const settings = audioTracks[0].getSettings()
      console.log('音声設定:', settings)

      // 低品質の場合は警告
      if (settings.sampleRate && settings.sampleRate < 22050) {
        console.warn('音声サンプルレートが低い可能性があります:', settings.sampleRate)
      }

      streamRef.current = stream

      // 音声分析の開始
      if (showQualityMetrics) {
        audioAnalyzerRef.current = new AudioAnalyzer()
        await audioAnalyzerRef.current.initializeFromStream(stream)
        setIsAnalyzing(true)
        startMetricsUpdate()
      }

      // MediaRecorderの設定と検証
      let finalFormat = audioFormat
      const options: MediaRecorderOptions = {}

      // サポートされている形式を優先順位で選択
      const supportedFormats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ]

      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          finalFormat = format as AudioFormat
          options.mimeType = format
          break
        }
      }

      console.log('使用する音声形式:', finalFormat)
      setAudioFormat(finalFormat)

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

      // ストリームクリーンアップ
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log('トラック停止:', track.label)
        })
        streamRef.current = null
      }

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

      // 音声データの検証
      if (audioChunksRef.current.length === 0) {
        throw new Error('録音データが見つかりません。もう一度お試しください。')
      }

      // 音声データを作成
      const audioBlob = new Blob(audioChunksRef.current, {
        type: audioChunksRef.current[0]?.type || audioFormat
      })

      // ファイルサイズ検証
      if (audioBlob.size === 0) {
        throw new Error('録音データが空です。もう一度お試しください。')
      }

      if (audioBlob.size > 50 * 1024 * 1024) { // 50MB制限
        throw new Error('録音ファイルが大きすぎます。録音時間を短くしてください。')
      }

      // 最低録音時間の検証（1秒）
      if (recordingDuration < 1) {
        throw new Error('録音が短すぎます。最低1秒以上録音してください。')
      }

      console.log(`録音完了: ${audioBlob.size}バイト, ${recordingDuration}秒`)

      setUploadProgress(30)

      // 音声圧縮の実行
      let finalAudioBlob = audioBlob
      let compressionResult: CompressionResult | null = null

      if (AudioCompressor.shouldCompress(audioBlob.size, recordingDuration)) {
        setIsCompressing(true)
        console.log('音声圧縮を開始します...')

        const compressionOptions = AudioCompressor.getRecommendedOptions(
          audioBlob.size,
          recordingDuration
        )

        compressionResult = await AudioCompressor.compressAudio(audioBlob, compressionOptions)
        finalAudioBlob = compressionResult.compressedBlob
        setCompressionInfo(compressionResult)

        console.log('圧縮結果:', {
          元サイズ: `${(compressionResult.originalSize / 1024).toFixed(1)}KB`,
          圧縮後: `${(compressionResult.compressedSize / 1024).toFixed(1)}KB`,
          圧縮率: `${(compressionResult.compressionRatio * 100).toFixed(1)}%`,
          品質: `${(compressionResult.quality * 100).toFixed(0)}%`
        })

        setIsCompressing(false)
      }

      setUploadProgress(50)

      // ファイル名を生成
      const timestamp = Date.now()
      const extension = compressionResult ? 'wav' : audioFormat.split('/')[1]
      const fileName = `voice_${user.id}_${timestamp}.${extension}`

      // 音声メタデータを作成
      const metadata: AudioMetadata = {
        size: finalAudioBlob.size,
        format: compressionResult ? 'audio/wav' : audioFormat,
        duration: recordingDuration,
        channels: 1,
        sampleRate: compressionResult ? 22050 : 44100
      }

      setUploadProgress(70)

      // Supabaseに保存
      const result = await supabaseAudioManager.uploadAndSaveVoiceMessage(
        finalAudioBlob,
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

      setUploadProgress(90)

      // 圧縮情報をメタデータに追加
      if (compressionResult) {
        console.log('圧縮による節約:', {
          サイズ削減: `${((compressionResult.originalSize - compressionResult.compressedSize) / 1024).toFixed(1)}KB`,
          削減率: `${((1 - compressionResult.compressionRatio) * 100).toFixed(1)}%`
        })
      }

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

      let errorMessage = '音声メッセージの保存に失敗しました。'
      if (error instanceof Error) {
        if (error.message.includes('録音データ')) {
          errorMessage = error.message
        } else if (error.message.includes('ネットワーク')) {
          errorMessage = 'ネットワークエラーが発生しました。接続を確認してお試しください。'
        } else if (error.message.includes('容量')) {
          errorMessage = 'ストレージ容量が不足しています。'
        } else {
          errorMessage += ` (${error.message})`
        }
      }

      alert(errorMessage)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      setIsCompressing(false)
      // データをクリーンアップ
      audioChunksRef.current = []
      // 圧縮情報は数秒後にクリア
      setTimeout(() => {
        setCompressionInfo(null)
      }, 5000)
    }
  }

  // エラーハンドリング
  const handleRecordingError = (error: unknown) => {
    if (error instanceof Error) {
      console.error('録音エラー詳細:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })

      let userMessage: string

      switch (error.name) {
        case 'NotAllowedError':
          userMessage = 'マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。'
          break
        case 'NotFoundError':
          userMessage = 'マイクが見つかりませんでした。マイクが接続されているか確認してください。'
          break
        case 'NotSupportedError':
          userMessage = 'お使いのブラウザは音声録音をサポートしていません。Chrome、Firefox、Safariの最新版をお試しください。'
          break
        case 'NotReadableError':
          userMessage = 'マイクが他のアプリケーションで使用されています。他のアプリを閉じてお試しください。'
          break
        case 'OverconstrainedError':
          userMessage = '音声設定に問題があります。マイクの設定を確認してください。'
          break
        case 'SecurityError':
          userMessage = 'セキュリティエラーが発生しました。HTTPSでアクセスしているか確認してください。'
          break
        default:
          if (error.message.includes('ブラウザ')) {
            userMessage = error.message
          } else {
            userMessage = `録音エラー: ${error.message}`
          }
      }

      alert(userMessage)
    } else {
      console.error('不明な録音エラー:', error)
      alert('録音中に予期しないエラーが発生しました。ページを再読み込みしてお試しください。')
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
    setCompressionInfo(null)
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
              <span className="text-sm font-medium">
                {isCompressing ? '圧縮中...' : '保存中...'}
              </span>
              <span className="text-sm">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
            {isCompressing && (
              <div className="text-xs text-gray-500 text-center">
                ファイルサイズを最適化しています...
              </div>
            )}
          </div>
        )}

        {/* 録音ボタン */}
        <div className="flex gap-2">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={disabled || isPreparing || isUploading || isCompressing}
              className="flex-1"
              size="lg"
            >
              {isPreparing ? '準備中...' : '🎤 録音開始'}
            </Button>
          ) : (
            <>
              <Button
                onClick={stopRecording}
                variant="destructive"
                className="flex-1"
                size="lg"
              >
                ⏹️ 録音停止
              </Button>
              <Button
                onClick={safeCleanup}
                variant="outline"
                size="lg"
                className="px-4"
                title="録音を中止してリセット"
              >
                ❌
              </Button>
            </>
          )}
        </div>

        {/* 緊急停止ボタン */}
        {(isRecording || isUploading || isCompressing) && (
          <Button
            onClick={safeCleanup}
            variant="outline"
            className="w-full"
            size="sm"
          >
            🛑 緊急停止（リセット）
          </Button>
        )}

        {/* 開発モード用のテストボタン */}
        {isDevMode() && (
          <Button
            onClick={handleDevModeRecording}
            variant="outline"
            className="w-full"
            disabled={isRecording || isUploading || isCompressing}
          >
            🧪 テスト音声を生成
          </Button>
        )}

        {/* 圧縮情報の表示 */}
        {compressionInfo && (
          <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm font-medium text-green-800">
              ✅ ファイルサイズを最適化しました
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
              <div>元サイズ: {(compressionInfo.originalSize / 1024).toFixed(1)}KB</div>
              <div>圧縮後: {(compressionInfo.compressedSize / 1024).toFixed(1)}KB</div>
              <div>削減率: {((1 - compressionInfo.compressionRatio) * 100).toFixed(1)}%</div>
              <div>品質: {(compressionInfo.quality * 100).toFixed(0)}%</div>
            </div>
          </div>
        )}

        {/* 音声形式の表示 */}
        <div className="text-xs text-gray-500 text-center">
          録音形式: {audioFormat}
          {compressionInfo && (
            <span className="ml-2 text-green-600">
              → 圧縮済み
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}