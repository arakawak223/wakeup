'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SupabaseAudioManager } from '@/lib/audio/supabase-audio'
import { FamilyManager, type FamilyMember } from '@/lib/family/family-manager'
import { useAuth } from '@/contexts/auth-context'
import { AudioAnalyzer } from '@/lib/audio/audio-analyzer'
import { generateDummyAudioBlob } from '@/lib/dummy-audio'
import { isDevMode } from '@/lib/dev-mode'

interface IntegratedVoiceSenderProps {
  onMessageSent?: (messageId: string) => void
  className?: string
}

type MessageCategory = 'thanks' | 'congratulation' | 'relief' | 'empathy' | 'general'
type RecordingStep = 'select' | 'record' | 'review' | 'send' | 'success'

const categoryLabels: Record<MessageCategory, string> = {
  thanks: '感謝',
  congratulation: 'お祝い',
  relief: '安心',
  empathy: '共感',
  general: 'その他'
}

export function IntegratedVoiceSender({ onMessageSent, className }: IntegratedVoiceSenderProps) {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState<RecordingStep>('select')

  // 家族選択
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [loadingFamily, setLoadingFamily] = useState(true)

  // 録音関連
  const [isRecording, setIsRecording] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [qualityScore, setQualityScore] = useState<number>(0)

  // メッセージ詳細
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<MessageCategory>('general')

  // 送信関連
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // レコーダー関連
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const familyManager = user ? new FamilyManager(user.id) : null
  const audioManager = user ? new SupabaseAudioManager() : null

  // 家族メンバーを読み込み
  const loadFamilyMembers = useCallback(async () => {
    if (!familyManager) return

    setLoadingFamily(true)
    try {
      const result = await familyManager.getFamilyMembers()
      if (result.success && result.data) {
        setFamilyMembers(result.data)
      }
    } catch (error) {
      console.error('家族メンバー読み込みエラー:', error)
    } finally {
      setLoadingFamily(false)
    }
  }, [familyManager])

  useEffect(() => {
    loadFamilyMembers()
  }, [loadFamilyMembers])

  // 録音開始
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('録音機能がサポートされていません')
      return
    }

    setIsPreparing(true)
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      // MediaRecorderの設定
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setRecordedAudio(audioBlob)

        // 音質分析
        try {
          const analyzer = new AudioAnalyzer()
          const metrics = await analyzer.analyzeAudio(audioBlob)
          setQualityScore(metrics.qualityScore)
        } catch (error) {
          console.warn('音質分析に失敗:', error)
          setQualityScore(75) // デフォルト値
        }

        setCurrentStep('review')
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // 1秒ごとにデータを記録

      setIsRecording(true)
      setIsPreparing(false)
      startTimeRef.current = Date.now()
      setRecordingDuration(0)

      // 録音時間の更新
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setRecordingDuration(elapsed)
      }, 100)

    } catch (error) {
      setError('マイクへのアクセスに失敗しました')
      setIsPreparing(false)
    }
  }

  // 録音停止
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    }
  }

  // メッセージ送信
  const sendMessage = async () => {
    if (!audioManager || !user || !selectedMember || !recordedAudio || !title.trim()) {
      setError('必要な情報が不足しています')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // 開発モードではダミーオーディオを使用
      const audioToUpload = isDevMode() ? generateDummyAudioBlob() : recordedAudio

      const messageData = {
        senderId: user.id,
        receiverId: selectedMember.id,
        title: title.trim(),
        category,
        duration: Math.round(recordingDuration),
        messageType: 'direct' as const
      }

      const result = await audioManager.uploadAndSaveVoiceMessage(audioToUpload, messageData)

      if (result.success && result.messageId) {
        setCurrentStep('success')
        onMessageSent?.(result.messageId)
      } else {
        setError(result.error || 'メッセージの送信に失敗しました')
      }
    } catch (error) {
      console.error('メッセージ送信エラー:', error)
      setError('メッセージの送信中にエラーが発生しました')
    } finally {
      setIsUploading(false)
    }
  }

  // リセット
  const resetRecorder = () => {
    setCurrentStep('select')
    setSelectedMember(null)
    setRecordedAudio(null)
    setTitle('')
    setCategory('general')
    setRecordingDuration(0)
    setQualityScore(0)
    setError(null)
    setIsUploading(false)
    setUploadProgress(0)

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">ログインが必要です</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎤 音声メッセージを送信
          {currentStep !== 'select' && (
            <Button size="sm" variant="outline" onClick={resetRecorder}>
              最初から
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* ステップ 1: 家族選択 */}
        {currentStep === 'select' && (
          <div className="space-y-4">
            <div>
              <Label>送信先の家族メンバー</Label>
              {loadingFamily ? (
                <div className="flex items-center gap-2 mt-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                  <span className="text-sm text-gray-600">家族メンバーを読み込み中...</span>
                </div>
              ) : familyMembers.length === 0 ? (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-700">
                    まだ家族メンバーがいません。「家族管理」タブから家族を招待してください。
                  </p>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {familyMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        setSelectedMember(member)
                        setCurrentStep('record')
                      }}
                      className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {(member.display_name || member.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">
                            {member.display_name || '名前未設定'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ステップ 2: 録音 */}
        {currentStep === 'record' && selectedMember && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">送信先:</span>
              <Badge variant="outline">
                {selectedMember.display_name || selectedMember.email}
              </Badge>
            </div>

            <div className="text-center space-y-4">
              {isPreparing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600">マイクを準備中...</p>
                </div>
              ) : isRecording ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                      <div className="w-6 h-6 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-mono">
                      {formatDuration(recordingDuration)}
                    </div>
                    <p className="text-sm text-gray-600">録音中...</p>
                  </div>
                  <Button onClick={stopRecording} variant="outline">
                    停止
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                    🎤
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      録音ボタンを押して、音声メッセージを録音してください
                    </p>
                    <Button onClick={startRecording} size="lg">
                      録音開始
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ステップ 3: 確認・詳細入力 */}
        {currentStep === 'review' && selectedMember && recordedAudio && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">送信先:</span>
              <Badge variant="outline">
                {selectedMember.display_name || selectedMember.email}
              </Badge>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">録音完了</p>
                  <p className="text-xs text-green-600">
                    時間: {formatDuration(recordingDuration)} | 品質: {qualityScore}/100
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setCurrentStep('record')}>
                  再録音
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">メッセージタイトル *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: おはよう！今日も頑張ろう"
                  maxLength={100}
                />
              </div>

              <div>
                <Label htmlFor="category">カテゴリ</Label>
                <Select value={category} onValueChange={(value: MessageCategory) => setCategory(value)}>
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

              <div className="flex gap-2">
                <Button
                  onClick={sendMessage}
                  disabled={!title.trim() || isUploading}
                  className="flex-1"
                >
                  {isUploading ? '送信中...' : 'メッセージを送信'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ステップ 4: 送信完了 */}
        {currentStep === 'success' && selectedMember && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              ✅
            </div>
            <div>
              <h3 className="font-semibold text-green-700">送信完了！</h3>
              <p className="text-sm text-gray-600">
                {selectedMember.display_name || selectedMember.email}にメッセージを送信しました
              </p>
            </div>
            <Button onClick={resetRecorder} variant="outline">
              新しいメッセージを作成
            </Button>
          </div>
        )}

        {/* 送信進捗 */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>送信中...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}