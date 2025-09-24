'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useOfflineStorage } from '@/lib/offline/offline-storage'

interface OfflineIndicatorProps {
  className?: string
  showDetails?: boolean
}

export function OfflineIndicator({ className = '', showDetails = false }: OfflineIndicatorProps) {
  const {
    isOnline,
    pendingMessages,
    storageUsage,
    clearOfflineData,
    refreshPendingMessages,
    refreshStorageUsage
  } = useOfflineStorage()

  const [isExpanded, setIsExpanded] = useState(false)

  const getConnectionBadge = () => {
    if (isOnline) {
      return <Badge variant="default" className="bg-green-500">🌐 オンライン</Badge>
    } else {
      return <Badge variant="destructive">📴 オフライン</Badge>
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleClearData = async () => {
    if (confirm('オフラインデータをすべて削除しますか？この操作は取り消せません。')) {
      try {
        await clearOfflineData()
        alert('オフラインデータを削除しました')
      } catch {
        alert('データの削除に失敗しました')
      }
    }
  }

  // コンパクト表示（通常時）
  if (!showDetails && !isExpanded) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getConnectionBadge()}
        {pendingMessages.length > 0 && (
          <Badge variant="outline" className="text-xs">
            📤 未送信: {pendingMessages.length}
          </Badge>
        )}
        {!isOnline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="text-xs h-6 px-2"
          >
            詳細
          </Button>
        )}
      </div>
    )
  }

  // 詳細表示
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span>📡 接続状態</span>
          <div className="flex items-center gap-2">
            {getConnectionBadge()}
            {showDetails || (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="text-xs h-6 w-6 p-0"
              >
                ✕
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* オフライン時の説明 */}
        {!isOnline && (
          <Alert>
            <AlertDescription>
              オフラインモードです。録音した音声メッセージは一時保存され、
              オンラインに復帰したときに自動的に送信されます。
            </AlertDescription>
          </Alert>
        )}

        {/* 未送信メッセージ */}
        {pendingMessages.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">未送信メッセージ</span>
              <Badge variant="outline">{pendingMessages.length}件</Badge>
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto">
              {pendingMessages.slice(0, 5).map((message) => (
                <div key={message.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{message.title}</div>
                    <div className="text-gray-500">
                      {formatBytes(message.metadata.size)} • {message.duration}秒
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={message.syncStatus === 'failed' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {message.syncStatus === 'pending' && '⏳'}
                      {message.syncStatus === 'syncing' && '📤'}
                      {message.syncStatus === 'failed' && '❌'}
                      {message.syncStatus === 'completed' && '✅'}
                    </Badge>
                    {message.retryCount > 0 && (
                      <span className="text-red-500">({message.retryCount})</span>
                    )}
                  </div>
                </div>
              ))}

              {pendingMessages.length > 5 && (
                <div className="text-center text-xs text-gray-500">
                  他 {pendingMessages.length - 5} 件
                </div>
              )}
            </div>

            {isOnline && (
              <Button
                size="sm"
                variant="outline"
                onClick={refreshPendingMessages}
                className="w-full text-xs"
              >
                🔄 同期状態を確認
              </Button>
            )}
          </div>
        )}

        {/* ストレージ使用量 */}
        {storageUsage && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ストレージ使用量</span>
              <span className="text-xs text-gray-600">
                {formatBytes(storageUsage.estimated)} / {formatBytes(storageUsage.quota)}
              </span>
            </div>

            <Progress value={storageUsage.usagePercentage} className="h-2" />

            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
              <div>音声: {storageUsage.details.voiceMessages}</div>
              <div>プロファイル: {storageUsage.details.profiles}</div>
              <div>設定: {storageUsage.details.settings}</div>
            </div>

            {storageUsage.usagePercentage > 80 && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  ストレージ容量が不足しています。不要なデータを削除してください。
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* 操作ボタン */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={refreshStorageUsage}
            className="flex-1 text-xs"
          >
            🔄 更新
          </Button>

          {(pendingMessages.length > 0 || (storageUsage?.details.voiceMessages || 0) > 0) && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleClearData}
              className="flex-1 text-xs"
            >
              🗑️ データ削除
            </Button>
          )}
        </div>

        {/* 開発情報 */}
        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer">開発情報</summary>
            <div className="mt-2 space-y-1 font-mono">
              <div>Online: {isOnline.toString()}</div>
              <div>Pending: {pendingMessages.length}</div>
              <div>Storage: {storageUsage ? formatBytes(storageUsage.estimated) : 'N/A'}</div>
              <div>IndexedDB: {typeof indexedDB !== 'undefined' ? 'Available' : 'Not available'}</div>
              <div>ServiceWorker: {typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'Available' : 'Not available'}</div>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

// 簡易ステータスバー
export function OfflineStatusBar({ className = '' }: { className?: string }) {
  const { isOnline, pendingMessages } = useOfflineStorage()

  if (isOnline && pendingMessages.length === 0) {
    return null // オンラインで未送信なしの場合は表示しない
  }

  return (
    <div className={`bg-gray-100 border-b px-4 py-2 text-sm ${className}`}>
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <span className="text-orange-600">📴 オフライン</span>
              <span className="text-gray-600">録音は一時保存されます</span>
            </>
          ) : pendingMessages.length > 0 ? (
            <>
              <span className="text-blue-600">📤 同期中</span>
              <span className="text-gray-600">{pendingMessages.length}件のメッセージを送信中</span>
            </>
          ) : null}
        </div>

        {pendingMessages.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {pendingMessages.length}件 未送信
          </Badge>
        )}
      </div>
    </div>
  )
}