/**
 * 音声テキスト変換（Speech-to-Text）機能
 * Web Speech API を使用した音声認識
 */

export interface SpeechRecognitionResult {
  text: string
  confidence: number
  isFinal: boolean
  timestamp: number
}

export interface SpeechToTextOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  grammars?: string[]
}

// Web Speech API basic interface
interface SpeechRecognitionInterface {
  start(): void
  stop(): void
  onresult: ((event: unknown) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
  continuous: boolean
  lang: string
  maxAlternatives: number
}

export class SpeechToTextService {
  private recognition: SpeechRecognitionInterface | null = null
  private isListening = false
  private options: SpeechToTextOptions = {}
  private onResult?: (result: SpeechRecognitionResult) => void
  private onError?: (error: string) => void
  private onEnd?: () => void

  constructor(options: SpeechToTextOptions = {}) {
    this.options = {
      language: 'ja-JP',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      ...options
    }

    this.initializeSpeechRecognition()
  }

  /**
   * 音声認識の初期化
   */
  private initializeSpeechRecognition(): boolean {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech Recognition API is not supported in this browser')
      return false
    }

    const SpeechRecognition = (window as typeof window & { SpeechRecognition: typeof SpeechRecognition; webkitSpeechRecognition: typeof SpeechRecognition }).SpeechRecognition || (window as typeof window & { SpeechRecognition: typeof SpeechRecognition; webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition

    this.recognition = new SpeechRecognition()
    this.recognition.lang = this.options.language || 'ja-JP'
    this.recognition.continuous = this.options.continuous || true
    this.recognition.interimResults = this.options.interimResults || true
    this.recognition.maxAlternatives = this.options.maxAlternatives || 1

    // イベントリスナーの設定
    this.recognition.onresult = this.handleResult.bind(this)
    this.recognition.onerror = this.handleError.bind(this)
    this.recognition.onend = this.handleEnd.bind(this)
    this.recognition.onstart = this.handleStart.bind(this)

    return true
  }

  /**
   * 音声認識開始
   */
  startListening(
    onResult?: (result: SpeechRecognitionResult) => void,
    onError?: (error: string) => void,
    onEnd?: () => void
  ): boolean {
    if (!this.recognition) {
      console.error('Speech Recognition is not available')
      return false
    }

    if (this.isListening) {
      console.warn('Speech Recognition is already running')
      return false
    }

    this.onResult = onResult
    this.onError = onError
    this.onEnd = onEnd

    try {
      this.recognition.start()
      return true
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      return false
    }
  }

  /**
   * 音声認識停止
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
    }
  }

  /**
   * 音声認識中断
   */
  abortListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.abort()
    }
  }

  /**
   * 結果処理
   */
  private handleResult(event: SpeechRecognitionEvent): void {
    const results = event.results
    let finalText = ''
    let interimText = ''

    for (let i = event.resultIndex; i < results.length; i++) {
      const result = results[i]
      const text = result[0].transcript

      if (result.isFinal) {
        finalText += text
      } else {
        interimText += text
      }
    }

    const text = finalText || interimText
    if (text && this.onResult) {
      this.onResult({
        text: text.trim(),
        confidence: results[results.length - 1]?.[0]?.confidence || 0,
        isFinal: finalText.length > 0,
        timestamp: Date.now()
      })
    }
  }

  /**
   * エラー処理
   */
  private handleError(event: SpeechRecognitionErrorEvent): void {
    let errorMessage = 'Unknown error'

    switch (event.error) {
      case 'no-speech':
        errorMessage = '音声が検出されませんでした'
        break
      case 'audio-capture':
        errorMessage = 'マイクにアクセスできません'
        break
      case 'not-allowed':
        errorMessage = 'マイクの使用が許可されていません'
        break
      case 'network':
        errorMessage = 'ネットワークエラーが発生しました'
        break
      case 'service-not-allowed':
        errorMessage = '音声認識サービスが利用できません'
        break
      default:
        errorMessage = `音声認識エラー: ${event.error}`
    }

    console.error('Speech recognition error:', errorMessage)

    if (this.onError) {
      this.onError(errorMessage)
    }
  }

  /**
   * 認識開始処理
   */
  private handleStart(): void {
    this.isListening = true
    console.log('Speech recognition started')
  }

  /**
   * 認識終了処理
   */
  private handleEnd(): void {
    this.isListening = false
    console.log('Speech recognition ended')

    if (this.onEnd) {
      this.onEnd()
    }
  }

  /**
   * 音声ファイルからテキストを抽出（Web Speech API では直接サポートされていないため、MediaRecorder と組み合わせて実装）
   */
  async transcribeAudioBlob(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      // 音声ファイルを再生しながら認識する方法
      const audio = new Audio(URL.createObjectURL(audioBlob))
      let transcription = ''

      const cleanup = () => {
        URL.revokeObjectURL(audio.src)
        this.stopListening()
      }

      this.startListening(
        (result) => {
          if (result.isFinal) {
            transcription += result.text + ' '
          }
        },
        (error) => {
          cleanup()
          reject(new Error(error))
        },
        () => {
          cleanup()
          resolve(transcription.trim())
        }
      )

      audio.onended = () => {
        setTimeout(() => {
          this.stopListening()
        }, 1000) // 1秒後に停止
      }

      audio.onerror = () => {
        cleanup()
        reject(new Error('音声ファイルの再生に失敗しました'))
      }

      audio.play().catch((error) => {
        cleanup()
        reject(new Error(`音声再生エラー: ${error.message}`))
      })
    })
  }

  /**
   * サポート状況を確認
   */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  }

  /**
   * サポートされている言語を取得（ブラウザによって異なる）
   */
  static getSupportedLanguages(): string[] {
    // 一般的にサポートされている言語
    return [
      'ja-JP', // 日本語
      'en-US', // 英語（米国）
      'en-GB', // 英語（イギリス）
      'zh-CN', // 中国語（簡体字）
      'ko-KR', // 韓国語
      'fr-FR', // フランス語
      'de-DE', // ドイツ語
      'es-ES', // スペイン語
      'it-IT', // イタリア語
      'pt-BR', // ポルトガル語（ブラジル）
    ]
  }

  /**
   * マイクのアクセス許可を確認
   */
  static async requestMicrophonePermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop()) // すぐに停止
      return true
    } catch (error) {
      console.error('Microphone permission denied:', error)
      return false
    }
  }

  /**
   * 設定を更新
   */
  updateOptions(options: Partial<SpeechToTextOptions>): void {
    this.options = { ...this.options, ...options }

    if (this.recognition) {
      this.recognition.lang = this.options.language || 'ja-JP'
      this.recognition.continuous = this.options.continuous || true
      this.recognition.interimResults = this.options.interimResults || true
      this.recognition.maxAlternatives = this.options.maxAlternatives || 1
    }
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    if (this.isListening) {
      this.abortListening()
    }

    this.recognition = null
    this.onResult = undefined
    this.onError = undefined
    this.onEnd = undefined
  }
}