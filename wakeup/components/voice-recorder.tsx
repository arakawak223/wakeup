'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { generateDummyAudioBlob, dummyMessageTemplates } from '@/lib/dummy-audio'
import { isDevMode } from '@/lib/dev-mode'

interface VoiceRecording {
  id: string
  name: string
  url: string
  createdAt: Date
}

interface VoiceRecorderProps {
  userId?: string
  mode?: 'standalone' | 'send'
  onRecordingComplete?: (audioBlob: Blob) => void
  disabled?: boolean
}

type AudioFormat = 'audio/webm' | 'audio/mp4' | 'audio/wav'

export function VoiceRecorder(props: VoiceRecorderProps = {}) {
  const { onRecordingComplete, disabled = false } = props
  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState<VoiceRecording[]>([])
  const [currentAudio, setCurrentAudio] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<AudioFormat>('audio/webm')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // サポートされている音声形式を検出
  const getSupportedFormat = (): AudioFormat => {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm' // Chrome/Firefox - 高圧縮、スマホ対応
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return 'audio/mp4' // Safari - iPhone対応
    } else {
      return 'audio/wav' // フォールバック
    }
  }

  // 音声形式の表示名とファイル拡張子を取得
  const getFormatInfo = (format: AudioFormat) => {
    switch (format) {
      case 'audio/webm':
        return { name: 'WebM (推奨)', extension: 'webm' }
      case 'audio/mp4':
        return { name: 'M4A (iPhone対応)', extension: 'm4a' }
      case 'audio/wav':
        return { name: 'WAV (汎用)', extension: 'wav' }
    }
  }

  // ローカルストレージから録音データを読み込み
  useEffect(() => {
    const savedRecordings = localStorage.getItem('voiceRecordings')
    if (savedRecordings) {
      try {
        const parsedRecordings = JSON.parse(savedRecordings)
        setRecordings(parsedRecordings.map((r: VoiceRecording & { createdAt: string }) => ({
          ...r,
          createdAt: new Date(r.createdAt)
        })))
      } catch (error) {
        console.error('保存された録音データの読み込みに失敗しました:', error)
      }
    }

    // 初期音声形式を設定
    setSelectedFormat(getSupportedFormat())
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      // MIMEタイプのサポート確認
      const options: MediaRecorderOptions = {}
      if (MediaRecorder.isTypeSupported(selectedFormat)) {
        options.mimeType = selectedFormat
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: audioChunksRef.current[0]?.type || selectedFormat
        })

        // ストリームのクリーンアップ
        stream.getTracks().forEach(track => track.stop())

        // onRecordingCompleteコールバックがある場合（送信モード）
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob)
          return
        }

        // Blobを Base64に変換して永続化（スタンドアロンモード）
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64Data = reader.result as string

          const newRecording: VoiceRecording = {
            id: Date.now().toString(),
            name: `録音 ${recordings.length + 1}`,
            url: base64Data, // base64データとして保存
            createdAt: new Date()
          }

          setRecordings(prev => {
            const updated = [...prev, newRecording]
            // ローカルストレージに保存
            localStorage.setItem('voiceRecordings', JSON.stringify(updated))
            return updated
          })
        }
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('録音を開始できませんでした:', error)
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。')
        } else if (error.name === 'NotFoundError') {
          alert('マイクが見つかりませんでした。マイクが接続されているか確認してください。')
        } else if (error.name === 'NotSupportedError') {
          alert('お使いのブラウザは音声録音をサポートしていません。')
        } else {
          alert(`録音開始エラー: ${error.message}`)
        }
      } else {
        alert('録音を開始できませんでした。')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const playAudio = (url: string) => {
    if (currentAudio === url) {
      setCurrentAudio(null)
      return
    }
    setCurrentAudio(url)
  }

  const deleteRecording = (id: string) => {
    setRecordings(prev => {
      const updated = prev.filter(recording => recording.id !== id)
      // ローカルストレージを更新
      localStorage.setItem('voiceRecordings', JSON.stringify(updated))
      return updated
    })
    if (currentAudio) {
      setCurrentAudio(null)
    }
  }

  const downloadRecording = (recording: VoiceRecording) => {
    const link = document.createElement('a')
    link.href = recording.url
    // URLからMIME typeを推定してファイル拡張子を決定
    let extension = 'webm'
    if (recording.url.includes('data:audio/mp4')) {
      extension = 'm4a'
    } else if (recording.url.includes('data:audio/wav')) {
      extension = 'wav'
    }
    link.download = `${recording.name}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const shareRecording = async (recording: VoiceRecording) => {
    if (navigator.share) {
      try {
        // Base64をBlobに変換
        const response = await fetch(recording.url)
        const blob = await response.blob()
        // URLからMIME typeを推定
        let mimeType = 'audio/webm'
        let extension = 'webm'
        if (recording.url.includes('data:audio/mp4')) {
          mimeType = 'audio/mp4'
          extension = 'm4a'
        } else if (recording.url.includes('data:audio/wav')) {
          mimeType = 'audio/wav'
          extension = 'wav'
        }
        const file = new File([blob], `${recording.name}.${extension}`, { type: mimeType })
        
        await navigator.share({
          title: recording.name,
          text: '音声メッセージを共有します',
          files: [file]
        })
      } catch (error) {
        console.error('共有に失敗しました:', error)
        // フォールバックとしてダウンロード
        downloadRecording(recording)
      }
    } else {
      // Web Share APIが使えない場合はダウンロード
      downloadRecording(recording)
    }
  }

  const shareByEmail = (recording: VoiceRecording) => {
    try {
      // 音声ファイルをダウンロード（添付用）
      downloadRecording(recording)
      
      // メールの件名と本文を設定
      const subject = encodeURIComponent(`音声メッセージ: ${recording.name}`)
      const body = encodeURIComponent(
        `こんにちは！\n\n「${recording.name}」という音声メッセージを共有します。\n\n` +
        `音声ファイルがダウンロードされましたので、このメールに添付してお送りください。\n\n` +
        `大切な人からの応援アプリより`
      )
      
      // mailto:リンクを作成
      const mailtoLink = `mailto:?subject=${subject}&body=${body}`
      
      // デフォルトメールアプリを開く
      window.location.href = mailtoLink
      
      // ユーザーに案内メッセージを表示
      setTimeout(() => {
        alert('音声ファイルがダウンロードされました。開いたメール作成画面にファイルを添付してお送りください。')
      }, 1000)
      
    } catch (error) {
      console.error('メール共有に失敗しました:', error)
      // フォールバックとしてダウンロード
      downloadRecording(recording)
    }
  }

  const startEditing = (recording: VoiceRecording) => {
    setEditingId(recording.id)
    setEditingName(recording.name)
  }

  const saveEdit = () => {
    if (editingId && editingName.trim()) {
      setRecordings(prev => {
        const updated = prev.map(recording => 
          recording.id === editingId 
            ? { ...recording, name: editingName.trim() }
            : recording
        )
        localStorage.setItem('voiceRecordings', JSON.stringify(updated))
        return updated
      })
      setEditingId(null)
      setEditingName('')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  // 開発モード用: ダミー音声を生成
  const generateDummyAudio = () => {
    try {
      const template = dummyMessageTemplates[Math.floor(Math.random() * dummyMessageTemplates.length)]
      const dummyBlob = generateDummyAudioBlob(3) // 3秒のダミー音声

      if (onRecordingComplete) {
        // 送信モードの場合、コールバックを呼び出し
        onRecordingComplete(dummyBlob)
        return
      }

      // スタンドアロンモードの場合、保存
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64Data = reader.result as string

        const newRecording: VoiceRecording = {
          id: Date.now().toString(),
          name: template.title,
          url: base64Data,
          createdAt: new Date()
        }

        setRecordings(prev => {
          const updated = [...prev, newRecording]
          localStorage.setItem('voiceRecordings', JSON.stringify(updated))
          return updated
        })
      }
      reader.readAsDataURL(dummyBlob)
    } catch (error) {
      console.error('ダミー音声生成エラー:', error)
      alert('ダミー音声の生成に失敗しました')
    }
  }

  // Base64データを使用するため、URL.revokeObjectURLは不要

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>音声メッセージ録音</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">音声形式</label>
            <select 
              value={selectedFormat} 
              onChange={(e) => setSelectedFormat(e.target.value as AudioFormat)}
              disabled={isRecording}
              className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {(['audio/webm', 'audio/mp4', 'audio/wav'] as AudioFormat[])
                .filter(format => MediaRecorder.isTypeSupported(format))
                .map(format => (
                  <option key={format} value={format}>
                    {getFormatInfo(format).name}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              WebM: 最小サイズ、Android対応 | M4A: iPhone対応 | WAV: 汎用
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          {!isRecording ? (
            <>
              <Button
                onClick={startRecording}
                className="bg-red-500 hover:bg-red-600"
                disabled={disabled}
              >
                🎤 録音開始
              </Button>
              {isDevMode() && (
                <Button
                  onClick={generateDummyAudio}
                  variant="outline"
                  disabled={disabled}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  🧪 テスト音声生成
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={stopRecording}
              className="bg-gray-500 hover:bg-gray-600"
              disabled={disabled}
            >
              ⏹️ 録音停止
            </Button>
          )}
        </div>

        {isRecording && (
          <div className="text-center text-red-500 animate-pulse">
            録音中...
          </div>
        )}

        <div className="space-y-2">
          <h3 className="font-semibold">保存された音声メッセージ</h3>
          {recordings.length === 0 ? (
            <p className="text-gray-500 text-center">まだ録音がありません</p>
          ) : (
            recordings.map((recording) => (
              <div key={recording.id} className="flex items-center gap-2 p-2 border rounded">
                {editingId === recording.id ? (
                  <>
                    <Input 
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1"
                      placeholder="録音名を入力"
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    />
                    <Button size="sm" onClick={saveEdit} variant="outline">
                      ✓
                    </Button>
                    <Button size="sm" onClick={cancelEdit} variant="outline">
                      ✕
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{recording.name}</span>
                    <Button 
                      size="sm" 
                      onClick={() => playAudio(recording.url)}
                      variant={currentAudio === recording.url ? "secondary" : "outline"}
                      title="再生/停止"
                    >
                      {currentAudio === recording.url ? "⏸️" : "▶️"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => startEditing(recording)}
                      title="名前を編集"
                    >
                      ✏️
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => downloadRecording(recording)}
                      title="ダウンロード"
                    >
                      💾
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => shareRecording(recording)}
                      title="共有"
                    >
                      📤
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => shareByEmail(recording)}
                      title="メールで共有"
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      📧
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => deleteRecording(recording.id)}
                      title="削除"
                    >
                      🗑️
                    </Button>
                  </>
                )}
                {currentAudio === recording.url && (
                  <audio 
                    src={recording.url} 
                    controls 
                    autoPlay 
                    className="hidden"
                    onEnded={() => setCurrentAudio(null)}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}