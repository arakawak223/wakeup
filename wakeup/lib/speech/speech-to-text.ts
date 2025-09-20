/**
 * Speech-to-Text機能 - Web Speech API & リアルタイム音声転写
 */

export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
  timestamp: number
  alternatives?: Array<{
    transcript: string
    confidence: number
  }>
}

export interface SpeechRecognitionConfig {
  language: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  audioSource?: MediaStream
}

export interface SpeechToTextManager {
  start(): Promise<void>
  stop(): void
  pause(): void
  resume(): void
  isSupported(): boolean
  isListening(): boolean
  getPartialResults(): string
  getFinalResults(): SpeechRecognitionResult[]
}

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

export class WebSpeechToText implements SpeechToTextManager {
  private recognition: SpeechRecognition | null = null
  private isActive = false
  private isPaused = false
  private partialText = ''
  private finalResults: SpeechRecognitionResult[] = []
  private config: SpeechRecognitionConfig
  private onResultCallback?: (result: SpeechRecognitionResult) => void
  private onErrorCallback?: (error: string) => void
  private onStatusCallback?: (status: 'started' | 'stopped' | 'paused' | 'error') => void

  constructor(config: Partial<SpeechRecognitionConfig> = {}) {
    this.config = {
      language: 'ja-JP',
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      ...config
    }
  }

  isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }

  isListening(): boolean {
    return this.isActive && !this.isPaused
  }

  async start(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Web Speech APIはこのブラウザでサポートされていません')
    }

    if (this.isActive) {
      return
    }

    try {
      // SpeechRecognitionインスタンスの作成
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      this.recognition = new SpeechRecognition()

      // 設定を適用
      this.recognition.lang = this.config.language
      this.recognition.continuous = this.config.continuous
      this.recognition.interimResults = this.config.interimResults
      this.recognition.maxAlternatives = this.config.maxAlternatives

      // イベントリスナーの設定
      this.setupEventListeners()

      // 音声認識開始
      this.recognition.start()
      this.isActive = true
      this.isPaused = false

      console.log('音声認識を開始しました')
      this.onStatusCallback?.('started')
    } catch (error) {
      console.error('音声認識開始エラー:', error)
      this.onErrorCallback?.('音声認識の開始に失敗しました')
      throw error
    }
  }

  stop(): void {
    if (this.recognition && this.isActive) {
      this.recognition.stop()
      this.isActive = false
      this.isPaused = false
      console.log('音声認識を停止しました')
      this.onStatusCallback?.('stopped')
    }
  }

  pause(): void {
    if (this.recognition && this.isActive && !this.isPaused) {
      this.recognition.stop()
      this.isPaused = true
      console.log('音声認識を一時停止しました')
      this.onStatusCallback?.('paused')
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.start().catch(error => {
        console.error('音声認識再開エラー:', error)
        this.onErrorCallback?.('音声認識の再開に失敗しました')
      })
    }
  }

  getPartialResults(): string {
    return this.partialText
  }

  getFinalResults(): SpeechRecognitionResult[] {
    return [...this.finalResults]
  }

  // コールバック設定
  onResult(callback: (result: SpeechRecognitionResult) => void): void {
    this.onResultCallback = callback
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback
  }

  onStatus(callback: (status: 'started' | 'stopped' | 'paused' | 'error') => void): void {
    this.onStatusCallback = callback
  }

  // 結果をクリア
  clearResults(): void {
    this.partialText = ''
    this.finalResults = []
  }

  private setupEventListeners(): void {
    if (!this.recognition) return

    // 結果受信時
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let partialTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          // 確定結果
          const finalResult: SpeechRecognitionResult = {
            transcript: transcript.trim(),
            confidence: result[0].confidence || 0,
            isFinal: true,
            timestamp: Date.now(),
            alternatives: Array.from(result).map(alt => ({
              transcript: alt.transcript,
              confidence: alt.confidence || 0
            }))
          }

          this.finalResults.push(finalResult)
          this.onResultCallback?.(finalResult)
          console.log('確定結果:', finalResult.transcript)
        } else {
          // 暫定結果
          partialTranscript += transcript
        }
      }

      if (partialTranscript !== this.partialText) {
        this.partialText = partialTranscript
        const partialResult: SpeechRecognitionResult = {
          transcript: partialTranscript.trim(),
          confidence: 0,
          isFinal: false,
          timestamp: Date.now()
        }

        this.onResultCallback?.(partialResult)
        console.log('暫定結果:', partialResult.transcript)
      }
    }

    // エラー処理
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('音声認識エラー:', event.error, event.message)

      let errorMessage = '音声認識でエラーが発生しました'

      switch (event.error) {
        case 'no-speech':
          errorMessage = '音声が検出されませんでした'
          break
        case 'audio-capture':
          errorMessage = 'マイクにアクセスできませんでした'
          break
        case 'not-allowed':
          errorMessage = 'マイクへのアクセスが拒否されました'
          break
        case 'network':
          errorMessage = 'ネットワークエラーが発生しました'
          break
        case 'language-not-supported':
          errorMessage = '指定された言語はサポートされていません'
          break
        case 'service-not-allowed':
          errorMessage = '音声認識サービスが利用できません'
          break
      }

      this.onErrorCallback?.(errorMessage)
      this.onStatusCallback?.('error')
    }

    // 音声認識開始時
    this.recognition.onstart = () => {
      console.log('音声認識が開始されました')
    }

    // 音声認識終了時
    this.recognition.onend = () => {
      console.log('音声認識が終了しました')

      if (this.isActive && !this.isPaused && this.config.continuous) {
        // 継続モードの場合、自動的に再開
        setTimeout(() => {
          if (this.isActive && !this.isPaused) {
            this.recognition?.start()
          }
        }, 100)
      } else {
        this.isActive = false
        this.onStatusCallback?.('stopped')
      }
    }

    // 音声入力開始時
    this.recognition.onspeechstart = () => {
      console.log('音声入力を検出しました')
    }

    // 音声入力終了時
    this.recognition.onspeechend = () => {
      console.log('音声入力が終了しました')
    }
  }
}

