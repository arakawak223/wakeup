'use client'

import { AuthProvider, useAuth } from "@/contexts/auth-context"
import type { User } from '@supabase/supabase-js'
import { EnhancedLoginForm } from "@/components/auth/enhanced-login-form"
import { ProfileSetup } from "@/components/auth/profile-setup"
import { FamilyDashboard } from "@/components/dashboard/family-dashboard"
import { EnhancedAuthButton } from "@/components/enhanced-auth-button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { VoiceRecorderSupabase } from "@/components/voice-recorder-supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import Link from "next/link"

function TestComponent() {
  console.log('TestComponent rendering...')

  const { user, profile, loading } = useAuth()
  console.log('Auth state:', { user: !!user, profile: !!profile, loading })

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
              <EnhancedLoginForm />
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
                      }}
                      showQualityMetrics={true}
                      mode="standalone"
                    />
                  </div>
                </CardContent>
              </Card>
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

  if (!profile?.display_name) {
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
          <FamilyDashboard user={user} profile={profile} />

          {/* 音声録音テスト */}
          <div className="max-w-5xl mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle>🎤 音声録音テスト</CardTitle>
              </CardHeader>
              <CardContent>
                <VoiceRecorderSupabase
                  user={user}
                  onRecordingComplete={(messageId) => {
                    console.log('録音完了:', messageId)
                    alert(`録音が完了しました！メッセージID: ${messageId}`)
                  }}
                  showQualityMetrics={true}
                  mode="standalone"
                />
              </CardContent>
            </Card>
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
  console.log('Page rendering with AuthProvider...')

  return (
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  )
}
