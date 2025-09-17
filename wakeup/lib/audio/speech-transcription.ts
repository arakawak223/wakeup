/**
 * 音声転写機能
 * Web Speech APIとオフライン処理を組み合わせた高精度転写システム
 */

export interface TranscriptionOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  confidenceThreshold?: number
  chunkSize?: number // 音声を分割する秒数
  enablePunctuation?: boolean
  enableCapitalization?: boolean
}

export interface TranscriptionResult {
  text: string
  confidence: number
  timestamp: number
  startTime?: number
  endTime?: number
  alternatives?: string[]
  language?: string
  isFinal: boolean
}

export interface TranscriptionChunk {
  id: string
  audioBlob: Blob
  startTime: number
  endTime: number
  result?: TranscriptionResult
}

export class SpeechTranscriptionService {
  private recognition: SpeechRecognition | null = null
  private isTranscribing = false
  private options: TranscriptionOptions
  private chunks: TranscriptionChunk[] = []
  private onResult?: (result: TranscriptionResult) => void
  private onProgress?: (progress: { current: number; total: number }) => void
  private onError?: (error: string) => void

  constructor(options: TranscriptionOptions = {}) {
    this.options = {
      language: 'ja-JP',
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      confidenceThreshold: 0.7,
      chunkSize: 30, // 30秒ずつ処理
      enablePunctuation: true,
      enableCapitalization: true,
      ...options
    }

    this.initializeSpeechRecognition()
  }

  /**
   * 音声認識の初期化
   */
  private initializeSpeechRecognition(): void {
    if (typeof window === 'undefined') return

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech Recognition API is not supported')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    this.recognition = new SpeechRecognition()
    this.recognition.lang = this.options.language || 'ja-JP'
    this.recognition.continuous = this.options.continuous || true
    this.recognition.interimResults = this.options.interimResults || true
    this.recognition.maxAlternatives = this.options.maxAlternatives || 3

    this.recognition.onresult = this.handleRecognitionResult.bind(this)
    this.recognition.onerror = this.handleRecognitionError.bind(this)
    this.recognition.onend = this.handleRecognitionEnd.bind(this)
  }

