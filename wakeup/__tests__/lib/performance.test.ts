import {
  debounce,
  throttle,
  DataCache,
  VirtualScrollCalculator,
  PerformanceMonitor
} from '@/lib/performance/lazy-loading'

describe('Performance Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    DataCache.clear()
    PerformanceMonitor.clear()
  })

  describe('debounce', () => {
    it('delays function execution', async () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn('test')
      expect(mockFn).not.toHaveBeenCalled()

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(mockFn).toHaveBeenCalledWith('test')
    })

    it('cancels previous calls when called multiple times', async () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn('first')
      debouncedFn('second')
      debouncedFn('third')

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('third')
    })
  })

  describe('throttle', () => {
    it('limits function execution frequency', async () => {
      const mockFn = jest.fn()
      const throttledFn = throttle(mockFn, 100)

      throttledFn('first')
      throttledFn('second')
      throttledFn('third')

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('first')

      await new Promise(resolve => setTimeout(resolve, 150))

      throttledFn('fourth')
      expect(mockFn).toHaveBeenCalledTimes(2)
      expect(mockFn).toHaveBeenCalledWith('fourth')
    })
  })

  describe('DataCache', () => {
    it('stores and retrieves data', () => {
      const testData = { name: 'test', value: 123 }
      DataCache.set('test-key', testData)

      const retrieved = DataCache.get('test-key')
      expect(retrieved).toEqual(testData)
    })

    it('returns null for non-existent keys', () => {
      const result = DataCache.get('non-existent')
      expect(result).toBeNull()
    })

    it('respects TTL and expires data', () => {
      const testData = { expired: true }
      DataCache.set('test-key', testData, 10) // 10ms TTL

      expect(DataCache.get('test-key')).toEqual(testData)

      // Wait for expiration
      setTimeout(() => {
        expect(DataCache.get('test-key')).toBeNull()
      }, 20)
    })

    it('checks if key exists', () => {
      DataCache.set('existing-key', 'value')

      expect(DataCache.has('existing-key')).toBe(true)
      expect(DataCache.has('non-existing-key')).toBe(false)
    })

    it('clears all data', () => {
      DataCache.set('key1', 'value1')
      DataCache.set('key2', 'value2')

      DataCache.clear()

      expect(DataCache.has('key1')).toBe(false)
      expect(DataCache.has('key2')).toBe(false)
    })

    it('cleans up expired entries', () => {
      DataCache.set('expired-key', 'value', 1) // 1ms TTL
      DataCache.set('valid-key', 'value', 10000) // 10s TTL

      setTimeout(() => {
        DataCache.cleanup()
        expect(DataCache.has('expired-key')).toBe(false)
        expect(DataCache.has('valid-key')).toBe(true)
      }, 10)
    })
  })

  describe('VirtualScrollCalculator', () => {
    it('calculates visible range correctly', () => {
      const calculator = new VirtualScrollCalculator(50, 300, 2) // 50px items, 300px container, 2 overscan

      const range = calculator.calculateVisibleRange(100, 100)

      expect(range.startIndex).toBe(0) // Math.max(0, floor(100/50) - 2) = 0
      expect(range.endIndex).toBe(10) // Math.min(99, floor(100/50) + ceil(300/50) + 2) = 10
      expect(range.visibleStartIndex).toBe(2) // floor(100/50) = 2
      expect(range.visibleEndIndex).toBe(8) // Math.min(99, 2 + ceil(300/50)) = 8
    })

    it('calculates item offset', () => {
      const calculator = new VirtualScrollCalculator(50, 300)

      expect(calculator.getItemOffset(0)).toBe(0)
      expect(calculator.getItemOffset(5)).toBe(250)
      expect(calculator.getItemOffset(10)).toBe(500)
    })

    it('calculates total height', () => {
      const calculator = new VirtualScrollCalculator(50, 300)

      expect(calculator.getTotalHeight(10)).toBe(500)
      expect(calculator.getTotalHeight(0)).toBe(0)
      expect(calculator.getTotalHeight(100)).toBe(5000)
    })

    it('handles edge cases in visible range calculation', () => {
      const calculator = new VirtualScrollCalculator(50, 300, 1)

      // Test at the beginning
      const rangeStart = calculator.calculateVisibleRange(0, 10)
      expect(rangeStart.startIndex).toBe(0)

      // Test at the end
      const rangeEnd = calculator.calculateVisibleRange(400, 10)
      expect(rangeEnd.endIndex).toBe(9) // totalItems - 1
    })
  })

  describe('PerformanceMonitor', () => {
    it('marks and measures performance', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      PerformanceMonitor.mark('test-start')

      // Simulate some work
      const start = performance.now()
      while (performance.now() - start < 10) {
        // Busy wait for ~10ms
      }

      const duration = PerformanceMonitor.measure('test-duration', 'test-start')

      expect(duration).toBeGreaterThan(0)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/test-duration: \d+\.\d+ms/)
      )

      consoleSpy.mockRestore()
    })

    it('warns when mark is not found', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const duration = PerformanceMonitor.measure('test', 'non-existent-mark')

      expect(duration).toBe(0)
      expect(consoleSpy).toHaveBeenCalledWith(
        "マーク 'non-existent-mark' が見つかりません"
      )

      consoleSpy.mockRestore()
    })

    it('clears all marks', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      PerformanceMonitor.mark('test-mark')
      PerformanceMonitor.clear()

      const duration = PerformanceMonitor.measure('test', 'test-mark')
      expect(duration).toBe(0)

      consoleSpy.mockRestore()
    })
  })
})