// リアルタイム音声転写クラス
export class RealtimeSpeechTranscription {
  private speechToText: WebSpeechToText
  private isTranscribing = false
  private transcriptHistory: SpeechRecognitionResult[] = []
  private onTranscriptCallback?: (transcript: string, isFinal: boolean) => void
  private onErrorCallback?: (error: string) => void

  constructor(language: string = 'ja-JP') {
    this.speechToText = new WebSpeechToText({
      language,
      continuous: true,
      interimResults: true,
      maxAlternatives: 1
    })

    this.setupCallbacks()
  }

  async startTranscription(): Promise<void> {
    if (this.isTranscribing) return

    try {
      if (!this.speechToText.isSupported()) {
        throw new Error('お使いのブラウザは音声認識をサポートしていません')
      }

      await this.speechToText.start()
      this.isTranscribing = true
      console.log('リアルタイム音声転写を開始しました')
    } catch (error) {
      console.error('音声転写開始エラー:', error)
      this.onErrorCallback?.(error instanceof Error ? error.message : '音声転写の開始に失敗しました')
      throw error
    }
  }

  stopTranscription(): void {
    if (!this.isTranscribing) return

    this.speechToText.stop()
    this.isTranscribing = false
    console.log('リアルタイム音声転写を停止しました')
  }

  isActive(): boolean {
    return this.isTranscribing
  }

  getFullTranscript(): string {
    const finalResults = this.speechToText.getFinalResults()
    return finalResults.map(result => result.transcript).join(' ')
  }

  getCurrentTranscript(): string {
    const finalTranscript = this.getFullTranscript()
    const partialTranscript = this.speechToText.getPartialResults()

    return finalTranscript + (partialTranscript ? ' ' + partialTranscript : '')
  }

  clearTranscript(): void {
    this.speechToText.clearResults()
    this.transcriptHistory = []
  }

  getTranscriptHistory(): SpeechRecognitionResult[] {
    return [...this.transcriptHistory]
  }

  // コールバック設定
  onTranscript(callback: (transcript: string, isFinal: boolean) => void): void {
    this.onTranscriptCallback = callback
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback
  }

  private setupCallbacks(): void {
    this.speechToText.onResult((result) => {
      this.transcriptHistory.push(result)

      if (result.isFinal) {
        this.onTranscriptCallback?.(this.getFullTranscript(), true)
      } else {
        this.onTranscriptCallback?.(this.getCurrentTranscript(), false)
      }
    })

    this.speechToText.onError((error) => {
      this.onErrorCallback?.(error)
    })

    this.speechToText.onStatus((status) => {
      if (status === 'stopped' || status === 'error') {
        this.isTranscribing = false
      }
    })
  }
}

// ユーティリティ関数
export const speechUtils = {
  // サポートされている言語のチェック
  getSupportedLanguages(): string[] {
    return [
      'ja-JP',    // 日本語
      'en-US',    // 英語（米国）
      'en-GB',    // 英語（英国）
      'ko-KR',    // 韓国語
      'zh-CN',    // 中国語（簡体）
      'zh-TW',    // 中国語（繁体）
      'es-ES',    // スペイン語
      'fr-FR',    // フランス語
      'de-DE',    // ドイツ語
      'it-IT',    // イタリア語
      'pt-BR',    // ポルトガル語（ブラジル）
      'ru-RU',    // ロシア語
      'ar-SA',    // アラビア語
    ]
  },

  // 言語名の取得
  getLanguageName(languageCode: string): string {
    const languageNames: Record<string, string> = {
      'ja-JP': '日本語',
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'ko-KR': '한국어',
      'zh-CN': '中文（简体）',
      'zh-TW': '中文（繁體）',
      'es-ES': 'Español',
      'fr-FR': 'Français',
      'de-DE': 'Deutsch',
      'it-IT': 'Italiano',
      'pt-BR': 'Português (Brasil)',
      'ru-RU': 'Русский',
      'ar-SA': 'العربية'
    }

    return languageNames[languageCode] || languageCode
  },

  // ブラウザサポートのチェック
  checkBrowserSupport(): {
    isSupported: boolean
    browserInfo: string
    recommendations?: string[]
  } {
    const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

    const userAgent = navigator.userAgent
    let browserInfo = 'Unknown'

    if (userAgent.includes('Chrome')) {
      browserInfo = 'Google Chrome'
    } else if (userAgent.includes('Firefox')) {
      browserInfo = 'Mozilla Firefox'
    } else if (userAgent.includes('Safari')) {
      browserInfo = 'Safari'
    } else if (userAgent.includes('Edge')) {
      browserInfo = 'Microsoft Edge'
    }

    const recommendations: string[] = []
    if (!isSupported) {
      recommendations.push('Chrome、Edge、またはSafariの最新版をお試しください')
      recommendations.push('HTTPSでアクセスしているか確認してください')
      recommendations.push('マイクへのアクセス許可を確認してください')
    }

    return {
      isSupported,
      browserInfo,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    }
  }
}