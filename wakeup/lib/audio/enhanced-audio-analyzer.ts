/**
 * 拡張音声分析と品質フィードバックシステム
 */

export interface EnhancedAudioMetrics {
  volume: number
  frequency: number
  noiseLevel: number
  clarity: number
  timestamp: number
  // 新しいメトリクス
  peakVolume: number
  averageVolume: number
  dynamicRange: number
  silenceRatio: number
  distortionLevel: number
  spectralCentroid: number
  spectralRolloff: number
  zeroCrossingRate: number
  mfcc: number[] // Mel-frequency cepstral coefficients
}

export interface QualityAnalysis {
  overallScore: number
  volumeScore: number
  clarityScore: number
  noiseScore: number
  dynamicScore: number
  distortionScore: number
  recommendation: string
  issues: string[]
  suggestions: string[]
  technicalDetails: {
    peakVolume: number
    averageVolume: number
    dynamicRange: number
    silenceRatio: number
    distortionLevel: number
    spectralCentroid: number
  }
}

export interface AudioEnvironment {
  type: 'quiet' | 'normal' | 'noisy' | 'very_noisy'
  noiseLevel: number
  recommendation: string
}

export class EnhancedAudioAnalyzer {
  private analyserNode: AnalyserNode | null = null
  private frequencyData: Uint8Array = new Uint8Array(0)
  private timeData: Uint8Array = new Uint8Array(0)
  private metrics: EnhancedAudioMetrics[] = []
  private isAnalyzing = false
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private volumeHistory: number[] = []
  private peakHistory: number[] = []
  private analysisInterval: number | null = null
  private qualityCheckInterval: number | null = null

  /**
   * 音声分析を開始
   */
  async initializeFromStream(stream: MediaStream): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      this.sourceNode = this.audioContext.createMediaStreamSource(stream)

      this.analyserNode = this.audioContext.createAnalyser()
      // 高精度分析のためFFTサイズを増加
      this.analyserNode.fftSize = 4096
      this.analyserNode.smoothingTimeConstant = 0.3
      this.analyserNode.minDecibels = -90
      this.analyserNode.maxDecibels = -10

      const bufferLength = this.analyserNode.frequencyBinCount
      this.frequencyData = new Uint8Array(bufferLength)
      this.timeData = new Uint8Array(this.analyserNode.fftSize)

      this.sourceNode.connect(this.analyserNode)
      this.isAnalyzing = true

      // 履歴を初期化
      this.volumeHistory = []
      this.peakHistory = []

