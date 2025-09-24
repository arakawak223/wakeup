'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Mic, MicOff, Play, Pause, Download, AlertCircle } from 'lucide-react'
import { FeatureDetector } from './feature-detector'

interface ProgressiveVoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void
}

export const ProgressiveVoiceRecorder: React.FC<ProgressiveVoiceRecorderProps> = ({
  onRecordingComplete
}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        onRecordingComplete?.(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setError(null)

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          setIsRecording(false)
        }
      }, 60000)
    } catch (err) {
      setError('マイクへのアクセスが拒否されました')
      console.error('Recording failed:', err)
    }
  }, [onRecordingComplete])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
  }, [])

  const playAudio = useCallback(() => {
    if (!audioBlob) return

    const audio = new Audio(URL.createObjectURL(audioBlob))
    audio.play()
    setIsPlaying(true)

    audio.onended = () => {
      setIsPlaying(false)
    }
  }, [audioBlob])

  const downloadAudio = useCallback(() => {
    if (!audioBlob) return

    const url = URL.createObjectURL(audioBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recording-${new Date().toISOString()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [audioBlob])

  return (
    <FeatureDetector>
      {(features) => (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              音声録音
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!features.mediaRecorder && (
              <div className="flex items-center gap-2 p-3 bg-yellow-100 text-yellow-800 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  お使いのブラウザは音声録音に対応していません
                </span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-100 text-red-800 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {features.mediaRecorder ? (
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "default"}
                  size="lg"
                  className="w-full"
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-4 w-4 mr-2" />
                      録音停止
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      録音開始
                    </>
                  )}
                </Button>
              ) : (
                <Button disabled className="w-full" size="lg">
                  <MicOff className="h-4 w-4 mr-2" />
                  録音機能は利用できません
                </Button>
              )}

              {audioBlob && (
                <div className="flex gap-2">
                  <Button
                    onClick={playAudio}
                    disabled={isPlaying}
                    variant="outline"
                    className="flex-1"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        再生中
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        再生
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={downloadAudio}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    ダウンロード
                  </Button>
                </div>
              )}
            </div>

            {isRecording && (
              <div className="flex items-center justify-center gap-2 text-red-600">
                <div className="animate-pulse w-3 h-3 bg-red-600 rounded-full"></div>
                <span className="text-sm font-medium">録音中...</span>
              </div>
            )}

            {features.mediaRecorder && (
              <div className="text-xs text-gray-500 text-center">
                最大録音時間: 60秒
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </FeatureDetector>
  )
}