/**
 * Advanced Performance Metrics Collector
 * Web Vitals とカスタムメトリクスの包括的収集システム
 */

interface VoiceMetrics {
  recordingDuration: number
  recordingQuality: 'low' | 'medium' | 'high'
  transcriptionAccuracy?: number
  audioFileSize: number
  compressionRatio?: number
  processingTime: number
}

interface CollaborationMetrics {
  roomJoinTime: number
  messageDeliveryTime: number
  participantCount: number
  audioLatency: number
  connectionQuality: 'poor' | 'fair' | 'good' | 'excellent'
}

interface AccessibilityMetrics {
  keyboardNavigation: boolean
  screenReaderUsage: boolean
  audioDescriptionUsage: boolean
  contrastLevel: number
  interactionTime: number
}

interface PerformanceData {
  // Core Web Vitals
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  fcp?: number // First Contentful Paint
  ttfb?: number // Time to First Byte

  // Custom Metrics
  voiceMetrics?: VoiceMetrics
  collaborationMetrics?: CollaborationMetrics
  accessibilityMetrics?: AccessibilityMetrics

  // Technical Metrics
  memoryUsage?: number
  networkLatency?: number
  cacheHitRate?: number
  serviceWorkerActive?: boolean
  offlineCapability?: boolean

  // User Context
  timestamp: number
  userAgent: string
  connectionType?: string
  deviceMemory?: number
  hardwareConcurrency?: number
  sessionId: string
}

export class MetricsCollector {
  private static instance: MetricsCollector
  private metrics: PerformanceData = {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    sessionId: this.generateSessionId()
  }
  private observers: Map<string, PerformanceObserver> = new Map()
  private isCollecting = false

