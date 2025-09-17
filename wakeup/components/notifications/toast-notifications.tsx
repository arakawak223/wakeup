'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRealtimeNotifications, type NotificationData } from '@/lib/realtime'

interface ToastNotification extends NotificationData {
  id: string
}

interface ToastNotificationsProps {
  userId: string
}

export function ToastNotifications({ userId }: ToastNotificationsProps) {
  const { notifications } = useRealtimeNotifications(userId)
  const [toasts, setToasts] = useState<ToastNotification[]>([])

  useEffect(() => {
    // 新しい通知をトーストとして表示
    notifications.slice(0, 1).forEach(notification => {
      const toastId = `toast-${Date.now()}-${Math.random()}`
      const toast: ToastNotification = {
        ...notification,
        id: toastId
      }

      setToasts(prev => [toast, ...prev].slice(0, 3)) // 最大3個まで表示

      // 5秒後に自動削除
      setTimeout(() => {
        removeToast(toastId)
      }, 5000)
    })
  }, [notifications])

  const removeToast = (toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId))
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_voice_message':
        return '🎵'
      case 'new_message_request':
        return '📝'
      case 'request_accepted':
        return '✅'
      case 'request_declined':
        return '❌'
      default:
        return '🔔'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_voice_message':
        return 'border-blue-300 bg-blue-50'
      case 'new_message_request':
        return 'border-purple-300 bg-purple-50'
      case 'request_accepted':
        return 'border-green-300 bg-green-50'
      case 'request_declined':
        return 'border-red-300 bg-red-50'
      default:
        return 'border-gray-300 bg-gray-50'
    }
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast, index) => (
        <Card
          key={toast.id}
          className={`p-4 shadow-lg animate-in slide-in-from-right duration-300 ${getNotificationColor(toast.type)}`}
          style={{
            animationDelay: `${index * 100}ms`,
            transform: `translateY(${index * 10}px)`
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">
              {getNotificationIcon(toast.type)}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {toast.title}
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">
                {toast.message}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeToast(toast.id)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            >
              ✕
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}