/**
 * 音声感情分析機能
 * 音声データから音響特徴を抽出し、感情状態を分析
 */

export interface EmotionAnalysisResult {
  emotions: {
    happiness: number    // 0-1: 幸福度
    sadness: number      // 0-1: 悲しみ
    anger: number        // 0-1: 怒り
    fear: number         // 0-1: 恐怖
    surprise: number     // 0-1: 驚き
    disgust: number      // 0-1: 嫌悪
    neutral: number      // 0-1: 中立
  }
  dominantEmotion: string
  confidence: number     // 0-1: 分析の信頼度
  arousal: number       // 0-1: 覚醒度（興奮・鎮静）
  valence: number       // 0-1: 感情価（ポジティブ・ネガティブ）
  timestamp: number
  features: AudioFeatures
}

export interface AudioFeatures {
  // 基本的な音響特徴
  fundamentalFrequency: number[]  // 基本周波数（ピッチ）の時系列
  pitch: {
    mean: number
    variance: number
    range: number
    contour: number[]
  }
  energy: {
    mean: number
    variance: number
    peaks: number[]
  }
  spectralFeatures: {
    centroid: number[]      // スペクトル重心
    rolloff: number[]       // スペクトロール・オフ
    bandwidth: number[]     // スペクトル帯域幅
    contrast: number[]      // スペクトルコントラスト
  }
  // MFCC (Mel-frequency cepstral coefficients)
  mfcc: number[][]
  // 話速・韻律特徴
  speakingRate: number
  pauseRatio: number
  jitter: number          // 音声の不安定性
  shimmer: number         // 音量の不安定性
}

export interface EmotionAnalysisOptions {
  windowSize?: number     // 分析ウィンドウサイズ（秒）
  hopSize?: number        // ホップサイズ（秒）
  sampleRate?: number     // サンプリング率
  enableAdvanced?: boolean // 高度な分析を有効にする
  model?: 'simple' | 'advanced' // 使用するモデル
}

export class EmotionAnalyzer {
  private audioContext: AudioContext | null = null
  private options: EmotionAnalysisOptions

  // 感情分類のための重み係数（経験的に調整された値）
  private emotionWeights = {
    happiness: {
      pitch: { mean: 0.3, variance: 0.2, range: 0.2 },
      energy: { mean: 0.4, variance: 0.1 },
      speakingRate: 0.3,
      spectral: { centroid: 0.2, bandwidth: 0.1 }
    },
    sadness: {
      pitch: { mean: -0.4, variance: -0.2, range: -0.1 },
      energy: { mean: -0.3, variance: -0.1 },
      speakingRate: -0.3,
      spectral: { centroid: -0.2, bandwidth: -0.1 }
    },
    anger: {
      pitch: { mean: 0.2, variance: 0.4, range: 0.3 },
      energy: { mean: 0.5, variance: 0.3 },
      speakingRate: 0.4,
      spectral: { centroid: 0.3, bandwidth: 0.2 }
    },
    fear: {
      pitch: { mean: 0.3, variance: 0.3, range: 0.2 },
      energy: { mean: 0.2, variance: 0.4 },
      speakingRate: 0.2,
      spectral: { centroid: 0.2, bandwidth: 0.2 }
    },
    surprise: {
      pitch: { mean: 0.4, variance: 0.2, range: 0.3 },
      energy: { mean: 0.3, variance: 0.2 },
      speakingRate: 0.1,
      spectral: { centroid: 0.3, bandwidth: 0.1 }
    },
    neutral: {
      pitch: { mean: 0.0, variance: 0.0, range: 0.0 },
      energy: { mean: 0.0, variance: 0.0 },
      speakingRate: 0.0,
      spectral: { centroid: 0.0, bandwidth: 0.0 }
    }
  }

  constructor(options: EmotionAnalysisOptions = {}) {
    this.options = {
      windowSize: 2.0,
      hopSize: 0.5,
      sampleRate: 44100,
      enableAdvanced: true,
      model: 'advanced',
      ...options
    }

    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }

