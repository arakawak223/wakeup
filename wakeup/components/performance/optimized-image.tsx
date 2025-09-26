'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { CDNOptimizer } from '@/lib/performance/cdn-optimizer'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  quality?: number
  formats?: ('webp' | 'avif' | 'jpeg')[]
  sizes?: string
  onLoad?: () => void
  onError?: (error: Error) => void
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  quality = 85,
  formats = ['webp', 'avif', 'jpeg'],
  sizes,
  onLoad,
  onError
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [loadTime, setLoadTime] = useState<number>(0)

  // Initialize CDN optimizer
  const [cdnOptimizer] = useState(() => {
    return new CDNOptimizer({
      provider: 'cloudflare',
      domains: [process.env.NEXT_PUBLIC_CDN_URL || ''],
      cachingRules: [],
      edgeLocations: []
    })
  })

  /**
   * 最適化された画像URLを生成
   */
  const generateOptimizedUrl = useCallback((originalSrc: string): string => {
    if (originalSrc.startsWith('data:') || originalSrc.startsWith('blob:')) {
      return originalSrc
    }

    // CDN最適化パラメータを追加
    const url = new URL(originalSrc, window.location.origin)
    url.searchParams.set('quality', quality.toString())
    url.searchParams.set('auto', 'format,compress')

    if (width) url.searchParams.set('w', width.toString())
    if (height) url.searchParams.set('h', height.toString())

    return url.toString()
  }, [quality, width, height])

  /**
   * 画像形式の対応チェック
   */
  const checkFormatSupport = useCallback(async (format: string): Promise<boolean> => {
    if (typeof window === 'undefined') return false

    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1

    try {
      const mimeType = `image/${format}`
      const dataUrl = canvas.toDataURL(mimeType)
      return dataUrl.startsWith(`data:${mimeType}`)
    } catch {
      return false
    }
  }, [])

  /**
   * 最適な画像形式を選択
   */
  const selectOptimalFormat = useCallback(async (): Promise<string> => {
    for (const format of formats) {
      const isSupported = await checkFormatSupport(format)
      if (isSupported) {
        return format
      }
    }
    return 'jpeg' // Fallback
  }, [formats, checkFormatSupport])

  /**
   * 画像の事前読み込み
   */
  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    })
  }, [])

  /**
   * パフォーマンス測定
   */
  const measureLoadTime = useCallback(() => {
    const startTime = performance.now()

    return () => {
      const endTime = performance.now()
      setLoadTime(endTime - startTime)
    }
  }, [])

  /**
   * 画像読み込みハンドラ
   */
  const handleLoad = useCallback(() => {
    setIsLoading(false)
    onLoad?.()
  }, [onLoad])

  /**
   * エラーハンドラ
   */
  const handleError = useCallback((error: Error) => {
    setHasError(true)
    setIsLoading(false)

    // フォールバック画像を試行
    const fallbackSrc = '/images/fallback.webp'
    if (imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc)
      setHasError(false)
    } else {
      onError?.(error)
    }
  }, [imageSrc, onError])

  /**
   * レスポンシブ画像サイズ生成
   */
  const generateResponsiveSizes = useCallback((): string => {
    if (sizes) return sizes

    // デフォルトのレスポンシブサイズ
    return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
  }, [sizes])

  /**
   * 画像最適化の初期化
   */
  useEffect(() => {
    let isMounted = true
    const measureEnd = measureLoadTime()

    const optimizeImage = async () => {
      try {
        // 最適な形式を選択
        const optimalFormat = await selectOptimalFormat()

        // CDN最適化URLを生成
        let optimizedSrc = generateOptimizedUrl(src)

        // 形式パラメータを追加
        const url = new URL(optimizedSrc, window.location.origin)
        url.searchParams.set('format', optimalFormat)
        optimizedSrc = url.toString()

        // 高優先度画像の場合は事前読み込み
        if (priority) {
          await preloadImage(optimizedSrc)
        }

        if (isMounted) {
          setImageSrc(optimizedSrc)
        }
      } catch (error) {
        if (isMounted) {
          handleError(error instanceof Error ? error : new Error('Image optimization failed'))
        }
      } finally {
        measureEnd()
      }
    }

    optimizeImage()

    return () => {
      isMounted = false
    }
  }, [src, generateOptimizedUrl, selectOptimalFormat, priority, preloadImage, measureLoadTime, handleError])

  /**
   * パフォーマンス情報の報告
   */
  useEffect(() => {
    if (!isLoading && loadTime > 0) {
      // パフォーマンスメトリクスを報告
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'image_load', {
          custom_map: { metric1: 'load_time' },
          metric1: loadTime,
          event_category: 'Performance',
          event_label: src
        })
      }
    }
  }, [isLoading, loadTime, src])

  return (
    <div className={`relative ${className || ''}`}>
      {isLoading && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse rounded"
          style={{
            width: width || '100%',
            height: height || 200,
            aspectRatio: width && height ? `${width}/${height}` : undefined
          }}
        />
      )}

      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        quality={quality}
        sizes={generateResponsiveSizes()}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className || ''}`}
        onLoad={handleLoad}
        onError={(e) => {
          handleError(new Error(`Failed to load image: ${imageSrc}`))
        }}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
      />

      {/* エラー状態の表示 */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
          <div className="text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm">画像を読み込めませんでした</p>
          </div>
        </div>
      )}

      {/* デバッグ情報（開発環境のみ） */}
      {process.env.NODE_ENV === 'development' && loadTime > 0 && (
        <div className="absolute top-0 left-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded">
          Load: {Math.round(loadTime)}ms
        </div>
      )}
    </div>
  )
}

// WebP対応チェック用のユーティリティ
export const checkWebPSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image()
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2)
    }
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
  })
}

// AVIF対応チェック用のユーティリティ
export const checkAVIFSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const avif = new Image()
    avif.onload = avif.onerror = () => {
      resolve(avif.height === 2)
    }
    avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgRAAAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAkASQEBggAOODA4M0Rr4ASgAADmAAA='
  })
}

export default OptimizedImage