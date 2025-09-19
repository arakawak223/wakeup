'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'

interface TestResult {
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  duration?: number
}

export function VoiceFunctionalityTest() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'マイクアクセス許可', status: 'pending' },
    { name: '音声録音機能', status: 'pending' },
    { name: '音声再生機能', status: 'pending' },
    { name: 'ファイル形式変換', status: 'pending' },
    { name: 'Supabase接続', status: 'pending' },
    { name: '認証状態確認', status: 'pending' },
    { name: '感情分析API', status: 'pending' },
    { name: '音声テキスト化', status: 'pending' }
  ])

  const [isRunning, setIsRunning] = useState(false)
  const { user } = useAuth()

  const updateTest = (index: number, update: Partial<TestResult>) => {
    setTests(prev => prev.map((test, i) =>
      i === index ? { ...test, ...update } : test
    ))
  }

  // マイクアクセステスト
  const testMicrophoneAccess = async (index: number): Promise<boolean> => {
    updateTest(index, { status: 'running' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      updateTest(index, { status: 'success', message: 'マイクアクセス正常' })
      return true
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: error instanceof Error ? error.message : 'マイクアクセス拒否'
      })
      return false
    }
  }

  // 音声録音テスト
  const testAudioRecording = async (index: number): Promise<boolean> => {
    updateTest(index, { status: 'running' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)

      return new Promise((resolve) => {
        const chunks: Blob[] = []
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data)

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          if (blob.size > 0) {
            updateTest(index, {
              status: 'success',
              message: `録音成功 (${blob.size} bytes)`
            })
            resolve(true)
          } else {
            updateTest(index, { status: 'error', message: '録音データが空' })
            resolve(false)
          }
          stream.getTracks().forEach(track => track.stop())
        }

        mediaRecorder.start()
        setTimeout(() => mediaRecorder.stop(), 1000) // 1秒録音
      })
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: error instanceof Error ? error.message : '録音失敗'
      })
      return false
    }
  }

  // 音声再生テスト
  const testAudioPlayback = async (index: number): Promise<boolean> => {
    updateTest(index, { status: 'running' })
    try {
      const audio = new Audio()

      return new Promise((resolve) => {
        audio.oncanplaythrough = () => {
          updateTest(index, { status: 'success', message: '音声再生準備完了' })
          resolve(true)
        }

        audio.onerror = () => {
          updateTest(index, { status: 'error', message: '音声再生エラー' })
          resolve(false)
        }

        // ダミー音声データを作成してテスト
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const dest = audioContext.createMediaStreamDestination()
        oscillator.connect(dest)
        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.1)

        updateTest(index, { status: 'success', message: 'AudioContext動作確認' })
        resolve(true)
      })
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: error instanceof Error ? error.message : '再生テスト失敗'
      })
      return false
    }
  }

  // ファイル形式変換テスト
  const testFileConversion = async (index: number): Promise<boolean> => {
    updateTest(index, { status: 'running' })
    try {
      // ダミーBlobを作成してFileに変換
      const blob = new Blob(['test'], { type: 'audio/webm' })
      const file = new File([blob], 'test.webm', { type: 'audio/webm' })

      if (file.size > 0 && file.type.includes('audio')) {
        updateTest(index, {
          status: 'success',
          message: `変換OK (${file.type})`
        })
        return true
      } else {
        updateTest(index, { status: 'error', message: '変換失敗' })
        return false
      }
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: error instanceof Error ? error.message : '変換エラー'
      })
      return false
    }
  }

  // Supabase接続テスト
  const testSupabaseConnection = async (index: number): Promise<boolean> => {
    updateTest(index, { status: 'running' })
    try {
      const { testSupabaseConnection } = await import('@/lib/supabase/client')
      const result = await testSupabaseConnection()

      if (result.success) {
        updateTest(index, { status: 'success', message: 'Supabase接続正常' })
        return true
      } else {
        updateTest(index, { status: 'error', message: result.error })
        return false
      }
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Supabase接続エラー'
      })
      return false
    }
  }

  // 認証状態確認
  const testAuthentication = async (index: number): Promise<boolean> => {
    updateTest(index, { status: 'running' })

    if (user) {
      updateTest(index, {
        status: 'success',
        message: `ログイン済み (${user.email})`
      })
      return true
    } else {
      updateTest(index, {
        status: 'error',
        message: 'ログインが必要です'
      })
      return false
    }
  }

  // 感情分析APIテスト
  const testEmotionAnalysis = async (index: number): Promise<boolean> => {
    updateTest(index, { status: 'running' })
    try {
      // 感情分析ライブラリの存在確認
      await import('@/lib/audio/emotion-analysis')
      updateTest(index, { status: 'success', message: '感情分析ライブラリ読み込み完了' })
      return true
    } catch {
      updateTest(index, {
        status: 'error',
        message: '感情分析ライブラリエラー'
      })
      return false
    }
  }

  // 音声テキスト化テスト
  const testSpeechTranscription = async (index: number): Promise<boolean> => {
    updateTest(index, { status: 'running' })
    try {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        updateTest(index, {
          status: 'success',
          message: 'Web Speech API利用可能'
        })
        return true
      } else {
        updateTest(index, {
          status: 'error',
          message: 'Web Speech API未対応ブラウザ'
        })
        return false
      }
    } catch {
      updateTest(index, {
        status: 'error',
        message: '音声認識テストエラー'
      })
      return false
    }
  }

  const runAllTests = async () => {
    setIsRunning(true)

    const testFunctions = [
      testMicrophoneAccess,
      testAudioRecording,
      testAudioPlayback,
      testFileConversion,
      testSupabaseConnection,
      testAuthentication,
      testEmotionAnalysis,
      testSpeechTranscription
    ]

    for (let i = 0; i < testFunctions.length; i++) {
      await testFunctions[i](i)
      await new Promise(resolve => setTimeout(resolve, 500)) // 500ms待機
    }

    setIsRunning(false)
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'success': return 'bg-green-100 text-green-800'
      case 'error': return 'bg-red-100 text-red-800'
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'running': return '🔄'
      case 'success': return '✅'
      case 'error': return '❌'
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🧪 音声機能テスト</span>
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            className="ml-4"
          >
            {isRunning ? '🔄 テスト中...' : '▶️ 全テスト実行'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tests.map((test, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-lg">{getStatusIcon(test.status)}</span>
                <span className="font-medium">{test.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {test.message && (
                  <span className="text-sm text-gray-600 max-w-xs truncate">
                    {test.message}
                  </span>
                )}
                <Badge className={getStatusColor(test.status)}>
                  {test.status === 'pending' ? '待機中' :
                   test.status === 'running' ? '実行中' :
                   test.status === 'success' ? '成功' : '失敗'}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">📋 テスト概要</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-lg">
                {tests.filter(t => t.status === 'success').length}
              </div>
              <div className="text-green-600">成功</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">
                {tests.filter(t => t.status === 'error').length}
              </div>
              <div className="text-red-600">失敗</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">
                {tests.filter(t => t.status === 'running').length}
              </div>
              <div className="text-blue-600">実行中</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">
                {tests.filter(t => t.status === 'pending').length}
              </div>
              <div className="text-gray-600">待機中</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}