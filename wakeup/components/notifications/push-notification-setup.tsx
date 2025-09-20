'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePushNotifications, PushNotificationManager } from '@/lib/notifications/push-notification-manager'

interface PushNotificationSetupProps {
  userId?: string
  onSubscriptionChange?: (subscriptionInfo: any) => void
  className?: string
}

export function PushNotificationSetup({
  userId,
  onSubscriptionChange,
  className = ''
}: PushNotificationSetupProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    subscribe,
    unsubscribe,
    showVoiceMessageNotification
  } = usePushNotifications()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supportInfo, setSupportInfo] = useState<ReturnType<typeof PushNotificationManager.checkSupport> | null>(null)

  useEffect(() => {
    setSupportInfo(PushNotificationManager.checkSupport())
  }, [])

  const handleToggleNotifications = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!isSubscribed) {
        // 通知を有効にする
        if (permission !== 'granted') {
          const granted = await requestPermission()
          if (!granted) {
            setError('通知の許可が必要です。ブラウザの設定で通知を許可してください。')
            return
          }
        }

        // TODO: 実際のVAPID公開キーを使用
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'demo-key'
        const success = await subscribe(vapidKey)

        if (success) {
          // サブスクリプション情報をサーバーに送信
          // TODO: 実装
          onSubscriptionChange?.(null)
        } else {
          setError('プッシュ通知の設定に失敗しました')
        }
      } else {
        // 通知を無効にする
        const success = await unsubscribe()
        if (!success) {
          setError('通知の無効化に失敗しました')
        }
      }
    } catch (error) {
      console.error('通知設定エラー:', error)
      setError(error instanceof Error ? error.message : '設定に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const testNotification = async () => {
    try {
      await showVoiceMessageNotification('テスト', 'これはテスト通知です')
    } catch (error) {
      console.error('テスト通知エラー:', error)
      setError('テスト通知の送信に失敗しました')
    }
  }

  if (!isSupported) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            🔔 プッシュ通知
            <Badge variant="destructive">未対応</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              お使いのブラウザはプッシュ通知をサポートしていません。
              Chrome、Firefox、Safari、Edgeの最新版をお試しください。
            </AlertDescription>
          </Alert>

          {/* サポート状況の詳細 */}
          {supportInfo && (
            <div className="mt-4 text-xs text-gray-600 space-y-1">
              <div>通知API: {supportInfo.notifications ? '✅' : '❌'}</div>
              <div>Service Worker: {supportInfo.serviceWorker ? '✅' : '❌'}</div>
              <div>Push Manager: {supportInfo.pushManager ? '✅' : '❌'}</div>
              <div>バイブレーション: {supportInfo.vibration ? '✅' : '❌'}</div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default">許可済み</Badge>
      case 'denied':
        return <Badge variant="destructive">拒否</Badge>
      default:
        return <Badge variant="outline">未設定</Badge>
    }
  }

  const getPermissionMessage = () => {
    switch (permission) {
      case 'granted':
        return 'プッシュ通知が許可されています'
      case 'denied':
        return 'プッシュ通知が拒否されています。ブラウザの設定から許可してください。'
      default:
        return 'プッシュ通知の許可が必要です'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          🔔 プッシュ通知設定
          {getPermissionBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 通知の状態 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="push-notifications">音声メッセージの通知</Label>
              <p className="text-xs text-gray-600">
                新しい音声メッセージが届いた時に通知を受け取る
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={isSubscribed}
              onCheckedChange={handleToggleNotifications}
              disabled={isLoading || permission === 'denied'}
            />
          </div>

          <div className="text-xs text-gray-600">
            {getPermissionMessage()}
          </div>
        </div>

        {/* 通知許可が必要な場合の説明 */}
        {permission === 'default' && (
          <Alert>
            <AlertDescription>
              通知を有効にするには、ブラウザからの許可が必要です。
              スイッチをオンにすると許可の確認が表示されます。
            </AlertDescription>
          </Alert>
        )}

        {/* 通知が拒否されている場合の説明 */}
        {permission === 'denied' && (
          <Alert variant="destructive">
            <AlertDescription>
              通知が拒否されています。以下の手順で許可してください：
              <br />• ブラウザのアドレスバーの左側にある鍵アイコンをクリック
              <br />• 通知の設定を「許可」に変更
              <br />• ページを再読み込み
            </AlertDescription>
          </Alert>
        )}

        {/* テスト通知ボタン */}
        {isSubscribed && permission === 'granted' && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testNotification}
              className="w-full"
            >
              🔔 テスト通知を送信
            </Button>
            <p className="text-xs text-gray-600 text-center">
              通知が正常に動作するかテストできます
            </p>
          </div>
        )}

        {/* 開発情報 */}
        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer">開発情報</summary>
            <div className="mt-2 space-y-1 font-mono">
              <div>Permission: {permission}</div>
              <div>Subscribed: {isSubscribed ? 'Yes' : 'No'}</div>
              <div>User ID: {userId || 'Not set'}</div>
              {supportInfo && (
                <div className="space-y-1">
                  <div>Notifications: {supportInfo.notifications.toString()}</div>
                  <div>ServiceWorker: {supportInfo.serviceWorker.toString()}</div>
                  <div>PushManager: {supportInfo.pushManager.toString()}</div>
                  <div>Vibration: {supportInfo.vibration.toString()}</div>
                </div>
              )}
            </div>
          </details>
        )}

        {/* 通知の種類説明 */}
        <div className="text-xs text-gray-600 space-y-2">
          <div className="font-medium">通知される内容：</div>
          <ul className="space-y-1 ml-4">
            <li>• 新しい音声メッセージの受信</li>
            <li>• 家族招待の承認・拒否</li>
            <li>• アプリの重要な更新</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}