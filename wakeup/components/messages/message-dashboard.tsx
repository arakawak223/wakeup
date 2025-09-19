'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { MessageSearchService, type SearchFilters, type SearchResult, type MessageStatistics, type PersonalizedInsights } from '@/lib/messages/message-search'

interface MessageDashboardProps {
  userId: string
  className?: string
}

const emotionEmojis: Record<string, string> = {
  happiness: '😊',
  sadness: '😢',
  anger: '😠',
  fear: '😨',
  surprise: '😲',
  disgust: '😤',
  neutral: '😐'
}

const categoryEmojis: Record<string, string> = {
  thanks: '🙏',
  congratulation: '🎉',
  relief: '😌',
  empathy: '🤝',
  love: '❤️',
  encouragement: '💪',
  daily: '📝'
}

export function MessageDashboard({ userId, className = '' }: MessageDashboardProps) {
  const [searchService] = useState(() => new MessageSearchService())
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [statistics, setStatistics] = useState<MessageStatistics | null>(null)
  const [insights, setInsights] = useState<PersonalizedInsights | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('search')

  // 検索フィルター状態
  const [textQuery, setTextQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedEmotion, setSelectedEmotion] = useState<string>('')
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({})
  const [qualityRange, setQualityRange] = useState({ min: 0, max: 100 })

  const loadInitialData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [statsResult, insightsResult, searchResult] = await Promise.all([
        searchService.getMessageStatistics(userId),
        searchService.getPersonalizedInsights(userId),
        searchService.searchMessages(userId, {}, { limit: 20 })
      ])

      setStatistics(statsResult)
      setInsights(insightsResult)
      setSearchResults(searchResult)
    } catch (error) {
      console.error('データ読み込みエラー:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId, searchService])

  // 初期データ読み込み
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // 検索実行
  const executeSearch = async () => {
    setIsLoading(true)
    try {
      const searchFilters: SearchFilters = {
        ...(textQuery && { textQuery }),
        ...(selectedCategory && { categories: [selectedCategory] }),
        ...(selectedEmotion && { emotions: [selectedEmotion] }),
        ...(dateRange.start && dateRange.end && { dateRange: { start: dateRange.start, end: dateRange.end } }),
        qualityScore: { min: qualityRange.min, max: qualityRange.max }
      }

      const results = await searchService.searchMessages(userId, searchFilters)
      setSearchResults(results)
    } catch (error) {
      console.error('検索エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // フィルターリセット
  const resetFilters = () => {
    setTextQuery('')
    setSelectedCategory('')
    setSelectedEmotion('')
    setDateRange({})
    setQualityRange({ min: 0, max: 100 })
    loadInitialData()
  }

  // 統計データの可視化用計算
  const emotionChartData = useMemo(() => {
    if (!statistics?.emotionBreakdown) return []

    return Object.entries(statistics.emotionBreakdown)
      .map(([emotion, count]) => ({
        emotion,
        count,
        percentage: (count / statistics.totalMessages) * 100,
        emoji: emotionEmojis[emotion] || '😐'
      }))
      .sort((a, b) => b.count - a.count)
  }, [statistics])

  const categoryChartData = useMemo(() => {
    if (!statistics?.categoryBreakdown) return []

    return Object.entries(statistics.categoryBreakdown)
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / statistics.totalMessages) * 100,
        emoji: categoryEmojis[category] || '📝'
      }))
      .sort((a, b) => b.count - a.count)
  }, [statistics])

  if (isLoading && !searchResults.length && !statistics) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p>データを読み込んでいます...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 メッセージダッシュボード
            <Badge variant="outline" className="ml-auto">
              総メッセージ数: {statistics?.totalMessages || 0}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="search">🔍 検索</TabsTrigger>
              <TabsTrigger value="stats">📈 統計</TabsTrigger>
              <TabsTrigger value="insights">🎯 分析</TabsTrigger>
              <TabsTrigger value="trends">📊 トレンド</TabsTrigger>
            </TabsList>

            {/* 検索タブ */}
            <TabsContent value="search" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* テキスト検索 */}
                <div className="space-y-2">
                  <Label>テキスト検索</Label>
                  <Input
                    placeholder="転写テキストから検索..."
                    value={textQuery}
                    onChange={(e) => setTextQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && executeSearch()}
                  />
                </div>

                {/* カテゴリフィルター */}
                <div className="space-y-2">
                  <Label>カテゴリ</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="すべてのカテゴリ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">すべて</SelectItem>
                      {Object.entries(categoryEmojis).map(([category, emoji]) => (
                        <SelectItem key={category} value={category}>
                          {emoji} {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 感情フィルター */}
                <div className="space-y-2">
                  <Label>感情</Label>
                  <Select value={selectedEmotion} onValueChange={setSelectedEmotion}>
                    <SelectTrigger>
                      <SelectValue placeholder="すべての感情" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">すべて</SelectItem>
                      {Object.entries(emotionEmojis).map(([emotion, emoji]) => (
                        <SelectItem key={emotion} value={emotion}>
                          {emoji} {emotion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 品質スコア範囲 */}
                <div className="space-y-2">
                  <Label>品質スコア: {qualityRange.min} - {qualityRange.max}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={qualityRange.min}
                      onChange={(e) => setQualityRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                    />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={qualityRange.max}
                      onChange={(e) => setQualityRange(prev => ({ ...prev, max: parseInt(e.target.value) || 100 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={executeSearch} disabled={isLoading}>
                  {isLoading ? '検索中...' : '🔍 検索'}
                </Button>
                <Button variant="outline" onClick={resetFilters}>
                  🔄 リセット
                </Button>
              </div>

              {/* 検索結果 */}
              <div className="space-y-4">
                <h3 className="font-semibold">検索結果 ({searchResults.length}件)</h3>
                {searchResults.map((result) => (
                  <Card key={result.message.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {categoryEmojis[result.message.category || 'daily']} {result.message.category}
                        </Badge>
                        {result.message.emotion_primary && (
                          <Badge className="bg-purple-100 text-purple-800">
                            {emotionEmojis[result.message.emotion_primary]} {result.message.emotion_primary}
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          品質: {result.message.quality_score}点
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(result.message.created_at).toLocaleString()}
                      </div>
                    </div>

                    <h4 className="font-medium mb-2">{result.message.title}</h4>

                    {result.message.transcription && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {result.message.transcription}
                      </p>
                    )}

                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        {result.matchReasons.map((reason, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">
                        関連度: {Math.round(result.relevanceScore)}%
                      </div>
                    </div>
                  </Card>
                ))}

                {searchResults.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-gray-500">
                    検索結果が見つかりませんでした
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 統計タブ */}
            <TabsContent value="stats" className="space-y-4">
              {statistics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 感情の分布 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>感情の分布</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {emotionChartData.map(({ emotion, count, percentage, emoji }) => (
                        <div key={emotion} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span>{emoji}</span>
                              <span>{emotion}</span>
                            </span>
                            <span>{count}件 ({Math.round(percentage)}%)</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* カテゴリの分布 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>カテゴリの分布</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {categoryChartData.map(({ category, count, percentage, emoji }) => (
                        <div key={category} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span>{emoji}</span>
                              <span>{category}</span>
                            </span>
                            <span>{count}件 ({Math.round(percentage)}%)</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* 分析タブ */}
            <TabsContent value="insights" className="space-y-4">
              {insights && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 感情分析 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>感情プロファイル</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <div className="text-4xl mb-2">
                          {emotionEmojis[insights.mostCommonEmotion]}
                        </div>
                        <div className="font-semibold">
                          最も多い感情: {insights.mostCommonEmotion}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm">覚醒度 (エネルギー)</Label>
                          <Progress
                            value={((insights.averageArousal + 1) / 2) * 100}
                            className="h-2"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            {insights.averageArousal > 0 ? '高エネルギー' : '低エネルギー'}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm">感情価 (ポジティブ/ネガティブ)</Label>
                          <Progress
                            value={((insights.averageValence + 1) / 2) * 100}
                            className="h-2"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            {insights.averageValence > 0 ? 'ポジティブ傾向' : 'ネガティブ傾向'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 品質改善 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>録音品質の推移</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-2">
                          {insights.qualityImprovement > 0 ? '↗️' : insights.qualityImprovement < 0 ? '↘️' : '→'}
                          {Math.abs(Math.round(insights.qualityImprovement))}点
                        </div>
                        <div className="text-sm text-gray-600">
                          {insights.qualityImprovement > 0 ? '品質が向上しています' :
                           insights.qualityImprovement < 0 ? '品質が低下しています' :
                           '品質は安定しています'}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">よく使うカテゴリ</h4>
                        {insights.topCategories.slice(0, 3).map(({ category, count, percentage }) => (
                          <div key={category} className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              {categoryEmojis[category]} {category}
                            </span>
                            <span>{count}件 ({Math.round(percentage)}%)</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* トレンドタブ */}
            <TabsContent value="trends" className="space-y-4">
              {statistics?.monthlyTrends && (
                <Card>
                  <CardHeader>
                    <CardTitle>月次トレンド</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {statistics.monthlyTrends.map((trend) => (
                        <div key={trend.month} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{trend.month}</span>
                            <Badge variant="outline">
                              {emotionEmojis[trend.topEmotion]} {trend.topEmotion}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>メッセージ数: {trend.count}件</div>
                            <div>平均品質: {Math.round(trend.averageQuality)}点</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}