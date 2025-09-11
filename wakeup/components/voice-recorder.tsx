'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface VoiceRecording {
  id: string
  name: string
  url: string
  createdAt: Date
}

export function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState<VoiceRecording[]>([])
  const [currentAudio, setCurrentAudio] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // ローカルストレージから録音データを読み込み
  useEffect(() => {
    const savedRecordings = localStorage.getItem('voiceRecordings')
    if (savedRecordings) {
      try {
        const parsedRecordings = JSON.parse(savedRecordings)
        setRecordings(parsedRecordings.map((r: any) => ({
          ...r,
          createdAt: new Date(r.createdAt)
        })))
      } catch (error) {
        console.error('保存された録音データの読み込みに失敗しました:', error)
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        
        // Blobを Base64に変換して永続化
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
        
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('録音を開始できませんでした:', error)
      alert('マイクへのアクセスが必要です')
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

  // Base64データを使用するため、URL.revokeObjectURLは不要

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>音声メッセージ録音</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 justify-center">
          {!isRecording ? (
            <Button onClick={startRecording} className="bg-red-500 hover:bg-red-600">
              🎤 録音開始
            </Button>
          ) : (
            <Button onClick={stopRecording} className="bg-gray-500 hover:bg-gray-600">
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
                <span className="flex-1">{recording.name}</span>
                <Button 
                  size="sm" 
                  onClick={() => playAudio(recording.url)}
                  variant={currentAudio === recording.url ? "secondary" : "outline"}
                >
                  {currentAudio === recording.url ? "⏸️" : "▶️"}
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => deleteRecording(recording.id)}
                >
                  🗑️
                </Button>
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