      this.startAnalysis()
      console.log('拡張音声分析を開始しました (FFT: 4096, バッファ: ' + bufferLength + ')')
    } catch (error) {
      console.error('拡張音声分析開始エラー:', error)
      throw error
    }
  }

  /**
   * 音声分析を停止
   */
  stopAnalysis(): void {
    this.isAnalyzing = false

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval)
      this.analysisInterval = null
    }

    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval)
      this.qualityCheckInterval = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error)
      this.audioContext = null
    }

    this.analyserNode = null
    this.volumeHistory = []
    this.peakHistory = []
    console.log('拡張音声分析を停止しました')
  }

  /**
   * リアルタイム音声分析
   */
  private startAnalysis(): void {
    this.analysisInterval = window.setInterval(() => {
      if (!this.isAnalyzing || !this.analyserNode) return

      // 周波数データと時間データを取得
      this.analyserNode.getByteFrequencyData(this.frequencyData)
      this.analyserNode.getByteTimeDomainData(this.timeData)

      const metrics = this.calculateEnhancedMetrics(this.frequencyData, this.timeData)
      this.metrics.push(metrics)

      // 音量履歴を更新
      this.volumeHistory.push(metrics.volume)
      this.peakHistory.push(metrics.peakVolume)

      // 履歴のサイズを制限（直近30秒、100ms間隔）
      if (this.volumeHistory.length > 300) {
        this.volumeHistory = this.volumeHistory.slice(-300)
        this.peakHistory = this.peakHistory.slice(-300)
      }

      // 最新200件のメトリクスを保持
      if (this.metrics.length > 200) {
        this.metrics = this.metrics.slice(-200)
      }
    }, 100) // 100ms間隔で分析

    // 品質チェックを1秒間隔で実行
    this.qualityCheckInterval = window.setInterval(() => {
      this.performQualityCheck()
    }, 1000)
  }

  /**
   * 拡張された音声メトリクスを計算
   */
  private calculateEnhancedMetrics(frequencyData: Uint8Array, timeData: Uint8Array): EnhancedAudioMetrics {
    const volume = this.calculateVolume(frequencyData)
    const peakVolume = this.calculatePeakVolume(timeData)
    const averageVolume = this.calculateAverageVolume()
    const frequency = this.calculateDominantFrequency(frequencyData)
    const noiseLevel = this.calculateNoiseLevel(frequencyData)
    const clarity = this.calculateClarity(frequencyData)
    const dynamicRange = this.calculateDynamicRange()
    const silenceRatio = this.calculateSilenceRatio()
    const distortionLevel = this.calculateDistortion(timeData)
    const spectralCentroid = this.calculateSpectralCentroid(frequencyData)
    const spectralRolloff = this.calculateSpectralRolloff(frequencyData)
    const zeroCrossingRate = this.calculateZeroCrossingRate(timeData)
    const mfcc = this.calculateMFCC(frequencyData)

    return {
      volume,
      frequency,
      noiseLevel,
      clarity,
      timestamp: Date.now(),
      peakVolume,
      averageVolume,
      dynamicRange,
      silenceRatio,
      distortionLevel,
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate,
      mfcc
    }
  }

  /**
   * 詳細な品質分析を取得
   */
  getDetailedQualityAnalysis(): QualityAnalysis {
    const current = this.getCurrentMetrics()
    if (!current) {
      return {
        overallScore: 50,
        volumeScore: 50,
        clarityScore: 50,
        noiseScore: 50,
        dynamicScore: 50,
        distortionScore: 50,
        recommendation: '音声データを取得中...',
        issues: [],
        suggestions: [],
        technicalDetails: {
          peakVolume: 0,
          averageVolume: 0,
          dynamicRange: 0,
          silenceRatio: 0,
          distortionLevel: 0,
          spectralCentroid: 0
        }
      }
    }

    const volumeScore = this.calculateVolumeScore(current)
    const clarityScore = current.clarity
    const noiseScore = Math.max(0, 100 - current.noiseLevel)
    const dynamicScore = Math.min(100, current.dynamicRange * 2)
    const distortionScore = Math.max(0, 100 - current.distortionLevel * 2)

    const overallScore = Math.round(
      volumeScore * 0.25 +
      noiseScore * 0.2 +
      clarityScore * 0.25 +
      dynamicScore * 0.1 +
      distortionScore * 0.15 +
      (100 - current.silenceRatio) * 0.05
    )

    const issues: string[] = []
    const suggestions: string[] = []

    // 問題と推奨事項を分析
    this.analyzeIssuesAndSuggestions(current, issues, suggestions)

    let recommendation = this.getQualityRecommendation(overallScore)

    return {
      overallScore,
      volumeScore,
      clarityScore,
      noiseScore,
      dynamicScore,
      distortionScore,
      recommendation,
      issues,
      suggestions,
      technicalDetails: {
        peakVolume: current.peakVolume,
        averageVolume: current.averageVolume,
        dynamicRange: current.dynamicRange,
        silenceRatio: current.silenceRatio,
        distortionLevel: current.distortionLevel,
        spectralCentroid: current.spectralCentroid
      }
    }
  }

  /**
   * 環境分析
   */
  analyzeEnvironment(): AudioEnvironment {
    const current = this.getCurrentMetrics()
    if (!current) {
      return {
        type: 'normal',
        noiseLevel: 0,
        recommendation: '環境を分析中...'
      }
    }

    let type: AudioEnvironment['type']
    let recommendation: string

    if (current.noiseLevel < 10) {
      type = 'quiet'
      recommendation = '非常に静かな環境です。録音に最適です。'
    } else if (current.noiseLevel < 25) {
      type = 'normal'
      recommendation = '良い録音環境です。'
    } else if (current.noiseLevel < 50) {
      type = 'noisy'
      recommendation = 'ややノイズがありますが、録音可能です。'
    } else {
      type = 'very_noisy'
      recommendation = 'ノイズが多い環境です。より静かな場所での録音をお勧めします。'
    }

    return {
      type,
      noiseLevel: current.noiseLevel,
      recommendation
    }
  }

  /**
   * 現在のメトリクスを取得
   */
  getCurrentMetrics(): EnhancedAudioMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  /**
   * 品質スコアを取得
   */
  getQualityScore(): number {
    const analysis = this.getDetailedQualityAnalysis()
    return analysis.overallScore
  }

  /**
   * 品質チェックを実行
   */
  private performQualityCheck(): void {
    const analysis = this.getDetailedQualityAnalysis()

    // 品質が低い場合の自動調整提案
    if (analysis.overallScore < 60) {
      console.log('品質改善の提案:', analysis.suggestions)
    }
  }

  // 以下、計算メソッド群

  private calculateVolume(frequencyData: Uint8Array): number {
    const sum = frequencyData.reduce((acc, value) => acc + value, 0)
    return (sum / frequencyData.length / 255) * 100
  }

  private calculatePeakVolume(timeData: Uint8Array): number {
    let peak = 0
    for (let i = 0; i < timeData.length; i++) {
      const sample = Math.abs(timeData[i] - 128) / 128
      if (sample > peak) peak = sample
    }
    return peak * 100
  }

  private calculateAverageVolume(): number {
    if (this.volumeHistory.length === 0) return 0
    const sum = this.volumeHistory.reduce((a, b) => a + b, 0)
    return sum / this.volumeHistory.length
  }

  private calculateDominantFrequency(frequencyData: Uint8Array): number {
    let maxValue = 0
    let maxIndex = 0

    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i]
        maxIndex = i
      }
    }

    return (maxIndex * 44100) / (frequencyData.length * 2)
  }

  private calculateNoiseLevel(frequencyData: Uint8Array): number {
    const highFreqStart = Math.floor(frequencyData.length * 0.7)
    const highFreqSum = frequencyData.slice(highFreqStart).reduce((acc, val) => acc + val, 0)
    const totalSum = frequencyData.reduce((acc, val) => acc + val, 0)

    return totalSum > 0 ? (highFreqSum / totalSum) * 100 : 0
  }

  private calculateClarity(frequencyData: Uint8Array): number {
    const voiceFreqStart = Math.floor((300 / 44100) * frequencyData.length * 2)
    const voiceFreqEnd = Math.floor((3400 / 44100) * frequencyData.length * 2)

    const voiceSum = frequencyData.slice(voiceFreqStart, voiceFreqEnd).reduce((acc, val) => acc + val, 0)
    const totalSum = frequencyData.reduce((acc, val) => acc + val, 0)

    return totalSum > 0 ? (voiceSum / totalSum) * 100 : 0
  }

  private calculateDynamicRange(): number {
    if (this.peakHistory.length < 10) return 0
    const maxPeak = Math.max(...this.peakHistory)
    const minPeak = Math.min(...this.peakHistory)
    return maxPeak - minPeak
  }

  private calculateSilenceRatio(): number {
    if (this.volumeHistory.length === 0) return 0
    const silenceThreshold = 5
    const silentSamples = this.volumeHistory.filter(v => v < silenceThreshold).length
    return (silentSamples / this.volumeHistory.length) * 100
  }

  private calculateDistortion(timeData: Uint8Array): number {
    let clippingCount = 0
    const threshold = 250

    for (let i = 0; i < timeData.length; i++) {
      if (timeData[i] <= 5 || timeData[i] >= threshold) {
        clippingCount++
      }
    }

    return (clippingCount / timeData.length) * 100
  }

  private calculateSpectralCentroid(frequencyData: Uint8Array): number {
    let weightedSum = 0
    let magnitudeSum = 0

    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = frequencyData[i]
      const frequency = (i * 44100) / (frequencyData.length * 2)
      weightedSum += frequency * magnitude
      magnitudeSum += magnitude
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0
  }

  private calculateSpectralRolloff(frequencyData: Uint8Array): number {
    const totalEnergy = frequencyData.reduce((sum, val) => sum + val * val, 0)
    const threshold = totalEnergy * 0.85

    let cumulativeEnergy = 0
    for (let i = 0; i < frequencyData.length; i++) {
      cumulativeEnergy += frequencyData[i] * frequencyData[i]
      if (cumulativeEnergy >= threshold) {
        return (i * 44100) / (frequencyData.length * 2)
      }
    }
    return 0
  }

  private calculateZeroCrossingRate(timeData: Uint8Array): number {
    let crossings = 0
    for (let i = 1; i < timeData.length; i++) {
      const prev = timeData[i - 1] - 128
      const curr = timeData[i] - 128
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
        crossings++
      }
    }
    return crossings / timeData.length
  }

  private calculateMFCC(frequencyData: Uint8Array): number[] {
    // 簡略化されたMFCC計算
    const mfccCount = 13
    const mfcc: number[] = []

    for (let i = 0; i < mfccCount; i++) {
      const start = Math.floor((i * frequencyData.length) / mfccCount)
      const end = Math.floor(((i + 1) * frequencyData.length) / mfccCount)
      const slice = frequencyData.slice(start, end)
      const energy = slice.reduce((sum, val) => sum + val * val, 0)
      mfcc.push(Math.log(energy + 1))
    }

    return mfcc
  }

  private calculateVolumeScore(metrics: EnhancedAudioMetrics): number {
    const ideal = 50
    const deviation = Math.abs(metrics.volume - ideal)
    const dynamicBonus = Math.min(20, metrics.dynamicRange)

    return Math.max(0, 100 - deviation * 2) + dynamicBonus
  }

  private analyzeIssuesAndSuggestions(
    metrics: EnhancedAudioMetrics,
    issues: string[],
    suggestions: string[]
  ): void {
    if (metrics.volume < 20) {
      issues.push('音量が小さすぎます')
      suggestions.push('マイクに近づいてください')
    } else if (metrics.volume > 80) {
      issues.push('音量が大きすぎます')
      suggestions.push('マイクから少し離れてください')
    }

    if (metrics.noiseLevel > 30) {
      issues.push('バックグラウンドノイズが多いです')
      suggestions.push('静かな環境で録音してください')
    }

    if (metrics.clarity < 60) {
      issues.push('音声の明瞭度が低いです')
      suggestions.push('はっきりと発音してください')
    }

    if (metrics.distortionLevel > 25) {
      issues.push('音声に歪みがあります')
      suggestions.push('マイクの音量を下げてください')
    }

    if (metrics.silenceRatio > 40) {
      issues.push('無音部分が多いです')
      suggestions.push('連続して話してください')
    }

    if (metrics.dynamicRange < 10) {
      issues.push('音量の変化が少ないです')
      suggestions.push('自然な抑揚をつけて話してください')
    }
  }

  private getQualityRecommendation(score: number): string {
    if (score >= 90) return '🌟 素晴らしい音質です！'
    if (score >= 80) return '✨ 優秀な音質です'
    if (score >= 70) return '👍 良好な音質です'
    if (score >= 60) return '👌 まずまずの音質です'
    if (score >= 50) return '⚠️ 音質を改善できます'
    return '🔧 音質の大幅な改善が必要です'
  }
}