  /**
   * 音声ファイルからテキストを転写
   */
  async transcribeAudioFile(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      // 長い音声ファイルをチャンクに分割
      const chunks = await this.splitAudioIntoChunks(audioBlob)

      if (chunks.length === 1) {
        // 短い音声は直接転写
        return await this.transcribeSingleChunk(chunks[0])
      } else {
        // 長い音声はチャンクごとに処理
        return await this.transcribeMultipleChunks(chunks)
      }
    } catch (error) {
      throw new Error(`音声転写エラー: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * リアルタイム音声転写を開始
   */
  startRealtimeTranscription(
    onResult: (result: TranscriptionResult) => void,
    onProgress?: (progress: { current: number; total: number }) => void,
    onError?: (error: string) => void
  ): boolean {
    if (!this.recognition || this.isTranscribing) {
      return false
    }

    this.onResult = onResult
    this.onProgress = onProgress
    this.onError = onError

    try {
      this.recognition.start()
      this.isTranscribing = true
      return true
    } catch (error) {
      this.onError?.(`転写開始エラー: ${error}`)
      return false
    }
  }

  /**
   * リアルタイム転写を停止
   */
  stopRealtimeTranscription(): void {
    if (this.recognition && this.isTranscribing) {
      this.recognition.stop()
      this.isTranscribing = false
    }
  }

  /**
   * 音声を時間ベースでチャンクに分割
   */
  private async splitAudioIntoChunks(audioBlob: Blob): Promise<TranscriptionChunk[]> {
    const audioContext = new AudioContext()
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const duration = audioBuffer.duration
    const chunkSize = this.options.chunkSize || 30
    const chunks: TranscriptionChunk[] = []

    if (duration <= chunkSize) {
      // 短い音声はそのまま1チャンクとして処理
      chunks.push({
        id: `chunk-0`,
        audioBlob,
        startTime: 0,
        endTime: duration
      })
      return chunks
    }

    // 長い音声をチャンクに分割
    for (let start = 0; start < duration; start += chunkSize) {
      const end = Math.min(start + chunkSize, duration)
      const chunkBlob = await this.extractAudioChunk(audioBlob, start, end)

      chunks.push({
        id: `chunk-${chunks.length}`,
        audioBlob: chunkBlob,
        startTime: start,
        endTime: end
      })
    }

    return chunks
  }

  /**
   * 音声から指定した時間範囲のチャンクを抽出
   */
  private async extractAudioChunk(audioBlob: Blob, startTime: number, endTime: number): Promise<Blob> {
    const audioContext = new AudioContext()
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const sampleRate = audioBuffer.sampleRate
    const startSample = Math.floor(startTime * sampleRate)
    const endSample = Math.floor(endTime * sampleRate)
    const chunkLength = endSample - startSample

    const chunkBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      chunkLength,
      sampleRate
    )

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel)
      const chunkData = chunkBuffer.getChannelData(channel)

      for (let i = 0; i < chunkLength; i++) {
        chunkData[i] = channelData[startSample + i]
      }
    }

    // AudioBuffer to Blob conversion
    return await this.audioBufferToBlob(chunkBuffer)
  }

  /**
   * AudioBufferをBlobに変換
   */
  private async audioBufferToBlob(audioBuffer: AudioBuffer): Promise<Blob> {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    )

    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start()

    const renderedBuffer = await offlineContext.startRendering()

    // Convert to WAV format
    const wav = this.audioBufferToWav(renderedBuffer)
    return new Blob([wav], { type: 'audio/wav' })
  }

  /**
   * AudioBufferをWAVフォーマットに変換
   */
  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length
    const numberOfChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(arrayBuffer)

    // WAVヘッダーを書き込み
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true)
    view.setUint16(32, numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * 2, true)

    // 音声データを書き込み
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample * 0x7FFF, true)
        offset += 2
      }
    }

    return arrayBuffer
  }

  /**
   * 単一チャンクの転写
   */
  private async transcribeSingleChunk(chunk: TranscriptionChunk): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(URL.createObjectURL(chunk.audioBlob))
      let transcriptionText = ''
      let finalConfidence = 0

      const handleResult = (result: TranscriptionResult) => {
        if (result.isFinal) {
          transcriptionText += result.text + ' '
          finalConfidence = Math.max(finalConfidence, result.confidence)
        }
      }

      const handleEnd = () => {
        URL.revokeObjectURL(audio.src)

        resolve({
          text: this.postProcessText(transcriptionText.trim()),
          confidence: finalConfidence,
          timestamp: Date.now(),
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          isFinal: true,
          language: this.options.language
        })
      }

      const handleError = (error: string) => {
        URL.revokeObjectURL(audio.src)
        reject(new Error(error))
      }

      this.startRealtimeTranscription(handleResult, undefined, handleError)

      audio.onended = () => {
        setTimeout(() => {
          this.stopRealtimeTranscription()
          handleEnd()
        }, 1000)
      }

      audio.onerror = () => {
        handleError('音声ファイルの再生に失敗しました')
      }

      audio.play().catch((error) => {
        handleError(`音声再生エラー: ${error.message}`)
      })
    })
  }

  /**
   * 複数チャンクの転写
   */
  private async transcribeMultipleChunks(chunks: TranscriptionChunk[]): Promise<TranscriptionResult> {
    let combinedText = ''
    let totalConfidence = 0
    let processedChunks = 0

    for (const chunk of chunks) {
      try {
        const result = await this.transcribeSingleChunk(chunk)
        chunk.result = result

        combinedText += result.text + ' '
        totalConfidence += result.confidence
        processedChunks++

        this.onProgress?.({
          current: processedChunks,
          total: chunks.length
        })
      } catch (error) {
        console.warn(`チャンク ${chunk.id} の転写に失敗:`, error)
        // 失敗したチャンクはスキップして継続
      }
    }

    const averageConfidence = processedChunks > 0 ? totalConfidence / processedChunks : 0

    return {
      text: this.postProcessText(combinedText.trim()),
      confidence: averageConfidence,
      timestamp: Date.now(),
      startTime: chunks[0].startTime,
      endTime: chunks[chunks.length - 1].endTime,
      isFinal: true,
      language: this.options.language
    }
  }

  /**
   * 転写結果の後処理
   */
  private postProcessText(text: string): string {
    if (!text) return text

    let processedText = text

    // 基本的なクリーンアップ
    processedText = processedText
      .replace(/\s+/g, ' ') // 連続する空白を単一に
      .trim()

    // 句読点の追加（日本語）
    if (this.options.enablePunctuation && this.options.language?.startsWith('ja')) {
      processedText = this.addJapanesePunctuation(processedText)
    }

    // 大文字小文字の調整（英語）
    if (this.options.enableCapitalization && this.options.language?.startsWith('en')) {
      processedText = this.capitalizeEnglishText(processedText)
    }

    return processedText
  }

  /**
   * 日本語の句読点を追加
   */
  private addJapanesePunctuation(text: string): string {
    // 簡単な句読点追加ルール
    return text
      .replace(/\s*ですね\s*/g, 'ですね。')
      .replace(/\s*ました\s*/g, 'ました。')
      .replace(/\s*でしょう\s*/g, 'でしょう。')
      .replace(/\s*ですが\s*/g, 'ですが、')
      .replace(/\s*けれど\s*/g, 'けれど、')
      .replace(/\s*そして\s*/g, 'そして、')
  }

  /**
   * 英語テキストの大文字小文字を調整
   */
  private capitalizeEnglishText(text: string): string {
    return text.replace(/(^\w|[.!?]\s*\w)/g, (match) => match.toUpperCase())
  }

  /**
   * 認識結果の処理
   */
  private handleRecognitionResult(event: SpeechRecognitionEvent): void {
    const results = event.results
    let finalText = ''
    let interimText = ''
    let maxConfidence = 0
    const alternatives: string[] = []

    for (let i = event.resultIndex; i < results.length; i++) {
      const result = results[i]

      if (result.isFinal) {
        finalText += result[0].transcript
        maxConfidence = Math.max(maxConfidence, result[0].confidence || 0)

        // 代替候補を収集
        for (let j = 0; j < Math.min(result.length, this.options.maxAlternatives || 3); j++) {
          alternatives.push(result[j].transcript)
        }
      } else {
        interimText += result[0].transcript
      }
    }

    const text = finalText || interimText
    const confidence = result[0]?.confidence || 0

    // 信頼度の閾値チェック
    if (confidence >= (this.options.confidenceThreshold || 0.7) || !finalText) {
      this.onResult?.({
        text: text.trim(),
        confidence,
        timestamp: Date.now(),
        alternatives: alternatives.length > 1 ? alternatives.slice(1) : undefined,
        language: this.options.language,
        isFinal: finalText.length > 0
      })
    }
  }

  /**
   * 認識エラーの処理
   */
  private handleRecognitionError(event: SpeechRecognitionErrorEvent): void {
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

    this.onError?.(errorMessage)
  }

  /**
   * 認識終了の処理
   */
  private handleRecognitionEnd(): void {
    this.isTranscribing = false
  }

  /**
   * サポート状況を確認
   */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.stopRealtimeTranscription()
    this.recognition = null
    this.chunks = []
    this.onResult = undefined
    this.onProgress = undefined
    this.onError = undefined
  }
}