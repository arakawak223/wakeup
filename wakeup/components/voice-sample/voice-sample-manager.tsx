'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

interface VoiceSample {
  id: string
  name: string
  audio_url: string
  created_at: string
}

interface VoiceSampleManagerProps {
  userId: string
  onSampleSaved?: () => void
}

export function VoiceSampleManager({ userId, onSampleSaved }: VoiceSampleManagerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [sampleName, setSampleName] = useState('')
  const [loading, setLoading] = useState(false)
  const [samples, setSamples] = useState<VoiceSample[]>([])
  const [playingSample, setPlayingSample] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadVoiceSamples()
  }, [userId])

  const loadVoiceSamples = async () => {
    try {
      const { data, error } = await supabase
        .from('voice_samples')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSamples(data || [])
    } catch (error) {
      console.error('音声サンプル読み込みエラー:', error)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('録音開始エラー:', error)
      alert('録音を開始できませんでした。マイクへのアクセスを許可してください。')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const saveSample = async () => {
    if (!audioBlob || !sampleName.trim()) return

    setLoading(true)
    try {
      // 音声ファイルをアップロード
      const fileName = `voice_sample_${userId}_${Date.now()}.webm`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-samples')
        .upload(fileName, audioBlob)

      if (uploadError) throw uploadError

      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('voice-samples')
        .getPublicUrl(fileName)

      // データベースに保存
      const { error: insertError } = await supabase
        .from('voice_samples')
        .insert({
          user_id: userId,
          name: sampleName.trim(),
          audio_url: publicUrl
        })

      if (insertError) throw insertError

      // フォームをリセット
      setSampleName('')
      setAudioBlob(null)

      // リストを更新
      loadVoiceSamples()
      onSampleSaved?.()

      alert('音声サンプルを保存しました！')
    } catch (error) {
      console.error('音声サンプル保存エラー:', error)
      alert('音声サンプルの保存に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  const deleteSample = async (sampleId: string) => {
    if (!confirm('この音声サンプルを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('voice_samples')
        .delete()
        .eq('id', sampleId)

      if (error) throw error

      loadVoiceSamples()
      alert('音声サンプルを削除しました。')
    } catch (error) {
      console.error('音声サンプル削除エラー:', error)
      alert('音声サンプルの削除に失敗しました。')
    }
  }

  const playSample = (audioUrl: string, sampleId: string) => {
    if (playingSample === sampleId) {
      setPlayingSample(null)
      return
    }
    setPlayingSample(sampleId)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>音声サンプル管理</CardTitle>
        <p className="text-sm text-gray-600">
          あなたの声をサンプルとして録音して保存できます。
          これらのサンプルを使ってメッセージが自動生成されます。
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 新規録音セクション */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="sampleName">サンプル名</Label>
            <Input
              id="sampleName"
              value={sampleName}
              onChange={(e) => setSampleName(e.target.value)}
              placeholder="例: 基本の声"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>音声録音</Label>
            {!audioBlob ? (
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "destructive" : "outline"}
                className="w-full"
                disabled={loading}
              >
                {isRecording ? "⏹️ 録音停止" : "🎤 録音開始"}
              </Button>
            ) : (
              <div className="space-y-2">
                <audio controls className="w-full">
                  <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
                </audio>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setAudioBlob(null)}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    録音し直す
                  </Button>
                  <Button
                    onClick={saveSample}
                    disabled={!sampleName.trim() || loading}
                    size="sm"
                  >
                    {loading ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {isRecording && (
            <div className="text-center text-red-500 animate-pulse">
              録音中... 自然に話してください
            </div>
          )}
        </div>

        {/* 保存済みサンプル一覧 */}
        <div className="space-y-2">
          <h3 className="font-semibold">保存済み音声サンプル</h3>
          {samples.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              まだ音声サンプルがありません
            </p>
          ) : (
            <div className="space-y-2">
              {samples.map((sample) => (
                <div key={sample.id} className="flex items-center gap-2 p-3 border rounded">
                  <span className="flex-1 font-medium">{sample.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => playSample(sample.audio_url, sample.id)}
                  >
                    {playingSample === sample.id ? "⏸️" : "▶️"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteSample(sample.id)}
                  >
                    🗑️
                  </Button>
                  {playingSample === sample.id && (
                    <audio
                      src={sample.audio_url}
                      controls
                      autoPlay
                      className="hidden"
                      onEnded={() => setPlayingSample(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}