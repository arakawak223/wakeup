'use client'

// Progressive enhancement enabled
export const dynamic = 'force-dynamic'

import React from 'react'
import { ProgressiveVoiceRecorder } from '@/components/progressive/progressive-voice-recorder'
import { FeatureDetector } from '@/components/progressive/feature-detector'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function ProgressivePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                プログレッシブ・エンハンスメント・デモ
              </h1>
              <p className="text-gray-600">
                ブラウザ機能に応じた段階的機能向上
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <FeatureDetector>
          {(features) => (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Feature Support Status */}
              <Card>
                <CardHeader>
                  <CardTitle>ブラウザ機能サポート状況</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(features).map(([feature, supported]) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">
                        {feature.replace(/([A-Z])/g, ' $1')}
                      </span>
                      {supported ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Progressive Voice Recorder */}
              <div>
                <ProgressiveVoiceRecorder
                  onRecordingComplete={(blob) => {
                    console.log('Recording completed:', blob)
                  }}
                />
              </div>
            </div>
          )}
        </FeatureDetector>

        {/* Implementation Guide */}
        <Card>
          <CardHeader>
            <CardTitle>プログレッシブ・エンハンスメント実装戦略</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">基本レベル</h3>
                <ul className="text-green-700 space-y-1">
                  <li>• 基本的なUI表示</li>
                  <li>• テキストベース操作</li>
                  <li>• フォールバック機能</li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">拡張レベル</h3>
                <ul className="text-blue-700 space-y-1">
                  <li>• 音声録音・再生</li>
                  <li>• リアルタイム機能</li>
                  <li>• オフライン対応</li>
                </ul>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">高度レベル</h3>
                <ul className="text-purple-700 space-y-1">
                  <li>• 音声解析・可視化</li>
                  <li>• WebRTC通信</li>
                  <li>• AI音声処理</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}