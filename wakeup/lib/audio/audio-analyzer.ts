/**
 * 音声分析と品質自動調整システム
 */

export interface AudioMetrics {
  volume: number
  frequency: number
  noiseLevel: number
  clarity: number
  timestamp: number
}

export interface AudioSettings {
  sampleRate: number
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  channelCount: number
  volume: number
}

export class AudioAnalyzer {
  private analyserNode: AnalyserNode | null = null
  private dataArray: Uint8Array = new Uint8Array()
  private metrics: AudioMetrics[] = []
  private isAnalyzing = false

  /**
   * 音声分析を開始
   */
  startAnalysis(stream: MediaStream): AudioAnalyzer {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(stream)

      this.analyserNode = audioContext.createAnalyser()
      this.analyserNode.fftSize = 2048
      this.analyserNode.smoothingTimeConstant = 0.8

      const bufferLength = this.analyserNode.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)

      source.connect(this.analyserNode)
      this.isAnalyzing = true

      this.analyze()
    } catch (error) {
      console.error('音声分析開始エラー:', error)
    }

    return this
  }

  /**
   * 音声分析を停止
   */
  stopAnalysis(): void {
    this.isAnalyzing = false
    this.analyserNode = null
  }

  /**
   * リアルタイム音声分析
   */
  private analyze(): void {
    if (!this.isAnalyzing || !this.analyserNode) return

    this.analyserNode.getByteFrequencyData(this.dataArray)

    const metrics = this.calculateMetrics(this.dataArray)
    this.metrics.push(metrics)

    // 最新100件のメトリクスを保持
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }

    // 次の分析をスケジュール
    requestAnimationFrame(() => this.analyze())
  }

  /**
   * 音声メトリクスを計算
   */
  private calculateMetrics(frequencyData: Uint8Array): AudioMetrics {
    const volume = this.calculateVolume(frequencyData)
    const frequency = this.calculateDominantFrequency(frequencyData)
    const noiseLevel = this.calculateNoiseLevel(frequencyData)
    const clarity = this.calculateClarity(frequencyData)

    return {
      volume,
      frequency,
      noiseLevel,
      clarity,
      timestamp: Date.now()
    }
  }

  /**
   * 音量レベルを計算（0-100）
   */
  private calculateVolume(frequencyData: Uint8Array): number {
    const sum = frequencyData.reduce((acc, value) => acc + value, 0)
    return (sum / frequencyData.length / 255) * 100
  }

  /**
   * 支配的周波数を計算
   */
  private calculateDominantFrequency(frequencyData: Uint8Array): number {
    let maxValue = 0
    let maxIndex = 0

    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i]
        maxIndex = i
      }
    }

    // 周波数ビンをHzに変換（サンプルレート44.1kHzを仮定）
    return (maxIndex * 44100) / (frequencyData.length * 2)
  }

  /**
   * ノイズレベルを計算（0-100）
   */
  private calculateNoiseLevel(frequencyData: Uint8Array): number {
    // 高周波数帯域のエネルギーをノイズとして評価
    const highFreqStart = Math.floor(frequencyData.length * 0.7)
    const highFreqSum = frequencyData.slice(highFreqStart).reduce((acc, val) => acc + val, 0)
    const totalSum = frequencyData.reduce((acc, val) => acc + val, 0)

    return totalSum > 0 ? (highFreqSum / totalSum) * 100 : 0
  }

  /**
   * 音声の明瞭度を計算（0-100）
   */
  private calculateClarity(frequencyData: Uint8Array): number {
    // 音声の周波数帯域（300Hz-3400Hz）のエネルギー比率
    const voiceFreqStart = Math.floor((300 / 44100) * frequencyData.length * 2)
    const voiceFreqEnd = Math.floor((3400 / 44100) * frequencyData.length * 2)

    const voiceSum = frequencyData.slice(voiceFreqStart, voiceFreqEnd).reduce((acc, val) => acc + val, 0)
    const totalSum = frequencyData.reduce((acc, val) => acc + val, 0)

    return totalSum > 0 ? (voiceSum / totalSum) * 100 : 0
  }

  /**
   * 現在の音声メトリクスを取得
   */
  getCurrentMetrics(): AudioMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  /**
   * 過去のメトリクス履歴を取得
   */
  getMetricsHistory(): AudioMetrics[] {
    return [...this.metrics]
  }

  /**
   * 環境に基づいて最適な音声設定を推奨
   */
  getRecommendedSettings(): AudioSettings {
    if (this.metrics.length < 10) {
      // 十分なデータがない場合はデフォルト設定
      return this.getDefaultSettings()
    }

    const recentMetrics = this.metrics.slice(-10)
    const avgNoiseLevel = recentMetrics.reduce((sum, m) => sum + m.noiseLevel, 0) / recentMetrics.length
    const avgVolume = recentMetrics.reduce((sum, m) => sum + m.volume, 0) / recentMetrics.length
    const avgClarity = recentMetrics.reduce((sum, m) => sum + m.clarity, 0) / recentMetrics.length

    const settings: AudioSettings = {
      sampleRate: 44100,
      echoCancellation: true,
      noiseSuppression: avgNoiseLevel > 30, // 高ノイズ環境では強化
      autoGainControl: avgVolume < 20 || avgVolume > 80, // 音量が極端な場合に有効
      channelCount: 1, // モノラル録音
      volume: this.calculateOptimalVolume(avgVolume, avgNoiseLevel)
    }

    // 音質が悪い場合はサンプルレートを上げる
    if (avgClarity < 40) {
      settings.sampleRate = 48000
    }

    return settings
  }

  /**
   * デフォルト音声設定
   */
  private getDefaultSettings(): AudioSettings {
    return {
      sampleRate: 44100,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      volume: 1.0
    }
  }

  /**
   * 最適な音量を計算
   */
  private calculateOptimalVolume(currentVolume: number, noiseLevel: number): number {
    let optimalVolume = 1.0

    if (currentVolume < 20) {
      // 音量が小さい場合は増幅
      optimalVolume = 1.5
    } else if (currentVolume > 80) {
      // 音量が大きい場合は減衰
      optimalVolume = 0.7
    }

    // ノイズレベルに応じて調整
    if (noiseLevel > 50) {
      optimalVolume = Math.min(optimalVolume * 1.2, 2.0)
    }

    return optimalVolume
  }

  /**
   * 音声品質の総合評価（0-100）
   */
  getQualityScore(): number {
    const current = this.getCurrentMetrics()
    if (!current) return 50 // デフォルトスコア

    // 各要素に重みを付けて総合スコアを計算
    const volumeScore = Math.max(0, 100 - Math.abs(current.volume - 50)) // 50%音量が最適
    const noiseScore = Math.max(0, 100 - current.noiseLevel) // ノイズは少ないほど良い
    const clarityScore = current.clarity // 明瞭度はそのまま

    return (volumeScore * 0.3 + noiseScore * 0.3 + clarityScore * 0.4)
  }

  /**
   * 音声ファイルを分析してメトリクスを返す
   */
  async analyzeAudio(audioBlob: Blob): Promise<{ qualityScore: number }> {
    try {
      // 簡易的な品質分析
      // 実際の実装では音声データの解析を行う
      const audioSize = audioBlob.size
      const duration = audioSize / (44100 * 2) // 概算時間

      // ファイルサイズと推定時間から品質スコアを計算
      let qualityScore = 75 // ベーススコア

      // ファイルサイズが適切な範囲にある場合はスコアを上げる
      if (audioSize > 10000 && audioSize < 1000000) {
        qualityScore += 10
      }

      // 時間が適切な範囲にある場合はスコアを上げる
      if (duration > 1 && duration < 60) {
        qualityScore += 10
      }

      return {
        qualityScore: Math.min(100, Math.max(0, qualityScore))
      }
    } catch (error) {
      console.warn('音声分析エラー:', error)
      return { qualityScore: 75 }
    }
  }
}