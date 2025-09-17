/**
 * キーボードナビゲーション機能
 * アクセシビリティ対応のキーボード操作システム
 */

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  action: string
  description: string
  handler: (event: KeyboardEvent) => void
}

export interface NavigationElement {
  element: HTMLElement
  id: string
  tabIndex: number
  label: string
  type: 'button' | 'input' | 'tab' | 'menu' | 'link' | 'custom'
  group?: string
}

export class KeyboardNavigationService {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private navigationElements: NavigationElement[] = []
  private currentFocusIndex = -1
  private isActive = false
  private onFocusChange?: (element: NavigationElement | null, index: number) => void
  private onShortcutTriggered?: (shortcut: KeyboardShortcut) => void

  constructor() {
    this.setupDefaultShortcuts()
  }

  /**
   * デフォルトのキーボードショートカットを設定
   */
  private setupDefaultShortcuts(): void {
    const defaultShortcuts: Omit<KeyboardShortcut, 'handler'>[] = [
      // 基本ナビゲーション
      { key: 'Tab', action: 'focus_next', description: '次の要素にフォーカス' },
      { key: 'Tab', shiftKey: true, action: 'focus_previous', description: '前の要素にフォーカス' },
      { key: 'Enter', action: 'activate', description: '選択された要素を実行' },
      { key: ' ', action: 'activate', description: '選択された要素を実行（スペース）' },
      { key: 'Escape', action: 'escape', description: 'メニューを閉じる・キャンセル' },

      // アプリケーション固有
      { key: 'r', ctrlKey: true, action: 'start_recording', description: '録音開始/停止' },
      { key: 'p', ctrlKey: true, action: 'play_pause', description: '再生/一時停止' },
      { key: 's', ctrlKey: true, action: 'send_message', description: 'メッセージ送信' },
      { key: 'n', ctrlKey: true, action: 'new_message', description: '新しいメッセージ' },

      // タブナビゲーション
      { key: '1', ctrlKey: true, action: 'tab_chat', description: '音声チャットタブ' },
      { key: '2', ctrlKey: true, action: 'tab_family', description: '家族管理タブ' },
      { key: '3', ctrlKey: true, action: 'tab_requests', description: 'リクエストタブ' },
      { key: '4', ctrlKey: true, action: 'tab_send', description: 'メッセージ送信タブ' },
      { key: '5', ctrlKey: true, action: 'tab_advanced', description: '高品質録音タブ' },
      { key: '6', ctrlKey: true, action: 'tab_received', description: '受信済みタブ' },
      { key: '7', ctrlKey: true, action: 'tab_sent', description: '送信済みタブ' },
      { key: '8', ctrlKey: true, action: 'tab_settings', description: '設定タブ' },

      // 読み上げ
      { key: 'F1', action: 'read_help', description: 'ヘルプを読み上げ' },
      { key: 'F2', action: 'read_current', description: '現在の要素を読み上げ' },
      { key: 'F3', action: 'stop_speech', description: '読み上げ停止' },

      // その他
      { key: '?', shiftKey: true, action: 'show_shortcuts', description: 'ショートカット一覧表示' },
      { key: 'h', ctrlKey: true, action: 'toggle_navigation_help', description: 'ナビゲーションヘルプ切り替え' },
    ]

    defaultShortcuts.forEach(shortcut => {
      this.addShortcut({
        ...shortcut,
        handler: this.createDefaultHandler(shortcut.action)
      })
    })
  }

  /**
   * デフォルトハンドラーを作成
   */
  private createDefaultHandler(action: string): (event: KeyboardEvent) => void {
    return (event: KeyboardEvent) => {
      event.preventDefault()

      switch (action) {
        case 'focus_next':
          this.focusNext()
          break
        case 'focus_previous':
          this.focusPrevious()
          break
        case 'activate':
          this.activateCurrentElement()
          break
        case 'escape':
          this.handleEscape()
          break
        case 'show_shortcuts':
          this.showShortcutHelp()
          break
        default:
          // アプリケーション固有のアクションは外部で処理
          if (this.onShortcutTriggered) {
            const shortcut = this.getShortcutByAction(action)
            if (shortcut) {
              this.onShortcutTriggered(shortcut)
            }
          }
      }
    }
  }

