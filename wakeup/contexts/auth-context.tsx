'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { authManager, type AuthResult } from '@/lib/auth/auth-utils'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  updateProfile: (updates: { displayName?: string; avatarUrl?: string }) => Promise<AuthResult>
  sendPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (newPassword: string) => Promise<AuthResult>
  updateEmail: (newEmail: string) => Promise<AuthResult>
  deleteAccount: () => Promise<AuthResult>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // 初期認証状態の取得
  useEffect(() => {
    let isMounted = true

    const getInitialAuth = async () => {
      console.log('認証状態取得開始...')

      try {
        const result = await authManager.getCurrentUserWithProfile()
        console.log('認証結果:', result)

        if (isMounted) {
          if (result && result.success) {
            setUser(result.user || null)
            setProfile(result.profile || null)
            console.log('認証成功')
          } else {
            setUser(null)
            setProfile(null)
            console.log('未ログイン状態')
          }
        }
      } catch (error) {
        console.error('認証エラー:', error)
        if (isMounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (isMounted) {
          console.log('loading=false設定')
          setLoading(false)
        }
      }
    }

    // 最大3秒後には必ずloadingを終了
    const timeout = setTimeout(() => {
      if (isMounted) {
        console.log('タイムアウト - アプリを続行します')
        setLoading(false)
      }
    }, 3000)

    getInitialAuth()

    return () => {
      isMounted = false
      clearTimeout(timeout)
    }
  }, [])

  // 認証状態の変更を監視
  useEffect(() => {
    const { data: { subscription } } = authManager.onAuthStateChange((newUser, newProfile) => {
      setUser(newUser)
      setProfile(newProfile || null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // サインイン
  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return {
          success: false,
          error: authManager.translateAuthError({ message: error.message, code: error.name })
        }
      }

      // プロフィール情報を取得
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()

        setUser(data.user)
        setProfile(profile || null)
      }

      return { success: true, user: data.user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ログインに失敗しました'
      }
    }
  }

  // サインアップ
  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        return {
          success: false,
          error: authManager.translateAuthError({ message: error.message, code: error.name })
        }
      }

      return { success: true, user: data.user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'サインアップに失敗しました'
      }
    }
  }

  // サインアウト
  const signOut = async (): Promise<void> => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('サインアウトエラー:', error)
    }
  }

  // プロフィール更新
  const updateProfile = async (updates: { displayName?: string; avatarUrl?: string }): Promise<AuthResult> => {
    if (!user) {
      return { success: false, error: 'ユーザーが認証されていません' }
    }

    const result = await authManager.updateProfile(user.id, updates)

    if (result.success && result.profile) {
      setProfile(result.profile)
    }

    return result
  }

  // パスワードリセット
  const sendPasswordReset = async (email: string): Promise<AuthResult> => {
    return authManager.sendPasswordResetEmail(email)
  }

  // パスワード更新
  const updatePassword = async (newPassword: string): Promise<AuthResult> => {
    return authManager.updatePassword(newPassword)
  }

  // メールアドレス更新
  const updateEmail = async (newEmail: string): Promise<AuthResult> => {
    const result = await authManager.updateEmail(newEmail)

    if (result.success && result.user) {
      setUser(result.user)
    }

    return result
  }

  // アカウント削除
  const deleteAccount = async (): Promise<AuthResult> => {
    const result = await authManager.deleteAccount()

    if (result.success) {
      setUser(null)
      setProfile(null)
    }

    return result
  }

  // プロフィール再取得
  const refreshProfile = async (): Promise<void> => {
    if (!user) return

    try {
      const result = await authManager.getCurrentUserWithProfile()
      if (result.success) {
        setProfile(result.profile || null)
      }
    } catch (error) {
      console.error('プロフィール再取得エラー:', error)
    }
  }

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    sendPasswordReset,
    updatePassword,
    updateEmail,
    deleteAccount,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// 認証が必要なページを保護するためのHOC
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth()

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      )
    }

    if (!user) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">認証が必要です</h1>
            <p>このページにアクセスするにはログインが必要です。</p>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}