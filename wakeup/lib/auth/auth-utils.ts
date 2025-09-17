/**
 * 認証関連のユーティリティ関数
 */

import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
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
      const { data: { user }, error: userError } = await this.supabase.auth.getUser()

      if (userError) {
        return { success: false, error: userError.message }
      }

      if (!user) {
        return { success: false, error: 'ユーザーが見つかりません' }
      }

      // プロフィール情報を取得
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116は行が見つからない場合
        return { success: false, user, error: profileError.message }
      }

      return { success: true, user, profile: profile || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました'
      }
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
    return this.supabase.auth.onAuthStateChange(async (event, session) => {
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