'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Square, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ScreenReaderAnnouncer, AriaLabels } from '@/lib/accessibility/screen-reader'

interface AccessibleAudioControlsProps {
  audioBuffer?: ArrayBuffer
  duration?: number
  onPlaybackStart?: () => void
  onPlaybackEnd?: () => void
  onPlaybackError?: (error: Error) => void
  showTimeline?: boolean
  showVolumeControl?: boolean
  className?: string
}

export function AccessibleAudioControls({
  audioBuffer,
  duration = 0,
  onPlaybackStart,
  onPlaybackEnd,
  onPlaybackError,
  showTimeline = true,
  showVolumeControl = true,
  className = ''
}: AccessibleAudioControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const startTimeRef = useRef<number>(0)
  const pauseTimeRef = useRef<number>(0)
  const animationFrameRef = useRef<number>(0)

  const announcer = ScreenReaderAnnouncer.getInstance()

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (sourceRef.current) {
        sourceRef.current.stop()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const initializeAudio = async () => {
    if (!audioBuffer) return null

    try {
      const audioContext = new AudioContext()
      const buffer = await audioContext.decodeAudioData(audioBuffer.slice(0))

      audioContextRef.current = audioContext
      return { audioContext, buffer }
    } catch (error) {
      console.error('Audio initialization failed:', error)
      announcer.announce('音声の初期化に失敗しました。', 'assertive')
      onPlaybackError?.(error as Error)
      return null
    }
  }

  const updateProgress = () => {
    if (isPlaying && audioContextRef.current && startTimeRef.current) {
      const elapsed = audioContextRef.current.currentTime - startTimeRef.current + pauseTimeRef.current
      setCurrentTime(Math.min(elapsed, duration))

      if (elapsed >= duration) {
        handleStop()
        return
      }
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }

  const handlePlay = async () => {
    if (isPlaying) return

    const audio = await initializeAudio()
    if (!audio) return

    const { audioContext, buffer } = audio

    try {
      const source = audioContext.createBufferSource()
      const gainNode = audioContext.createGain()

      source.buffer = buffer
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)

      gainNode.gain.value = isMuted ? 0 : volume

      sourceRef.current = source
      gainNodeRef.current = gainNode

      source.onended = () => {
        if (currentTime >= duration - 0.1) { // Allow small margin for precision
          handleStop()
        }
      }

      const offset = pauseTimeRef.current
      const remainingDuration = duration - offset

      source.start(0, offset, remainingDuration)
      startTimeRef.current = audioContext.currentTime - offset

      setIsPlaying(true)
      announcer.announcePlaybackStart(duration - offset)
      onPlaybackStart?.()

      updateProgress()
    } catch (error) {
      console.error('Playback failed:', error)
      announcer.announceRecordingError('再生の開始に失敗しました')
      onPlaybackError?.(error as Error)
    }
  }

  const handlePause = () => {
    if (!isPlaying || !sourceRef.current) return

    sourceRef.current.stop()
    pauseTimeRef.current = currentTime
    setIsPlaying(false)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    announcer.announce('音声の再生を一時停止しました。')
  }

  const handleStop = () => {
    if (sourceRef.current) {
      sourceRef.current.stop()
    }

    setIsPlaying(false)
    setCurrentTime(0)
    pauseTimeRef.current = 0
    startTimeRef.current = 0

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    announcer.announcePlaybackEnd()
    onPlaybackEnd?.()
  }

  const handleSeek = (newTime: number[]) => {
    const targetTime = newTime[0]
    const wasPlaying = isPlaying

    if (wasPlaying) {
      handlePause()
    }

    setCurrentTime(targetTime)
    pauseTimeRef.current = targetTime

    if (wasPlaying) {
      // Resume playback from new position
      setTimeout(() => handlePlay(), 50)
    }

    announcer.announce(`再生位置を${Math.round(targetTime)}秒に変更しました。`)
  }

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0]
    setVolume(vol)
    setIsMuted(vol === 0)

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = vol
    }

    announcer.announce(`音量を${Math.round(vol * 100)}%に設定しました。`)
  }

  const handleMuteToggle = () => {
    const newMutedState = !isMuted
    setIsMuted(newMutedState)

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newMutedState ? 0 : volume
    }

    announcer.announce(newMutedState ? 'ミュートしました。' : 'ミュートを解除しました。')
  }

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 10)
    handleSeek([newTime])
  }

  const handleSkipForward = () => {
    const newTime = Math.min(duration, currentTime + 10)
    handleSeek([newTime])
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case ' ':
      case 'Enter':
        event.preventDefault()
        if (isPlaying) {
          handlePause()
        } else {
          handlePlay()
        }
        break
      case 'ArrowLeft':
        event.preventDefault()
        handleSkipBack()
        break
      case 'ArrowRight':
        event.preventDefault()
        handleSkipForward()
        break
      case 'ArrowUp':
        event.preventDefault()
        handleVolumeChange([Math.min(1, volume + 0.1)])
        break
      case 'ArrowDown':
        event.preventDefault()
        handleVolumeChange([Math.max(0, volume - 0.1)])
        break
      case 'm':
      case 'M':
        event.preventDefault()
        handleMuteToggle()
        break
    }
  }

  if (!audioBuffer || duration === 0) {
    return (
      <div className={`text-center text-gray-500 ${className}`}>
        <p>音声データが利用できません</p>
      </div>
    )
  }

  return (
    <div
      className={`bg-white border rounded-lg p-4 ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="音声コントロール"
      aria-describedby="audio-controls-help"
    >
      {/* Help text for keyboard shortcuts */}
      <div id="audio-controls-help" className="sr-only">
        スペースキーで再生・一時停止、左右矢印キーで10秒スキップ、上下矢印キーで音量調整、Mキーでミュート切り替え
      </div>

      {/* Time Display */}
      <div className="text-center mb-4">
        <div className="text-lg font-mono" aria-live="polite">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Timeline Slider */}
      {showTimeline && (
        <div className="mb-4">
          <label htmlFor="timeline-slider" className="sr-only">
            再生位置
          </label>
          <Slider
            id="timeline-slider"
            value={[currentTime]}
            onValueChange={handleSeek}
            max={duration}
            step={0.1}
            className="w-full"
            aria-label={AriaLabels.progressSlider(currentTime, duration)}
          />
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex justify-center items-center space-x-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSkipBack}
          aria-label="10秒戻る"
          title="10秒戻る (左矢印キー)"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          onClick={isPlaying ? handlePause : handlePlay}
          size="lg"
          aria-label={isPlaying ? '一時停止' : '再生'}
          title={isPlaying ? '一時停止 (スペースキー)' : '再生 (スペースキー)'}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          aria-label="停止"
          title="停止"
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSkipForward}
          aria-label="10秒進む"
          title="10秒進む (右矢印キー)"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Volume Control */}
      {showVolumeControl && (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMuteToggle}
            aria-label={AriaLabels.muteButton(isMuted)}
            title={`${isMuted ? 'ミュート解除' : 'ミュート'} (Mキー)`}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          <div className="flex-1">
            <label htmlFor="volume-slider" className="sr-only">
              音量調整
            </label>
            <Slider
              id="volume-slider"
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.05}
              className="w-full"
              aria-label={AriaLabels.volumeSlider(volume)}
            />
          </div>

          <span className="text-sm text-gray-600 min-w-[3ch]" aria-live="polite">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}