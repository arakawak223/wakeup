/**
 * パフォーマンス最適化ユーティリティ
 * 遅延読み込み、メモ化、キャッシュなど
 */

// 画像の遅延読み込み
export class LazyImageLoader {
  private static observer: IntersectionObserver | null = null
  private static cache = new Map<string, HTMLImageElement>()

  static initialize() {
    if (typeof window === 'undefined') return

    if (!this.observer) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement
              const src = img.dataset.src
              if (src) {
                this.loadImage(img, src)
                this.observer?.unobserve(img)
              }
            }
          })
        },
        { rootMargin: '50px' }
      )
    }
  }

  static observe(img: HTMLImageElement) {
    if (this.observer) {
      this.observer.observe(img)
    }
  }

  private static async loadImage(img: HTMLImageElement, src: string) {
    // キャッシュから取得を試行
    const cached = this.cache.get(src)
    if (cached) {
      img.src = cached.src
      img.classList.remove('loading')
      return
    }

    // 新しい画像を読み込み
    const newImg = new Image()
    newImg.onload = () => {
      img.src = src
      img.classList.remove('loading')
      this.cache.set(src, newImg)
    }
    newImg.onerror = () => {
      img.classList.add('error')
      img.classList.remove('loading')
    }
    newImg.src = src
  }
}

// 音声ファイルの事前読み込み
export class AudioPreloader {
  private static cache = new Map<string, AudioBuffer>()
  private static audioContext: AudioContext | null = null

  static initialize() {
    if (typeof window === 'undefined') return

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn('AudioContext初期化に失敗しました:', error)
    }
  }

  static async preloadAudio(url: string): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null

    // キャッシュから取得
    const cached = this.cache.get(url)
    if (cached) return cached

    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      this.cache.set(url, audioBuffer)
      return audioBuffer
    } catch (error) {
      console.error('音声プリロードエラー:', error)
      return null
    }
  }

  static async playPreloadedAudio(url: string): Promise<void> {
    if (!this.audioContext) return

    const audioBuffer = this.cache.get(url)
    if (!audioBuffer) {
      // キャッシュにない場合は通常の再生にフォールバック
      const audio = new Audio(url)
      audio.play().catch(console.error)
      return
    }

    try {
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start()
    } catch (error) {
      console.error('プリロード音声再生エラー:', error)
    }
  }
}

// データキャッシュユーティリティ
export class DataCache {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  static set(key: string, data: any, ttlMs = 5 * 60 * 1000) { // デフォルト5分
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  static get<T = any>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  static has(key: string): boolean {
    return this.get(key) !== null
  }

  static clear() {
    this.cache.clear()
  }

  static cleanup() {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// デバウンス関数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

// スロットル関数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// 仮想スクロール用のアイテム計算
export class VirtualScrollCalculator {
  private itemHeight: number
  private containerHeight: number
  private overscan: number

  constructor(itemHeight: number, containerHeight: number, overscan = 5) {
    this.itemHeight = itemHeight
    this.containerHeight = containerHeight
    this.overscan = overscan
  }

  calculateVisibleRange(scrollTop: number, totalItems: number) {
    const visibleItemsCount = Math.ceil(this.containerHeight / this.itemHeight)
    const startIndex = Math.floor(scrollTop / this.itemHeight)
    const endIndex = Math.min(startIndex + visibleItemsCount, totalItems - 1)

    // オーバースキャンを追加
    const startWithOverscan = Math.max(0, startIndex - this.overscan)
    const endWithOverscan = Math.min(totalItems - 1, endIndex + this.overscan)

    return {
      startIndex: startWithOverscan,
      endIndex: endWithOverscan,
      visibleStartIndex: startIndex,
      visibleEndIndex: endIndex
    }
  }

  getItemOffset(index: number) {
    return index * this.itemHeight
  }

  getTotalHeight(totalItems: number) {
    return totalItems * this.itemHeight
  }
}

// パフォーマンス測定ユーティリティ
export class PerformanceMonitor {
  private static marks = new Map<string, number>()

  static mark(name: string) {
    this.marks.set(name, performance.now())
  }

  static measure(name: string, startMark?: string): number {
    const endTime = performance.now()
    const startTime = startMark ? this.marks.get(startMark) : this.marks.get(name)

    if (startTime === undefined) {
      console.warn(`マーク '${startMark || name}' が見つかりません`)
      return 0
    }

    const duration = endTime - startTime
    console.log(`${name}: ${duration.toFixed(2)}ms`)

    return duration
  }

  static clear() {
    this.marks.clear()
  }
}

// 初期化関数
export function initializePerformanceOptimizations() {
  if (typeof window !== 'undefined') {
    LazyImageLoader.initialize()
    AudioPreloader.initialize()

    // 定期的にキャッシュをクリーンアップ
    setInterval(() => {
      DataCache.cleanup()
    }, 10 * 60 * 1000) // 10分ごと
  }
}