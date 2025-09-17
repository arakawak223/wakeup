'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { SpeechTranscriptionService, type TranscriptionResult, type TranscriptionOptions } from '@/lib/audio/speech-transcription'

interface TranscriptionViewerProps {
  audioBlob?: Blob
  onTranscriptionComplete?: (result: TranscriptionResult) => void
  className?: string
}

export function TranscriptionViewer({
  audioBlob,
  onTranscriptionComplete,
  className = ''
}: TranscriptionViewerProps) {
  const [transcriptionService, setTranscriptionService] = useState<SpeechTranscriptionService | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [realtimeMode, setRealtimeMode] = useState(false)
  const [editableText, setEditableText] = useState('')

  // 転写設定
  const [options, setOptions] = useState<TranscriptionOptions>({
    language: 'ja-JP',
    continuous: true,
    interimResults: true,
    maxAlternatives: 3,
    confidenceThreshold: 0.7,
    chunkSize: 30,
    enablePunctuation: true,
    enableCapitalization: true
  })

  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const service = new SpeechTranscriptionService(options)
    setTranscriptionService(service)

    return () => {
      service.dispose()
    }
  }, [options])

  useEffect(() => {
    if (transcriptionResult) {
      setEditableText(transcriptionResult.text)
      onTranscriptionComplete?.(transcriptionResult)
    }
  }, [transcriptionResult, onTranscriptionComplete])

  const handleFileTranscription = async () => {
    if (!audioBlob || !transcriptionService) return

    setIsTranscribing(true)
    setError(null)
    setProgress({ current: 0, total: 0 })

    try {
      const result = await transcriptionService.transcribeAudioFile(audioBlob)
      setTranscriptionResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '転写に失敗しました')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleRealtimeToggle = (enabled: boolean) => {
    setRealtimeMode(enabled)

    if (!transcriptionService) return

    if (enabled) {
      const success = transcriptionService.startRealtimeTranscription(
        (result) => {
          setTranscriptionResult(result)
        },
        (progress) => {
          setProgress(progress)
        },
        (error) => {
          setError(error)
          setRealtimeMode(false)
        }
      )

      if (!success) {
        setError('リアルタイム転写を開始できませんでした')
        setRealtimeMode(false)
      }
    } else {
      transcriptionService.stopRealtimeTranscription()
    }
  }

  const handleOptionChange = (key: keyof TranscriptionOptions, value: any) => {
    setOptions(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleTextEdit = (text: string) => {
    setEditableText(text)
    if (transcriptionResult) {
      const updatedResult: TranscriptionResult = {
        ...transcriptionResult,
        text: text
      }
      setTranscriptionResult(updatedResult)
      onTranscriptionComplete?.(updatedResult)
    }
  }

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 0.8) return 'default'
    if (confidence >= 0.6) return 'secondary'
    return 'destructive'
  }

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return '高'
    if (confidence >= 0.6) return '中'
    return '低'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 設定パネル */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎤 音声転写設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 言語設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">言語</Label>
              <Select
                value={options.language}
                onValueChange={(value) => handleOptionChange('language', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="言語を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja-JP">日本語</SelectItem>
                  <SelectItem value="en-US">英語（米国）</SelectItem>
                  <SelectItem value="en-GB">英語（英国）</SelectItem>
                  <SelectItem value="ko-KR">韓国語</SelectItem>
                  <SelectItem value="zh-CN">中国語（簡体字）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confidence">信頼度閾値</Label>
              <Select
                value={options.confidenceThreshold?.toString()}
                onValueChange={(value) => handleOptionChange('confidenceThreshold', parseFloat(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="閾値を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5 (低)</SelectItem>
                  <SelectItem value="0.7">0.7 (標準)</SelectItem>
                  <SelectItem value="0.8">0.8 (高)</SelectItem>
                  <SelectItem value="0.9">0.9 (最高)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 転写オプション */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="punctuation"
                checked={options.enablePunctuation}
                onCheckedChange={(checked) => handleOptionChange('enablePunctuation', checked)}
              />
              <Label htmlFor="punctuation">句読点の自動追加</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="capitalization"
                checked={options.enableCapitalization}
                onCheckedChange={(checked) => handleOptionChange('enableCapitalization', checked)}
              />
              <Label htmlFor="capitalization">大文字小文字の調整</Label>
            </div>
          </div>

          {/* リアルタイム転写 */}
          <div className="flex items-center space-x-2">
            <Switch
              id="realtime"
              checked={realtimeMode}
              onCheckedChange={handleRealtimeToggle}
              disabled={isTranscribing}
            />
            <Label htmlFor="realtime">リアルタイム転写</Label>
            {realtimeMode && (
              <Badge variant="outline" className="ml-2">録音中</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 転写コントロール */}
      {audioBlob && !realtimeMode && (
        <Card>
          <CardHeader>
            <CardTitle>音声ファイル転写</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 音声プレビュー */}
            <audio
              ref={audioRef}
              controls
              src={audioBlob ? URL.createObjectURL(audioBlob) : undefined}
              className="w-full"
            />

            {/* 転写ボタン */}
            <Button
              onClick={handleFileTranscription}
              disabled={isTranscribing}
              className="w-full"
            >
              {isTranscribing ? '転写中...' : '音声を転写'}
            </Button>

            {/* 進行状況 */}
            {progress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>進行状況</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <Progress
                  value={(progress.current / progress.total) * 100}
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* エラー表示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 転写結果 */}
      {transcriptionResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>転写結果</span>
              <div className="flex items-center gap-2">
                <Badge variant={getConfidenceBadgeVariant(transcriptionResult.confidence)}>
                  信頼度: {getConfidenceText(transcriptionResult.confidence)} ({Math.round(transcriptionResult.confidence * 100)}%)
                </Badge>
                {transcriptionResult.language && (
                  <Badge variant="outline">{transcriptionResult.language}</Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 編集可能なテキストエリア */}
            <div className="space-y-2">
              <Label htmlFor="transcription-text">転写テキスト（編集可能）</Label>
              <Textarea
                id="transcription-text"
                value={editableText}
                onChange={(e) => handleTextEdit(e.target.value)}
                placeholder="転写結果がここに表示されます..."
                className="min-h-[150px] font-mono"
              />
            </div>

            {/* メタデータ */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              {transcriptionResult.startTime !== undefined && transcriptionResult.endTime !== undefined && (
                <div>
                  <strong>長さ:</strong> {Math.round(transcriptionResult.endTime - transcriptionResult.startTime)}秒
                </div>
              )}
              <div>
                <strong>文字数:</strong> {editableText.length}文字
              </div>
              <div>
                <strong>転写時刻:</strong> {new Date(transcriptionResult.timestamp).toLocaleString()}
              </div>
              <div>
                <strong>状態:</strong> {transcriptionResult.isFinal ? '完了' : '処理中'}
              </div>
            </div>

            {/* 代替候補 */}
            {transcriptionResult.alternatives && transcriptionResult.alternatives.length > 0 && (
              <div className="space-y-2">
                <Label>代替候補</Label>
                <div className="space-y-1">
                  {transcriptionResult.alternatives.map((alt, index) => (
                    <div
                      key={index}
                      className="p-2 bg-gray-50 rounded text-sm cursor-pointer hover:bg-gray-100"
                      onClick={() => handleTextEdit(alt)}
                    >
                      {index + 2}. {alt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* アクション */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(editableText)}
              >
                📋 コピー
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([editableText], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `transcription-${Date.now()}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                💾 保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}