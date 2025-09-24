'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'

interface AudioVisualizerProps {
  audioStream?: MediaStream | null
  isRecording?: boolean
  className?: string
  showControls?: boolean
}

export function AudioVisualizer({
  audioStream,
  isRecording = false,
  className = '',
  showControls = true
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const [visualizationType, setVisualizationType] = useState<'waveform' | 'frequency' | 'bars' | 'circle'>('waveform')
  const [sensitivity, setSensitivity] = useState([1])
  const [colorMode, setColorMode] = useState<'rainbow' | 'blue' | 'green' | 'red'>('rainbow')
  const [isActive, setIsActive] = useState(false)

  // 初期化
  const initializeAudioContext = useCallback(async () => {
    if (!audioStream) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      analyser.minDecibels = -100
      analyser.maxDecibels = -10
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(audioStream)
      source.connect(analyser)

      setIsActive(true)
      startVisualization()
    } catch (error) {
      console.error('AudioContext初期化エラー:', error)
    }
  }, [audioStream])

  // 視覚化開始
  const startVisualization = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      analyser.getByteFrequencyData(dataArray)

      // キャンバスクリア
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      switch (visualizationType) {
        case 'waveform':
          drawWaveform(ctx, dataArray, canvas.width, canvas.height)
          break
        case 'frequency':
          drawFrequencySpectrum(ctx, dataArray, canvas.width, canvas.height)
          break
        case 'bars':
          drawBars(ctx, dataArray, canvas.width, canvas.height)
          break
        case 'circle':
          drawCircle(ctx, dataArray, canvas.width, canvas.height)
          break
      }

      if (isActive) {
        animationRef.current = requestAnimationFrame(draw)
      }
    }

    draw()
  }, [visualizationType, isActive, sensitivity, colorMode])

  // 波形描画
  const drawWaveform = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number) => {
    ctx.lineWidth = 2
    ctx.strokeStyle = getColor(128, 255)
    ctx.beginPath()

    const sliceWidth = width / dataArray.length
    let x = 0

    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] / 255) * sensitivity[0]
      const y = (v * height) / 2

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.stroke()
  }

  // 周波数スペクトラム描画
  const drawFrequencySpectrum = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number) => {
    const barWidth = width / dataArray.length

    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * height * sensitivity[0]

      ctx.fillStyle = getColor(dataArray[i], 255)
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight)
    }
  }

  // バー視覚化
  const drawBars = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number) => {
    const barCount = Math.min(64, dataArray.length)
    const barWidth = width / barCount

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * dataArray.length)
      const barHeight = (dataArray[dataIndex] / 255) * height * sensitivity[0]

      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight)
      gradient.addColorStop(0, getColor(dataArray[dataIndex] * 0.5, 255))
      gradient.addColorStop(1, getColor(dataArray[dataIndex], 255))

      ctx.fillStyle = gradient
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight)
    }
  }

  // 円形視覚化
  const drawCircle = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number) => {
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 4

    ctx.save()
    ctx.translate(centerX, centerY)

    const angleStep = (Math.PI * 2) / dataArray.length

    for (let i = 0; i < dataArray.length; i++) {
      const amplitude = (dataArray[i] / 255) * sensitivity[0]
      const angle = i * angleStep

      const x1 = Math.cos(angle) * radius
      const y1 = Math.sin(angle) * radius
      const x2 = Math.cos(angle) * (radius + amplitude * 100)
      const y2 = Math.sin(angle) * (radius + amplitude * 100)

      ctx.strokeStyle = getColor(dataArray[i], 255)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    ctx.restore()
  }

  // 色生成
  const getColor = (value: number, max: number): string => {
    const intensity = value / max

    switch (colorMode) {
      case 'rainbow':
        const hue = (intensity * 240 + 120) % 360
        return `hsl(${hue}, 100%, 50%)`
      case 'blue':
        return `rgba(0, ${Math.floor(intensity * 255)}, 255, ${intensity})`
      case 'green':
        return `rgba(0, 255, ${Math.floor(intensity * 255)}, ${intensity})`
      case 'red':
        return `rgba(255, ${Math.floor(intensity * 255)}, 0, ${intensity})`
      default:
        return `rgba(255, 255, 255, ${intensity})`
    }
  }

  // エフェクト
  useEffect(() => {
    if (audioStream && isRecording) {
      initializeAudioContext()
    } else {
      setIsActive(false)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [audioStream, isRecording, initializeAudioContext])

  useEffect(() => {
    if (isActive) {
      startVisualization()
    }
  }, [visualizationType, sensitivity, colorMode, startVisualization, isActive])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎵 音声視覚化
          {isActive && <Badge variant="secondary">動作中</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="w-full border rounded-lg bg-black"
            style={{ aspectRatio: '2/1' }}
          />

          {showControls && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">視覚化タイプ</label>
                <div className="flex gap-2 mt-1">
                  {(['waveform', 'frequency', 'bars', 'circle'] as const).map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant={visualizationType === type ? 'default' : 'outline'}
                      onClick={() => setVisualizationType(type)}
                    >
                      {type === 'waveform' && '波形'}
                      {type === 'frequency' && 'スペクトラム'}
                      {type === 'bars' && 'バー'}
                      {type === 'circle' && '円形'}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">カラーモード</label>
                <div className="flex gap-2 mt-1">
                  {(['rainbow', 'blue', 'green', 'red'] as const).map((color) => (
                    <Button
                      key={color}
                      size="sm"
                      variant={colorMode === color ? 'default' : 'outline'}
                      onClick={() => setColorMode(color)}
                    >
                      {color === 'rainbow' && '🌈'}
                      {color === 'blue' && '🔵'}
                      {color === 'green' && '🟢'}
                      {color === 'red' && '🔴'}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">感度: {sensitivity[0].toFixed(1)}</label>
                <Slider
                  value={sensitivity}
                  onValueChange={setSensitivity}
                  min={0.1}
                  max={3}
                  step={0.1}
                  className="mt-2"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}