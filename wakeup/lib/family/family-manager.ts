import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type FamilyConnection = Database['public']['Tables']['family_connections']['Row']
type FamilyConnectionStatus = Database['public']['Tables']['family_connections']['Row']['status']

export interface FamilyMember extends Profile {
  connection_status: FamilyConnectionStatus
  connected_at: string
  connection_id: string
}

export interface ConnectionRequest {
  id: string
  requester: Profile
  receiver: Profile
  status: FamilyConnectionStatus
  created_at: string
}

export interface FamilyManagerResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export class FamilyManager {
  private supabase = createClient()

  constructor(private userId: string) {}

  // 家族メンバーを取得
  async getFamilyMembers(): Promise<FamilyManagerResult<FamilyMember[]>> {
    try {
      const { data: connections, error } = await this.supabase
        .from('family_connections')
        .select(`
          *,
          user1:profiles!family_connections_user1_id_fkey(*),
          user2:profiles!family_connections_user2_id_fkey(*)
        `)
        .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)
        .eq('status', 'accepted')

      if (error) throw error

      const familyMembers: FamilyMember[] = connections?.map(connection => {
        const isUser1 = connection.user1_id === this.userId
        const member = isUser1 ? connection.user2 : connection.user1

        return {
          ...member,
          connection_status: connection.status,
          connected_at: connection.created_at,
          connection_id: connection.id
        }
      }) || []

      return { success: true, data: familyMembers }
    } catch (error) {
      console.error('家族メンバー取得エラー:', error)
      return {
        success: false,
        error: '家族メンバーの取得に失敗しました'
      }
    }
  }

  // 保留中の接続リクエストを取得
  async getPendingRequests(): Promise<FamilyManagerResult<ConnectionRequest[]>> {
    try {
      const { data: connections, error } = await this.supabase
        .from('family_connections')
        .select(`
          *,
          user1:profiles!family_connections_user1_id_fkey(*),
          user2:profiles!family_connections_user2_id_fkey(*)
        `)
        .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)
        .eq('status', 'pending')

      if (error) throw error

      const requests: ConnectionRequest[] = connections?.map(connection => {
        const isUser1 = connection.user1_id === this.userId
        const requester = connection.created_by === connection.user1_id ? connection.user1 : connection.user2
        const receiver = connection.created_by === connection.user1_id ? connection.user2 : connection.user1

        return {
          id: connection.id,
          requester,
          receiver,
          status: connection.status,
          created_at: connection.created_at
        }
      }) || []

      return { success: true, data: requests }
    } catch (error) {
      console.error('保留中リクエスト取得エラー:', error)
      return {
        success: false,
        error: '保留中のリクエストの取得に失敗しました'
      }
    }
  }

  // メールアドレスで家族を招待
  async inviteFamilyMember(email: string): Promise<FamilyManagerResult> {
    try {
      // 招待するユーザーを検索
      const { data: inviteeProfile, error: searchError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('email', email.toLowerCase())
        .single()

      if (searchError || !inviteeProfile) {
        return {
          success: false,
          error: 'そのメールアドレスのユーザーが見つかりません'
        }
      }

      if (inviteeProfile.id === this.userId) {
        return {
          success: false,
          error: '自分自身を招待することはできません'
        }
      }

      // 既存の接続を確認
      const { data: existingConnection } = await this.supabase
        .from('family_connections')
        .select('*')
        .or(`and(user1_id.eq.${this.userId},user2_id.eq.${inviteeProfile.id}),and(user1_id.eq.${inviteeProfile.id},user2_id.eq.${this.userId})`)
        .single()

      if (existingConnection) {
        if (existingConnection.status === 'accepted') {
          return {
            success: false,
            error: 'このユーザーは既に家族メンバーです'
          }
        } else if (existingConnection.status === 'pending') {
          return {
            success: false,
            error: '既に招待リクエストが送信されています'
          }
        }
      }

      // 新しい接続を作成 (user1_id < user2_idの制約に従う)
      const [user1Id, user2Id] = [this.userId, inviteeProfile.id].sort()

      const { error: insertError } = await this.supabase
        .from('family_connections')
        .insert({
          user1_id: user1Id,
          user2_id: user2Id,
          status: 'pending',
          created_by: this.userId
        })

      if (insertError) throw insertError

      // 通知を作成
      await this.createNotification(
        inviteeProfile.id,
        'connection_request',
        '家族の招待',
        '新しい家族の招待が届きました',
        { inviter_id: this.userId }
      )

      return { success: true }
    } catch (error) {
      console.error('家族招待エラー:', error)
      return {
        success: false,
        error: '招待の送信に失敗しました'
      }
    }
  }

  // 招待を承認
  async acceptInvitation(connectionId: string): Promise<FamilyManagerResult> {
    try {
      const { error } = await this.supabase
        .from('family_connections')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId)
        .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)

      if (error) throw error

      // 招待者に通知
      const { data: connection } = await this.supabase
        .from('family_connections')
        .select('created_by')
        .eq('id', connectionId)
        .single()

      if (connection?.created_by && connection.created_by !== this.userId) {
        await this.createNotification(
          connection.created_by,
          'connection_accepted',
          '招待が承認されました',
          'あなたの家族招待が承認されました',
          { accepter_id: this.userId }
        )
      }

      return { success: true }
    } catch (error) {
      console.error('招待承認エラー:', error)
      return {
        success: false,
        error: '招待の承認に失敗しました'
      }
    }
  }

  // 招待を拒否
  async rejectInvitation(connectionId: string): Promise<FamilyManagerResult> {
    try {
      const { error } = await this.supabase
        .from('family_connections')
        .delete()
        .eq('id', connectionId)
        .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('招待拒否エラー:', error)
      return {
        success: false,
        error: '招待の拒否に失敗しました'
      }
    }
  }

  // 家族メンバーを削除
  async removeFamilyMember(connectionId: string): Promise<FamilyManagerResult> {
    try {
      const { error } = await this.supabase
        .from('family_connections')
        .delete()
        .eq('id', connectionId)
        .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('家族メンバー削除エラー:', error)
      return {
        success: false,
        error: '家族メンバーの削除に失敗しました'
      }
    }
  }

  // 通知を作成
  private async createNotification(
    userId: string,
    type: 'connection_request' | 'connection_accepted' | 'message_received',
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title,
          message,
          data: data || {}
        })
    } catch (error) {
      console.error('通知作成エラー:', error)
    }
  }

  // ユーザー検索
  async searchUsers(query: string): Promise<FamilyManagerResult<Profile[]>> {
    try {
      if (!query.trim()) {
        return { success: true, data: [] }
      }

      const { data: profiles, error } = await this.supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', this.userId)
        .limit(10)

      if (error) throw error

      return { success: true, data: profiles || [] }
    } catch (error) {
      console.error('ユーザー検索エラー:', error)
      return {
        success: false,
        error: 'ユーザーの検索に失敗しました'
      }
    }
  }
}