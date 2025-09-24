/**
 * Production Monitoring System
 * プロダクション環境での包括的監視システム
 */

interface MonitoringEvent {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'critical'
  category: 'performance' | 'security' | 'user' | 'system' | 'business'
  message: string
  details?: Record<string, any>
  userId?: string
  sessionId?: string
}

interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay
  cls: number | null // Cumulative Layout Shift

  // Navigation Timing
  ttfb: number | null // Time to First Byte
  fcp: number | null  // First Contentful Paint
  domContentLoaded: number | null
  loadComplete: number | null

  // Memory & Resources
  memoryUsed: number | null
  memoryTotal: number | null
  connectionType: string | null
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown'
}

class ProductionMonitor {
  private static instance: ProductionMonitor
  private events: MonitoringEvent[] = []
  private sessionId: string
  private isEnabled: boolean

  private constructor() {
    this.sessionId = this.generateSessionId()
    this.isEnabled = process.env.NODE_ENV === 'production' ||
                    process.env.ENABLE_MONITORING === 'true'

    if (this.isEnabled && typeof window !== 'undefined') {
      this.initializeMonitoring()
    }
  }

  static getInstance(): ProductionMonitor {
    if (!ProductionMonitor.instance) {
      ProductionMonitor.instance = new ProductionMonitor()
    }
    return ProductionMonitor.instance
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeMonitoring(): void {
    // Error tracking
    window.addEventListener('error', (event) => {
      this.logEvent({
        level: 'error',
        category: 'system',
        message: `JavaScript Error: ${event.error?.message || event.message}`,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      })
    })

    // Promise rejection tracking
    window.addEventListener('unhandledrejection', (event) => {
      this.logEvent({
        level: 'error',
        category: 'system',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        details: { reason: event.reason }
      })
    })

    // Performance monitoring
    this.startPerformanceMonitoring()

    // User interaction tracking
    this.startUserInteractionTracking()

    // Periodic health checks
    setInterval(() => this.performHealthCheck(), 60000) // Every minute

    // Send logs periodically
    setInterval(() => this.sendLogs(), 30000) // Every 30 seconds
  }

  private startPerformanceMonitoring(): void {
    if ('performance' in window && 'observer' in window.PerformanceObserver.prototype) {
      // Core Web Vitals monitoring
      import('web-vitals').then(({ getLCP, getFID, getCLS, getFCP, getTTFB }) => {
        getLCP((metric) => this.recordPerformanceMetric('lcp', metric.value))
        getFID((metric) => this.recordPerformanceMetric('fid', metric.value))
        getCLS((metric) => this.recordPerformanceMetric('cls', metric.value))
        getFCP((metric) => this.recordPerformanceMetric('fcp', metric.value))
        getTTFB((metric) => this.recordPerformanceMetric('ttfb', metric.value))
      }).catch(() => {
        // Fallback for manual Core Web Vitals measurement
        this.measureCoreWebVitalsManually()
      })
    }

    // Resource timing monitoring
    this.monitorResourceTiming()
  }

  private measureCoreWebVitalsManually(): void {
    // Manual LCP measurement
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      this.recordPerformanceMetric('lcp', lastEntry.startTime)
    })

