'use client'

import { DeployButton } from "@/components/deploy-button"
import { EnhancedAuthButton } from "@/components/enhanced-auth-button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { ProfileSetup } from "@/components/auth/profile-setup"
import { FamilyDashboard } from "@/components/dashboard/family-dashboard"
import { EnhancedLoginForm } from "@/components/auth/enhanced-login-form"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"

export function HomeClient() {
  const { user, profile, loading } = useAuth()

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
      <main className="min-h-screen flex flex-col items-center">
        <div className="flex-1 w-full flex flex-col gap-20 items-center">
          <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
            <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
              <div className="flex gap-5 items-center font-semibold">
                <Link href={"/"}>👨‍👩‍👧‍👦 家族の音声メッセージ</Link>
                <div className="flex items-center gap-2">
                  <DeployButton />
                </div>
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

  // ユーザーのプロフィールを確認
  if (!profile || !profile.display_name) {
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

        <div className="flex-1 w-full py-8">
          <FamilyDashboard user={user} profile={profile} />
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