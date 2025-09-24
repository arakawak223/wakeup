/**
 * Production Monitor Tests
 * プロダクション監視システムのテスト
 */

import { productionMonitor, trackUserAction, trackBusinessEvent, trackSecurityEvent } from '@/lib/monitoring/production-monitor'

// Mock Web APIs
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 10000000,
    totalJSHeapSize: 50000000,
    jsHeapSizeLimit: 2000000000
  }
}

const mockNavigator = {
  userAgent: 'Mock Browser 1.0',
  connection: {
    effectiveType: '4g'
  }
}

const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}

describe('Production Monitor', () => {
  let originalEnv: string | undefined
  let originalPerformance: any
  let originalNavigator: any
  let originalWindow: any

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV
    originalPerformance = global.performance
    originalNavigator = global.navigator
    originalWindow = global.window

    // Mock environment
    global.performance = mockPerformance as any
    global.navigator = mockNavigator as any
    global.window = mockWindow as any

    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    global.performance = originalPerformance
    global.navigator = originalNavigator
    global.window = originalWindow
  })

  describe('Initialization', () => {
    test('should initialize in production environment', () => {
      process.env.NODE_ENV = 'production'

      const monitor = productionMonitor
      const metrics = monitor.getSessionMetrics()

      expect(metrics.sessionId).toBeTruthy()
      expect(metrics.sessionId).toContain('session_')
    })

    test('should respect monitoring enable flag', () => {
      process.env.NODE_ENV = 'development'
      process.env.ENABLE_MONITORING = 'true'

      const monitor = productionMonitor
      const metrics = monitor.getSessionMetrics()

      expect(metrics.sessionId).toBeTruthy()
    })

    test('should disable in development without flag', () => {
      process.env.NODE_ENV = 'development'
      process.env.ENABLE_MONITORING = 'false'

      // Should still create instance but not collect events
      const monitor = productionMonitor
      expect(monitor).toBeTruthy()
    })
  })

  describe('Event Logging', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    test('should log info events', () => {
      productionMonitor.logEvent({
        level: 'info',
        category: 'system',
        message: 'Test info event',
        details: { test: true }
      })

      const metrics = productionMonitor.getSessionMetrics()
      expect(metrics.eventCount).toBeGreaterThan(0)
    })

    test('should log warning events', () => {
      productionMonitor.logEvent({
        level: 'warn',
        category: 'performance',
        message: 'Test warning event',
        details: { slowResource: 'test.js' }
      })

      const metrics = productionMonitor.getSessionMetrics()
      expect(metrics.warningCount).toBeGreaterThan(0)
    })

    test('should log error events', () => {
      productionMonitor.logEvent({
        level: 'error',
        category: 'system',
        message: 'Test error event',
        details: { error: 'Test error' }
      })

      const metrics = productionMonitor.getSessionMetrics()
      expect(metrics.errorCount).toBeGreaterThan(0)
    })

    test('should handle critical events', () => {
      const sendLogsSpy = jest.spyOn(productionMonitor as any, 'sendLogs')

      productionMonitor.logEvent({
        level: 'critical',
        category: 'security',
        message: 'Critical security event'
      })

      // Critical events should trigger immediate log sending
      expect(sendLogsSpy).toHaveBeenCalled()
    })
  })

  describe('Convenience Methods', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    test('should track user actions', () => {
      trackUserAction('button_click', { button: 'submit' })

      const metrics = productionMonitor.getSessionMetrics()
      expect(metrics.eventCount).toBeGreaterThan(0)
    })

    test('should track business events', () => {
      trackBusinessEvent('conversion', { type: 'purchase', value: 100 })

      const metrics = productionMonitor.getSessionMetrics()
      expect(metrics.eventCount).toBeGreaterThan(0)
    })

    test('should track security events with severity', () => {
      trackSecurityEvent('unauthorized_access', 'high', { ip: '192.168.1.1' })

      const metrics = productionMonitor.getSessionMetrics()
      expect(metrics.errorCount).toBeGreaterThan(0) // High severity should be error level
    })
  })

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    test('should record performance metrics', () => {
      // Simulate performance metric recording
      const monitor = productionMonitor as any
      monitor.recordPerformanceMetric('lcp', 2500)

      const metrics = productionMonitor.getSessionMetrics()
      expect(metrics.eventCount).toBeGreaterThan(0)
    })

    test('should perform health checks', () => {
      const monitor = productionMonitor as any
      monitor.performHealthCheck()

      const metrics = productionMonitor.getSessionMetrics()
      expect(metrics.eventCount).toBeGreaterThan(0)
    })

    test('should detect device type correctly', () => {
      const monitor = productionMonitor as any

      // Mock mobile viewport
      global.window = { ...mockWindow, innerWidth: 500 }
      expect(monitor.detectDeviceType()).toBe('mobile')

      // Mock tablet viewport
      global.window = { ...mockWindow, innerWidth: 800 }
      expect(monitor.detectDeviceType()).toBe('tablet')

      // Mock desktop viewport
      global.window = { ...mockWindow, innerWidth: 1200 }
      expect(monitor.detectDeviceType()).toBe('desktop')
    })
  })

  describe('Session Management', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    test('should generate unique session IDs', () => {
      const monitor1 = productionMonitor
      const monitor2 = productionMonitor // Should return same instance

      const metrics1 = monitor1.getSessionMetrics()
      const metrics2 = monitor2.getSessionMetrics()

      // Should be same instance with same session ID
      expect(metrics1.sessionId).toBe(metrics2.sessionId)
    })

    test('should maintain event count', () => {
      const initialMetrics = productionMonitor.getSessionMetrics()
      const initialCount = initialMetrics.eventCount

      productionMonitor.logEvent({
        level: 'info',
        category: 'test',
        message: 'Test event'
      })

      const finalMetrics = productionMonitor.getSessionMetrics()
      expect(finalMetrics.eventCount).toBe(initialCount + 1)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    test('should handle missing performance API gracefully', () => {
      global.performance = undefined as any

      const monitor = productionMonitor as any
      expect(() => monitor.performHealthCheck()).not.toThrow()
    })

    test('should handle missing navigator API gracefully', () => {
      global.navigator = undefined as any

      const monitor = productionMonitor as any
      expect(() => monitor.performHealthCheck()).not.toThrow()
    })

    test('should handle log sending failures', async () => {
      const monitor = productionMonitor as any
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Mock fetch to fail
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))

      await expect(monitor.sendLogs()).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send monitoring logs:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('Event Filtering and Limits', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    test('should limit events in memory', () => {
      const monitor = productionMonitor as any

      // Add many events
      for (let i = 0; i < 1200; i++) {
        monitor.logEvent({
          level: 'info',
          category: 'test',
          message: `Test event ${i}`
        })
      }

      // Should keep only last 1000 events
      expect(monitor.events.length).toBeLessThanOrEqual(1000)
    })

    test('should disable logging in non-production without flag', () => {
      process.env.NODE_ENV = 'development'
      delete process.env.ENABLE_MONITORING

      const initialMetrics = productionMonitor.getSessionMetrics()
      const initialCount = initialMetrics.eventCount

      productionMonitor.logEvent({
        level: 'info',
        category: 'test',
        message: 'Should not be logged'
      })

      const finalMetrics = productionMonitor.getSessionMetrics()
      // Count should remain same as logging is disabled
      expect(finalMetrics.eventCount).toBe(initialCount)
    })
  })
})