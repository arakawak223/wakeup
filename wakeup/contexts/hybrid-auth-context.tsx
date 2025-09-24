'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface HybridUser {
  id: string
  email: string
  name?: string
  isOffline?: boolean
}

interface AuthContextType {
  user: HybridUser | null
  loading: boolean
  isOfflineMode: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  switchToOnlineMode: () => void
  switchToOfflineMode: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function HybridAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<HybridUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOfflineMode, setIsOfflineMode] = useState(false)

  useEffect(() => {
    // 初期化時にオンライン接続を試行
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    console.log('🔄 認証システム初期化開始...')

    try {
      // まずSupabase接続を試行（タイムアウトを10秒に延長）
      const supabase = createClient()

      // タイムアウト付きでセッション取得
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Supabase接続タイムアウト')), 10000)
      })

      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any

      if (session?.user) {
        console.log('✅ Supabaseセッション復元成功')
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          isOffline: false
        })
        setIsOfflineMode(false)
        // 認証状態の監視を設定
        setupAuthListener()
      } else {
        console.log('⚠️ セッションなし、オンライン認証を優先')
        setIsOfflineMode(false)
        // 認証状態の監視を設定
        setupAuthListener()
      }

    } catch (error) {
      console.log('⚠️ Supabase接続失敗:', error)
      // 接続失敗時もオンラインモードを維持し、ログインページで再試行可能にする
      setIsOfflineMode(false)
    } finally {
      setLoading(false)
    }
  }

  const restoreOfflineAuth = async () => {
    try {
      const stored = localStorage.getItem('wakeup_auth')
      if (stored) {
        const authData = JSON.parse(stored)
        // 24時間以内の認証情報のみ有効
        if (Date.now() - authData.timestamp < 24 * 60 * 60 * 1000) {
          setUser({ ...authData.user, isOffline: true })
          setIsOfflineMode(true)
          console.log('📱 オフライン認証情報復元完了')
          return
        } else {
          localStorage.removeItem('wakeup_auth')
        }
      }
    } catch (error) {
      console.error('📱 オフライン認証復元エラー:', error)
    }

    setIsOfflineMode(true)
  }

  const setupAuthListener = () => {
    if (isOfflineMode) return

    try {
      const supabase = createClient()
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event: string, session: any) => {
          console.log('🔑 Supabase認証状態変更:', event, !!session?.user)

          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              isOffline: false
            })
            setIsOfflineMode(false)
          } else if (!isOfflineMode) {
            setUser(null)
          }
        }
      )

      return () => subscription.unsubscribe()
    } catch (error) {
      console.error('🔑 認証リスナー設定エラー:', error)
    }
  }

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isOfflineMode) {
        // オンラインモード: Supabase認証を試行
        console.log('🔑 Supabaseログイン試行:', email)
        const supabase = createClient()

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) {
          console.log('⚠️ Supabaseログイン失敗、オフライン認証にフォールバック')
          return await performOfflineSignIn(email, password)
        }

        if (data.user) {
          console.log('✅ Supabaseログイン成功')
          setUser({
            id: data.user.id,
            email: data.user.email || '',
            isOffline: false
          })
          return { success: true }
        }
      }

      // オフラインモードまたはSupabase失敗時
      return await performOfflineSignIn(email, password)

    } catch (error) {
      console.error('🔑 ログインエラー:', error)
      return await performOfflineSignIn(email, password)
    }
  }

  const performOfflineSignIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // オフライン認証（開発用）
    const validCredentials = [
      { email: 'test@example.com', password: 'password123' },
      { email: 'wakeuptest@gmail.com', password: 'password123' }
    ]

    const isValid = validCredentials.some(
      cred => cred.email === email && cred.password === password
    )

    if (isValid) {
      const userData: HybridUser = {
        id: 'offline-' + Date.now(),
        email: email,
        name: 'テストユーザー',
        isOffline: true
      }

      // ローカルストレージに保存
      localStorage.setItem('wakeup_auth', JSON.stringify({
        user: userData,
        timestamp: Date.now()
      }))

      setUser(userData)
      setIsOfflineMode(true)
      console.log('📱 オフラインログイン成功')
      return { success: true }
    } else {
      return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' }
    }
  }

  const signOut = async () => {
    try {
      if (!isOfflineMode && user && !user.isOffline) {
        // オンラインユーザーの場合はSupabaseからもサインアウト
        const supabase = createClient()
        await supabase.auth.signOut()
      }

      // ローカル認証情報のクリア
      localStorage.removeItem('wakeup_auth')
      setUser(null)
      console.log('🚪 ログアウト完了')
    } catch (error) {
      console.error('🚪 ログアウトエラー:', error)
      // エラーが発生してもローカル状態はクリア
      localStorage.removeItem('wakeup_auth')
      setUser(null)
    }
  }

  const switchToOnlineMode = () => {
    setIsOfflineMode(false)
    initializeAuth()
  }

  const switchToOfflineMode = () => {
    setIsOfflineMode(true)
    if (user && !user.isOffline) {
      // オンラインユーザーをオフラインモードに変換
      setUser({ ...user, isOffline: true })
    }
  }

  const value = {
    user,
    loading,
    isOfflineMode,
    signIn,
    signOut,
    switchToOnlineMode,
    switchToOfflineMode
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}