'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface OfflineUser {
  id: string
  email: string
  name: string
}

interface AuthContextType {
  user: OfflineUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function OfflineAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OfflineUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ローカルストレージから認証情報を復元
    try {
      const stored = localStorage.getItem('wakeup_auth')
      if (stored) {
        const authData = JSON.parse(stored)
        // 24時間以内の認証情報のみ有効
        if (Date.now() - authData.timestamp < 24 * 60 * 60 * 1000) {
          setUser(authData.user)
        } else {
          localStorage.removeItem('wakeup_auth')
        }
      }
    } catch (error) {
      console.error('認証情報の復元エラー:', error)
      localStorage.removeItem('wakeup_auth')
    }
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      // 簡単なオフライン認証
      if (email === 'test@example.com' && password === 'password123') {
        const userData: OfflineUser = {
          id: '1',
          email: 'test@example.com',
          name: 'テストユーザー'
        }

        // ローカルストレージに保存
        localStorage.setItem('wakeup_auth', JSON.stringify({
          user: userData,
          timestamp: Date.now()
        }))

        setUser(userData)
        return { success: true }
      } else {
        return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' }
      }
    } catch (error) {
      console.error('ログインエラー:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ログインに失敗しました'
      }
    }
  }

  const signOut = async () => {
    try {
      localStorage.removeItem('wakeup_auth')
      setUser(null)
    } catch (error) {
      console.error('サインアウトエラー:', error)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}