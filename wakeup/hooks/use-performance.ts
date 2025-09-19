import { useEffect, useRef, useState } from 'react'

interface PerformanceMetrics {
  renderTime: number
  componentName: string
  timestamp: number
}

/**
 * コンポーネントのレンダリング時間を測定
 */
export function useRenderPerformance(componentName: string) {
  const renderStartRef = useRef<number>(0)
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])

  useEffect(() => {
    renderStartRef.current = performance.now()
  })

  useEffect(() => {
    if (renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current
      const metric: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: Date.now()
      }

      setMetrics(prev => [...prev.slice(-9), metric]) // 最新10件を保持

      // 開発モードでのログ出力
      if (process.env.NODE_ENV === 'development' && renderTime > 16) {
        console.warn(`[Performance] ${componentName} rendered in ${renderTime.toFixed(2)}ms (>16ms)`)
      }
    }
  })

  return metrics
}

/**
 * メモリ使用量の監視
 */
export function useMemoryUsage() {
  const [memoryInfo, setMemoryInfo] = useState<any | null>(null)

  useEffect(() => {
    const checkMemory = () => {
      if ('memory' in performance) {
        setMemoryInfo((performance as any).memory)
      }
    }

    checkMemory()
    const interval = setInterval(checkMemory, 5000) // 5秒ごとにチェック

    return () => clearInterval(interval)
  }, [])

  return memoryInfo
}

/**
 * APIレスポンス時間の測定
 */
export function useApiPerformance() {
  const [apiMetrics, setApiMetrics] = useState<Array<{
    url: string
    method: string
    duration: number
    timestamp: number
  }>>([])

  const measureApiCall = async <T>(
    apiCall: () => Promise<T>,
    metadata: { url: string; method: string }
  ): Promise<T> => {
    const start = performance.now()

    try {
      const result = await apiCall()
      const duration = performance.now() - start

      setApiMetrics(prev => [...prev.slice(-19), {
        ...metadata,
        duration,
        timestamp: Date.now()
      }]) // 最新20件を保持

      if (duration > 1000) {
        console.warn(`[API Performance] ${metadata.method} ${metadata.url} took ${duration.toFixed(2)}ms`)
      }

      return result
    } catch (error) {
      const duration = performance.now() - start
      console.error(`[API Error] ${metadata.method} ${metadata.url} failed after ${duration.toFixed(2)}ms`, error)
      throw error
    }
  }

  return { apiMetrics, measureApiCall }
}

/**
 * 総合パフォーマンス監視
 */
export function usePerformanceMonitor(componentName: string) {
  const renderMetrics = useRenderPerformance(componentName)
  const memoryInfo = useMemoryUsage()
  const { apiMetrics, measureApiCall } = useApiPerformance()

  return {
    renderMetrics,
    memoryInfo,
    apiMetrics,
    measureApiCall
  }
}