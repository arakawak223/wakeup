'use client'

import { useState, useEffect } from 'react'
import { useAuth } from "@/contexts/hybrid-auth-context"
import type { User } from '@supabase/supabase-js'
import { initializePerformanceOptimizations } from "@/lib/performance/lazy-loading"
import { ProfileSetup } from "@/components/auth/profile-setup"
import { EnhancedAuthButton } from "@/components/enhanced-auth-button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { VoiceRecorderSupabase } from "@/components/voice-recorder-supabase"
import { VoiceMessageReceiver } from "@/components/messages/voice-message-receiver"
import { VoiceRecordingsList } from "@/components/voice-recordings-list"
import { MicrophoneTest } from "@/components/audio/microphone-test"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import Link from "next/link"

function TestComponent() {
  console.log('TestComponent rendering...')

  const { user, loading, isOfflineMode } = useAuth()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  console.log('Auth state:', { user: !!user, loading, isOfflineMode })

  // パフォーマンス最適化の初期化
  useEffect(() => {
    initializePerformanceOptimizations()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-lg text-gray-600">認証情報を読み込み中...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center">
        <div className="flex-1 w-full flex flex-col gap-20 items-center">
          <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
            <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
              <div className="flex gap-5 items-center font-semibold">
                <Link href={"/"}>👨‍👩‍👧‍👦 家族の音声メッセージ</Link>
              </div>
              <div className="flex items-center gap-4">
                <EnhancedAuthButton />
                <ThemeSwitcher />
              </div>
            </div>
          </nav>

          <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-4">👨‍👩‍👧‍👦 家族の音声メッセージ</h1>
              <p className="text-lg text-gray-600 mb-8">
                家族や親しい友人と、音声メッセージで心温まるつながりを
              </p>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-center mb-4">
                    {isOfflineMode ? '📱 オフラインモード' : '☁️ オンラインモード'}
                  </h2>
                  <p className="text-sm text-center text-gray-600 mb-4">
                    {isOfflineMode
                      ? '現在オフライン認証モードで動作中です'
                      : 'Supabase認証に接続中です'
                    }
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">テスト用ログイン:</p>
                    <p className="text-xs">メール: test@example.com</p>
                    <p className="text-xs">パスワード: password123</p>
                  </div>
                  <div className="mt-4">
                    <a
                      href="/auth/login"
                      className="w-full bg-blue-600 text-white rounded px-4 py-2 text-center block hover:bg-blue-700"
                    >
                      ログインページへ
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* マイクテスト機能（認証なし） */}
            <div className="mt-8">
              <MicrophoneTest
                onTestComplete={(result) => {
                  console.log('マイクテスト完了:', result)
                }}
              />
            </div>

            {/* 開発用音声テスト（認証なし） */}
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>🧪 開発テスト - 音声録音（認証なし）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      開発環境での音声録音テスト。実際のユーザー認証は不要です。
                    </p>
                    <VoiceRecorderSupabase
                      user={{
                        id: 'test-user',
                        email: 'test@example.com',
                        app_metadata: {},
                        user_metadata: {},
                        aud: 'authenticated',
                        created_at: new Date().toISOString()
                      } as User}
                      onRecordingComplete={(messageId) => {
                        console.log('開発テスト録音完了:', messageId)
                        alert(`開発テスト録音が完了しました！メッセージID: ${messageId}`)
                        setRefreshTrigger(prev => prev + 1)
                      }}
                      showQualityMetrics={true}
                      mode="standalone"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 保存された録音データ一覧（認証なし） */}
            <div className="mt-8">
              <VoiceRecordingsList
                user={{
                  id: 'test-user',
                  email: 'test@example.com',
                  app_metadata: {},
                  user_metadata: {},
                  aud: 'authenticated',
                  created_at: new Date().toISOString()
                } as User}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>

          <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
            <p>
              Powered by{" "}
              <a
                href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
                target="_blank"
                className="font-bold hover:underline"
                rel="noreferrer"
              >
                Supabase
              </a>
            </p>
          </footer>
        </div>
      </main>
    )
  }

  // オフライン認証ではプロフィールセットアップをスキップ
  if (user && false) {
    return (
      <main className="min-h-screen flex flex-col items-center">
        <div className="flex-1 w-full flex flex-col items-center">
          <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
            <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
              <div className="flex gap-5 items-center font-semibold">
                <Link href={"/"}>👨‍👩‍👧‍👦 家族の音声メッセージ</Link>
              </div>
              <div className="flex items-center gap-4">
                <EnhancedAuthButton />
                <ThemeSwitcher />
              </div>
            </div>
          </nav>

          <div className="flex-1 w-full py-8 flex items-center justify-center">
            <ProfileSetup user={user} />
          </div>

          <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
            <p>
              Powered by{" "}
              <a
                href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
                target="_blank"
                className="font-bold hover:underline"
                rel="noreferrer"
              >
                Supabase
              </a>
            </p>
            <ThemeSwitcher />
          </footer>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>👨‍👩‍👧‍👦 家族の音声メッセージ</Link>
            </div>
            <div className="flex items-center gap-4">
              <EnhancedAuthButton />
              <ThemeSwitcher />
            </div>
          </div>
        </nav>

        <div className="flex-1 w-full py-8 space-y-8">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">🎉 ログイン成功！</h1>
              <p className="text-gray-600">
                ようこそ、{user.name || user.email}さん
                {user.isOffline ? ' (オフライン)' : ' (オンライン)'}
              </p>
            </div>
          </div>

          {/* マイクテスト */}
          <div className="max-w-5xl mx-auto px-4">
            <MicrophoneTest
              onTestComplete={(result) => {
                console.log('認証済みユーザー マイクテスト完了:', result)
              }}
            />
          </div>

          {/* 音声録音テスト */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>🎤 音声録音テスト</CardTitle>
              </CardHeader>
              <CardContent>
                <VoiceRecorderSupabase
                  user={{
                    id: user.id,
                    email: user.email,
                    app_metadata: {},
                    user_metadata: {},
                    aud: 'authenticated',
                    created_at: new Date().toISOString()
                  } as User}
                  onRecordingComplete={(messageId) => {
                    console.log('録音完了:', messageId)
                    alert(`録音が完了しました！メッセージID: ${messageId}`)
                    setRefreshTrigger(prev => prev + 1)
                  }}
                  showQualityMetrics={true}
                  mode="standalone"
                />
              </CardContent>
            </Card>
          </div>

          {/* 保存された録音データ一覧 */}
          <div className="max-w-5xl mx-auto px-4">
            <VoiceRecordingsList
              user={{
                id: user.id,
                email: user.email,
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date().toISOString()
              } as User}
              refreshTrigger={refreshTrigger}
            />
          </div>

          {/* 家族機能へのリンク */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>👨‍👩‍👧‍👦 家族機能</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    家族との音声メッセージのやり取りをテストできます
                  </p>
                  <Link
                    href="/test-family-messages"
                    className="inline-block bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
                  >
                    家族チャット画面を開く
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* リアルタイム音声コラボレーション */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>🎙️ リアルタイムコラボレーション</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    複数人での音声メッセージリアルタイムコラボレーション機能です。
                    音声録音、即座の配信、参加者の表示機能が利用できます。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">✨ 主な機能:</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• リアルタイム音声メッセージ配信</li>
                      <li>• 参加者のオンライン状況表示</li>
                      <li>• 録音中インジケーター</li>
                      <li>• 音声テキスト変換機能</li>
                    </ul>
                  </div>
                  <Link
                    href="/collaboration"
                    className="inline-block bg-green-600 text-white rounded px-4 py-2 hover:bg-green-700"
                  >
                    コラボレーション画面を開く
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* アクセシビリティ機能デモ */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>♿ アクセシビリティ機能</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    全ての人が利用できる音声メッセージ機能を体験してください。
                    WCAG 2.1準拠のアクセシビリティ機能が実装されています。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">🌟 主要機能:</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• フルキーボード操作対応</li>
                      <li>• スクリーンリーダー完全対応</li>
                      <li>• 高コントラストデザイン</li>
                      <li>• リアルタイム文字起こし</li>
                      <li>• アクセシビリティ自動チェック機能</li>
                    </ul>
                  </div>
                  <Link
                    href="/accessibility"
                    className="inline-block bg-purple-600 text-white rounded px-4 py-2 hover:bg-purple-700"
                  >
                    アクセシビリティデモを体験
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* パフォーマンス監視 */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>📊 パフォーマンス監視</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    アプリケーションのリアルタイムパフォーマンス監視とWeb Vitals測定。
                    Core Web Vitals、メモリ使用量、ネットワーク性能を包括的に監視します。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">📈 監視項目:</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• Core Web Vitals (LCP, FID, CLS)</li>
                      <li>• メモリ使用量とリソース監視</li>
                      <li>• ネットワーク遅延とキャッシュ効率</li>
                      <li>• Service Worker動作状況</li>
                      <li>• リアルタイムメトリクス収集</li>
                    </ul>
                  </div>
                  <Link
                    href="/performance"
                    className="inline-block bg-indigo-600 text-white rounded px-4 py-2 hover:bg-indigo-700"
                  >
                    パフォーマンス監視を開く
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* セキュリティ・プライバシー管理 */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>🔒 セキュリティ・プライバシー</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    エンタープライズレベルのセキュリティ機能とGDPR/CCPA準拠のプライバシー管理。
                    エンドツーエンド暗号化、脅威検出、データ保護を包括的に提供します。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">🛡️ セキュリティ機能:</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• エンドツーエンド暗号化（RSA-4096 + AES-256）</li>
                      <li>• リアルタイム脅威検出・監視</li>
                      <li>• GDPR/CCPA準拠のプライバシー管理</li>
                      <li>• データ主体の権利対応（削除・ポータビリティ）</li>
                      <li>• セキュリティ監査ログ</li>
                    </ul>
                  </div>
                  <Link
                    href="/security"
                    className="inline-block bg-red-600 text-white rounded px-4 py-2 hover:bg-red-700"
                  >
                    セキュリティ管理を開く
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* プログレッシブ・エンハンスメント */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>⚡ プログレッシブ・エンハンスメント</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    ブラウザ機能に応じた段階的機能向上システム。基本機能から高度な機能まで、
                    ユーザーの環境に最適化された体験を提供します。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">🎯 適応機能:</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• ブラウザ機能自動検出</li>
                      <li>• 段階的機能向上（Progressive Enhancement）</li>
                      <li>• フォールバック機能自動提供</li>
                      <li>• クロスブラウザ互換性保証</li>
                      <li>• パフォーマンス最適化</li>
                    </ul>
                  </div>
                  <Link
                    href="/progressive"
                    className="inline-block bg-purple-600 text-white rounded px-4 py-2 hover:bg-purple-700"
                  >
                    プログレッシブ機能を体験
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* プロダクション監視システム */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>📊 プロダクション監視</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    包括的なプロダクション監視システム。パフォーマンス、エラー、ユーザー行動、
                    セキュリティイベントをリアルタイムで監視・分析します。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">🔍 監視項目:</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• Core Web Vitals & パフォーマンス指標</li>
                      <li>• JavaScriptエラー・例外追跡</li>
                      <li>• ユーザーセッション・行動分析</li>
                      <li>• セキュリティイベント監視</li>
                      <li>• リアルタイムログ収集</li>
                    </ul>
                  </div>
                  <Link
                    href="/monitoring"
                    className="inline-block bg-indigo-600 text-white rounded px-4 py-2 hover:bg-indigo-700"
                  >
                    監視ダッシュボードを開く
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 受信メッセージ（リアクション機能付き） */}
          <div className="max-w-5xl mx-auto px-4">
            <VoiceMessageReceiver />
          </div>
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
          <p>
            Powered by{" "}
            <a
              href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
              target="_blank"
              className="font-bold hover:underline"
              rel="noreferrer"
            >
              Supabase
            </a>
          </p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  )
}

export default function Home() {
  console.log('Page rendering with OfflineAuthProvider...')

  return <TestComponent />
}
