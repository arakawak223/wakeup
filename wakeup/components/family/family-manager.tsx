'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { getMockFamilyMembers, isDevMode } from '@/lib/dev-mode'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type FamilyConnection = Database['public']['Tables']['family_connections']['Row'] & {
  user1: Profile
  user2: Profile
}

interface FamilyManagerProps {
  userId: string
}

export function FamilyManager({ userId }: FamilyManagerProps) {
  const [connections, setConnections] = useState<FamilyConnection[]>([])
  const [searchEmail, setSearchEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const supabase = createClient()

  const loadFamilyConnections = useCallback(async () => {
    try {
      setLoading(true)

      // 現在のユーザーの認証状態を確認
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('認証エラー:', authError)
        throw authError
      }
      if (!user) {
        console.error('ユーザーが認証されていません')
        throw new Error('ユーザーが認証されていません')
      }

      const { data, error } = await supabase
        .from('family_connections')
        .select(`
          *,
          user1:profiles!user1_id(id, display_name, email),
          user2:profiles!user2_id(id, display_name, email)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

      if (error) throw error

      let allConnections = data || []

      // 開発モードの場合、モック家族メンバーを追加
      if (isDevMode()) {
        const mockMembers = getMockFamilyMembers(userId)
        const mockConnections = mockMembers.map((member) => ({
          id: `mock-connection-${member.id}`,
          user1_id: userId,
          user2_id: member.id,
          status: 'accepted' as const,
          created_by: userId,
          created_at: member.created_at,
          updated_at: member.updated_at,
          user1: {
            id: userId,
            email: 'current@user.com',
            display_name: 'あなた',
            avatar_url: null,
            role: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          user2: { ...member, role: member.role || null }
        }))

        allConnections = [...allConnections, ...mockConnections]
      }

      setConnections(allConnections)
    } catch (error) {
      console.error('家族関係の読み込みエラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }

      // エラー時でも開発モードではモックデータを表示
      if (isDevMode()) {
        const mockMembers = getMockFamilyMembers(userId)
        const mockConnections = mockMembers.map((member) => ({
          id: `mock-connection-${member.id}`,
          user1_id: userId,
          user2_id: member.id,
          status: 'accepted' as const,
          created_by: userId,
          created_at: member.created_at,
          updated_at: member.updated_at,
          user1: {
            id: userId,
            email: 'current@user.com',
            display_name: 'あなた',
            avatar_url: null,
            role: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          user2: { ...member, role: member.role || null }
        }))

        setConnections(mockConnections)
      }
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => {
    loadFamilyConnections()
  }, [loadFamilyConnections])

  const addFamilyMember = async () => {
    if (!searchEmail.trim()) return

    try {
      setSearching(true)

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(searchEmail.trim())) {
        alert('有効なメールアドレスを入力してください')
        return
      }

      // 相手のプロフィールを検索
      const { data: targetProfile, error: searchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', searchEmail.trim())
        .single()

      if (searchError) {
        if (searchError.code === 'PGRST116') {
          const shouldCopyInvite = confirm(
            `${searchEmail.trim()} はまだアプリに登録していません。\n\n招待リンクをコピーして相手に送りますか？`
          )

          if (shouldCopyInvite) {
            await copyInviteLink(searchEmail.trim())
          }
        } else {
          console.error('プロフィール検索エラー:', searchError)
          console.error('エラー詳細:', JSON.stringify(searchError, null, 2))
          if (searchError && typeof searchError === 'object' && 'message' in searchError) {
            console.error('エラーメッセージ:', searchError.message)
          }
          alert('ユーザー検索でエラーが発生しました')
        }
        return
      }

      if (targetProfile.id === userId) {
        alert('自分自身は追加できません')
        return
      }

      // user1_id < user2_id となるようにソート
      const [user1_id, user2_id] = [userId, targetProfile.id].sort()

      // 既存の関係をチェック
      const { data: existingConnection } = await supabase
        .from('family_connections')
        .select('*')
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .single()

      if (existingConnection) {
        alert('この家族との関係は既に存在します')
        return
      }

      // 関係を作成
      const { error: insertError } = await supabase
        .from('family_connections')
        .insert({
          user1_id,
          user2_id,
          created_by: userId,
          status: 'pending'
        })

      if (insertError) {
        console.error('家族関係作成エラー:', insertError)
        console.error('エラー詳細:', JSON.stringify(insertError, null, 2))
        if (insertError && typeof insertError === 'object' && 'message' in insertError) {
          console.error('エラーメッセージ:', insertError.message)
        }
        alert('家族関係の作成に失敗しました')
        return
      }

      setSearchEmail('')
      loadFamilyConnections()
      alert('家族への招待を送信しました')
    } catch (error) {
      console.error('家族の追加エラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }
      alert('家族の追加に失敗しました')
    } finally {
      setSearching(false)
    }
  }

  const updateConnectionStatus = async (connectionId: string, status: 'accepted' | 'blocked') => {
    try {
      const { error } = await supabase
        .from('family_connections')
        .update({ status })
        .eq('id', connectionId)

      if (error) throw error

      loadFamilyConnections()
      alert(`家族関係を${status === 'accepted' ? '承認' : 'ブロック'}しました`)
    } catch (error) {
      console.error('家族関係の更新エラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }
    }
  }

  const copyInviteLink = async (targetEmail: string) => {
    try {
      const { data: currentUser } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', userId)
        .single()

      const inviteUrl = `${window.location.origin}/auth/signup`
      const inviteMessage = `家族の音声メッセージアプリへの招待

${currentUser?.display_name || 'あなたの家族'}（${currentUser?.email}）があなた（${targetEmail}）を家族の音声メッセージアプリに招待しています。

家族や親しい友人とだけ音声メッセージでつながるプライベートなアプリです。
以下のリンクからご登録ください：

${inviteUrl}

登録後、${currentUser?.email} を検索して家族関係を追加してください。`

      await navigator.clipboard.writeText(inviteMessage)
      alert('招待メッセージをクリップボードにコピーしました。\n相手にLINEやメールで送信してください。')
      setSearchEmail('')
    } catch (error) {
      console.error('招待リンクコピーエラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }
      const inviteUrl = `${window.location.origin}/auth/signup`
      const fallbackMessage = `家族の音声メッセージアプリに登録してください: ${inviteUrl}`

      try {
        await navigator.clipboard.writeText(fallbackMessage)
        alert('招待リンクをコピーしました')
      } catch {
        prompt('以下のメッセージをコピーして相手に送信してください:', fallbackMessage)
      }
      setSearchEmail('')
    }
  }

  const removeConnection = async (connectionId: string) => {
    if (!confirm('この家族関係を削除しますか？')) return

    try {
      // モック接続の場合は特別処理
      if (connectionId.startsWith('mock-connection-')) {
        // モック接続はLocalStorageから削除するのではなく、単純に再読み込みで非表示にする
        // 実際の削除は開発コントロールパネルから行う
        alert('テスト用の家族メンバーです。削除するには開発モードパネルの「モックデータ削除」を使用してください。')
        return
      }

      const { error } = await supabase
        .from('family_connections')
        .delete()
        .eq('id', connectionId)

      if (error) throw error

      loadFamilyConnections()
      alert('家族関係を削除しました')
    } catch (error) {
      console.error('家族関係の削除エラー:', error)
      console.error('エラー詳細:', JSON.stringify(error, null, 2))
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('エラーメッセージ:', error.message)
      }
    }
  }

  const getOtherUser = (connection: FamilyConnection): Profile => {
    return connection.user1_id === userId ? connection.user2 : connection.user1
  }

  const isCreatedByMe = (connection: FamilyConnection): boolean => {
    return connection.created_by === userId
  }

  if (loading) {
    return <div className="text-center py-4">読み込み中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 新しい家族を追加 */}
      <Card>
        <CardHeader>
          <CardTitle>👨‍👩‍👧‍👦 家族・親しい友人を招待</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="相手のメールアドレスを入力"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFamilyMember()}
            />
            <Button
              onClick={addFamilyMember}
              disabled={searching || !searchEmail.trim()}
            >
              {searching ? '検索中...' : '招待'}
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            💡 家族や親しい友人のメールアドレスを入力して、プライベートな音声メッセージ交換を始めましょう
          </p>
        </CardContent>
      </Card>

      {/* 既存の家族関係 */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">家族・友人</h3>
        {connections.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-gray-500">
              まだ家族・友人がいません
            </CardContent>
          </Card>
        ) : (
          connections.map((connection) => {
            const otherUser = getOtherUser(connection)
            const createdByMe = isCreatedByMe(connection)

            return (
              <Card key={connection.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{otherUser.display_name || 'ユーザー'}</h4>
                        {connection.id.startsWith('mock-connection-') && isDevMode() && (
                          <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                            🧪 テスト用
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {otherUser.email} •
                        {connection.id.startsWith('mock-connection-')
                          ? ' 開発用ダミー'
                          : createdByMe ? ' あなたが招待' : ' 相手が招待'} •
                        <span className={`
                          ${connection.status === 'accepted' ? 'text-green-600' : ''}
                          ${connection.status === 'pending' ? 'text-yellow-600' : ''}
                          ${connection.status === 'blocked' ? 'text-red-600' : ''}
                        `}>
                          {connection.status === 'accepted' && '✅ つながっています'}
                          {connection.status === 'pending' && '⏳ 承認待ち'}
                          {connection.status === 'blocked' && '🚫 ブロック済み'}
                        </span>
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {connection.status === 'pending' && !createdByMe && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateConnectionStatus(connection.id, 'accepted')}
                            className="bg-green-500 hover:bg-green-600"
                          >
                            承認
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateConnectionStatus(connection.id, 'blocked')}
                          >
                            拒否
                          </Button>
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeConnection(connection.id)}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}