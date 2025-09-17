/**
 * テキスト読み上げ（Text-to-Speech）機能
 * Web Speech Synthesis API を使用
 */

export interface TextToSpeechOptions {
  language?: string
  voice?: SpeechSynthesisVoice
  rate?: number      // 話速 (0.1 - 10)
  pitch?: number     // ピッチ (0 - 2)
  volume?: number    // 音量 (0 - 1)
}

export interface SpeechQueueItem {
  id: string
  text: string
  options: TextToSpeechOptions
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: SpeechSynthesisErrorEvent) => void
}

export class TextToSpeechService {
  private synthesis: SpeechSynthesis
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private speechQueue: SpeechQueueItem[] = []
  private isProcessingQueue = false
  private defaultOptions: TextToSpeechOptions = {}

  constructor(options: TextToSpeechOptions = {}) {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech Synthesis API is not supported in this browser')
    }

    this.synthesis = window.speechSynthesis
    this.defaultOptions = {
      language: 'ja-JP',
      rate: 1.0,
      pitch: 1.0,
      volume: 0.8,
      ...options
    }
  }

  /**
   * テキストを即座に読み上げ
   */
  speak(text: string, options: TextToSpeechOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!text.trim()) {
        resolve()
        return
      }

      const utterance = this.createUtterance(text, options)

      utterance.onend = () => {
        this.currentUtterance = null
        resolve()
      }

      utterance.onerror = (event) => {
        this.currentUtterance = null
        reject(new Error(`Speech synthesis error: ${event.error}`))
      }

      this.currentUtterance = utterance
      this.synthesis.speak(utterance)
    })
  }

  /**
   * テキストを読み上げキューに追加
   */
  addToQueue(
    text: string,
    options: TextToSpeechOptions = {},
    callbacks: {
      onStart?: () => void
      onEnd?: () => void
      onError?: (error: SpeechSynthesisErrorEvent) => void
    } = {}
  ): string {
    const id = `speech-${Date.now()}-${Math.random()}`

    this.speechQueue.push({
      id,
      text,
      options: { ...this.defaultOptions, ...options },
      ...callbacks
    })

    if (!this.isProcessingQueue) {
      this.processQueue()
    }

    return id
  }

  /**
   * キューからアイテムを削除
   */
  removeFromQueue(id: string): boolean {
    const index = this.speechQueue.findIndex(item => item.id === id)
    if (index !== -1) {
      this.speechQueue.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * キューをクリア
   */
  clearQueue(): void {
    this.speechQueue = []
    this.isProcessingQueue = false
  }

  /**
   * 現在の読み上げを停止
   */
  stop(): void {
    if (this.synthesis.speaking) {
      this.synthesis.cancel()
    }
    this.currentUtterance = null
  }

  /**
   * 現在の読み上げを一時停止
   */
  pause(): void {
    if (this.synthesis.speaking && !this.synthesis.paused) {
      this.synthesis.pause()
    }
  }

  /**
   * 一時停止された読み上げを再開
   */
  resume(): void {
    if (this.synthesis.paused) {
      this.synthesis.resume()
    }
  }

  /**
   * 読み上げ中かどうか
   */
  isSpeaking(): boolean {
    return this.synthesis.speaking
  }

  /**
   * 一時停止中かどうか
   */
  isPaused(): boolean {
    return this.synthesis.paused
  }

  /**
   * 利用可能な音声を取得
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices()
  }

  /**
   * 指定した言語の音声を取得
   */
  getVoicesByLanguage(language: string): SpeechSynthesisVoice[] {
    return this.getAvailableVoices().filter(voice =>
      voice.lang.startsWith(language)
    )
  }

  /**
   * 日本語の音声を取得
   */
  getJapaneseVoices(): SpeechSynthesisVoice[] {
    return this.getVoicesByLanguage('ja')
  }

  /**
   * 推奨音声を取得
   */
  getRecommendedVoice(language: string = 'ja-JP'): SpeechSynthesisVoice | null {
    const voices = this.getVoicesByLanguage(language.split('-')[0])

    // ローカル音声を優先
    const localVoices = voices.filter(voice => voice.localService)
    if (localVoices.length > 0) {
      return localVoices[0]
    }

    // 完全一致する言語
    const exactMatch = voices.filter(voice => voice.lang === language)
    if (exactMatch.length > 0) {
      return exactMatch[0]
    }

    // 最初に見つかった音声
    return voices.length > 0 ? voices[0] : null
  }

  /**
   * メッセージテキストを自然な読み上げ用に前処理
   */
  preprocessText(text: string): string {
    return text
      // 絵文字を読み上げ可能なテキストに変換
      .replace(/👋/g, 'こんにちは')
      .replace(/🎵/g, '音楽')
      .replace(/🎤/g, 'マイク')
      .replace(/📝/g, 'メモ')
      .replace(/❤️/g, 'ハート')
      .replace(/😊/g, '笑顔')
      .replace(/🙏/g, 'お願い')
      .replace(/🎉/g, 'お祝い')
      .replace(/😌/g, '安心')
      .replace(/🤝/g, '握手')
      .replace(/💪/g, '力こぶ')
      // URL を「リンク」に置換
      .replace(/https?:\/\/[^\s]+/g, 'リンク')
      // 数字を読みやすく
      .replace(/(\d{4})-(\d{1,2})-(\d{1,2})/g, '$1年$2月$3日')
      .replace(/(\d{1,2}):(\d{1,2})/g, '$1時$2分')
      // 不要な記号を削除
      .replace(/[*_`~]/g, '')
      // 連続する空白を単一に
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * 音声メッセージのメタデータを読み上げ
   */
  speakMessageInfo(
    senderName: string,
    timestamp: Date,
    category?: string
  ): Promise<void> {
    let infoText = `${senderName}さんからのメッセージです。`

    if (category) {
      const categoryMap: Record<string, string> = {
        'thanks': '感謝',
        'congratulation': 'お祝い',
        'relief': '安心',
        'empathy': '共感',
        'love': '愛情',
        'encouragement': '励まし',
        'daily': '日常'
      }
      const categoryText = categoryMap[category] || category
      infoText += `カテゴリは${categoryText}です。`
    }

    const now = new Date()
    const diffHours = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60))

    if (diffHours === 0) {
      infoText += 'つい先ほど送信されました。'
    } else if (diffHours < 24) {
      infoText += `${diffHours}時間前に送信されました。`
    } else {
      const days = Math.floor(diffHours / 24)
      infoText += `${days}日前に送信されました。`
    }

    return this.speak(infoText, { rate: 1.1 })
  }

  /**
   * UIナビゲーションの読み上げ
   */
  speakNavigation(action: string, destination?: string): Promise<void> {
    let text = ''

    switch (action) {
      case 'tab_changed':
        text = `${destination}タブに移動しました`
        break
      case 'button_focused':
        text = `${destination}ボタン`
        break
      case 'menu_opened':
        text = 'メニューが開きました'
        break
      case 'menu_closed':
        text = 'メニューが閉じました'
        break
      case 'recording_started':
        text = '録音を開始しました'
        break
      case 'recording_stopped':
        text = '録音を停止しました'
        break
      case 'message_sent':
        text = 'メッセージを送信しました'
        break
      default:
        text = action
    }

    return this.speak(text, { rate: 1.2, volume: 0.6 })
  }

  /**
   * エラーメッセージの読み上げ
   */
  speakError(error: string): Promise<void> {
    const errorText = `エラーが発生しました。${error}`
    return this.speak(errorText, {
      rate: 0.9,
      pitch: 0.8,
      volume: 0.9
    })
  }

  /**
   * 成功メッセージの読み上げ
   */
  speakSuccess(message: string): Promise<void> {
    return this.speak(message, {
      rate: 1.1,
      pitch: 1.2,
      volume: 0.8
    })
  }

  /**
   * SpeechSynthesisUtteranceを作成
   */
  private createUtterance(text: string, options: TextToSpeechOptions): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(this.preprocessText(text))
    const finalOptions = { ...this.defaultOptions, ...options }

    utterance.lang = finalOptions.language || 'ja-JP'
    utterance.rate = finalOptions.rate || 1.0
    utterance.pitch = finalOptions.pitch || 1.0
    utterance.volume = finalOptions.volume || 0.8

    if (finalOptions.voice) {
      utterance.voice = finalOptions.voice
    } else {
      const recommendedVoice = this.getRecommendedVoice(utterance.lang)
      if (recommendedVoice) {
        utterance.voice = recommendedVoice
      }
    }

    return utterance
  }

  /**
   * キューを処理
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.speechQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.speechQueue.length > 0) {
      const item = this.speechQueue.shift()
      if (!item) break

      try {
        if (item.onStart) {
          item.onStart()
        }

        await this.speak(item.text, item.options)

        if (item.onEnd) {
          item.onEnd()
        }
      } catch (error) {
        if (item.onError) {
          item.onError(error as SpeechSynthesisErrorEvent)
        }
      }

      // 次のアイテムまで少し待機
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    this.isProcessingQueue = false
  }

  /**
   * デフォルト設定を更新
   */
  updateDefaultOptions(options: Partial<TextToSpeechOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options }
  }

  /**
   * サポート状況を確認
   */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false
    return 'speechSynthesis' in window
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.stop()
    this.clearQueue()
  }
}