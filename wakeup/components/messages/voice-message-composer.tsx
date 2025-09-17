'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EnhancedVoiceRecorder } from '@/components/voice-recorder-enhanced'
import { AudioPreview } from '@/components/audio/audio-preview'
import { TranscriptionViewer } from '@/components/audio/transcription-viewer'
import { EmotionAnalysisViewer } from '@/components/audio/emotion-analysis-viewer'
import { AudioProcessor, type FilterOptions } from '@/lib/audio/audio-filters'
import { uploadVoiceMessage } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import type { AudioSettings } from '@/lib/audio/audio-analyzer'
import type { Database } from '@/lib/database.types'
import type { TranscriptionResult } from '@/lib/audio/speech-transcription'
import type { EmotionAnalysisResult } from '@/lib/audio/emotion-analysis'

type Profile = Database['public']['Tables']['profiles']['Row']

interface VoiceMessageComposerProps {
  userId: string
  receiverId?: string
  receiver?: Profile
  onMessageSent?: () => void
  className?: string
}

type ComposerStep = 'record' | 'preview' | 'transcribe' | 'emotion' | 'filter' | 'send'

const messageCategories = [
  { value: 'thanks', label: '感謝', emoji: '🙏' },
  { value: 'congratulation', label: 'お祝い', emoji: '🎉' },
  { value: 'relief', label: '安心', emoji: '😌' },
  { value: 'empathy', label: '共感', emoji: '🤝' },
  { value: 'love', label: '愛情', emoji: '❤️' },
  { value: 'encouragement', label: '励まし', emoji: '💪' },
  { value: 'daily', label: '日常', emoji: '📝' }
]

const filterPresets = [
  { id: 'none', label: 'フィルターなし', description: '元の音声をそのまま使用' },
  { id: 'quality', label: '品質向上', description: 'ノイズ除去と音量調整' },
  { id: 'warm', label: '温かい声', description: 'ベース強化とリバーブ' },
  { id: 'clear', label: '明瞭な声', description: 'トレブル強化とコンプレッション' },
  { id: 'custom', label: 'カスタム', description: '詳細設定を手動調整' }
]

