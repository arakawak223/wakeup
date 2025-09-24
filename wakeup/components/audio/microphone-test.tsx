'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

interface MicrophoneTestProps {
  onTestComplete?: (result: MicTestResult) => void
  className?: string
}

interface MicTestResult {
  isAvailable: boolean
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  avgVolume: number
  noiseLevel: number
  recommendations: string[]
}

export function MicrophoneTest({ onTestComplete, className = '' }: MicrophoneTestProps) {
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<MicTestResult | null>(null)
  const [currentVolume, setCurrentVolume] = useState(0)
  const [testProgress, setTestProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)

  // テスト実行
  const runMicrophoneTest = useCallback(async () => {
    setIsTestRunning(true)
    setError(null)
    setTestResult(null)
    setTestProgress(0)

    try {
      // マイクへのアクセス要求
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      mediaStreamRef.current = stream

      // Web Audio API の設定
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const microphone = audioContext.createMediaStreamSource(stream)
      microphone.connect(analyser)

      // 5秒間のテスト実行
      const testDuration = 5000
      const startTime = Date.now()
      const volumeReadings: number[] = []
      const noiseReadings: number[] = []

      const updateTest = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min((elapsed / testDuration) * 100, 100)
        setTestProgress(progress)

        // 音量データを取得
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)

        // 平均音量を計算
        const avgVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setCurrentVolume(avgVolume)
        volumeReadings.push(avgVolume)

        // ノイズレベルを推定（低周波数帯の分析）
        const lowFreqData = dataArray.slice(0, 16)
        const noiseLevel = lowFreqData.reduce((a, b) => a + b, 0) / lowFreqData.length
        noiseReadings.push(noiseLevel)

        if (elapsed < testDuration) {
          animationRef.current = requestAnimationFrame(updateTest)
        } else {
          // テスト完了、結果を分析
          finalizeMicTest(volumeReadings, noiseReadings)
        }
      }

      updateTest()

    } catch (error) {
      console.error('マイクテストエラー:', error)
      setError(error instanceof Error ? error.message : 'マイクアクセスエラー')
      setIsTestRunning(false)
    }
  }, [])

  // テスト結果の分析
  const finalizeMicTest = useCallback((volumeReadings: number[], noiseReadings: number[]) => {
    const avgVolume = volumeReadings.reduce((a, b) => a + b, 0) / volumeReadings.length
    const avgNoise = noiseReadings.reduce((a, b) => a + b, 0) / noiseReadings.length

    // 音量の標準偏差（安定性の指標）
    const volumeStdev = Math.sqrt(
      volumeReadings.reduce((acc, val) => acc + Math.pow(val - avgVolume, 2), 0) / volumeReadings.length
    )

    // 品質判定
    let quality: MicTestResult['quality'] = 'poor'
    const recommendations: string[] = []

    if (avgVolume > 50 && avgNoise < 20 && volumeStdev < 15) {
      quality = 'excellent'
    } else if (avgVolume > 30 && avgNoise < 30 && volumeStdev < 25) {
      quality = 'good'
    } else if (avgVolume > 15 && avgNoise < 40) {
      quality = 'fair'
    }

    // 推奨事項
    if (avgVolume < 30) {
      recommendations.push('マイクの位置を口に近づけてください')
    }
    if (avgNoise > 25) {
      recommendations.push('周囲の騒音を減らしてください')
    }
    if (volumeStdev > 20) {
      recommendations.push('一定の音量で話してください')
    }
    if (quality === 'excellent') {
      recommendations.push('マイクの品質は優秀です！')
    }

    const result: MicTestResult = {
      isAvailable: true,
      quality,
      avgVolume: Math.round(avgVolume),
      noiseLevel: Math.round(avgNoise),
      recommendations
    }

    setTestResult(result)
    setIsTestRunning(false)
    setTestProgress(100)

    // ストリームを停止
    cleanupTest()

    onTestComplete?.(result)
  }, [onTestComplete])

  // リソースのクリーンアップ
  const cleanupTest = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  // コンポーネントのアンマウント時のクリーンアップ
  useEffect(() => {
    return cleanupTest
  }, [cleanupTest])

  const getQualityColor = (quality: MicTestResult['quality']) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500'
      case 'good': return 'bg-blue-500'
      case 'fair': return 'bg-yellow-500'
      case 'poor': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getQualityText = (quality: MicTestResult['quality']) => {
    switch (quality) {
      case 'excellent': return '優秀'
      case 'good': return '良好'
      case 'fair': return '普通'
      case 'poor': return '改善必要'
      default: return '不明'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎤 マイクテスト
          {testResult && (
            <Badge className={getQualityColor(testResult.quality)}>
              {getQualityText(testResult.quality)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert>
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!testResult && !isTestRunning && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              マイクの動作確認を行います。「テスト開始」を押して5秒間話してください。
            </p>
            <Button
              onClick={runMicrophoneTest}
              className="w-full"
              disabled={isTestRunning}
            >
              テスト開始
            </Button>
          </div>
        )}

        {isTestRunning && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium">テスト実行中...</p>
              <p className="text-xs text-gray-600">自然に話してください</p>
            </div>

            <Progress value={testProgress} className="w-full" />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>現在の音量</span>
                <span>{Math.round(currentVolume)}</span>
              </div>
              <Progress value={Math.min(currentVolume * 2, 100)} className="w-full h-2" />
            </div>
          </div>
        )}

        {testResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">平均音量:</span>
                <span className="ml-2 font-medium">{testResult.avgVolume}</span>
              </div>
              <div>
                <span className="text-gray-600">ノイズレベル:</span>
                <span className="ml-2 font-medium">{testResult.noiseLevel}</span>
              </div>
            </div>

            {testResult.recommendations.length > 0 && (
              <Alert>
                <AlertTitle>推奨事項</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {testResult.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm">{rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={runMicrophoneTest}
              variant="outline"
              className="w-full"
            >
              再テスト
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}