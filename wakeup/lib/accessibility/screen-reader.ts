/**
 * Screen Reader Support Utilities
 * スクリーンリーダー対応のためのユーティリティ関数群
 */

export class ScreenReaderAnnouncer {
  private static instance: ScreenReaderAnnouncer
  private announcementRegion: HTMLElement | null = null

  private constructor() {
    this.initializeAnnouncementRegion()
  }

  static getInstance(): ScreenReaderAnnouncer {
    if (!ScreenReaderAnnouncer.instance) {
      ScreenReaderAnnouncer.instance = new ScreenReaderAnnouncer()
    }
    return ScreenReaderAnnouncer.instance
  }

  private initializeAnnouncementRegion() {
    if (typeof window === 'undefined') return

    // Create live region for screen reader announcements
    this.announcementRegion = document.createElement('div')
    this.announcementRegion.id = 'sr-announcement-region'
    this.announcementRegion.setAttribute('aria-live', 'polite')
    this.announcementRegion.setAttribute('aria-atomic', 'true')
    this.announcementRegion.className = 'sr-only absolute -left-[10000px] w-1 h-1 overflow-hidden'

    document.body.appendChild(this.announcementRegion)
  }

  /**
   * Announce message to screen readers
   * @param message - Message to announce
   * @param priority - Announcement priority ('polite' | 'assertive')
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.announcementRegion) {
      this.initializeAnnouncementRegion()
    }

    if (this.announcementRegion) {
      this.announcementRegion.setAttribute('aria-live', priority)
      this.announcementRegion.textContent = message

      // Clear after announcement to allow repeated messages
      setTimeout(() => {
        if (this.announcementRegion) {
          this.announcementRegion.textContent = ''
        }
      }, 1000)
    }
  }

  /**
   * Announce recording status changes
   */
  announceRecordingStart(duration?: number) {
    const message = duration
      ? `音声録音を開始しました。最大${duration}秒まで録音できます。`
      : '音声録音を開始しました。'
    this.announce(message, 'assertive')
  }

  announceRecordingStop(duration: number) {
    this.announce(`音声録音を停止しました。録音時間: ${Math.round(duration)}秒`, 'assertive')
  }

  announceRecordingError(error: string) {
    this.announce(`録音エラーが発生しました: ${error}`, 'assertive')
  }

  /**
   * Announce playback status
   */
  announcePlaybackStart(duration: number) {
    this.announce(`音声メッセージの再生を開始しました。再生時間: ${Math.round(duration)}秒`)
  }

  announcePlaybackEnd() {
    this.announce('音声メッセージの再生が完了しました。')
  }

  /**
   * Announce collaboration events
   */
  announceUserJoined(userName: string) {
    this.announce(`${userName}さんがルームに参加しました。`)
  }

  announceUserLeft(userName: string) {
    this.announce(`${userName}さんがルームから退出しました。`)
  }

  announceNewMessage(userName: string, duration: number) {
    this.announce(`${userName}さんから新しい音声メッセージが届きました。再生時間: ${Math.round(duration)}秒`)
  }

  announceTypingStart(userName: string) {
    this.announce(`${userName}さんが録音中です。`)
  }

  /**
   * Announce connectivity status
   */
  announceConnectionStatus(isConnected: boolean) {
    const message = isConnected
      ? 'オンラインに接続されました。'
      : 'オフラインになりました。'
    this.announce(message, 'assertive')
  }
}

/**
 * ARIA label generators for common UI elements
 */
export const AriaLabels = {
  recordButton: (isRecording: boolean) =>
    isRecording ? '録音を停止' : '音声録音を開始',

  playButton: (duration?: number) =>
    duration ? `音声を再生 (${Math.round(duration)}秒)` : '音声を再生',

  pauseButton: () => '再生を一時停止',

  stopButton: () => '再生を停止',

  muteButton: (isMuted: boolean) =>
    isMuted ? 'ミュートを解除' : 'ミュート',

  volumeSlider: (volume: number) =>
    `音量調整 (現在: ${Math.round(volume * 100)}%)`,

  progressSlider: (current: number, total: number) =>
    `再生位置 (${Math.round(current)}秒 / ${Math.round(total)}秒)`,

  userStatus: (name: string, status: string) =>
    `${name}さん (${status})`,

  messageItem: (sender: string, duration: number, timestamp: Date) => {
    const timeStr = timestamp.toLocaleTimeString()
    return `${sender}さんからの音声メッセージ、${Math.round(duration)}秒、${timeStr}`
  }
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private static focusStack: HTMLElement[] = []

  static saveFocus() {
    const activeElement = document.activeElement as HTMLElement
    if (activeElement) {
      this.focusStack.push(activeElement)
    }
  }

  static restoreFocus() {
    const lastFocused = this.focusStack.pop()
    if (lastFocused && lastFocused instanceof Node && document.contains(lastFocused)) {
      if (lastFocused instanceof HTMLElement) {
        lastFocused.focus()
      }
    }
  }

  static trapFocus(container: HTMLElement) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)
    firstElement.focus()

    return () => {
      container.removeEventListener('keydown', handleTabKey)
    }
  }
}