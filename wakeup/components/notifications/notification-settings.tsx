'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { smartNotificationSystem, type NotificationSettings } from '@/lib/notifications/smart-notification-system'

interface NotificationSettingsProps {
  userId: string
  onSettingsChanged?: (settings: NotificationSettings) => void
}

export function NotificationSettingsComponent({ userId, onSettingsChanged }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const userSettings = await smartNotificationSystem.getUserSettings(userId)
      setSettings(userSettings)
    } catch (error) {
      console.error('通知設定の読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 設定の読み込み
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = async () => {
    if (!settings) return

    try {
      setSaving(true)
      await smartNotificationSystem.updateUserSettings(userId, settings)

      if (onSettingsChanged) {
        onSettingsChanged(settings)
      }

      alert('設定を保存しました！')
    } catch (error) {
      console.error('設定保存エラー:', error)
      alert('設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...updates })
  }

  const updateDoNotDisturb = (updates: Partial<NotificationSettings['doNotDisturb']>) => {
    if (!settings) return
    updateSettings({
      doNotDisturb: { ...settings.doNotDisturb, ...updates }
    })
  }

  const updatePriority = (updates: Partial<NotificationSettings['priority']>) => {
    if (!settings) return
    updateSettings({
      priority: { ...settings.priority, ...updates }
    })
  }

  const updateSchedule = (type: 'workdays' | 'weekends', updates: Partial<NotificationSettings['schedule']['workdays']>) => {
    if (!settings) return
    updateSettings({
      schedule: {
        ...settings.schedule,
        [type]: { ...settings.schedule[type], ...updates }
      }
    })
  }

  const addCustomRule = () => {
    if (!settings) return
    const newRule = {
      id: `rule-${Date.now()}`,
      name: '新しいルール',
      condition: 'time' as const,
      value: '22',
      action: 'delay' as const,
      enabled: true
    }
    updateSettings({
      customRules: [...settings.customRules, newRule]
    })
  }

  const updateCustomRule = (ruleId: string, updates: Partial<NotificationSettings['customRules'][0]>) => {
    if (!settings) return
    const updatedRules = settings.customRules.map(rule =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    )
    updateSettings({ customRules: updatedRules })
  }

  const deleteCustomRule = (ruleId: string) => {
    if (!settings) return
    const filteredRules = settings.customRules.filter(rule => rule.id !== ruleId)
    updateSettings({ customRules: filteredRules })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          <span className="ml-2">設定を読み込み中...</span>
        </CardContent>
      </Card>
    )
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">設定の読み込みに失敗しました</p>
          <Button onClick={loadSettings} className="mt-2">
            再試行
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔔 スマート通知設定
            <Badge variant="outline" className="text-xs">
              NEW
            </Badge>
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            時間帯や状況に応じて通知を自動調整します
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">基本設定</TabsTrigger>
              <TabsTrigger value="schedule">スケジュール</TabsTrigger>
              <TabsTrigger value="priority">優先度</TabsTrigger>
              <TabsTrigger value="custom">カスタムルール</TabsTrigger>
            </TabsList>

            {/* 基本設定タブ */}
            <TabsContent value="general" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Do Not Disturb</h3>

                <div className="flex items-center justify-between">
                  <Label>Do Not Disturb を有効にする</Label>
                  <Switch
                    checked={settings.doNotDisturb.enabled}
                    onCheckedChange={(checked) => updateDoNotDisturb({ enabled: checked })}
                  />
                </div>

                {settings.doNotDisturb.enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-blue-200">
                    <div>
                      <Label>開始時刻</Label>
                      <Input
                        type="time"
                        value={settings.doNotDisturb.startTime}
                        onChange={(e) => updateDoNotDisturb({ startTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>終了時刻</Label>
                      <Input
                        type="time"
                        value={settings.doNotDisturb.endTime}
                        onChange={(e) => updateDoNotDisturb({ endTime: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* スケジュール設定タブ */}
            <TabsContent value="schedule" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">平日設定</h3>

                <div className="flex items-center justify-between">
                  <Label>平日の静寂時間を有効にする</Label>
                  <Switch
                    checked={settings.schedule.workdays.enabled}
                    onCheckedChange={(checked) => updateSchedule('workdays', { enabled: checked })}
                  />
                </div>

                {settings.schedule.workdays.enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-green-200">
                    <div>
                      <Label>開始時刻（仕事開始）</Label>
                      <Input
                        type="time"
                        value={settings.schedule.workdays.quietHours.start}
                        onChange={(e) => updateSchedule('workdays', {
                          quietHours: { ...settings.schedule.workdays.quietHours, start: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label>終了時刻（仕事終了）</Label>
                      <Input
                        type="time"
                        value={settings.schedule.workdays.quietHours.end}
                        onChange={(e) => updateSchedule('workdays', {
                          quietHours: { ...settings.schedule.workdays.quietHours, end: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">週末設定</h3>

                <div className="flex items-center justify-between">
                  <Label>週末の静寂時間を有効にする</Label>
                  <Switch
                    checked={settings.schedule.weekends.enabled}
                    onCheckedChange={(checked) => updateSchedule('weekends', { enabled: checked })}
                  />
                </div>

                {settings.schedule.weekends.enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-purple-200">
                    <div>
                      <Label>開始時刻</Label>
                      <Input
                        type="time"
                        value={settings.schedule.weekends.quietHours.start}
                        onChange={(e) => updateSchedule('weekends', {
                          quietHours: { ...settings.schedule.weekends.quietHours, start: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label>終了時刻</Label>
                      <Input
                        type="time"
                        value={settings.schedule.weekends.quietHours.end}
                        onChange={(e) => updateSchedule('weekends', {
                          quietHours: { ...settings.schedule.weekends.quietHours, end: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 優先度設定タブ */}
            <TabsContent value="priority" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">優先通知</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  これらの通知は静寂時間中でも配信されます
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>緊急通知</Label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">システム緊急通知など</p>
                    </div>
                    <Switch
                      checked={settings.priority.emergency}
                      onCheckedChange={(checked) => updatePriority({ emergency: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>家族通知</Label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">家族からの音声メッセージ</p>
                    </div>
                    <Switch
                      checked={settings.priority.family}
                      onCheckedChange={(checked) => updatePriority({ family: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>メッセージリクエスト</Label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">新しいメッセージリクエスト</p>
                    </div>
                    <Switch
                      checked={settings.priority.requests}
                      onCheckedChange={(checked) => updatePriority({ requests: checked })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* カスタムルールタブ */}
            <TabsContent value="custom" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">カスタムルール</h3>
                <Button onClick={addCustomRule} size="sm">
                  + ルール追加
                </Button>
              </div>

              <div className="space-y-3">
                {settings.customRules.map((rule) => (
                  <div key={rule.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Input
                        value={rule.name}
                        onChange={(e) => updateCustomRule(rule.id, { name: e.target.value })}
                        className="flex-1 mr-2"
                        placeholder="ルール名"
                      />
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => updateCustomRule(rule.id, { enabled: checked })}
                      />
                      <Button
                        onClick={() => deleteCustomRule(rule.id)}
                        variant="outline"
                        size="sm"
                        className="ml-2"
                      >
                        削除
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={rule.condition}
                        onValueChange={(value) => updateCustomRule(rule.id, { condition: value as "content" | "time" | "sender" | "frequency" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="time">時間</SelectItem>
                          <SelectItem value="sender">送信者</SelectItem>
                          <SelectItem value="content">コンテンツ</SelectItem>
                          <SelectItem value="frequency">頻度</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        value={rule.value}
                        onChange={(e) => updateCustomRule(rule.id, { value: e.target.value })}
                        placeholder="値"
                      />

                      <Select
                        value={rule.action}
                        onValueChange={(value) => updateCustomRule(rule.id, { action: value as "allow" | "delay" | "suppress" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allow">許可</SelectItem>
                          <SelectItem value="delay">遅延</SelectItem>
                          <SelectItem value="suppress">抑制</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {settings.customRules.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>カスタムルールがありません</p>
                  <p className="text-xs">「ルール追加」ボタンで新しいルールを作成できます</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* 保存ボタン */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadSettings}>
                リセット
              </Button>
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    保存中...
                  </>
                ) : (
                  '💾 設定を保存'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}