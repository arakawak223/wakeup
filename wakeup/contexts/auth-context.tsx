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
    console.log('認証プロバイダー初期化開始')

    // 認証確認のタイムアウトを短縮
    const timeout = setTimeout(() => {
      console.log('認証タイムアウト - 未ログイン状態で続行')
      setUser(null)
      setProfile(null)
      setLoading(false)
    }, 100)

    // 実際の認証確認は非同期で実行し、結果を待たない
    authManager.getCurrentUserWithProfile()
      .then(result => {
        console.log('認証結果:', result)
        if (result && result.success && result.user) {
          clearTimeout(timeout)
          setUser(result.user)
          setProfile(result.profile || null)
          setLoading(false)
        }
      })
      .catch(error => {
        console.log('認証エラー（無視）:', error)
      })

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  // 認証状態の変更を監視
  useEffect(() => {
    const setupAuthListener = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
        console.log('🔑 認証状態変更:', event, !!session?.user)

        const user = session?.user || null

        if (user) {
          // ユーザーがログインしている場合、プロフィール情報を取得
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()

            setUser(user)
            setProfile(profile || null)
            setLoading(false)
          } catch (error) {
            console.log('🔑 プロフィール取得エラー:', error)
            setUser(user)
            setProfile(null)
            setLoading(false)
          }
        } else {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      })

      return subscription
    }

    const subscription = setupAuthListener()
    return () => {
      subscription.then(sub => sub.unsubscribe())
    }
  }, [])

  // サインイン
  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      console.log('🔑 ログイン開始:', email)
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      console.log('🔑 ログイン結果:', { data: !!data.user, error: error?.message })

      if (error) {
        console.error('🔑 ログインエラー:', error)
        return {
          success: false,
          error: authManager.translateAuthError({ message: error.message, code: error.name })
        }
      }

      // プロフィール情報を非同期で取得（ブロックしない）
      if (data.user) {
        console.log('🔑 ユーザー認証成功 - 状態更新中:', data.user.id)
        setUser(data.user)
        setLoading(false)

        // プロフィール取得は非同期で実行してログインをブロックしない
        supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()
          .then((result: any) => {
            console.log('🔑 プロフィール取得完了:', !!result.data)
            setProfile(result.data || null)
          })
          .catch((error: any) => {
            console.log('🔑 プロフィール取得失敗:', error.message)
            setProfile(null)
          })
      }

      return { success: true, user: data.user }
    } catch (error) {
      console.error('🔑 ログイン例外:', error)
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

      // Supabaseのサインアウトをタイムアウト付きで実行
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('サインアウトタイムアウト')), 3000)
      })

      await Promise.race([signOutPromise, timeoutPromise])
    } catch (error) {
      console.warn('サインアウト処理でエラーが発生しましたが、ローカル状態をクリアします:', error)
    } finally {
      // Supabaseの状態に関係なく、ローカル状態をクリア
      setUser(null)
      setProfile(null)
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