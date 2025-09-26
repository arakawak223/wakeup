/**
 * Memory Monitoring and Resource Management
 * メモリ使用量監視とリソース管理
 */

interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  timestamp: number
}

interface ResourceUsage {
  memory: MemoryInfo | null
  audioContexts: number
  mediaRecorders: number
  webRTCConnections: number
  serviceWorkers: number
  indexedDBConnections: number
}

export class MemoryMonitor {
  private static instance: MemoryMonitor
  private resourceUsage: ResourceUsage = {
    memory: null,
    audioContexts: 0,
    mediaRecorders: 0,
    webRTCConnections: 0,
    serviceWorkers: 0,
    indexedDBConnections: 0
  }

  private audioContexts = new Set<AudioContext>()
  private mediaRecorders = new Set<MediaRecorder>()
  private intervalId: number | null = null
  private memoryHistory: MemoryInfo[] = []
  private readonly MAX_HISTORY = 100

  private constructor() {
    if (typeof window !== 'undefined') {
      this.startMonitoring()
    }
  }

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor()
    }
    return MemoryMonitor.instance
  }

  /**
   * メモリ監視を開始
   */
  private startMonitoring() {
    // 5秒間隔でメモリ使用量をチェック
    this.intervalId = window.setInterval(() => {
      this.updateMemoryInfo()
      this.checkMemoryPressure()
    }, 5000)

    // ページが非表示になった時の処理
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseMonitoring()
      } else {
        this.resumeMonitoring()
      }
    })

    // ページ終了時のクリーンアップ
    window.addEventListener('beforeunload', () => {
      this.cleanup()
    })
  }

  /**
   * メモリ情報を更新
   */
  private updateMemoryInfo() {
    const memory = (performance as any).memory
    if (memory) {
      const memoryInfo: MemoryInfo = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        timestamp: Date.now()
      }

      this.resourceUsage.memory = memoryInfo
      this.memoryHistory.push(memoryInfo)

      // 履歴のサイズ制限
      if (this.memoryHistory.length > this.MAX_HISTORY) {
        this.memoryHistory.shift()
      }
    }
  }

  /**
   * メモリ圧迫をチェック
   */
  private checkMemoryPressure() {
    const memory = this.resourceUsage.memory
    if (!memory) return

    const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit

    if (usageRatio > 0.8) {
      console.warn('[Memory] メモリ使用量が高くなっています:', {
        used: this.formatBytes(memory.usedJSHeapSize),
        limit: this.formatBytes(memory.jsHeapSizeLimit),
        ratio: `${(usageRatio * 100).toFixed(1)}%`
      })

      this.performMemoryCleanup()
    }
  }

  /**
   * AudioContextを登録
   */
  registerAudioContext(context: AudioContext) {
    this.audioContexts.add(context)
    this.resourceUsage.audioContexts = this.audioContexts.size
  }

  /**
   * AudioContextの登録解除
   */
  unregisterAudioContext(context: AudioContext) {
    this.audioContexts.delete(context)
    this.resourceUsage.audioContexts = this.audioContexts.size
  }

  /**
   * MediaRecorderを登録
   */
  registerMediaRecorder(recorder: MediaRecorder) {
    this.mediaRecorders.add(recorder)
    this.resourceUsage.mediaRecorders = this.mediaRecorders.size
  }

  /**
   * MediaRecorderの登録解除
   */
  unregisterMediaRecorder(recorder: MediaRecorder) {
    this.mediaRecorders.delete(recorder)
    this.resourceUsage.mediaRecorders = this.mediaRecorders.size
  }

  /**
   * メモリクリーンアップを実行
   */
  private performMemoryCleanup() {
    // 未使用のAudioContextをクローズ
    this.audioContexts.forEach(context => {
      if (context.state === 'suspended') {
        context.close()
        this.audioContexts.delete(context)
      }
    })

    // 停止されたMediaRecorderをクリーンアップ
    this.mediaRecorders.forEach(recorder => {
      if (recorder.state === 'inactive') {
        this.mediaRecorders.delete(recorder)
      }
    })

    // ガベージコレクションのヒント
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc()
    }

    this.resourceUsage.audioContexts = this.audioContexts.size
    this.resourceUsage.mediaRecorders = this.mediaRecorders.size
  }

  /**
   * 監視を一時停止
   */
  private pauseMonitoring() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * 監視を再開
   */
  private resumeMonitoring() {
    if (!this.intervalId) {
      this.startMonitoring()
    }
  }

  /**
   * リソースの現在の使用状況を取得
   */
  getCurrentUsage(): ResourceUsage {
    this.updateMemoryInfo()
    return { ...this.resourceUsage }
  }

  /**
   * メモリ使用量の履歴を取得
   */
  getMemoryHistory(): MemoryInfo[] {
    return [...this.memoryHistory]
  }

  /**
   * メモリ使用量のトレンドを分析
   */
  analyzeMemoryTrend(): {
    trend: 'increasing' | 'decreasing' | 'stable'
    averageUsage: number
    peakUsage: number
  } {
    if (this.memoryHistory.length < 2) {
      return { trend: 'stable', averageUsage: 0, peakUsage: 0 }
    }

    const recent = this.memoryHistory.slice(-10)
    const totalUsage = recent.reduce((sum, info) => sum + info.usedJSHeapSize, 0)
    const averageUsage = totalUsage / recent.length
    const peakUsage = Math.max(...recent.map(info => info.usedJSHeapSize))

    const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
    const secondHalf = recent.slice(Math.floor(recent.length / 2))

    const firstAvg = firstHalf.reduce((sum, info) => sum + info.usedJSHeapSize, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, info) => sum + info.usedJSHeapSize, 0) / secondHalf.length

    const trend = secondAvg > firstAvg * 1.1 ? 'increasing' :
                 secondAvg < firstAvg * 0.9 ? 'decreasing' : 'stable'

    return { trend, averageUsage, peakUsage }
  }

  /**
   * バイト数を読みやすい形式にフォーマット
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId)
    }

    // すべてのリソースをクリーンアップ
    this.audioContexts.forEach(context => {
      if (context.state !== 'closed') {
        context.close()
      }
    })

    this.audioContexts.clear()
    this.mediaRecorders.clear()
  }

  /**
   * リソース使用量レポートを生成
   */
  generateReport(): {
    memory: any
    resources: ResourceUsage
    trend: any
    recommendations: string[]
  } {
    const current = this.getCurrentUsage()
    const trend = this.analyzeMemoryTrend()
    const recommendations: string[] = []

    if (current.memory && current.memory.usedJSHeapSize > current.memory.jsHeapSizeLimit * 0.7) {
      recommendations.push('メモリ使用量が高くなっています。不要なリソースを解放してください。')
    }

    if (current.audioContexts > 3) {
      recommendations.push('AudioContextが多数作成されています。不要なものは閉じてください。')
    }

    if (current.mediaRecorders > 1) {
      recommendations.push('複数のMediaRecorderが動作中です。重複がないか確認してください。')
    }

    if (trend.trend === 'increasing') {
      recommendations.push('メモリ使用量が増加傾向にあります。メモリリークの可能性があります。')
    }

    return {
      memory: current.memory ? {
        used: this.formatBytes(current.memory.usedJSHeapSize),
        total: this.formatBytes(current.memory.totalJSHeapSize),
        limit: this.formatBytes(current.memory.jsHeapSizeLimit),
        usagePercentage: ((current.memory.usedJSHeapSize / current.memory.jsHeapSizeLimit) * 100).toFixed(1)
      } : null,
      resources: current,
      trend,
      recommendations
    }
  }
}