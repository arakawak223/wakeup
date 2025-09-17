'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePresence } from '@/lib/presence'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface OnlineStatusProps {
  userId: string
  displayName: string
  familyMembers: Profile[]
}

export function OnlineStatus({ userId, displayName, familyMembers }: OnlineStatusProps) {
  const [showOnlineList, setShowOnlineList] = useState(false)
  const { otherOnlineUsers, isOnline, toggleOnlineStatus, onlineCount, isUserOnline } = usePresence(
    userId,
    displayName,
    'family'
  )

  const getOnlineFamilyMembers = () => {
    return familyMembers.filter(member => isUserOnline(member.id))
  }

  const onlineFamilyMembers = getOnlineFamilyMembers()

  return (
    <div className="relative">
      {/* オンライン状態表示 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowOnlineList(!showOnlineList)}
          className="relative"
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            <span className="text-xs">
              {onlineCount > 0 ? `${onlineCount}人オンライン` : 'オフライン'}
            </span>
          </div>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleOnlineStatus}
          className="text-xs"
        >
          {isOnline ? '🟢 オンライン' : '⚫ オフライン'}
        </Button>
      </div>

      {/* オンラインユーザー一覧 */}
      {showOnlineList && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              オンライン ({onlineCount}人)
            </h3>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {/* 自分の状態 */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName} (あなた)</span>
                <Badge variant={isOnline ? 'default' : 'secondary'} className="text-xs">
                  {isOnline ? 'オンライン' : 'オフライン'}
                </Badge>
              </div>
            </div>

            {/* 家族メンバーのオンライン状態 */}
            {familyMembers.length > 0 && (
              <div className="p-3">
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">家族・友人</h4>
                <div className="space-y-2">
                  {familyMembers.map((member) => {
                    const isOnline = isUserOnline(member.id)
                    return (
                      <div key={member.id} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-sm text-gray-900 dark:text-gray-100">{member.display_name || 'ユーザー'}</span>
                        {member.id.startsWith('dummy-') && (
                          <Badge variant="outline" className="text-xs">
                            🧪 テスト
                          </Badge>
                        )}
                        <Badge variant={isOnline ? 'default' : 'secondary'} className="text-xs ml-auto">
                          {isOnline ? 'オンライン' : 'オフライン'}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* その他のオンラインユーザー */}
            {otherOnlineUsers.length > onlineFamilyMembers.length && (
              <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">その他のユーザー</h4>
                <div className="space-y-2">
                  {otherOnlineUsers
                    .filter(user => !familyMembers.some(member => member.id === user.user_id))
                    .map((user) => (
                      <div key={user.user_id} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">{user.display_name}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          オンライン
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {onlineCount === 1 && (
              <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                現在オンラインなのはあなただけです
              </div>
            )}
          </div>

          <div className="p-2 border-t border-gray-100 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlineList(false)}
              className="w-full text-xs"
            >
              閉じる
            </Button>
          </div>
        </div>
      )}

      {/* クリックアウトサイドで閉じる */}
      {showOnlineList && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowOnlineList(false)}
        />
      )}
    </div>
  )
}