  /**
   * 音声ファイルから感情を分析
   */
  async analyzeEmotion(audioBlob: Blob): Promise<EmotionAnalysisResult> {
    if (!this.audioContext) {
      throw new Error('AudioContext is not available')
    }

    try {
      // 音声データを取得
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      // 音響特徴を抽出
      const features = await this.extractAudioFeatures(audioBuffer)

      // 感情分析を実行
      const emotionScores = this.computeEmotionScores(features)

      // 結果を構築
      const dominantEmotion = Object.keys(emotionScores).reduce((a, b) =>
        emotionScores[a] > emotionScores[b] ? a : b
      )

      const confidence = this.computeConfidence(emotionScores, features)
      const { arousal, valence } = this.computeArousalValence(emotionScores, features)

      return {
        emotions: emotionScores,
        dominantEmotion,
        confidence,
        arousal,
        valence,
        timestamp: Date.now(),
        features
      }
    } catch (error) {
      throw new Error(`感情分析エラー: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 音響特徴の抽出
   */
  private async extractAudioFeatures(audioBuffer: AudioBuffer): Promise<AudioFeatures> {
    const channelData = audioBuffer.getChannelData(0)
    const sampleRate = audioBuffer.sampleRate
    const windowSize = Math.floor(this.options.windowSize! * sampleRate)
    const hopSize = Math.floor(this.options.hopSize! * sampleRate)

    // 基本周波数（ピッチ）抽出
    const fundamentalFrequency = this.extractPitch(channelData, sampleRate, windowSize, hopSize)
    const pitchStats = this.computePitchStatistics(fundamentalFrequency)

    // エネルギー分析
    const energy = this.extractEnergy(channelData, windowSize, hopSize)
    const energyStats = this.computeEnergyStatistics(energy)

    // スペクトル特徴
    const spectralFeatures = this.extractSpectralFeatures(channelData, sampleRate, windowSize, hopSize)

    // MFCC特徴
    const mfcc = this.extractMFCC(channelData, sampleRate, windowSize, hopSize)

    // 韻律特徴
    const speakingRate = this.estimateSpeakingRate(fundamentalFrequency, energy)
    const pauseRatio = this.computePauseRatio(energy)
    const jitter = this.computeJitter(fundamentalFrequency)
    const shimmer = this.computeShimmer(energy)

    return {
      fundamentalFrequency,
      pitch: pitchStats,
      energy: energyStats,
      spectralFeatures,
      mfcc,
      speakingRate,
      pauseRatio,
      jitter,
      shimmer
    }
  }

  /**
   * ピッチ（基本周波数）の抽出
   */
  private extractPitch(signal: Float32Array, sampleRate: number, windowSize: number, hopSize: number): number[] {
    const pitch: number[] = []
    const window = this.createWindow(windowSize)

    for (let i = 0; i <= signal.length - windowSize; i += hopSize) {
      const frame = signal.slice(i, i + windowSize)

      // ウィンドウ関数を適用
      const windowedFrame = frame.map((sample, idx) => sample * window[idx])

      // 自己相関を使ってピッチを推定
      const f0 = this.estimatePitchAutocorrelation(windowedFrame, sampleRate)
      pitch.push(f0)
    }

    return pitch
  }

  /**
   * 自己相関によるピッチ推定
   */
  private estimatePitchAutocorrelation(frame: Float32Array, sampleRate: number): number {
    const minPeriod = Math.floor(sampleRate / 500)  // 最大500Hz
    const maxPeriod = Math.floor(sampleRate / 50)   // 最小50Hz

    let maxCorrelation = -1
    let bestPeriod = 0

    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0
      let normalization = 0

      for (let i = 0; i < frame.length - period; i++) {
        correlation += frame[i] * frame[i + period]
        normalization += frame[i] * frame[i]
      }

      if (normalization > 0) {
        correlation /= normalization
        if (correlation > maxCorrelation) {
          maxCorrelation = correlation
          bestPeriod = period
        }
      }
    }

    return bestPeriod > 0 ? sampleRate / bestPeriod : 0
  }

  /**
   * エネルギー抽出
   */
  private extractEnergy(signal: Float32Array, windowSize: number, hopSize: number): number[] {
    const energy: number[] = []

    for (let i = 0; i <= signal.length - windowSize; i += hopSize) {
      let sum = 0
      for (let j = i; j < i + windowSize; j++) {
        sum += signal[j] * signal[j]
      }
      energy.push(Math.sqrt(sum / windowSize))
    }

    return energy
  }

  /**
   * スペクトル特徴の抽出
   */
  private extractSpectralFeatures(signal: Float32Array, sampleRate: number, windowSize: number, hopSize: number) {
    const centroid: number[] = []
    const rolloff: number[] = []
    const bandwidth: number[] = []
    const contrast: number[] = []
    const window = this.createWindow(windowSize)

    for (let i = 0; i <= signal.length - windowSize; i += hopSize) {
      const frame = signal.slice(i, i + windowSize)
      const windowedFrame = frame.map((sample, idx) => sample * window[idx])

      // FFTを実行（簡易実装）
      const spectrum = this.computeSpectrum(windowedFrame)
      const magnitude = spectrum.map(complex => Math.sqrt(complex.real * complex.real + complex.imag * complex.imag))

      // スペクトル重心
      centroid.push(this.computeSpectralCentroid(magnitude, sampleRate))

      // スペクトロール・オフ
      rolloff.push(this.computeSpectralRolloff(magnitude, sampleRate, 0.85))

      // スペクトル帯域幅
      bandwidth.push(this.computeSpectralBandwidth(magnitude, sampleRate))

      // スペクトルコントラスト
      contrast.push(this.computeSpectralContrast(magnitude))
    }

    return { centroid, rolloff, bandwidth, contrast }
  }

  /**
   * MFCC特徴の抽出
   */
  private extractMFCC(signal: Float32Array, sampleRate: number, windowSize: number, hopSize: number): number[][] {
    const mfcc: number[][] = []
    const numCoeffs = 13
    const window = this.createWindow(windowSize)

    for (let i = 0; i <= signal.length - windowSize; i += hopSize) {
      const frame = signal.slice(i, i + windowSize)
      const windowedFrame = frame.map((sample, idx) => sample * window[idx])

      const coeffs = this.computeMFCC(windowedFrame, sampleRate, numCoeffs)
      mfcc.push(coeffs)
    }

    return mfcc
  }

  /**
   * 感情スコアの計算
   */
  private computeEmotionScores(features: AudioFeatures): EmotionAnalysisResult['emotions'] {
    const emotions = {
      happiness: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      disgust: 0,
      neutral: 0
    }

    // 正規化された特徴量を計算
    const normalizedFeatures = this.normalizeFeatures(features)

    // 各感情に対してスコアを計算
    for (const [emotion, weights] of Object.entries(this.emotionWeights)) {
      let score = 0

      // ピッチ特徴の重み付け
      score += weights.pitch.mean * normalizedFeatures.pitch.mean
      score += weights.pitch.variance * normalizedFeatures.pitch.variance
      score += weights.pitch.range * normalizedFeatures.pitch.range

      // エネルギー特徴の重み付け
      score += weights.energy.mean * normalizedFeatures.energy.mean
      score += weights.energy.variance * normalizedFeatures.energy.variance

      // 話速の重み付け
      score += weights.speakingRate * normalizedFeatures.speakingRate

      // スペクトル特徴の重み付け
      score += weights.spectral.centroid * normalizedFeatures.spectral.centroid
      score += weights.spectral.bandwidth * normalizedFeatures.spectral.bandwidth

      // スコアを0-1の範囲に正規化
      emotions[emotion as keyof typeof emotions] = Math.max(0, Math.min(1, (score + 1) / 2))
    }

    // ソフトマックス正規化
    return this.softmaxNormalize(emotions)
  }

  /**
   * 特徴量の正規化
   */
  private normalizeFeatures(features: AudioFeatures) {
    return {
      pitch: {
        mean: this.normalizeValue(features.pitch.mean, 50, 500),
        variance: this.normalizeValue(features.pitch.variance, 0, 10000),
        range: this.normalizeValue(features.pitch.range, 0, 450)
      },
      energy: {
        mean: this.normalizeValue(features.energy.mean, 0, 1),
        variance: this.normalizeValue(features.energy.variance, 0, 0.1)
      },
      speakingRate: this.normalizeValue(features.speakingRate, 1, 10),
      spectral: {
        centroid: this.normalizeValue(this.mean(features.spectralFeatures.centroid), 0, 8000),
        bandwidth: this.normalizeValue(this.mean(features.spectralFeatures.bandwidth), 0, 4000)
      }
    }
  }

  /**
   * 値を-1から1の範囲に正規化
   */
  private normalizeValue(value: number, min: number, max: number): number {
    return (2 * (value - min) / (max - min)) - 1
  }

  /**
   * ソフトマックス正規化
   */
  private softmaxNormalize(emotions: Record<string, number>): EmotionAnalysisResult['emotions'] {
    const values = Object.values(emotions)
    const max = Math.max(...values)
    const exponentials = values.map(v => Math.exp(v - max))
    const sum = exponentials.reduce((a, b) => a + b, 0)

    const normalized = {} as EmotionAnalysisResult['emotions']
    let i = 0
    for (const key of Object.keys(emotions)) {
      normalized[key as keyof EmotionAnalysisResult['emotions']] = exponentials[i] / sum
      i++
    }

    return normalized
  }

  /**
   * 信頼度の計算
   */
  private computeConfidence(emotions: EmotionAnalysisResult['emotions'], features: AudioFeatures): number {
    const values = Object.values(emotions).sort((a, b) => b - a)
    const maxScore = values[0]
    const secondMaxScore = values[1] || 0

    // 最大スコアと2番目のスコアの差が大きいほど信頼度が高い
    const scoreDifference = maxScore - secondMaxScore

    // 音声品質による調整
    const signalQuality = this.assessSignalQuality(features)

    return Math.min(1, scoreDifference * 2 * signalQuality)
  }

  /**
   * 覚醒度と感情価の計算
   */
  private computeArousalValence(emotions: EmotionAnalysisResult['emotions'], features: AudioFeatures) {
    // 覚醒度（Arousal）: 高い興奮状態 vs 落ち着いた状態
    const arousal =
      emotions.anger * 0.8 +
      emotions.fear * 0.7 +
      emotions.surprise * 0.6 +
      emotions.happiness * 0.5 +
      emotions.disgust * 0.4 +
      emotions.sadness * 0.2 +
      emotions.neutral * 0.0

    // 感情価（Valence）: ポジティブ vs ネガティブ
    const valence =
      emotions.happiness * 1.0 +
      emotions.surprise * 0.3 +
      emotions.neutral * 0.0 +
      emotions.disgust * (-0.3) +
      emotions.fear * (-0.5) +
      emotions.sadness * (-0.8) +
      emotions.anger * (-0.6)

    return {
      arousal: Math.max(0, Math.min(1, arousal)),
      valence: Math.max(0, Math.min(1, (valence + 1) / 2))
    }
  }

  /**
   * ユーティリティメソッド
   */
  private computePitchStatistics(pitch: number[]) {
    const validPitch = pitch.filter(p => p > 0)
    if (validPitch.length === 0) {
      return { mean: 0, variance: 0, range: 0, contour: pitch }
    }

    const mean = this.mean(validPitch)
    const variance = this.variance(validPitch, mean)
    const range = Math.max(...validPitch) - Math.min(...validPitch)

    return { mean, variance, range, contour: pitch }
  }

  private computeEnergyStatistics(energy: number[]) {
    const mean = this.mean(energy)
    const variance = this.variance(energy, mean)
    const peaks = this.findPeaks(energy)

    return { mean, variance, peaks }
  }

  private estimateSpeakingRate(pitch: number[], energy: number[]): number {
    // 簡易的な話速推定（音声活動区間の数に基づく）
    const threshold = this.mean(energy) * 0.3
    let speechSegments = 0
    let inSpeech = false

    for (const e of energy) {
      if (e > threshold && !inSpeech) {
        speechSegments++
        inSpeech = true
      } else if (e <= threshold) {
        inSpeech = false
      }
    }

    const duration = energy.length * (this.options.hopSize! / this.options.sampleRate!)
    return speechSegments / duration
  }

  private computePauseRatio(energy: number[]): number {
    const threshold = this.mean(energy) * 0.2
    const pauseFrames = energy.filter(e => e <= threshold).length
    return pauseFrames / energy.length
  }

  private computeJitter(pitch: number[]): number {
    if (pitch.length < 2) return 0

    let jitter = 0
    let count = 0

    for (let i = 1; i < pitch.length; i++) {
      if (pitch[i] > 0 && pitch[i - 1] > 0) {
        jitter += Math.abs(pitch[i] - pitch[i - 1]) / pitch[i - 1]
        count++
      }
    }

    return count > 0 ? jitter / count : 0
  }

  private computeShimmer(energy: number[]): number {
    if (energy.length < 2) return 0

    let shimmer = 0
    for (let i = 1; i < energy.length; i++) {
      if (energy[i - 1] > 0) {
        shimmer += Math.abs(energy[i] - energy[i - 1]) / energy[i - 1]
      }
    }

    return shimmer / (energy.length - 1)
  }

  // 数学的ユーティリティ
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private variance(values: number[], mean?: number): number {
    const m = mean ?? this.mean(values)
    return values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / values.length
  }

  private findPeaks(values: number[]): number[] {
    const peaks: number[] = []
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(i)
      }
    }
    return peaks
  }

  private createWindow(size: number): Float32Array {
    const window = new Float32Array(size)
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1))
    }
    return window
  }

  private computeSpectrum(frame: Float32Array): { real: number; imag: number }[] {
    // 簡易FFT実装（実際の実装では高速化が必要）
    const N = frame.length
    const spectrum: { real: number; imag: number }[] = []

    for (let k = 0; k < N / 2; k++) {
      let real = 0
      let imag = 0

      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N
        real += frame[n] * Math.cos(angle)
        imag += frame[n] * Math.sin(angle)
      }

      spectrum.push({ real, imag })
    }

    return spectrum
  }

  private computeSpectralCentroid(magnitude: number[], sampleRate: number): number {
    let numerator = 0
    let denominator = 0

    for (let i = 0; i < magnitude.length; i++) {
      const freq = i * sampleRate / (2 * magnitude.length)
      numerator += freq * magnitude[i]
      denominator += magnitude[i]
    }

    return denominator > 0 ? numerator / denominator : 0
  }

  private computeSpectralRolloff(magnitude: number[], sampleRate: number, rolloffRatio: number): number {
    const totalEnergy = magnitude.reduce((sum, mag) => sum + mag * mag, 0)
    const targetEnergy = totalEnergy * rolloffRatio

    let accumulatedEnergy = 0
    for (let i = 0; i < magnitude.length; i++) {
      accumulatedEnergy += magnitude[i] * magnitude[i]
      if (accumulatedEnergy >= targetEnergy) {
        return i * sampleRate / (2 * magnitude.length)
      }
    }

    return sampleRate / 2
  }

  private computeSpectralBandwidth(magnitude: number[], sampleRate: number): number {
    const centroid = this.computeSpectralCentroid(magnitude, sampleRate)
    let numerator = 0
    let denominator = 0

    for (let i = 0; i < magnitude.length; i++) {
      const freq = i * sampleRate / (2 * magnitude.length)
      const diff = freq - centroid
      numerator += diff * diff * magnitude[i]
      denominator += magnitude[i]
    }

    return denominator > 0 ? Math.sqrt(numerator / denominator) : 0
  }

  private computeSpectralContrast(magnitude: number[]): number {
    // スペクトルの動的範囲を計算
    const nonZero = magnitude.filter(mag => mag > 0)
    if (nonZero.length === 0) return 0

    const max = Math.max(...nonZero)
    const min = Math.min(...nonZero)
    return min > 0 ? 20 * Math.log10(max / min) : 0
  }

  private computeMFCC(frame: Float32Array, sampleRate: number, numCoeffs: number): number[] {
    // 簡易MFCC実装
    const spectrum = this.computeSpectrum(frame)
    const magnitude = spectrum.map(complex => Math.sqrt(complex.real * complex.real + complex.imag * complex.imag))

    // メルフィルターバンクを適用（簡略化）
    const melFiltered = this.applyMelFilterBank(magnitude, sampleRate)

    // DCT変換（簡略化）
    const mfcc: number[] = []
    for (let k = 0; k < numCoeffs; k++) {
      let coeff = 0
      for (let n = 0; n < melFiltered.length; n++) {
        coeff += Math.log(melFiltered[n] + 1e-10) * Math.cos(Math.PI * k * (n + 0.5) / melFiltered.length)
      }
      mfcc.push(coeff)
    }

    return mfcc
  }

  private applyMelFilterBank(magnitude: number[], sampleRate: number): number[] {
    // 簡易メルフィルターバンク（実際の実装では詳細な設計が必要）
    const numFilters = 26
    const filtered: number[] = []

    for (let i = 0; i < numFilters; i++) {
      const startIdx = Math.floor(i * magnitude.length / numFilters)
      const endIdx = Math.floor((i + 1) * magnitude.length / numFilters)

      let sum = 0
      for (let j = startIdx; j < endIdx && j < magnitude.length; j++) {
        sum += magnitude[j]
      }
      filtered.push(sum)
    }

    return filtered
  }

  private assessSignalQuality(features: AudioFeatures): number {
    // 信号品質の評価（0-1）
    let quality = 1.0

    // エネルギーレベルのチェック
    if (features.energy.mean < 0.01) {
      quality *= 0.5 // 音声が小さすぎる
    }

    // ピッチの安定性チェック
    if (features.jitter > 0.1) {
      quality *= 0.8 // ピッチが不安定
    }

    // ノイズレベルの推定
    const noiseLevel = features.shimmer
    if (noiseLevel > 0.1) {
      quality *= 0.7 // ノイズが多い
    }

    return Math.max(0.1, quality)
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
    this.audioContext = null
  }

  /**
   * 感情分析がサポートされているかチェック
   */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false
    return 'AudioContext' in window || 'webkitAudioContext' in window
  }
}