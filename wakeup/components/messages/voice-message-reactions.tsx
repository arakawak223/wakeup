'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type ReactionType = 'heart' | 'laugh' | 'surprise' | 'sad' | 'angry' | 'thumbs_up' | 'thumbs_down' | 'clap' | 'fire' | 'crying'

export interface MessageReaction {
  id: string
  messageId: string
  userId: string
  reactionType: ReactionType
  createdAt: string
  user?: {
    id: string
    displayName?: string
    email: string
  }
}

interface VoiceMessageReactionsProps {
  messageId: string
  currentUserId: string
  reactions: MessageReaction[]
  onReactionAdd: (messageId: string, reactionType: ReactionType) => Promise<void>
  onReactionRemove: (messageId: string, reactionType: ReactionType) => Promise<void>
  disabled?: boolean
}

const reactionEmojis: Record<ReactionType, string> = {
  heart: '❤️',
  laugh: '😂',
  surprise: '😲',
  sad: '😢',
  angry: '😡',
  thumbs_up: '👍',
  thumbs_down: '👎',
  clap: '👏',
  fire: '🔥',
  crying: '😭'
}

const reactionLabels: Record<ReactionType, string> = {
  heart: 'ハート',
  laugh: '笑い',
  surprise: '驚き',
  sad: '悲しい',
  angry: '怒り',
  thumbs_up: 'いいね',
  thumbs_down: 'よくない',
  clap: '拍手',
  fire: '燃える',
  crying: '泣く'
}

export function VoiceMessageReactions({
  messageId,
  currentUserId,
  reactions,
  onReactionAdd,
  onReactionRemove,
  disabled = false
}: VoiceMessageReactionsProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [processing, setProcessing] = useState<ReactionType | null>(null)

  // リアクションの集計
  const reactionCounts = reactions.reduce((acc, reaction) => {
    acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1
    return acc
  }, {} as Record<ReactionType, number>)

  // 現在のユーザーがつけたリアクション
  const userReactions = reactions
    .filter(r => r.userId === currentUserId)
    .map(r => r.reactionType)

  // リアクションの追加/削除
  const toggleReaction = useCallback(async (reactionType: ReactionType) => {
    if (disabled || processing) return

    setProcessing(reactionType)
    try {
      if (userReactions.includes(reactionType)) {
        await onReactionRemove(messageId, reactionType)
      } else {
        await onReactionAdd(messageId, reactionType)
      }
    } catch (error) {
      console.error('リアクション処理エラー:', error)
    } finally {
      setProcessing(null)
    }
  }, [messageId, userReactions, onReactionAdd, onReactionRemove, disabled, processing])

  // 表示するリアクション（少なくとも1人がつけたもの）
  const displayedReactions = Object.entries(reactionCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a) // 多い順でソート

  if (displayedReactions.length === 0 && disabled) {
    return null
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 既存のリアクション表示 */}
      {displayedReactions.map(([reactionType, count]) => {
        const isUserReaction = userReactions.includes(reactionType as ReactionType)
        return (
          <Button
            key={reactionType}
            variant="outline"
            size="sm"
            className={cn(
              "h-8 px-2 py-1 text-xs",
              isUserReaction && "bg-blue-100 border-blue-300 text-blue-700",
              processing === reactionType && "opacity-50"
            )}
            onClick={() => toggleReaction(reactionType as ReactionType)}
            disabled={disabled || processing === reactionType}
          >
            <span className="mr-1">
              {reactionEmojis[reactionType as ReactionType]}
            </span>
            <span>{count}</span>
          </Button>
        )
      })}

      {/* リアクション追加ボタン */}
      {!disabled && (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
              disabled={processing !== null}
            >
              <span className="text-lg">😊</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-5 gap-1">
              {Object.entries(reactionEmojis).map(([type, emoji]) => {
                const reactionType = type as ReactionType
                const isActive = userReactions.includes(reactionType)
                return (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-10 w-10 p-0 text-lg hover:bg-gray-100",
                      isActive && "bg-blue-100 hover:bg-blue-200",
                      processing === reactionType && "opacity-50"
                    )}
                    onClick={async () => {
                      await toggleReaction(reactionType)
                      setIsPopoverOpen(false)
                    }}
                    disabled={processing === reactionType}
                    title={reactionLabels[reactionType]}
                  >
                    {emoji}
                  </Button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

interface ReactionDetailProps {
  reactions: MessageReaction[]
  reactionType: ReactionType
  onClose: () => void
}

export function ReactionDetail({ reactions, reactionType, onClose }: ReactionDetailProps) {
  const filteredReactions = reactions.filter(r => r.reactionType === reactionType)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">
          {reactionEmojis[reactionType]} {reactionLabels[reactionType]}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </div>

      <div className="space-y-1 max-h-32 overflow-y-auto">
        {filteredReactions.map((reaction) => (
          <div key={reaction.id} className="text-xs text-gray-600">
            {reaction.user?.displayName || reaction.user?.email || '匿名ユーザー'}
            <span className="ml-2 text-gray-400">
              {new Date(reaction.createdAt).toLocaleString('ja-JP')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ReactionSummaryProps {
  reactions: MessageReaction[]
  maxDisplay?: number
}

export function ReactionSummary({ reactions, maxDisplay = 3 }: ReactionSummaryProps) {
  const reactionCounts = reactions.reduce((acc, reaction) => {
    acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1
    return acc
  }, {} as Record<ReactionType, number>)

  const sortedReactions = Object.entries(reactionCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxDisplay)

  if (sortedReactions.length === 0) {
    return null
  }

  const totalReactions = reactions.length
  const hiddenCount = Math.max(0, Object.keys(reactionCounts).length - maxDisplay)

  return (
    <div className="flex items-center gap-1 text-xs text-gray-600">
      {sortedReactions.map(([type, count]) => (
        <span key={type} className="flex items-center gap-1">
          {reactionEmojis[type as ReactionType]}
          {count}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="text-gray-400">
          +{hiddenCount}種類
        </span>
      )}
      <span className="text-gray-400">
        ({totalReactions}件)
      </span>
    </div>
  )
}