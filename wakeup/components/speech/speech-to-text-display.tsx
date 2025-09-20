'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RealtimeSpeechTranscription, speechUtils, type SpeechRecognitionResult } from '@/lib/speech/speech-to-text'

interface SpeechToTextDisplayProps {
  isRecording?: boolean
  onTranscriptChange?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
  showLanguageSelector?: boolean
  autoStart?: boolean
  className?: string
}

export function SpeechToTextDisplay({
  isRecording = false,
  onTranscriptChange,
  onError,
  showLanguageSelector = true,
  autoStart = false,
  className = ''
}: SpeechToTextDisplayProps) {
  const [transcription, setTranscription] = useState<RealtimeSpeechTranscription | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState('ja-JP')
  const [confidence, setConfidence] = useState(0)
  const [isSupported, setIsSupported] = useState(true)
  const [transcriptHistory, setTranscriptHistory] = useState<SpeechRecognitionResult[]>([])

  // ブラウザサポートチェック
  useEffect(() => {
    const support = speechUtils.checkBrowserSupport()
    setIsSupported(support.isSupported)

    if (!support.isSupported) {
      setError(`音声認識はサポートされていません (${support.browserInfo})`)
      onError?.(`音声認識はサポートされていません。${support.recommendations?.join(', ')}`)
    }
  }, [onError])

  // 転写開始/停止
  const toggleTranscription = useCallback(async () => {
    if (!isSupported) return

    try {
      if (isActive) {
        // 停止
        transcription?.stopTranscription()
        setIsActive(false)
        setCurrentTranscript('')
      } else {
        // 開始
        const newTranscription = new RealtimeSpeechTranscription(language)

        // コールバック設定
        newTranscription.onTranscript((transcript, isFinal) => {
          if (isFinal) {
            setFinalTranscript(transcript)
            setCurrentTranscript('')
            // 最新の結果から信頼度を取得
            const history = newTranscription.getTranscriptHistory()
            const lastResult = history[history.length - 1]
            if (lastResult) {
              setConfidence(lastResult.confidence * 100)
            }
          } else {
            setCurrentTranscript(transcript.replace(finalTranscript, '').trim())
          }

          onTranscriptChange?.(transcript, isFinal)
          setTranscriptHistory(newTranscription.getTranscriptHistory())
        })

        newTranscription.onError((errorMsg) => {
          setError(errorMsg)
          onError?.(errorMsg)
          setIsActive(false)
        })

        setTranscription(newTranscription)
        await newTranscription.startTranscription()
        setIsActive(true)
        setError(null)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '音声認識エラー'
      setError(errorMsg)
      onError?.(errorMsg)
      setIsActive(false)
    }
  }, [isSupported, isActive, transcription, language, onTranscriptChange, onError, finalTranscript])

  // 録音状態に応じた自動開始/停止
  useEffect(() => {
    if (autoStart && isRecording && !isActive && isSupported) {
      toggleTranscription()
    } else if (!isRecording && isActive) {
      toggleTranscription()
    }
  }, [isRecording, autoStart, isActive, isSupported, toggleTranscription])

  // 言語変更
  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage)

    if (isActive) {
      // アクティブな場合は再起動
      transcription?.stopTranscription()
      setIsActive(false)
      setTimeout(() => {
        toggleTranscription()
      }, 100)
    }
  }, [isActive, transcription, toggleTranscription])

  // 転写クリア
  const clearTranscript = useCallback(() => {
    setCurrentTranscript('')
    setFinalTranscript('')
    setTranscriptHistory([])
    setConfidence(0)
    transcription?.clearTranscript()
  }, [transcription])

  // 文字数カウント
  const totalChars = finalTranscript.length + currentTranscript.length
  const wordCount = finalTranscript.split(/\s+/).filter(word => word.length > 0).length

  if (!isSupported) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            🎙️ 音声認識
            <Badge variant="destructive">未対応</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 space-y-2">
            <p>お使いのブラウザは音声認識をサポートしていません</p>
            <p className="text-xs">Chrome、Edge、またはSafariの最新版をお試しください</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          🎙️ 音声認識
          {isActive && (
            <Badge variant="default" className="animate-pulse">
              録音中
            </Badge>
          )}
          {confidence > 0 && (
            <Badge variant="outline" className="text-xs">
              信頼度: {confidence.toFixed(0)}%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 言語選択 */}
        {showLanguageSelector && (
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {speechUtils.getSupportedLanguages().map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {speechUtils.getLanguageName(lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 操作ボタン */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={isActive ? "destructive" : "default"}
                onClick={toggleTranscription}
                disabled={!isSupported}
              >
                {isActive ? '⏹️ 停止' : '🎙️ 開始'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={clearTranscript}
                disabled={!finalTranscript && !currentTranscript}
              >
                🗑️ クリア
              </Button>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 転写結果表示 */}
        <div className="space-y-3">
          {/* 統計情報 */}
          {(finalTranscript || currentTranscript) && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>文字数: {totalChars}</span>
              <span>単語数: {wordCount}</span>
              {confidence > 0 && (
                <span>信頼度: {confidence.toFixed(0)}%</span>
              )}
            </div>
          )}

          {/* 信頼度バー */}
          {confidence > 0 && (
            <div className="space-y-1">
              <Progress value={confidence} className="h-1" />
            </div>
          )}

          {/* 転写テキスト */}
          <div className="min-h-[100px] max-h-[300px] overflow-y-auto p-3 bg-gray-50 rounded-lg border">
            {finalTranscript || currentTranscript ? (
              <div className="space-y-1">
                {/* 確定テキスト */}
                {finalTranscript && (
                  <span className="text-gray-800">{finalTranscript}</span>
                )}

                {/* 暫定テキスト */}
                {currentTranscript && (
                  <span className="text-gray-500 italic">
                    {finalTranscript && ' '}
                    {currentTranscript}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 mt-8">
                {isActive ? (
                  <div className="space-y-2">
                    <div className="animate-pulse">🎤 音声を待機中...</div>
                    <div className="text-xs">話しかけてください</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>🎙️ 音声認識が準備完了</div>
                    <div className="text-xs">開始ボタンを押して話しかけてください</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 転写履歴（デバッグ用） */}
          {process.env.NODE_ENV === 'development' && transcriptHistory.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-600">
                転写履歴 ({transcriptHistory.length}件)
              </summary>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {transcriptHistory.slice(-5).map((result, index) => (
                  <div key={index} className="p-2 bg-gray-100 rounded text-xs">
                    <div className="flex justify-between">
                      <span className={result.isFinal ? 'font-medium' : 'italic'}>
                        {result.transcript}
                      </span>
                      <span className="text-gray-500">
                        {(result.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// 簡易版コンポーネント（録音中に自動表示）
export function InlineSpeechToText({
  isRecording,
  onTranscriptChange
}: {
  isRecording: boolean
  onTranscriptChange?: (transcript: string) => void
}) {
  const [transcript, setTranscript] = useState('')

  return (
    <div className="space-y-2">
      <SpeechToTextDisplay
        isRecording={isRecording}
        onTranscriptChange={(text, isFinal) => {
          setTranscript(text)
          if (isFinal) {
            onTranscriptChange?.(text)
          }
        }}
        showLanguageSelector={false}
        autoStart={true}
        className="border-none shadow-none"
      />

      {transcript && (
        <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
          <strong>認識テキスト:</strong> {transcript}
        </div>
      )}
    </div>
  )
}