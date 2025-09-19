'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'

interface AudioPreviewProps {
  audioBlob: Blob
  audioUrl: string
  qualityScore?: number
  onApprove: () => void
  onReject: () => void
  onRetake?: () => void
  title?: string
  showAdvancedControls?: boolean
}

export function AudioPreview({
  audioBlob,
  audioUrl,
  qualityScore,
  onApprove,
  onReject,
  onRetake,
  title = '録音プレビュー',
  showAdvancedControls = true
}: AudioPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  // 音声ファイルの情報を取得
  const [fileSize, setFileSize] = useState(0)
  const [format, setFormat] = useState('unknown')

  useEffect(() => {
    setFileSize(audioBlob.size)
    setFormat(audioBlob.type.split('/')[1] || 'unknown')
  }, [audioBlob])

  // 音声の読み込み完了時
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [audioUrl])

  // 波形可視化
  useEffect(() => {
    if (!isPlaying || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // シンプルな波形アニメーション
      const time = Date.now() * 0.01
      const centerY = canvas.height / 2
      const amplitude = 20

      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.beginPath()

      for (let x = 0; x < canvas.width; x += 2) {
        const y = centerY + Math.sin((x + time) * 0.02) * amplitude * (Math.random() * 0.5 + 0.5)
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(draw)
      }
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying])

  // 再生/一時停止
  const togglePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  // シークバーの操作
  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio || !duration) return

    const newTime = (value[0] / 100) * duration
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }, [duration])

  // 音量調整
  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newVolume = value[0] / 100
    audio.volume = newVolume
    setVolume(newVolume)
  }, [])

  // 再生速度調整
  const handlePlaybackRateChange = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newRate = value[0] / 100
    audio.playbackRate = newRate
    setPlaybackRate(newRate)
  }, [])

  // 時間フォーマット
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ファイルサイズフォーマット
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 品質スコアの色とテキスト
  const getQualityColor = (score: number = 0) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getQualityText = (score: number = 0) => {
    if (score >= 80) return '優秀'
    if (score >= 60) return '良好'
    if (score >= 40) return '普通'
    return '要改善'
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {qualityScore !== undefined && (
            <Badge className={`${getQualityColor(qualityScore)} text-white`}>
              {Math.round(qualityScore)}点 - {getQualityText(qualityScore)}
            </Badge>
          )}
        </div>

        {/* 音声ファイル情報 */}
        <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">形式:</span> {format.toUpperCase()}
          </div>
          <div>
            <span className="font-medium">サイズ:</span> {formatFileSize(fileSize)}
          </div>
          <div>
            <span className="font-medium">長さ:</span> {formatTime(duration)}
          </div>
        </div>

        {/* 波形表示 */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={400}
            height={80}
            className="w-full h-20 bg-gray-100 dark:bg-gray-800 rounded"
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
            </div>
          )}
        </div>

        {/* 再生コントロール */}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Button
              onClick={togglePlayback}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isPlaying ? '⏸️ 一時停止' : '▶️ 再生'}
            </Button>

            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* シークバー */}
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 w-12">位置</span>
              <Slider
                value={[duration ? (currentTime / duration) * 100 : 0]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                className="flex-1"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* 高度なコントロール */}
        {showAdvancedControls && (
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">詳細コントロール</h4>

            <div className="grid grid-cols-2 gap-4">
              {/* 音量調整 */}
              <div className="space-y-1">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12">音量</span>
                  <Slider
                    value={[volume * 100]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-8">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              {/* 再生速度調整 */}
              <div className="space-y-1">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12">速度</span>
                  <Slider
                    value={[playbackRate * 100]}
                    onValueChange={handlePlaybackRateChange}
                    min={50}
                    max={200}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                    {playbackRate.toFixed(1)}x
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <Button onClick={onReject} variant="outline">
              ❌ 破棄
            </Button>
            {onRetake && (
              <Button onClick={onRetake} variant="outline">
                🔄 録音し直す
              </Button>
            )}
          </div>

          <Button onClick={onApprove} className="flex items-center gap-2">
            ✅ 送信する
          </Button>
        </div>

        {/* 隠し音声要素 */}
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          className="hidden"
        />
      </CardContent>
    </Card>
  )
}