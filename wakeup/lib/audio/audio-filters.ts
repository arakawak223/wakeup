/**
 * 音声フィルターとエフェクト処理システム
 */

export interface FilterOptions {
  noiseReduction: boolean
  volumeNormalization: boolean
  bassBoost: boolean
  trebleBoost: boolean
  compressor: boolean
  echo: {
    enabled: boolean
    delay: number  // ms
    feedback: number  // 0-1
    mix: number  // 0-1
  }
  reverb: {
    enabled: boolean
    roomSize: number  // 0-1
    damping: number   // 0-1
    wetness: number   // 0-1
  }
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null
  private sourceBuffer: AudioBuffer | null = null

  constructor() {
    this.initializeAudioContext()
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.error('AudioContext初期化エラー:', error)
    }
  }

  /**
   * Blobから音声データを処理
   */
  async processAudioBlob(audioBlob: Blob, options: FilterOptions): Promise<Blob> {
    if (!this.audioContext) {
      throw new Error('AudioContextが初期化されていません')
    }

    try {
      // BlobをArrayBufferに変換
      const arrayBuffer = await audioBlob.arrayBuffer()

      // AudioBufferにデコード
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      this.sourceBuffer = audioBuffer

      // フィルターを適用
      const processedBuffer = await this.applyFilters(audioBuffer, options)

      // 処理済み音声をBlobに変換
      const processedBlob = await this.audioBufferToBlob(processedBuffer)

      return processedBlob
    } catch (error) {
      console.error('音声処理エラー:', error)
      throw error
    }
  }

  /**
   * フィルターを適用
   */
  private async applyFilters(audioBuffer: AudioBuffer, options: FilterOptions): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContextが初期化されていません')
    }

    let processedBuffer = audioBuffer

    // ノイズリダクション
    if (options.noiseReduction) {
      processedBuffer = await this.applyNoiseReduction(processedBuffer)
    }

    // 音量正規化
    if (options.volumeNormalization) {
      processedBuffer = await this.normalizeVolume(processedBuffer)
    }

    // EQ調整
    if (options.bassBoost || options.trebleBoost) {
      processedBuffer = await this.applyEQ(processedBuffer, options)
    }

    // コンプレッサー
    if (options.compressor) {
      processedBuffer = await this.applyCompressor(processedBuffer)
    }

    // エコー
    if (options.echo.enabled) {
      processedBuffer = await this.applyEcho(processedBuffer, options.echo)
    }

    // リバーブ
    if (options.reverb.enabled) {
      processedBuffer = await this.applyReverb(processedBuffer, options.reverb)
    }

    return processedBuffer
  }

  /**
   * ノイズリダクション（簡易版）
   */
  private async applyNoiseReduction(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    )

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel)
      const outputData = processedBuffer.getChannelData(channel)

      // 簡易ノイズゲート（閾値以下の音をカット）
      const threshold = 0.01
      for (let i = 0; i < inputData.length; i++) {
        if (Math.abs(inputData[i]) < threshold) {
          outputData[i] = 0
        } else {
          outputData[i] = inputData[i]
        }
      }
    }

    return processedBuffer
  }

  /**
   * 音量正規化
   */
  private async normalizeVolume(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    )

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel)
      const outputData = processedBuffer.getChannelData(channel)

      // 最大音量を検出
      let maxVolume = 0
      for (let i = 0; i < inputData.length; i++) {
        const absValue = Math.abs(inputData[i])
        if (absValue > maxVolume) {
          maxVolume = absValue
        }
      }

      // 正規化倍率を計算（最大0.8にクリップ）
      const normalizeRatio = maxVolume > 0 ? Math.min(0.8 / maxVolume, 2.0) : 1

      // 正規化を適用
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i] * normalizeRatio
      }
    }

    return processedBuffer
  }

  /**
   * EQ調整
   */
  private async applyEQ(
    audioBuffer: AudioBuffer,
    options: { bassBoost: boolean; trebleBoost: boolean }
  ): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    )

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel)
      const outputData = processedBuffer.getChannelData(channel)

      // 簡易EQ（フィルターバンクの代わりに移動平均を使用）
      for (let i = 0; i < inputData.length; i++) {
        let sample = inputData[i]

        // ベースブースト（低域強化）
        if (options.bassBoost && i > 10) {
          const lowFreqAvg = inputData.slice(i - 10, i).reduce((sum, val) => sum + val, 0) / 10
          sample += lowFreqAvg * 0.2
        }

        // トレブルブースト（高域強化）
        if (options.trebleBoost && i > 1) {
          const highFreqDiff = inputData[i] - inputData[i - 1]
          sample += highFreqDiff * 0.3
        }

        outputData[i] = Math.max(-1, Math.min(1, sample))
      }
    }

    return processedBuffer
  }

  /**
   * コンプレッサー
   */
  private async applyCompressor(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    )

    const threshold = 0.5
    const ratio = 4 // 4:1圧縮比
    const attack = 0.001 // 1ms
    const release = 0.1 // 100ms

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel)
      const outputData = processedBuffer.getChannelData(channel)

      let envelope = 0

      for (let i = 0; i < inputData.length; i++) {
        const input = Math.abs(inputData[i])

        // エンベロープ追従
        if (input > envelope) {
          envelope = input * attack + envelope * (1 - attack)
        } else {
          envelope = input * release + envelope * (1 - release)
        }

        // 圧縮の適用
        let compressionRatio = 1
        if (envelope > threshold) {
          compressionRatio = threshold + (envelope - threshold) / ratio
          compressionRatio = compressionRatio / envelope
        }

        outputData[i] = inputData[i] * compressionRatio
      }
    }

    return processedBuffer
  }

  /**
   * エコー効果
   */
  private async applyEcho(
    audioBuffer: AudioBuffer,
    echoOptions: { delay: number; feedback: number; mix: number }
  ): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const delayInSamples = Math.floor((echoOptions.delay / 1000) * audioBuffer.sampleRate)
    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length + delayInSamples,
      audioBuffer.sampleRate
    )

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel)
      const outputData = processedBuffer.getChannelData(channel)

      // 原音をコピー
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i] * (1 - echoOptions.mix)
      }

      // エコーを追加
      for (let i = 0; i < inputData.length; i++) {
        const echoIndex = i + delayInSamples
        if (echoIndex < outputData.length) {
          outputData[echoIndex] += inputData[i] * echoOptions.mix * echoOptions.feedback
        }
      }
    }

    return processedBuffer
  }

  /**
   * リバーブ効果（簡易版）
   */
  private async applyReverb(
    audioBuffer: AudioBuffer,
    reverbOptions: { roomSize: number; damping: number; wetness: number }
  ): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    )

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel)
      const outputData = processedBuffer.getChannelData(channel)

      // 簡易リバーブ（複数のディレイを組み合わせ）
      const delayTimes = [0.03, 0.05, 0.07, 0.09, 0.11, 0.13] // 秒
      const delayGains = [0.5, 0.4, 0.3, 0.25, 0.2, 0.15]

      for (let i = 0; i < inputData.length; i++) {
        let sample = inputData[i] * (1 - reverbOptions.wetness)

        // 複数のディレイを追加
        for (let d = 0; d < delayTimes.length; d++) {
          const delayIndex = i - Math.floor(delayTimes[d] * audioBuffer.sampleRate * reverbOptions.roomSize)
          if (delayIndex >= 0) {
            sample += inputData[delayIndex] * delayGains[d] * reverbOptions.wetness * (1 - reverbOptions.damping)
          }
        }

        outputData[i] = Math.max(-1, Math.min(1, sample))
      }
    }

    return processedBuffer
  }

  /**
   * AudioBufferをBlobに変換
   */
  private async audioBufferToBlob(audioBuffer: AudioBuffer): Promise<Blob> {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    // WAV形式でエクスポート
    const length = audioBuffer.length
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
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
        const sample = audioBuffer.getChannelData(channel)[i]
        const intSample = Math.max(-1, Math.min(1, sample))
        view.setInt16(offset, intSample * 0x7FFF, true)
        offset += 2
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }

  /**
   * デフォルトフィルター設定を取得
   */
  static getDefaultFilters(): FilterOptions {
    return {
      noiseReduction: true,
      volumeNormalization: true,
      bassBoost: false,
      trebleBoost: false,
      compressor: true,
      echo: {
        enabled: false,
        delay: 150,
        feedback: 0.3,
        mix: 0.2
      },
      reverb: {
        enabled: false,
        roomSize: 0.5,
        damping: 0.7,
        wetness: 0.3
      }
    }
  }

  /**
   * 音声品質向上に特化した設定
   */
  static getQualityEnhancementFilters(): FilterOptions {
    return {
      noiseReduction: true,
      volumeNormalization: true,
      bassBoost: false,
      trebleBoost: true,
      compressor: true,
      echo: {
        enabled: false,
        delay: 0,
        feedback: 0,
        mix: 0
      },
      reverb: {
        enabled: false,
        roomSize: 0,
        damping: 0,
        wetness: 0
      }
    }
  }

  /**
   * クリーンアップ
   */
  dispose() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.sourceBuffer = null
  }
}