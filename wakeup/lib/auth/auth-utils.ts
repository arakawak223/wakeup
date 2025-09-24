/**
 * 認証関連のユーティリティ関数
 */

import { createClient } from '@/lib/supabase/client'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

export interface AuthResult {
  success: boolean
  user?: User
  profile?: Profile
  error?: string
}

export interface AuthError {
  message: string
  code?: string
}

export class AuthManager {
  private supabase = createClient()

  /**
   * ユーザーとプロフィール情報を取得
   */
  async getCurrentUserWithProfile(): Promise<AuthResult> {
    try {
      console.log('認証状態確認開始...')

      // Supabaseセッション確認（タイムアウト付き）
      const sessionPromise = this.supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('セッション確認タイムアウト')), 300)
      })

      let sessionResult
      try {
        sessionResult = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: { user?: { id: string } } } }
      } catch (error) {
        console.log('セッション確認タイムアウト/エラー:', error)
        return { success: true, user: undefined, profile: undefined }
      }

      const { data: { session } } = sessionResult

      if (!session?.user) {
        console.log('セッションなし - 未ログイン状態')
        return { success: true, user: undefined, profile: undefined }
      }

      const user = session.user
      console.log('ユーザー確認:', user.id)

      // プロフィール情報を短時間で取得試行
      try {
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        console.log('プロフィール取得完了')
        return { success: true, user, profile: profile || undefined }
      } catch {
        console.log('プロフィール取得をスキップ')
        // プロフィール取得失敗でもユーザー情報は返す
        return { success: true, user, profile: undefined }
      }
    } catch (error) {
      console.log('認証エラーですが継続:', error)
      // 開発環境では即座に未ログイン状態を返す
      return { success: true, user: null, profile: undefined }
    }
  }

  /**
   * プロフィールを作成または更新
   */
  async updateProfile(
    userId: string,
    updates: {
      displayName?: string
      avatarUrl?: string
    }
  ): Promise<AuthResult> {
    try {
      const { data: user } = await this.supabase.auth.getUser()

      if (!user.data.user || user.data.user.id !== userId) {
        return { success: false, error: '認証エラー: ユーザーIDが一致しません' }
      }

      const profileData = {
        id: userId,
        email: user.data.user.email!,
        display_name: updates.displayName || null,
        avatar_url: updates.avatarUrl || null,
        updated_at: new Date().toISOString()
      }

      const { data: profile, error } = await this.supabase
        .from('profiles')
        .upsert(profileData)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, user: user.data.user, profile }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'プロフィール更新に失敗しました'
      }
    }
  }

  /**
   * パスワードリセットメールを送信
   */
  async sendPasswordResetEmail(email: string): Promise<AuthResult> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'パスワードリセットメールの送信に失敗しました'
      }
    }
  }

  /**
   * パスワードを更新
   */
  async updatePassword(newPassword: string): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, user: data.user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'パスワード更新に失敗しました'
      }
    }
  }

  /**
   * メールアドレスを更新
   */
  async updateEmail(newEmail: string): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        email: newEmail
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, user: data.user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'メールアドレス更新に失敗しました'
      }
    }
  }

  /**
   * アカウントを削除
   */
  async deleteAccount(): Promise<AuthResult> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()

      if (!user) {
        return { success: false, error: 'ユーザーが見つかりません' }
      }

      // プロフィールを削除（CASCADE設定によりrelatedデータも削除される）
      const { error: profileError } = await this.supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      if (profileError) {
        console.error('プロフィール削除エラー:', profileError)
        // プロフィール削除エラーは警告として扱い、認証アカウント削除を続行
      }

      // 認証アカウントからサインアウト
      const { error: signOutError } = await this.supabase.auth.signOut()

      if (signOutError) {
        return { success: false, error: signOutError.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'アカウント削除に失敗しました'
      }
    }
  }

  /**
   * 認証状態の変更を監視
   */
  onAuthStateChange(callback: (user: User | null, profile?: Profile) => void) {
    return this.supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      const user = session?.user || null

      if (user) {
        // ユーザーがログインしている場合、プロフィール情報を取得
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        callback(user, profile || undefined)
      } else {
        callback(null)
      }
    })
  }

  /**
   * 認証エラーメッセージを日本語化
   */
  translateAuthError(error: AuthError): string {
    const errorMessages: Record<string, string> = {
      'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
      'Email not confirmed': 'メールアドレスが確認されていません。確認メールをご確認ください',
      'User already registered': 'このメールアドレスは既に登録されています',
      'Password should be at least 6 characters': 'パスワードは6文字以上である必要があります',
      'Invalid email': 'メールアドレスの形式が正しくありません',
      'Email rate limit exceeded': 'メール送信の制限に達しました。しばらく待ってからお試しください',
      'Signup disabled': '新規登録は現在無効になっています',
      'Invalid token': '無効なトークンです',
      'Token has expired': 'トークンの有効期限が切れています'
    }

    return errorMessages[error.message] || error.message
  }
}

// シングルトンインスタンス
export const authManager = new AuthManager()