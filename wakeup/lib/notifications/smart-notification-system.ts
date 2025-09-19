/**
 * スマート通知システム
 * 時間帯、活動状況、ユーザー設定を考慮した通知配信
 */

export interface NotificationSettings {
  userId: string
  doNotDisturb: {
    enabled: boolean
    startTime: string // HH:MM format
    endTime: string   // HH:MM format
  }
  priority: {
    emergency: boolean    // 緊急通知を常に受信
    family: boolean      // 家族からの通知を優先
    requests: boolean    // メッセージリクエストを通知
  }
  schedule: {
    workdays: {
      enabled: boolean
      quietHours: { start: string; end: string } // 仕事中の静寂時間
    }
    weekends: {
      enabled: boolean
      quietHours: { start: string; end: string } // 週末の静寂時間
    }
  }
  customRules: Array<{
    id: string
    name: string
    condition: 'time' | 'sender' | 'content' | 'frequency'
    value: string
    action: 'allow' | 'delay' | 'suppress'
    enabled: boolean
  }>
}

export interface SmartNotificationRequest {
  id: string
  userId: string
  senderId: string
  type: 'voice_message' | 'message_request' | 'system' | 'emergency'
  title: string
  message: string
  priority: 'low' | 'normal' | 'high' | 'emergency'
  metadata?: {
    senderName?: string
    category?: string
    qualityScore?: number
    isReply?: boolean
  }
  createdAt: Date
}

export interface NotificationDeliveryResult {
  delivered: boolean
  method: 'immediate' | 'delayed' | 'suppressed'
  delayUntil?: Date
  reason: string
}

export class SmartNotificationSystem {
  private userSettings = new Map<string, NotificationSettings>()

  /**
   * ユーザーの通知設定を取得
   */
  async getUserSettings(userId: string): Promise<NotificationSettings> {
    if (this.userSettings.has(userId)) {
      return this.userSettings.get(userId)!
    }

    // デフォルト設定
    const defaultSettings: NotificationSettings = {
      userId,
      doNotDisturb: {
        enabled: true,
        startTime: '22:00',
        endTime: '07:00'
      },
      priority: {
        emergency: true,
        family: true,
        requests: true
      },
      schedule: {
        workdays: {
          enabled: true,
          quietHours: { start: '09:00', end: '18:00' }
        },
        weekends: {
          enabled: false,
          quietHours: { start: '10:00', end: '20:00' }
        }
      },
      customRules: [
        {
          id: 'frequent-sender',
          name: '頻繁な送信者の抑制',
          condition: 'frequency',
          value: '5', // 1時間に5回以上
          action: 'delay',
          enabled: true
        },
        {
          id: 'low-quality-suppress',
          name: '低品質音声の抑制',
          condition: 'content',
          value: '30', // 品質スコア30以下
          action: 'suppress',
          enabled: false
        }
      ]
    }

    this.userSettings.set(userId, defaultSettings)
    return defaultSettings
  }

