'use client'

import { useAuth } from '@/contexts/auth-context'
import { VoiceRecorderSupabase } from '@/components/voice-recorder-supabase'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { useState } from 'react'

export default function VoiceTestPage() {
  const { user, loading } = useAuth()
  const [testResults, setTestResults] = useState<string[]>([])

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  const handleRecordingComplete = (messageId: string) => {
    addTestResult(`✅ 録音完了 - メッセージID: ${messageId}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        <p className="mt-4 text-gray-600">読み込み中...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">ログインが必要です</h1>
          <p className="text-gray-600">音声テストにはログインが必要です。</p>
          <Button asChild>
            <Link href="/">ホームへ戻る</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8">
          <Button asChild variant="outline" className="mb-4">
            <Link href="/">← ホームに戻る</Link>
          </Button>
          <h1 className="text-3xl font-bold">🎤 音声機能テスト</h1>
          <p className="text-gray-600 mt-2">
            音声録音とアップロード機能をテストします。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 音声録音テスト */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>音声録音テスト</CardTitle>
              </CardHeader>
              <CardContent>
                <VoiceRecorderSupabase
                  user={user}
                  onRecordingComplete={handleRecordingComplete}
                  showQualityMetrics={true}
                  mode="standalone"
                />
              </CardContent>
            </Card>
          </div>

          {/* テスト結果 */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>テスト結果</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {testResults.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      テスト結果がここに表示されます
                    </p>
                  ) : (
                    testResults.map((result, index) => (
                      <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                        {result}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={() => setTestResults([])}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    結果をクリア
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 音声機能情報 */}
            <Card>
              <CardHeader>
                <CardTitle>ブラウザ対応状況</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>MediaRecorder:</span>
                  <span className={typeof MediaRecorder !== 'undefined' ? 'text-green-600' : 'text-red-600'}>
                    {typeof MediaRecorder !== 'undefined' ? '✅ 対応' : '❌ 非対応'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>getUserMedia:</span>
                  <span className={navigator.mediaDevices ? 'text-green-600' : 'text-red-600'}>
                    {navigator.mediaDevices ? '✅ 対応' : '❌ 非対応'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>WebM支援:</span>
                  <span className={MediaRecorder.isTypeSupported('audio/webm') ? 'text-green-600' : 'text-yellow-600'}>
                    {MediaRecorder.isTypeSupported('audio/webm') ? '✅ 対応' : '⚠️ 制限あり'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 使用方法 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>テスト手順</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>「録音開始」ボタンをクリックしてマイクアクセスを許可</li>
              <li>数秒間音声を録音</li>
              <li>「録音停止」ボタンをクリック</li>
              <li>音声ファイルの自動アップロードを確認</li>
              <li>テスト結果に成功メッセージが表示されることを確認</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}