/**
 * 音声圧縮とファイルサイズ最適化ユーティリティ
 */

export interface CompressionOptions {
  quality: number // 0.1 - 1.0
  sampleRate?: number
  bitRate?: number
  channels?: number
  format?: string
}

export interface CompressionResult {
  compressedBlob: Blob
  originalSize: number
  compressedSize: number
  compressionRatio: number
  quality: number
}

export class AudioCompressor {
  /**
   * 音声ファイルを圧縮
   */
  static async compressAudio(
    audioBlob: Blob,
    options: CompressionOptions = { quality: 0.8 }
  ): Promise<CompressionResult> {
    const originalSize = audioBlob.size

    try {
      // WebAudioAPIを使用した圧縮処理
      const compressedBlob = await this.compressUsingWebAudio(audioBlob, options)

      const compressedSize = compressedBlob.size
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1

      return {
        compressedBlob,
        originalSize,
        compressedSize,
        compressionRatio,
        quality: options.quality
      }
    } catch (error) {
      console.warn('音声圧縮に失敗。元のファイルを返します:', error)
      return {
        compressedBlob: audioBlob,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        quality: 1
      }
    }
  }

  /**
   * WebAudioAPIを使用した音声圧縮
   */
  private static async compressUsingWebAudio(
    audioBlob: Blob,
    options: CompressionOptions
  ): Promise<Blob> {
    // AudioContextの作成
    const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    try {
      // Blobを ArrayBuffer に変換
      const arrayBuffer = await audioBlob.arrayBuffer()

      // AudioBufferにデコード
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      // サンプルレートとチャンネル数を調整
      const targetSampleRate = options.sampleRate || Math.min(audioBuffer.sampleRate, 22050)
      const targetChannels = options.channels || 1

      // リサンプリングとモノラル変換
      const processedBuffer = await this.resampleAndMixdown(
        audioBuffer,
        audioContext,
        targetSampleRate,
        targetChannels
      )

      // 圧縮されたWAVファイルを生成
      const compressedBlob = this.audioBufferToBlob(processedBuffer, options.quality)

      return compressedBlob
    } finally {
      // AudioContextを適切に閉じる
      if (audioContext.state !== 'closed') {
        await audioContext.close()
      }
    }
  }

  /**
   * AudioBufferのリサンプリングとミックスダウン
   */
  private static async resampleAndMixdown(
    audioBuffer: AudioBuffer,
    audioContext: AudioContext,
    targetSampleRate: number,
    targetChannels: number
  ): Promise<AudioBuffer> {
    const originalSampleRate = audioBuffer.sampleRate
    const originalChannels = audioBuffer.numberOfChannels
    const originalLength = audioBuffer.length

    // 新しいサンプルレートでの長さを計算
    const newLength = Math.round((originalLength * targetSampleRate) / originalSampleRate)

    // 新しいAudioBufferを作成
    const newAudioBuffer = audioContext.createBuffer(
      targetChannels,
      newLength,
      targetSampleRate
    )

    // チャンネルごとにリサンプリング
    for (let channel = 0; channel < targetChannels; channel++) {
      const newChannelData = newAudioBuffer.getChannelData(channel)

      // ソースチャンネルデータを取得（モノラル変換の場合は混合）
      const sourceData = this.getSourceChannelData(audioBuffer, channel, originalChannels)

      // リニア補間でリサンプリング
      for (let i = 0; i < newLength; i++) {
        const sourceIndex = (i * originalLength) / newLength
        const index = Math.floor(sourceIndex)
        const fraction = sourceIndex - index

        const sample1 = sourceData[index] || 0
        const sample2 = sourceData[index + 1] || 0

        // リニア補間
        newChannelData[i] = sample1 + (sample2 - sample1) * fraction
      }
    }

    return newAudioBuffer
  }

