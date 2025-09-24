'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthDebug() {
  const [testResult, setTestResult] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<string>('')

  useEffect(() => {
    testSupabaseConnection()
  }, [])

  const testSupabaseConnection = async () => {
    try {
      const supabase = createClient()

      // 接続テスト
      const { error } = await supabase.from('profiles').select('count').limit(1)

      if (error) {
        setConnectionStatus(`❌ 接続エラー: ${error.message}`)
      } else {
        setConnectionStatus('✅ Supabase接続OK')
      }
    } catch (error) {
      setConnectionStatus(`❌ 接続失敗: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const testLogin = async () => {
    try {
      setTestResult('ログインテスト中...')

      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      })

      if (error) {
        setTestResult(`❌ ログインエラー: ${error.message}`)
      } else {
        setTestResult(`✅ ログイン成功: ${data.user?.email}`)
      }
    } catch (error) {
      setTestResult(`❌ ログイン失敗: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
      <h3 className="font-bold">認証デバッグ</h3>

      <div>
        <p className="font-semibold">Supabase接続状態:</p>
        <p className="text-sm">{connectionStatus}</p>
      </div>

      <div>
        <button
          onClick={testLogin}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          テストログイン実行
        </button>
        <p className="text-sm mt-2">{testResult}</p>
      </div>
    </div>
  )
}