    try {
      observer.observe({ entryTypes: ['largest-contentful-paint'] })
    } catch (e) {
      console.warn('LCP measurement not supported')
    }
  }

  private monitorResourceTiming(): void {
    // Monitor slow resources
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (entry.duration > 1000) { // Resources taking more than 1 second
          this.logEvent({
            level: 'warn',
            category: 'performance',
            message: `Slow resource detected: ${entry.name}`,
            details: {
              duration: entry.duration,
              size: entry.transferSize,
              type: entry.initiatorType
            }
          })
        }
      })
    })

    try {
      observer.observe({ entryTypes: ['resource'] })
    } catch (e) {
      console.warn('Resource timing monitoring not supported')
    }
  }

  private startUserInteractionTracking(): void {
    // Track user engagement
    let lastActivity = Date.now()

    const updateActivity = () => {
      lastActivity = Date.now()
    }

    ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    // Track user sessions
    setInterval(() => {
      const inactiveTime = Date.now() - lastActivity
      if (inactiveTime > 300000) { // 5 minutes of inactivity
        this.logEvent({
          level: 'info',
          category: 'user',
          message: 'User session appears inactive',
          details: { inactiveTime }
        })
      }
    }, 60000)
  }

  private recordPerformanceMetric(metric: string, value: number): void {
    this.logEvent({
      level: 'info',
      category: 'performance',
      message: `Performance metric recorded: ${metric}`,
      details: { metric, value }
    })
  }

  private performHealthCheck(): void {
    const metrics: PerformanceMetrics = {
      lcp: null,
      fid: null,
      cls: null,
      ttfb: null,
      fcp: null,
      domContentLoaded: null,
      loadComplete: null,
      memoryUsed: null,
      memoryTotal: null,
      connectionType: null,
      deviceType: this.detectDeviceType()
    }

    // Memory information
    if ('memory' in performance) {
      const memory = (performance as any).memory
      metrics.memoryUsed = memory.usedJSHeapSize
      metrics.memoryTotal = memory.totalJSHeapSize
    }

    // Connection information
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      metrics.connectionType = connection.effectiveType
    }

    this.logEvent({
      level: 'info',
      category: 'system',
      message: 'Health check performed',
      details: { metrics }
    })
  }

  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
    if (typeof window === 'undefined') return 'unknown'

    const width = window.innerWidth
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  public logEvent(event: Omit<MonitoringEvent, 'timestamp' | 'sessionId'>): void {
    if (!this.isEnabled) return

    const fullEvent: MonitoringEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId
    }

    this.events.push(fullEvent)

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      console.group(`[Monitor] ${event.level.toUpperCase()} - ${event.category}`)
      console.log(event.message)
      if (event.details) {
        console.log('Details:', event.details)
      }
      console.groupEnd()
    }

    // Keep only last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000)
    }

    // Send critical events immediately
    if (event.level === 'critical') {
      this.sendLogs()
    }
  }

  private async sendLogs(): Promise<void> {
    if (this.events.length === 0) return

    try {
      const payload = {
        sessionId: this.sessionId,
        timestamp: Date.now(),
        events: [...this.events],
        metadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          referrer: document.referrer
        }
      }

      // In a real application, send to your logging service
      if (process.env.NEXT_PUBLIC_MONITORING_ENDPOINT) {
        await fetch(process.env.NEXT_PUBLIC_MONITORING_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      }

      // Clear sent events
      this.events = []
    } catch (error) {
      console.warn('Failed to send monitoring logs:', error)
    }
  }

  public getSessionMetrics(): {
    sessionId: string
    eventCount: number
    errorCount: number
    warningCount: number
    lastActivity: number
  } {
    const errorCount = this.events.filter(e => e.level === 'error' || e.level === 'critical').length
    const warningCount = this.events.filter(e => e.level === 'warn').length

    return {
      sessionId: this.sessionId,
      eventCount: this.events.length,
      errorCount,
      warningCount,
      lastActivity: Date.now()
    }
  }

  public trackUserAction(action: string, details?: Record<string, any>): void {
    this.logEvent({
      level: 'info',
      category: 'user',
      message: `User action: ${action}`,
      details
    })
  }

  public trackBusinessEvent(event: string, details?: Record<string, any>): void {
    this.logEvent({
      level: 'info',
      category: 'business',
      message: `Business event: ${event}`,
      details
    })
  }

  public trackSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>): void {
    const level = severity === 'critical' ? 'critical' : severity === 'high' ? 'error' : 'warn'

    this.logEvent({
      level,
      category: 'security',
      message: `Security event: ${event}`,
      details: { severity, ...details }
    })
  }
}

// Export singleton instance
export const productionMonitor = ProductionMonitor.getInstance()

// Export convenience methods
export const trackUserAction = (action: string, details?: Record<string, any>) =>
  productionMonitor.trackUserAction(action, details)

export const trackBusinessEvent = (event: string, details?: Record<string, any>) =>
  productionMonitor.trackBusinessEvent(event, details)

export const trackSecurityEvent = (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>) =>
  productionMonitor.trackSecurityEvent(event, severity, details)

export default productionMonitor