  /**
   * ソースチャンネルデータを取得（モノラル変換対応）
   */
  private static getSourceChannelData(
    audioBuffer: AudioBuffer,
    targetChannel: number,
    originalChannels: number
  ): Float32Array {
    if (targetChannel === 0 && originalChannels > 1) {
      // モノラル変換：すべてのチャンネルを混合
      const length = audioBuffer.length
      const mixedData = new Float32Array(length)

      for (let i = 0; i < length; i++) {
        let sum = 0
        for (let ch = 0; ch < originalChannels; ch++) {
          sum += audioBuffer.getChannelData(ch)[i]
        }
        mixedData[i] = sum / originalChannels
      }

      return mixedData
    } else {
      // 対応するチャンネルまたは最初のチャンネルを使用
      const channelIndex = Math.min(targetChannel, originalChannels - 1)
      return audioBuffer.getChannelData(channelIndex)
    }
  }

  /**
   * AudioBufferをBlobに変換（品質調整付き）
   */
  private static audioBufferToBlob(audioBuffer: AudioBuffer, quality: number): Blob {
    const length = audioBuffer.length
    const channels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate

    // WAVファイルヘッダーサイズ
    const headerSize = 44
    const dataSize = length * channels * 2 // 16bit = 2 bytes per sample
    const fileSize = headerSize + dataSize

    const buffer = new ArrayBuffer(fileSize)
    const view = new DataView(buffer)

    // WAVファイルヘッダーを書き込み
    this.writeWAVHeader(view, length, channels, sampleRate)

    // 音声データを書き込み（品質調整付き）
    let offset = headerSize
    const amplificationFactor = quality * 0.8 + 0.2 // 0.2 - 1.0 の範囲

    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i] * amplificationFactor

        // -1.0 から 1.0 の範囲を -32768 から 32767 にマッピング
        const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)))

        view.setInt16(offset, intSample, true) // リトルエンディアン
        offset += 2
      }
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  /**
   * WAVファイルヘッダーを書き込み
   */
  private static writeWAVHeader(
    view: DataView,
    length: number,
    channels: number,
    sampleRate: number
  ): void {
    const byteRate = sampleRate * channels * 2
    const blockAlign = channels * 2
    const dataSize = length * channels * 2

    // RIFF header
    view.setUint32(0, 0x46464952, false) // "RIFF"
    view.setUint32(4, 36 + dataSize, true) // file size - 8
    view.setUint32(8, 0x45564157, false) // "WAVE"

    // Format chunk
    view.setUint32(12, 0x20746d66, false) // "fmt "
    view.setUint32(16, 16, true) // chunk size
    view.setUint16(20, 1, true) // PCM format
    view.setUint16(22, channels, true) // channels
    view.setUint32(24, sampleRate, true) // sample rate
    view.setUint32(28, byteRate, true) // byte rate
    view.setUint16(32, blockAlign, true) // block align
    view.setUint16(34, 16, true) // bits per sample

    // Data chunk
    view.setUint32(36, 0x61746164, false) // "data"
    view.setUint32(40, dataSize, true) // data size
  }

  /**
   * 音声品質に基づく推奨圧縮オプション
   */
  static getRecommendedOptions(fileSize: number, duration: number): CompressionOptions {
    const kbps = (fileSize * 8) / (duration * 1000) // ビットレート計算

    if (fileSize > 5 * 1024 * 1024) { // 5MB以上
      return { quality: 0.6, sampleRate: 16000, channels: 1 }
    } else if (fileSize > 2 * 1024 * 1024) { // 2MB以上
      return { quality: 0.7, sampleRate: 22050, channels: 1 }
    } else if (kbps > 128) { // 高ビットレート
      return { quality: 0.8, sampleRate: 24000, channels: 1 }
    } else {
      return { quality: 0.9, sampleRate: 32000, channels: 1 }
    }
  }

  /**
   * 圧縮が必要かどうかを判定
   */
  static shouldCompress(fileSize: number, duration: number): boolean {
    const maxSize = 1024 * 1024 // 1MB
    const maxBitrate = 96 // kbps
    const currentBitrate = (fileSize * 8) / (duration * 1000)

    return fileSize > maxSize || currentBitrate > maxBitrate
  }
}