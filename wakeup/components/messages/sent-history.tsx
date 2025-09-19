'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SupabaseAudioManager } from '@/lib/audio/supabase-audio'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type VoiceMessage = Database['public']['Tables']['voice_messages']['Row'] & {
  sender?: { id: string; display_name: string | null; email: string }
  receiver?: { id: string; display_name: string | null; email: string }
}

interface SentHistoryProps {
  user: User
}

type TimeFilter = 'all' | 'today' | 'week' | 'month'
type CategoryFilter = 'all' | 'thanks' | 'congratulation' | 'relief' | 'empathy' | 'general'

export function SentHistory({ user }: SentHistoryProps) {
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [filteredMessages, setFilteredMessages] = useState<VoiceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    thisWeek: 0,
    thisMonth: 0,
    totalDuration: 0,
    averageDuration: 0,
    categoryCounts: {} as Record<string, number>
  })

  const audioManager = useMemo(() => new SupabaseAudioManager(), [])

  // メッセージを読み込み
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      const data = await audioManager.getUserVoiceMessages(user.id, 'sent')
      setMessages(data)

      // 統計を計算
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const thisWeek = data.filter(msg => new Date(msg.created_at) > oneWeekAgo).length
      const thisMonth = data.filter(msg => new Date(msg.created_at) > oneMonthAgo).length
      const totalDuration = data.reduce((sum, msg) => sum + (msg.duration || 0), 0)
      const averageDuration = data.length > 0 ? totalDuration / data.length : 0

      const categoryCounts: Record<string, number> = {}
      data.forEach(msg => {
        const category = msg.category || 'general'
        categoryCounts[category] = (categoryCounts[category] || 0) + 1
      })

      setStats({
        total: data.length,
        thisWeek,
        thisMonth,
        totalDuration,
        averageDuration,
        categoryCounts
      })
    } catch (error) {
      console.error('送信履歴読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }, [user.id, audioManager])

  // フィルタリング
  useEffect(() => {
    let filtered = [...messages]

    // 時間フィルタ
    if (timeFilter !== 'all') {
      const now = new Date()
      let cutoffDate: Date

      switch (timeFilter) {
        case 'today':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          cutoffDate = new Date(0)
      }

      filtered = filtered.filter(msg => new Date(msg.created_at) > cutoffDate)
    }

    // カテゴリフィルタ
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(msg => (msg.category || 'general') === categoryFilter)
    }

    // 検索フィルタ
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(msg =>
        msg.title?.toLowerCase().includes(term) ||
        msg.receiver?.display_name?.toLowerCase().includes(term) ||
        msg.receiver?.email?.toLowerCase().includes(term)
      )
    }

    setFilteredMessages(filtered)
  }, [messages, timeFilter, categoryFilter, searchTerm])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}時間${minutes}分`
    } else if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`
    } else {
      return `${remainingSeconds}秒`
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      thanks: '感謝',
      congratulation: 'お祝い',
      relief: '安心',
      empathy: '共感',
      general: 'その他'
    }
    return labels[category] || category
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600">送信履歴を読み込み中...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 統計カード */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">総送信数</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.thisWeek}</div>
              <div className="text-sm text-gray-600">今週の送信</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatDuration(Math.round(stats.totalDuration))}</div>
              <div className="text-sm text-gray-600">総録音時間</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{formatDuration(Math.round(stats.averageDuration))}</div>
              <div className="text-sm text-gray-600">平均録音時間</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* カテゴリ別統計 */}
      {Object.keys(stats.categoryCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📊 カテゴリ別送信数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.categoryCounts).map(([category, count]) => (
                <Badge key={category} variant="outline" className="text-sm">
                  {getCategoryLabel(category)}: {count}件
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* フィルタ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 メッセージを絞り込み</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="time-filter">期間</Label>
              <Select value={timeFilter} onValueChange={(value: TimeFilter) => setTimeFilter(value)}>
                <SelectTrigger id="time-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">1週間以内</SelectItem>
                  <SelectItem value="month">1ヶ月以内</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category-filter">カテゴリ</Label>
              <Select value={categoryFilter} onValueChange={(value: CategoryFilter) => setCategoryFilter(value)}>
                <SelectTrigger id="category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="thanks">感謝</SelectItem>
                  <SelectItem value="congratulation">お祝い</SelectItem>
                  <SelectItem value="relief">安心</SelectItem>
                  <SelectItem value="empathy">共感</SelectItem>
                  <SelectItem value="general">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">検索</Label>
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="タイトルや送信先で検索..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {filteredMessages.length}件のメッセージ
              {(timeFilter !== 'all' || categoryFilter !== 'all' || searchTerm.trim()) &&
                ` (全${stats.total}件中)`
              }
            </div>

            {(timeFilter !== 'all' || categoryFilter !== 'all' || searchTerm.trim()) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTimeFilter('all')
                  setCategoryFilter('all')
                  setSearchTerm('')
                }}
              >
                フィルタをリセット
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* メッセージ一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📤 送信履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMessages.length > 0 ? (
            <div className="space-y-4">
              {filteredMessages.map((message) => (
                <Card
                  key={message.id}
                  className="cursor-pointer transition-all hover:shadow-md"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">
                            送信先: {message.receiver?.display_name || message.receiver?.email || '不明'}
                          </span>
                        </div>

                        <h3 className="font-medium text-lg mb-2 truncate">
                          {message.title || '無題の音声メッセージ'}
                        </h3>

                        <div className="flex items-center gap-2 mb-3">
                          <Badge className="bg-gray-100 text-gray-800">
                            {getCategoryLabel(message.category || 'general')}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {formatDuration(message.duration || 0)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(message.created_at).toLocaleString('ja-JP')}
                          </span>
                        </div>

                        {message.dominant_emotion && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500">感情:</span>
                            <Badge variant="outline" className="text-xs">
                              {message.dominant_emotion}
                            </Badge>
                            {message.emotion_confidence && (
                              <span className="text-xs text-gray-500">
                                {Math.round(message.emotion_confidence * 100)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 min-w-[100px]">
                        <Button size="sm" variant="outline" disabled>
                          ✅ 送信済み
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="text-6xl">📭</div>
              <div className="text-gray-500">
                {messages.length === 0 ?
                  '送信した音声メッセージはありません' :
                  '条件に一致するメッセージが見つかりません'
                }
              </div>
              {messages.length === 0 && (
                <p className="text-sm text-gray-400">
                  「簡単送信」タブから音声メッセージを送信してみましょう
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}