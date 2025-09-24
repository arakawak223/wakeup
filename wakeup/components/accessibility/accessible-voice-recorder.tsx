'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Square, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScreenReaderAnnouncer, AriaLabels, FocusManager } from '@/lib/accessibility/screen-reader'

interface AccessibleVoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, duration: number, transcription?: string) => void
  onRecordingStart?: () => void
  onRecordingStop?: () => void
  maxDuration?: number
  showVisualFeedback?: boolean
  showTranscription?: boolean
  disabled?: boolean
  className?: string
}

export function AccessibleVoiceRecorder({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  maxDuration = 60,
  showVisualFeedback = true,
  showTranscription = false,
  disabled = false,
  className = ''
}: AccessibleVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [transcription, setTranscription] = useState('')
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const animationFrameRef = useRef<number>(0)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const announcer = ScreenReaderAnnouncer.getInstance()

  useEffect(() => {
    checkMicrophonePermission()
    initializeSpeechRecognition()

    return () => {
      cleanup()
    }
  }, [])

  useEffect(() => {
    if (isRecording && recordingTime >= maxDuration) {
      handleStopRecording()
    }
  }, [recordingTime, maxDuration, isRecording])

  const checkMicrophonePermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setPermissionStatus(permission.state)

      permission.onchange = () => {
        setPermissionStatus(permission.state)
        if (permission.state === 'denied') {
          announcer.announce('マイクロフォンのアクセス許可が拒否されました。', 'assertive')
        }
      }
    } catch (error) {
      console.warn('Permission API not supported')
    }
  }

  const initializeSpeechRecognition = () => {
    if (!showTranscription) return

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'ja-JP'

      recognition.onresult = (event) => {
        let finalTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          }
        }
        if (finalTranscript) {
          setTranscription(prev => prev + finalTranscript)
        }
      }

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error)
      }

      recognitionRef.current = recognition
    }
  }

  const updateAudioLevel = () => {
    if (!analyzerRef.current) return

    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount)
    analyzerRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = Math.min(average / 128, 1)
    setAudioLevel(normalizedLevel)

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const handleStartRecording = async () => {
    if (disabled || isRecording) return

    setError(null)
    FocusManager.saveFocus()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream

      // Set up audio analysis
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyzer = audioContext.createAnalyser()

      analyzer.fftSize = 256
      source.connect(analyzer)

      audioContextRef.current = audioContext
      analyzerRef.current = analyzer

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/wav'
      })

      const audioChunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType })
        onRecordingComplete?.(audioBlob, recordingTime, transcription || undefined)
      }

      mediaRecorderRef.current = mediaRecorder

      // Start recording
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      setTranscription('')

      // Start speech recognition
      if (recognitionRef.current && showTranscription) {
        recognitionRef.current.start()
      }

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 0.1)
      }, 100)

      // Start audio level monitoring
      updateAudioLevel()

      announcer.announceRecordingStart(maxDuration)
      onRecordingStart?.()

    } catch (error) {
      console.error('Recording start failed:', error)
      const errorMessage = error instanceof Error ? error.message : '録音の開始に失敗しました'
      setError(errorMessage)
      announcer.announceRecordingError(errorMessage)
      cleanup()
    }
  }

  const handleStopRecording = () => {
    if (!isRecording) return

    setIsRecording(false)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (recognitionRef.current && showTranscription) {
      recognitionRef.current.stop()
    }

    cleanup()
    announcer.announceRecordingStop(recordingTime)
    onRecordingStop?.()

    FocusManager.restoreFocus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return

    switch (event.key) {
      case ' ':
      case 'Enter':
        event.preventDefault()
        if (isRecording) {
          handleStopRecording()
        } else {
          handleStartRecording()
        }
        break
      case 'Escape':
        if (isRecording) {
          event.preventDefault()
          handleStopRecording()
        }
        break
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const centisecs = Math.floor((seconds % 1) * 10)
    return `${mins}:${secs.toString().padStart(2, '0')}.${centisecs}`
  }

  const progressPercentage = (recordingTime / maxDuration) * 100

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Permission Status */}
      {permissionStatus === 'denied' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            マイクロフォンのアクセス許可が必要です。ブラウザの設定で許可してください。
          </AlertDescription>
        </Alert>
      )}

      {/* Main Recording Control */}
      <div className="text-center">
        <Button
          size="lg"
          variant={isRecording ? 'destructive' : 'default'}
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          onKeyDown={handleKeyDown}
          disabled={disabled || permissionStatus === 'denied'}
          aria-label={isRecording ? '録音を停止' : '音声録音を開始'}
          aria-describedby="recording-instructions"
          className="h-16 w-16 rounded-full"
        >
          {isRecording ? (
            <Square className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>

        <div id="recording-instructions" className="sr-only">
          {isRecording
            ? 'スペースキーまたはEnterキーで録音を停止、Escapeキーでキャンセル'
            : 'スペースキーまたはEnterキーで録音を開始'
          }
        </div>
      </div>

      {/* Recording Status */}
      <div className="text-center">
        <div className="text-lg font-mono" aria-live="polite">
          {formatTime(recordingTime)} / {formatTime(maxDuration)}
        </div>

        {isRecording && (
          <div className="text-sm text-red-600 animate-pulse" aria-live="polite">
            🔴 録音中...
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {isRecording && (
        <div>
          <Progress
            value={progressPercentage}
            className="w-full"
            aria-label={`録音進行状況 ${Math.round(progressPercentage)}%`}
          />
          <div className="text-xs text-center text-gray-600 mt-1">
            残り時間: {formatTime(maxDuration - recordingTime)}
          </div>
        </div>
      )}

      {/* Audio Level Indicator */}
      {showVisualFeedback && isRecording && (
        <div className="space-y-2">
          <label htmlFor="audio-level" className="text-sm font-medium">
            音声レベル
          </label>
          <Progress
            id="audio-level"
            value={audioLevel * 100}
            className="w-full"
            aria-label={`音声レベル ${Math.round(audioLevel * 100)}%`}
          />
        </div>
      )}

      {/* Live Transcription */}
      {showTranscription && (
        <div className="space-y-2">
          <label htmlFor="transcription" className="text-sm font-medium">
            リアルタイム文字起こし
          </label>
          <div
            id="transcription"
            className="min-h-[80px] p-3 bg-gray-50 border rounded-md"
            role="log"
            aria-live="polite"
            aria-label="文字起こしテキスト"
          >
            {transcription || (isRecording ? '音声を認識中...' : '録音を開始すると文字起こしが表示されます')}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="text-xs text-gray-600 text-center">
        <details>
          <summary className="cursor-pointer hover:text-gray-800">
            キーボードショートカット
          </summary>
          <div className="mt-2 space-y-1">
            <div>スペース/Enter: 録音開始・停止</div>
            <div>Escape: 録音キャンセル</div>
          </div>
        </details>
      </div>
    </div>
  )
}