  /**
   * キーボードショートカットを追加
   */
  addShortcut(shortcut: KeyboardShortcut): void {
    const key = this.createShortcutKey(shortcut)
    this.shortcuts.set(key, shortcut)
  }

  /**
   * キーボードショートカットを削除
   */
  removeShortcut(key: string, modifiers: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}): void {
    const shortcutKey = this.createShortcutKey({ key, ...modifiers } as KeyboardShortcut)
    this.shortcuts.delete(shortcutKey)
  }

  /**
   * ナビゲーション要素を登録
   */
  registerNavigationElements(elements: NavigationElement[]): void {
    this.navigationElements = elements.sort((a, b) => a.tabIndex - b.tabIndex)
  }

  /**
   * ナビゲーション要素を追加
   */
  addNavigationElement(element: NavigationElement): void {
    this.navigationElements.push(element)
    this.navigationElements.sort((a, b) => a.tabIndex - b.tabIndex)
  }

  /**
   * ナビゲーション要素を削除
   */
  removeNavigationElement(id: string): void {
    this.navigationElements = this.navigationElements.filter(el => el.id !== id)
  }

  /**
   * キーボードナビゲーションを開始
   */
  activate(
    onFocusChange?: (element: NavigationElement | null, index: number) => void,
    onShortcutTriggered?: (shortcut: KeyboardShortcut) => void
  ): void {
    if (this.isActive) return

    this.isActive = true
    this.onFocusChange = onFocusChange
    this.onShortcutTriggered = onShortcutTriggered

    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('focusin', this.handleFocusIn)

    // 最初の要素にフォーカス
    if (this.navigationElements.length > 0) {
      this.focusElement(0)
    }
  }

  /**
   * キーボードナビゲーションを停止
   */
  deactivate(): void {
    if (!this.isActive) return

    this.isActive = false
    this.currentFocusIndex = -1

    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('focusin', this.handleFocusIn)
  }

  /**
   * 次の要素にフォーカス
   */
  focusNext(): void {
    if (this.navigationElements.length === 0) return

    let nextIndex = this.currentFocusIndex + 1
    if (nextIndex >= this.navigationElements.length) {
      nextIndex = 0
    }

    this.focusElement(nextIndex)
  }

  /**
   * 前の要素にフォーカス
   */
  focusPrevious(): void {
    if (this.navigationElements.length === 0) return

    let previousIndex = this.currentFocusIndex - 1
    if (previousIndex < 0) {
      previousIndex = this.navigationElements.length - 1
    }

    this.focusElement(previousIndex)
  }

  /**
   * 指定した要素にフォーカス
   */
  focusElement(index: number): void {
    if (index < 0 || index >= this.navigationElements.length) return

    const element = this.navigationElements[index]
    element.element.focus()

    this.currentFocusIndex = index

    if (this.onFocusChange) {
      this.onFocusChange(element, index)
    }
  }

  /**
   * IDで要素にフォーカス
   */
  focusElementById(id: string): boolean {
    const index = this.navigationElements.findIndex(el => el.id === id)
    if (index !== -1) {
      this.focusElement(index)
      return true
    }
    return false
  }

  /**
   * 現在の要素を実行
   */
  activateCurrentElement(): void {
    if (this.currentFocusIndex === -1) return

    const element = this.navigationElements[this.currentFocusIndex]
    if (element.element) {
      element.element.click()
    }
  }

  /**
   * エスケープキー処理
   */
  private handleEscape(): void {
    // モーダルやメニューが開いている場合は閉じる
    const openModals = document.querySelectorAll('[role="dialog"][open], [role="menu"][open]')
    if (openModals.length > 0) {
      const lastModal = openModals[openModals.length - 1] as HTMLElement
      const closeButton = lastModal.querySelector('[data-close], .close, [aria-label*="閉じる"]') as HTMLElement
      if (closeButton) {
        closeButton.click()
      }
    }

    // フォーカスをボディに戻す
    document.body.focus()
  }

  /**
   * ショートカットヘルプを表示
   */
  private showShortcutHelp(): void {
    const shortcuts = Array.from(this.shortcuts.values())
    const helpText = shortcuts
      .map(shortcut => {
        const keys = []
        if (shortcut.ctrlKey) keys.push('Ctrl')
        if (shortcut.altKey) keys.push('Alt')
        if (shortcut.shiftKey) keys.push('Shift')
        if (shortcut.metaKey) keys.push('Meta')
        keys.push(shortcut.key)

        return `${keys.join(' + ')}: ${shortcut.description}`
      })
      .join('\n')

    alert(`キーボードショートカット:\n\n${helpText}`)
  }

  /**
   * キーダウンイベント処理
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    const shortcutKey = this.createShortcutKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    } as KeyboardShortcut)

    const shortcut = this.shortcuts.get(shortcutKey)
    if (shortcut) {
      shortcut.handler(event)
    }
  }

  /**
   * フォーカスインイベント処理
   */
  private handleFocusIn = (event: FocusEvent): void => {
    const target = event.target as HTMLElement
    const index = this.navigationElements.findIndex(el => el.element === target)

    if (index !== -1) {
      this.currentFocusIndex = index

      if (this.onFocusChange) {
        this.onFocusChange(this.navigationElements[index], index)
      }
    }
  }

  /**
   * ショートカットキーを作成
   */
  private createShortcutKey(shortcut: Pick<KeyboardShortcut, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string {
    const modifiers = []
    if (shortcut.ctrlKey) modifiers.push('Ctrl')
    if (shortcut.altKey) modifiers.push('Alt')
    if (shortcut.shiftKey) modifiers.push('Shift')
    if (shortcut.metaKey) modifiers.push('Meta')

    return [...modifiers, shortcut.key].join('+')
  }

  /**
   * アクションでショートカットを取得
   */
  private getShortcutByAction(action: string): KeyboardShortcut | undefined {
    return Array.from(this.shortcuts.values()).find(shortcut => shortcut.action === action)
  }

  /**
   * 現在フォーカス中の要素を取得
   */
  getCurrentElement(): NavigationElement | null {
    if (this.currentFocusIndex === -1) return null
    return this.navigationElements[this.currentFocusIndex] || null
  }

  /**
   * すべてのショートカットを取得
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * 特定のグループの要素を取得
   */
  getElementsByGroup(group: string): NavigationElement[] {
    return this.navigationElements.filter(el => el.group === group)
  }

  /**
   * アクティブ状態を取得
   */
  isNavigationActive(): boolean {
    return this.isActive
  }

  /**
   * ARIA属性を要素に設定
   */
  static setupAccessibilityAttributes(element: HTMLElement, options: {
    role?: string
    label?: string
    description?: string
    expanded?: boolean
    selected?: boolean
    disabled?: boolean
  }): void {
    if (options.role) {
      element.setAttribute('role', options.role)
    }
    if (options.label) {
      element.setAttribute('aria-label', options.label)
    }
    if (options.description) {
      element.setAttribute('aria-describedby', options.description)
    }
    if (options.expanded !== undefined) {
      element.setAttribute('aria-expanded', options.expanded.toString())
    }
    if (options.selected !== undefined) {
      element.setAttribute('aria-selected', options.selected.toString())
    }
    if (options.disabled !== undefined) {
      element.setAttribute('aria-disabled', options.disabled.toString())
    }
  }

  /**
   * フォーカス可能な要素を自動検出
   */
  static findFocusableElements(container: HTMLElement = document.body): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="tab"]:not([aria-disabled="true"])',
      '[role="menuitem"]:not([aria-disabled="true"])'
    ].join(',')

    return Array.from(container.querySelectorAll(focusableSelectors))
  }
}

// シングルトンインスタンス
export const keyboardNavigationService = new KeyboardNavigationService()