  /**
   * ユーザーの通知設定を更新
   */
  async updateUserSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
    const currentSettings = await this.getUserSettings(userId)
    const updatedSettings = { ...currentSettings, ...settings, userId }
    this.userSettings.set(userId, updatedSettings)
  }

  /**
   * スマート通知配信を処理
   */
  async processNotification(request: SmartNotificationRequest): Promise<NotificationDeliveryResult> {
    const settings = await this.getUserSettings(request.userId)

    // 緊急通知は常に配信
    if (request.priority === 'emergency' && settings.priority.emergency) {
      return {
        delivered: true,
        method: 'immediate',
        reason: '緊急通知のため即座に配信'
      }
    }

    // Do Not Disturb チェック
    const dndResult = this.checkDoNotDisturb(settings, new Date())
    if (dndResult.blocked) {
      // 家族からの通知で優先設定が有効な場合は例外
      if (settings.priority.family && this.isFamilyNotification(request)) {
        return {
          delivered: true,
          method: 'immediate',
          reason: '家族からの優先通知'
        }
      }

      return {
        delivered: false,
        method: 'delayed',
        delayUntil: dndResult.resumeAt,
        reason: `Do Not Disturb期間中（${dndResult.reason}）`
      }
    }

    // 勤務時間チェック
    const workResult = this.checkWorkHours(settings, new Date())
    if (workResult.inQuietHours) {
      if (request.priority === 'high' || this.isFamilyNotification(request)) {
        // 高優先度または家族通知は配信
        return {
          delivered: true,
          method: 'immediate',
          reason: '高優先度または家族通知のため配信'
        }
      }

      return {
        delivered: false,
        method: 'delayed',
        delayUntil: workResult.resumeAt,
        reason: `静寂時間中（${workResult.reason}）`
      }
    }

    // カスタムルールチェック
    const customResult = this.checkCustomRules(settings, request)
    if (customResult.action !== 'allow') {
      return {
        delivered: customResult.action !== 'suppress',
        method: customResult.action as 'delayed' | 'suppressed',
        delayUntil: customResult.delayUntil,
        reason: customResult.reason
      }
    }

    // すべてのチェックをパス - 即座に配信
    return {
      delivered: true,
      method: 'immediate',
      reason: 'すべての条件をクリア'
    }
  }

  /**
   * Do Not Disturb期間チェック
   */
  private checkDoNotDisturb(settings: NotificationSettings, now: Date): {
    blocked: boolean
    reason: string
    resumeAt?: Date
  } {
    if (!settings.doNotDisturb.enabled) {
      return { blocked: false, reason: 'DND無効' }
    }

    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const startTime = settings.doNotDisturb.startTime
    const endTime = settings.doNotDisturb.endTime

    const inDndPeriod = this.isTimeInRange(currentTime, startTime, endTime)

    if (inDndPeriod) {
      const resumeAt = this.calculateResumeTime(now, endTime)
      return {
        blocked: true,
        reason: `Do Not Disturb期間（${startTime}-${endTime}）`,
        resumeAt
      }
    }

    return { blocked: false, reason: 'DND期間外' }
  }

  /**
   * 勤務時間チェック
   */
  private checkWorkHours(settings: NotificationSettings, now: Date): {
    inQuietHours: boolean
    reason: string
    resumeAt?: Date
  } {
    const isWeekend = now.getDay() === 0 || now.getDay() === 6
    const schedule = isWeekend ? settings.schedule.weekends : settings.schedule.workdays

    if (!schedule.enabled) {
      return { inQuietHours: false, reason: 'スケジュール無効' }
    }

    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const inQuietHours = this.isTimeInRange(currentTime, schedule.quietHours.start, schedule.quietHours.end)

    if (inQuietHours) {
      const resumeAt = this.calculateResumeTime(now, schedule.quietHours.end)
      return {
        inQuietHours: true,
        reason: `${isWeekend ? '週末' : '平日'}の静寂時間（${schedule.quietHours.start}-${schedule.quietHours.end}）`,
        resumeAt
      }
    }

    return { inQuietHours: false, reason: '静寂時間外' }
  }

  /**
   * カスタムルールチェック
   */
  private checkCustomRules(settings: NotificationSettings, request: SmartNotificationRequest): {
    action: 'allow' | 'delay' | 'suppress'
    reason: string
    delayUntil?: Date
  } {
    for (const rule of settings.customRules) {
      if (!rule.enabled) continue

      const ruleResult = this.evaluateCustomRule(rule, request)
      if (ruleResult.matches) {
        const delayUntil = rule.action === 'delay'
          ? new Date(Date.now() + 30 * 60 * 1000) // 30分後
          : undefined

        return {
          action: rule.action,
          reason: `カスタムルール適用: ${rule.name}`,
          delayUntil
        }
      }
    }

    return { action: 'allow', reason: 'カスタムルール適用なし' }
  }

  /**
   * カスタムルールの評価
   */
  private evaluateCustomRule(rule: NotificationSettings['customRules'][0], request: SmartNotificationRequest): {
    matches: boolean
  } {
    switch (rule.condition) {
      case 'time':
        // 時間ベースのルール（例: 深夜時間帯）
        const currentHour = new Date().getHours()
        const targetHour = parseInt(rule.value)
        return { matches: currentHour >= targetHour }

      case 'sender':
        // 送信者ベースのルール
        return { matches: request.senderId === rule.value }

      case 'content':
        // コンテンツベースのルール（品質スコアなど）
        const qualityThreshold = parseInt(rule.value)
        const actualScore = request.metadata?.qualityScore || 100
        return { matches: actualScore <= qualityThreshold }

      case 'frequency':
        // 頻度ベースのルール（実装は簡略化）
        // 実際には過去の通知履歴を確認する必要があります
        return { matches: false }

      default:
        return { matches: false }
    }
  }

  /**
   * 家族通知かどうかを判定
   */
  private isFamilyNotification(request: SmartNotificationRequest): boolean {
    // 簡略化: 実際には家族関係を確認する必要があります
    return request.type === 'voice_message' && request.metadata?.senderName !== undefined
  }

  /**
   * 時間が範囲内かチェック
   */
  private isTimeInRange(current: string, start: string, end: string): boolean {
    const currentMinutes = this.timeToMinutes(current)
    const startMinutes = this.timeToMinutes(start)
    const endMinutes = this.timeToMinutes(end)

    if (startMinutes <= endMinutes) {
      // 同日内の範囲
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes
    } else {
      // 日をまたぐ範囲
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes
    }
  }

  /**
   * 時間を分単位に変換
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * 再開時間を計算
   */
  private calculateResumeTime(now: Date, endTime: string): Date {
    const [hours, minutes] = endTime.split(':').map(Number)
    const resumeDate = new Date(now)
    resumeDate.setHours(hours, minutes, 0, 0)

    // 終了時間が現在時刻より前の場合、翌日にする
    if (resumeDate <= now) {
      resumeDate.setDate(resumeDate.getDate() + 1)
    }

    return resumeDate
  }

  /**
   * 遅延配信の処理
   */
  async processDelayedNotifications(): Promise<void> {
    // 実装: 遅延された通知を定期的にチェックして配信
    console.log('遅延通知の処理を実行中...')
  }

  /**
   * 通知統計の取得
   */
  async getNotificationStats(): Promise<{
    total: number
    delivered: number
    delayed: number
    suppressed: number
    byType: Record<string, number>
  }> {
    // 実装: 通知統計の集計
    return {
      total: 0,
      delivered: 0,
      delayed: 0,
      suppressed: 0,
      byType: {}
    }
  }
}

// シングルトンインスタンス
export const smartNotificationSystem = new SmartNotificationSystem()