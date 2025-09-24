'use client'

// Dynamic rendering for accessibility features
export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { AccessibleVoiceRecorder } from '@/components/accessibility/accessible-voice-recorder'
import { AccessibleAudioControls } from '@/components/accessibility/accessible-audio-controls'
import { AccessibilityChecker } from '@/components/accessibility/accessibility-checker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScreenReaderAnnouncer } from '@/lib/accessibility/screen-reader'
import {
  Eye,
  Keyboard,
  Volume2,
  Mic,
  Play,
  CheckCircle,
  Lightbulb,
  Headphones,
  MousePointer
} from 'lucide-react'

export default function AccessibilityPage() {
  const [recordedAudio, setRecordedAudio] = useState<ArrayBuffer | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [announcer] = useState(() => ScreenReaderAnnouncer.getInstance())

  useEffect(() => {
    // Announce page load
    announcer.announce('アクセシビリティ機能デモページが読み込まれました。')

    // Add skip link for keyboard navigation
    const skipLink = document.createElement('a')
    skipLink.href = '#main-content'
    skipLink.textContent = 'メインコンテンツにスキップ'
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded focus:z-50'
    document.body.insertBefore(skipLink, document.body.firstChild)

    return () => {
      if (document.body.contains(skipLink)) {
        document.body.removeChild(skipLink)
      }
    }
  }, [announcer])

  const handleRecordingComplete = (audioBlob: Blob, duration: number, transcription?: string) => {
    audioBlob.arrayBuffer().then(buffer => {
      setRecordedAudio(buffer)
      setRecordingDuration(duration)

      announcer.announce(
        `録音が完了しました。時間: ${Math.round(duration)}秒` +
        (transcription ? `、文字起こし: ${transcription}` : '')
      )
    })
  }

  const accessibility_features = [
    {
      icon: <Keyboard className="h-5 w-5" />,
      title: 'キーボード操作',
      description: 'すべての機能がキーボードのみで操作可能',
      details: [
        'Tab/Shift+Tabでフォーカス移動',
        'Enter/スペースで録音開始・停止',
        '矢印キーで音量・再生位置調整',
        'Escapeでキャンセル操作'
      ]
    },
    {
      icon: <Volume2 className="h-5 w-5" />,
      title: 'スクリーンリーダー対応',
      description: '画面読み上げソフトに完全対応',
      details: [
        'ARIA属性による意味付け',
        'ライブリージョンでの状態通知',
        '適切な見出し構造',
        '操作手順の音声案内'
      ]
    },
    {
      icon: <Eye className="h-5 w-5" />,
      title: '視覚的配慮',
      description: '色覚多様性とコントラストに配慮',
      details: [
        'WCAG 2.1 AAレベルのコントラスト',
        '色だけに依存しない情報伝達',
        '大きなクリック領域',
        'フォーカス表示の明確化'
      ]
    },
    {
      icon: <Headphones className="h-5 w-5" />,
      title: '聴覚サポート',
      description: '聴覚障害者への配慮機能',
      details: [
        'リアルタイム文字起こし',
        '視覚的な音声レベル表示',
        '録音状態の視覚表示',
        '字幕対応準備'
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header with proper landmark */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <Eye className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                アクセシビリティ機能デモ
              </h1>
              <p className="text-gray-600">
                全ての人が利用できる音声メッセージ機能
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Feature Overview */}
        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-xl font-semibold mb-6">
            🌟 アクセシビリティ機能
          </h2>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {accessibility_features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {feature.icon}
                    <span>{feature.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-3">{feature.description}</p>
                  <ul className="text-sm space-y-1">
                    {feature.details.map((detail, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Demo Tabs */}
        <Tabs defaultValue="recorder" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recorder" className="flex items-center space-x-2">
              <Mic className="h-4 w-4" />
              <span>音声録音</span>
            </TabsTrigger>
            <TabsTrigger value="player" className="flex items-center space-x-2">
              <Play className="h-4 w-4" />
              <span>音声再生</span>
            </TabsTrigger>
            <TabsTrigger value="checker" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>アクセシビリティチェック</span>
            </TabsTrigger>
          </TabsList>

          {/* Voice Recorder Demo */}
          <TabsContent value="recorder" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mic className="h-5 w-5" />
                  <span>アクセシブル音声録音</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex items-start space-x-2">
                      <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-blue-900">操作方法</h3>
                        <p className="text-blue-800 text-sm mt-1">
                          スペースキーまたはEnterキーで録音開始・停止。Escapeキーでキャンセル。
                          音声レベルとリアルタイム文字起こしが表示されます。
                        </p>
                      </div>
                    </div>
                  </div>

                  <AccessibleVoiceRecorder
                    onRecordingComplete={handleRecordingComplete}
                    maxDuration={30}
                    showVisualFeedback={true}
                    showTranscription={true}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audio Player Demo */}
          <TabsContent value="player" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Play className="h-5 w-5" />
                  <span>アクセシブル音声再生</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recordedAudio ? (
                    <>
                      <div className="bg-green-50 border-l-4 border-green-400 p-4">
                        <div className="flex items-start space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div>
                            <h3 className="font-medium text-green-900">録音済み音声</h3>
                            <p className="text-green-800 text-sm mt-1">
                              録音時間: {Math.round(recordingDuration)}秒
                              <br />
                              キーボードショートカット: スペース（再生・一時停止）、矢印キー（スキップ・音量）
                            </p>
                          </div>
                        </div>
                      </div>

                      <AccessibleAudioControls
                        audioBuffer={recordedAudio}
                        duration={recordingDuration}
                        showTimeline={true}
                        showVolumeControl={true}
                      />
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Volume2 className="h-12 w-12 mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">再生する音声がありません</p>
                      <p>まず「音声録音」タブで録音を行ってください</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                          const recordingTab = document.querySelector('[value="recorder"]') as HTMLElement
                          recordingTab?.click()
                        }}
                      >
                        録音タブに移動
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accessibility Checker Demo */}
          <TabsContent value="checker" className="space-y-6">
            <AccessibilityChecker />
          </TabsContent>
        </Tabs>

        {/* Usage Guidelines */}
        <section aria-labelledby="guidelines-heading">
          <Card>
            <CardHeader>
              <CardTitle id="guidelines-heading" className="flex items-center space-x-2">
                <MousePointer className="h-5 w-5" />
                <span>利用ガイドライン</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">キーボード操作</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Tab</Badge>
                      <span>次の要素にフォーカス</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Shift+Tab</Badge>
                      <span>前の要素にフォーカス</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Enter/Space</Badge>
                      <span>ボタン実行</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Arrow Keys</Badge>
                      <span>スライダー調整</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Escape</Badge>
                      <span>操作キャンセル</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">スクリーンリーダー</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• 全ての操作が音声で案内されます</p>
                    <p>• 録音状態や再生状態がリアルタイムで通知されます</p>
                    <p>• 適切な見出し構造で情報が整理されています</p>
                    <p>• ARIAラベルで詳細な情報を提供しています</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-600">
          <p>
            このデモは WCAG 2.1 AAレベルのアクセシビリティ基準に準拠しています
          </p>
        </div>
      </footer>
    </div>
  )
}