  private constructor() {
    this.initializeWebVitals()
    this.initializeCustomObservers()
    this.collectSystemInfo()
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector()
    }
    return MetricsCollector.instance
  }

  /**
   * Initialize Web Vitals collection
   */
  private initializeWebVitals() {
    if (typeof window === 'undefined') return

    // Largest Contentful Paint
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1] as PerformanceEntry
      this.metrics.lcp = lastEntry.startTime
      this.reportMetric('lcp', lastEntry.startTime)
    })

    // First Input Delay
    this.observePerformanceEntry('first-input', (entries) => {
      const entry = entries[0] as any
      this.metrics.fid = entry.processingStart - entry.startTime
      this.reportMetric('fid', this.metrics.fid)
    })

    // Cumulative Layout Shift
    let clsScore = 0
    this.observePerformanceEntry('layout-shift', (entries) => {
      for (const entry of entries as any[]) {
        if (!entry.hadRecentInput) {
          clsScore += entry.value
        }
      }
      this.metrics.cls = clsScore
    })

    // First Contentful Paint
    this.observePerformanceEntry('paint', (entries) => {
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
      if (fcpEntry) {
        this.metrics.fcp = fcpEntry.startTime
        this.reportMetric('fcp', fcpEntry.startTime)
      }
    })

    // Navigation Timing
    this.observePerformanceEntry('navigation', (entries) => {
      const navEntry = entries[0] as PerformanceNavigationTiming
      this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart
      this.reportMetric('ttfb', this.metrics.ttfb)
    })
  }

  /**
   * Initialize custom performance observers
   */
  private initializeCustomObservers() {
    // Memory usage monitoring
    this.startMemoryMonitoring()

    // Network monitoring
    this.startNetworkMonitoring()

    // Service Worker monitoring
    this.startServiceWorkerMonitoring()
  }

  /**
   * Collect system information
   */
  private collectSystemInfo() {
    if (typeof window === 'undefined') return

    const nav = navigator as any

    // Connection information
    if ('connection' in nav) {
      this.metrics.connectionType = nav.connection.effectiveType
    }

    // Device capabilities
    if ('deviceMemory' in nav) {
      this.metrics.deviceMemory = nav.deviceMemory
    }

    if ('hardwareConcurrency' in nav) {
      this.metrics.hardwareConcurrency = nav.hardwareConcurrency
    }

    // Service Worker status
    if ('serviceWorker' in nav) {
      this.metrics.serviceWorkerActive = nav.serviceWorker.controller !== null
    }

    // Offline capability
    this.metrics.offlineCapability = 'onLine' in nav ? nav.onLine : true
  }

  /**
   * Start memory usage monitoring
   */
  private startMemoryMonitoring() {
    if ('memory' in performance) {
      const updateMemoryUsage = () => {
        const memory = (performance as any).memory
        this.metrics.memoryUsage = memory.usedJSHeapSize
      }

      updateMemoryUsage()
      setInterval(updateMemoryUsage, 10000) // Update every 10 seconds
    }
  }

  /**
   * Start network latency monitoring
   */
  private startNetworkMonitoring() {
    // Resource timing monitoring
    this.observePerformanceEntry('resource', (entries) => {
      const networkEntries = entries as PerformanceResourceTiming[]
      const latencies = networkEntries
        .filter(entry => entry.name.includes('/api/'))
        .map(entry => entry.responseEnd - entry.requestStart)

      if (latencies.length > 0) {
        this.metrics.networkLatency = latencies.reduce((a, b) => a + b) / latencies.length
      }
    })

    // Cache performance monitoring
    let cacheHits = 0
    let totalRequests = 0

    this.observePerformanceEntry('resource', (entries) => {
      entries.forEach((entry: PerformanceResourceTiming) => {
        totalRequests++
        if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
          cacheHits++
        }
      })

      if (totalRequests > 0) {
        this.metrics.cacheHitRate = cacheHits / totalRequests
      }
    })
  }

  /**
   * Start Service Worker monitoring
   */
  private startServiceWorkerMonitoring() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_PERFORMANCE') {
          // Service Workerからのパフォーマンスデータを受信
          this.updateMetrics(event.data.metrics)
        }
      })
    }
  }

  /**
   * Record voice recording metrics
   */
  recordVoiceMetrics(metrics: Partial<VoiceMetrics>) {
    this.metrics.voiceMetrics = {
      ...this.metrics.voiceMetrics,
      ...metrics
    } as VoiceMetrics

    this.reportMetric('voice_recording', metrics)
  }

  /**
   * Record collaboration metrics
   */
  recordCollaborationMetrics(metrics: Partial<CollaborationMetrics>) {
    this.metrics.collaborationMetrics = {
      ...this.metrics.collaborationMetrics,
      ...metrics
    } as CollaborationMetrics

    this.reportMetric('collaboration', metrics)
  }

  /**
   * Record accessibility metrics
   */
  recordAccessibilityMetrics(metrics: Partial<AccessibilityMetrics>) {
    this.metrics.accessibilityMetrics = {
      ...this.metrics.accessibilityMetrics,
      ...metrics
    } as AccessibilityMetrics

    this.reportMetric('accessibility', metrics)
  }

  /**
   * Measure function execution time
   */
  measureExecutionTime<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
    const startTime = performance.now()

    const result = fn()

    if (result instanceof Promise) {
      return result.finally(() => {
        const endTime = performance.now()
        this.reportMetric(`execution_time_${name}`, endTime - startTime)
      })
    } else {
      const endTime = performance.now()
      this.reportMetric(`execution_time_${name}`, endTime - startTime)
      return result
    }
  }

  /**
   * Mark custom timing
   */
  mark(name: string): void {
    performance.mark(name)
  }

  /**
   * Measure time between marks
   */
  measure(name: string, startMark: string, endMark?: string): number {
    if (endMark) {
      performance.measure(name, startMark, endMark)
    } else {
      performance.measure(name, startMark)
    }

    const measure = performance.getEntriesByName(name, 'measure')[0]
    const duration = measure.duration

    this.reportMetric(`measure_${name}`, duration)
    return duration
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): PerformanceData {
    return { ...this.metrics }
  }

  /**
   * Send metrics to analytics endpoint
   */
  async sendMetrics(): Promise<void> {
    if (!this.isCollecting) return

    const metricsSnapshot = this.getMetrics()

    try {
      await fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsSnapshot)
      })
    } catch (error) {
      console.warn('Failed to send metrics:', error)

      // Store in IndexedDB for later transmission
      this.storeOfflineMetrics(metricsSnapshot)
    }
  }

  /**
   * Start automatic metrics collection
   */
  startCollection(): void {
    this.isCollecting = true

    // Send metrics every 30 seconds
    setInterval(() => this.sendMetrics(), 30000)

    // Send metrics on page unload
    window.addEventListener('beforeunload', () => {
      navigator.sendBeacon('/api/analytics/metrics', JSON.stringify(this.getMetrics()))
    })

    // Send metrics on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendMetrics()
      }
    })
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    this.isCollecting = false
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
  }

  /**
   * Private helper methods
   */
  private observePerformanceEntry(type: string, callback: (entries: PerformanceEntry[]) => void) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries())
      })

      observer.observe({ entryTypes: [type] })
      this.observers.set(type, observer)
    } catch (error) {
      console.warn(`Performance observer for ${type} not supported:`, error)
    }
  }

  private reportMetric(name: string, value: any) {
    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Metrics] ${name}:`, value)
    }

    // Custom event for real-time monitoring
    window.dispatchEvent(new CustomEvent('metric-recorded', {
      detail: { name, value, timestamp: Date.now() }
    }))
  }

  private updateMetrics(newMetrics: Partial<PerformanceData>) {
    this.metrics = { ...this.metrics, ...newMetrics }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private async storeOfflineMetrics(metrics: PerformanceData) {
    if ('indexedDB' in window) {
      try {
        const db = await this.openIndexedDB()
        const transaction = db.transaction(['metrics'], 'readwrite')
        const store = transaction.objectStore('metrics')
        await store.add(metrics)
      } catch (error) {
        console.warn('Failed to store offline metrics:', error)
      }
    }
  }

  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WakeupMetrics', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('metrics')) {
          const store = db.createObjectStore('metrics', {
            keyPath: 'timestamp',
            autoIncrement: true
          })
          store.createIndex('sessionId', 'sessionId', { unique: false })
        }
      }
    })
  }
}

// React Hook for metrics collection
export function usePerformanceMetrics() {
  const collector = MetricsCollector.getInstance()

  return {
    recordVoiceMetrics: (metrics: Partial<VoiceMetrics>) => collector.recordVoiceMetrics(metrics),
    recordCollaborationMetrics: (metrics: Partial<CollaborationMetrics>) => collector.recordCollaborationMetrics(metrics),
    recordAccessibilityMetrics: (metrics: Partial<AccessibilityMetrics>) => collector.recordAccessibilityMetrics(metrics),
    measureExecutionTime: <T>(name: string, fn: () => T | Promise<T>) => collector.measureExecutionTime(name, fn),
    mark: (name: string) => collector.mark(name),
    measure: (name: string, startMark: string, endMark?: string) => collector.measure(name, startMark, endMark),
    getMetrics: () => collector.getMetrics()
  }
}