export function VoiceMessageComposer({
  userId,
  receiverId,
  receiver,
  onMessageSent,
  className = ''
}: VoiceMessageComposerProps) {
  // States
  const [currentStep, setCurrentStep] = useState<ComposerStep>('record')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string>('')
  const [originalQualityScore, setOriginalQualityScore] = useState<number>(0)
  const [originalSettings, setOriginalSettings] = useState<AudioSettings | null>(null)
  const [filteredBlob, setFilteredBlob] = useState<Blob | null>(null)
  const [filteredUrl, setFilteredUrl] = useState<string>('')
  const [filteredQualityScore, setFilteredQualityScore] = useState<number>(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('daily')
  const [messageTitle, setMessageTitle] = useState<string>('')
  const [selectedPreset, setSelectedPreset] = useState<string>('quality')
  const [customFilters, setCustomFilters] = useState<FilterOptions>(AudioProcessor.getDefaultFilters())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null)
  const [enableTranscription, setEnableTranscription] = useState(true)
  const [emotionResult, setEmotionResult] = useState<EmotionAnalysisResult | null>(null)
  const [enableEmotionAnalysis, setEnableEmotionAnalysis] = useState(true)

  // Refs
  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const supabase = createClient()

  /**
   * 録音完了時の処理
   */
  const handleRecordingComplete = useCallback((
    audioBlob: Blob,
    metadata?: { qualityScore: number; settings: AudioSettings }
  ) => {
    setRecordedBlob(audioBlob)
    setRecordedUrl(URL.createObjectURL(audioBlob))

    if (metadata) {
      setOriginalQualityScore(metadata.qualityScore)
      setOriginalSettings(metadata.settings)
    }

    // デフォルトのメッセージタイトルを生成
    const now = new Date()
    setMessageTitle(`音声メッセージ_${now.getMonth() + 1}/${now.getDate()}_${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`)

    setCurrentStep('preview')
  }, [])

  /**
   * フィルター適用
   */
  const applyFilters = useCallback(async () => {
    if (!recordedBlob) return

    setIsProcessing(true)

    try {
      if (!audioProcessorRef.current) {
        audioProcessorRef.current = new AudioProcessor()
      }

      let filterOptions = customFilters

      // プリセットに応じてフィルター設定を調整
      switch (selectedPreset) {
        case 'none':
          filterOptions = {
            ...AudioProcessor.getDefaultFilters(),
            noiseReduction: false,
            volumeNormalization: false,
            compressor: false
          }
          break
        case 'quality':
          filterOptions = AudioProcessor.getQualityEnhancementFilters()
          break
        case 'warm':
          filterOptions = {
            ...AudioProcessor.getDefaultFilters(),
            bassBoost: true,
            reverb: { enabled: true, roomSize: 0.3, damping: 0.8, wetness: 0.2 }
          }
          break
        case 'clear':
          filterOptions = {
            ...AudioProcessor.getQualityEnhancementFilters(),
            trebleBoost: true,
            compressor: true
          }
          break
        case 'custom':
          filterOptions = customFilters
          break
      }

      const processed = await audioProcessorRef.current.processAudioBlob(recordedBlob, filterOptions)

      setFilteredBlob(processed)
      setFilteredUrl(URL.createObjectURL(processed))

      // 処理後の品質スコアを推定（実際は再分析が必要）
      const qualityImprovement = selectedPreset === 'none' ? 0 : 10
      setFilteredQualityScore(Math.min(100, originalQualityScore + qualityImprovement))

    } catch (error) {
      console.error('フィルター適用エラー:', error)
      alert('フィルター適用中にエラーが発生しました')
    } finally {
      setIsProcessing(false)
    }
  }, [recordedBlob, originalQualityScore, selectedPreset, customFilters])

  /**
   * メッセージ送信
   */
  const sendMessage = useCallback(async () => {
    const finalBlob = filteredBlob || recordedBlob
    if (!finalBlob || !receiverId) return

    setIsSending(true)

    try {
      // 音声ファイルをアップロード
      const fileName = `voice_${userId}_${Date.now()}.wav`
      const { audioUrl, error: uploadError } = await uploadVoiceMessage(finalBlob, fileName)

      if (uploadError) throw uploadError

      // データベースにメッセージを保存
      const finalScore = filteredBlob ? filteredQualityScore : originalQualityScore
      const { error: dbError } = await supabase
        .from('voice_messages')
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          title: messageTitle || '音声メッセージ',
          audio_url: audioUrl,
          category: selectedCategory,
          duration: 0, // 実際の再生時間は別途計算
          quality_score: Math.round(finalScore),
          filter_applied: selectedPreset !== 'none',
          transcription: transcriptionResult?.text || null,
          transcription_confidence: transcriptionResult?.confidence ? Math.round(transcriptionResult.confidence * 100) : null,
          emotion_primary: emotionResult?.primaryEmotion || null,
          emotion_confidence: emotionResult?.confidence ? Math.round(emotionResult.confidence * 100) : null,
          emotion_arousal: emotionResult?.arousal || null,
          emotion_valence: emotionResult?.valence || null
        })

      if (dbError) throw dbError

      // 成功処理
      alert('音声メッセージを送信しました！')
      handleReset()

      if (onMessageSent) {
        onMessageSent()
      }

    } catch (error) {
      console.error('メッセージ送信エラー:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setIsSending(false)
    }
  }, [
    filteredBlob,
    recordedBlob,
    receiverId,
    userId,
    messageTitle,
    selectedCategory,
    filteredQualityScore,
    originalQualityScore,
    selectedPreset,
    transcriptionResult,
    emotionResult,
    onMessageSent,
    supabase
  ])

  /**
   * リセット処理
   */
  const handleReset = useCallback(() => {
    setCurrentStep('record')
    setRecordedBlob(null)
    setFilteredBlob(null)
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    if (filteredUrl) URL.revokeObjectURL(filteredUrl)
    setRecordedUrl('')
    setFilteredUrl('')
    setOriginalQualityScore(0)
    setFilteredQualityScore(0)
    setMessageTitle('')
    setSelectedCategory('daily')
    setSelectedPreset('quality')
    setTranscriptionResult(null)
    setEmotionResult(null)
  }, [recordedUrl, filteredUrl])

  /**
   * カスタムフィルター設定の更新
   */
  const updateCustomFilter = useCallback((key: keyof FilterOptions, value: any) => {
    setCustomFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🎵 音声メッセージ作成</span>
            {receiver && (
              <Badge variant="outline" className="flex items-center gap-1">
                送信先: {receiver.display_name || 'ユーザー'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentStep} className="w-full">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="record" disabled={currentStep !== 'record'}>
                🎤 録音
              </TabsTrigger>
              <TabsTrigger value="preview" disabled={currentStep !== 'preview' && currentStep !== 'transcribe' && currentStep !== 'emotion' && currentStep !== 'filter' && currentStep !== 'send'}>
                🎧 プレビュー
              </TabsTrigger>
              <TabsTrigger value="transcribe" disabled={currentStep !== 'transcribe' && currentStep !== 'emotion' && currentStep !== 'filter' && currentStep !== 'send'}>
                📝 転写
              </TabsTrigger>
              <TabsTrigger value="emotion" disabled={currentStep !== 'emotion' && currentStep !== 'filter' && currentStep !== 'send'}>
                🎭 感情
              </TabsTrigger>
              <TabsTrigger value="filter" disabled={currentStep !== 'filter' && currentStep !== 'send'}>
                🎛️ フィルター
              </TabsTrigger>
              <TabsTrigger value="send" disabled={currentStep !== 'send'}>
                📤 送信
              </TabsTrigger>
            </TabsList>

            {/* 録音タブ */}
            <TabsContent value="record" className="space-y-4">
              <EnhancedVoiceRecorder
                userId={userId}
                mode="send"
                onRecordingComplete={handleRecordingComplete}
                showQualityMetrics={true}
              />
            </TabsContent>

            {/* プレビュータブ */}
            <TabsContent value="preview" className="space-y-4">
              {recordedBlob && recordedUrl && (
                <AudioPreview
                  audioBlob={recordedBlob}
                  audioUrl={recordedUrl}
                  qualityScore={originalQualityScore}
                  title="録音プレビュー"
                  onApprove={() => setCurrentStep(enableTranscription ? 'transcribe' : (enableEmotionAnalysis ? 'emotion' : 'filter'))}
                  onReject={handleReset}
                  onRetake={() => setCurrentStep('record')}
                  showAdvancedControls={true}
                />
              )}
              {/* 転写・感情分析設定 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-transcription"
                    checked={enableTranscription}
                    onCheckedChange={setEnableTranscription}
                  />
                  <Label htmlFor="enable-transcription">音声転写を有効にする</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-emotion"
                    checked={enableEmotionAnalysis}
                    onCheckedChange={setEnableEmotionAnalysis}
                  />
                  <Label htmlFor="enable-emotion">感情分析を有効にする</Label>
                </div>
              </div>
            </TabsContent>

            {/* 転写タブ */}
            <TabsContent value="transcribe" className="space-y-4">
              {recordedBlob && enableTranscription && (
                <div className="space-y-4">
                  <TranscriptionViewer
                    audioBlob={recordedBlob}
                    onTranscriptionComplete={setTranscriptionResult}
                  />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep('preview')}
                    >
                      ← 戻る
                    </Button>
                    <Button
                      onClick={() => setCurrentStep(enableEmotionAnalysis ? 'emotion' : 'filter')}
                      className="flex-1"
                    >
                      次へ進む →
                    </Button>
                  </div>
                </div>
              )}

              {!enableTranscription && (
                <div className="text-center py-8 text-gray-500">
                  転写機能が無効になっています。
                  <br />
                  プレビュー画面で転写を有効にしてください。
                </div>
              )}
            </TabsContent>

            {/* 感情分析タブ */}
            <TabsContent value="emotion" className="space-y-4">
              {recordedBlob && enableEmotionAnalysis && (
                <div className="space-y-4">
                  <EmotionAnalysisViewer
                    audioBlob={recordedBlob}
                    onAnalysisComplete={setEmotionResult}
                  />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(enableTranscription ? 'transcribe' : 'preview')}
                    >
                      ← 戻る
                    </Button>
                    <Button
                      onClick={() => setCurrentStep('filter')}
                      className="flex-1"
                    >
                      次へ進む →
                    </Button>
                  </div>
                </div>
              )}

              {!enableEmotionAnalysis && (
                <div className="text-center py-8 text-gray-500">
                  感情分析機能が無効になっています。
                  <br />
                  プレビュー画面で感情分析を有効にしてください。
                </div>
              )}
            </TabsContent>

            {/* フィルタータブ */}
            <TabsContent value="filter" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">フィルター選択</Label>
                  <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterPresets.map(preset => (
                        <SelectItem key={preset.id} value={preset.id}>
                          <div>
                            <div className="font-medium">{preset.label}</div>
                            <div className="text-xs text-gray-500">{preset.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPreset === 'custom' && (
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium">詳細設定</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <Label>ノイズ除去</Label>
                        <Switch
                          checked={customFilters.noiseReduction}
                          onCheckedChange={(checked) => updateCustomFilter('noiseReduction', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>音量正規化</Label>
                        <Switch
                          checked={customFilters.volumeNormalization}
                          onCheckedChange={(checked) => updateCustomFilter('volumeNormalization', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>ベース強化</Label>
                        <Switch
                          checked={customFilters.bassBoost}
                          onCheckedChange={(checked) => updateCustomFilter('bassBoost', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>トレブル強化</Label>
                        <Switch
                          checked={customFilters.trebleBoost}
                          onCheckedChange={(checked) => updateCustomFilter('trebleBoost', checked)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={applyFilters}
                    disabled={isProcessing || !recordedBlob}
                    className="flex-1"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        処理中...
                      </>
                    ) : (
                      '🎛️ フィルター適用'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('send')}
                  >
                    スキップ
                  </Button>
                </div>

                {filteredBlob && filteredUrl && (
                  <AudioPreview
                    audioBlob={filteredBlob}
                    audioUrl={filteredUrl}
                    qualityScore={filteredQualityScore}
                    title="フィルター適用後"
                    onApprove={() => setCurrentStep('send')}
                    onReject={() => {
                      if (filteredUrl) URL.revokeObjectURL(filteredUrl)
                      setFilteredBlob(null)
                      setFilteredUrl('')
                    }}
                    showAdvancedControls={true}
                  />
                )}
              </div>
            </TabsContent>

            {/* 送信タブ */}
            <TabsContent value="send" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>メッセージタイトル</Label>
                  <input
                    type="text"
                    value={messageTitle}
                    onChange={(e) => setMessageTitle(e.target.value)}
                    className="w-full p-2 border rounded dark:bg-gray-800"
                    placeholder="メッセージのタイトル"
                  />
                </div>

                <div>
                  <Label>カテゴリ</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {messageCategories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.emoji} {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <h4 className="font-medium mb-2">送信内容</h4>
                  <div className="text-sm space-y-1">
                    <div>タイトル: {messageTitle}</div>
                    <div>カテゴリ: {messageCategories.find(c => c.value === selectedCategory)?.emoji} {messageCategories.find(c => c.value === selectedCategory)?.label}</div>
                    <div>品質スコア: {Math.round(filteredBlob ? filteredQualityScore : originalQualityScore)}点</div>
                    <div>フィルター: {filterPresets.find(p => p.id === selectedPreset)?.label}</div>
                    {transcriptionResult && (
                      <div>転写: ✓ (信頼度: {Math.round(transcriptionResult.confidence * 100)}%)</div>
                    )}
                    {emotionResult && (
                      <div>感情: {emotionResult.primaryEmotion} (信頼度: {Math.round(emotionResult.confidence * 100)}%)</div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={sendMessage}
                    disabled={isSending || !receiverId}
                    className="flex-1"
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        送信中...
                      </>
                    ) : (
                      '📤 送信する'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isSending}
                  >
                    🔄 最初から
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}