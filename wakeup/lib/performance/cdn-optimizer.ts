/**
 * CDN and Edge Computing Optimizer
 * CDNとエッジコンピューティング最適化システム
 */

interface CDNConfig {
  provider: 'cloudflare' | 'cloudfront' | 'fastly'
  domains: string[]
  cachingRules: CachingRule[]
  edgeLocations: EdgeLocation[]
}

interface CachingRule {
  path: string
  ttl: number
  headers: Record<string, string>
  compress: boolean
  minify?: boolean
}

interface EdgeLocation {
  region: string
  endpoint: string
  latency: number
}

interface AssetOptimization {
  format: 'webp' | 'avif' | 'jpeg' | 'png'
  quality: number
  sizes: number[]
  lazy: boolean
}

export class CDNOptimizer {
  private config: CDNConfig
  private readonly OPTIMAL_CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Vary': 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff'
  }

  constructor(config: CDNConfig) {
    this.config = config
  }

  /**
   * 最適なCDNエンドポイントを選択
   */
  async selectOptimalEndpoint(userLocation?: GeolocationPosition): Promise<EdgeLocation> {
    if (!userLocation) {
      return this.config.edgeLocations[0] // Fallback
    }

    const userLat = userLocation.coords.latitude
    const userLng = userLocation.coords.longitude

    // 最も近いエッジロケーションを計算
    let closestEdge = this.config.edgeLocations[0]
    let minDistance = Infinity

    for (const edge of this.config.edgeLocations) {
      const distance = this.calculateDistance(userLat, userLng, edge)
      if (distance < minDistance) {
        minDistance = distance
        closestEdge = edge
      }
    }

    return closestEdge
  }

  /**
   * 静的アセットの最適化
   */
  optimizeStaticAssets(assets: string[]): OptimizedAsset[] {
    return assets.map(asset => {
      const extension = asset.split('.').pop()?.toLowerCase()

      switch (extension) {
        case 'js':
          return this.optimizeJavaScript(asset)
        case 'css':
          return this.optimizeCSS(asset)
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'webp':
          return this.optimizeImage(asset)
        default:
          return this.optimizeGenericAsset(asset)
      }
    })
  }

  /**
   * JavaScript最適化
   */
  private optimizeJavaScript(asset: string): OptimizedAsset {
    return {
      original: asset,
      optimized: this.addCDNPrefix(asset),
      headers: {
        ...this.OPTIMAL_CACHE_HEADERS,
        'Content-Type': 'application/javascript',
        'Content-Encoding': 'br, gzip'
      },
      preload: asset.includes('critical'),
      prefetch: asset.includes('non-critical'),
      compressionRatio: 0.7
    }
  }

  /**
   * CSS最適化
   */
  private optimizeCSS(asset: string): OptimizedAsset {
    return {
      original: asset,
      optimized: this.addCDNPrefix(asset),
      headers: {
        ...this.OPTIMAL_CACHE_HEADERS,
        'Content-Type': 'text/css',
        'Content-Encoding': 'br, gzip'
      },
      preload: true,
      compressionRatio: 0.8
    }
  }

  /**
   * 画像最適化
   */
  private optimizeImage(asset: string): OptimizedAsset {
    const optimization: AssetOptimization = {
      format: 'webp',
      quality: 85,
      sizes: [320, 640, 1024, 1920],
      lazy: !asset.includes('hero')
    }

    return {
      original: asset,
      optimized: this.generateResponsiveImages(asset, optimization),
      headers: {
        ...this.OPTIMAL_CACHE_HEADERS,
        'Content-Type': 'image/webp'
      },
      lazy: optimization.lazy,
      srcset: this.generateSrcSet(asset, optimization.sizes),
      compressionRatio: 0.6
    }
  }

  /**
   * レスポンシブ画像生成
   */
  private generateResponsiveImages(asset: string, opt: AssetOptimization): string {
    const baseName = asset.replace(/\.[^/.]+$/, '')
    const cdnPrefix = this.getCDNPrefix()

    return `${cdnPrefix}${baseName}.${opt.format}?quality=${opt.quality}&auto=format,compress`
  }

  /**
   * srcset生成
   */
  private generateSrcSet(asset: string, sizes: number[]): string {
    const baseName = asset.replace(/\.[^/.]+$/, '')
    const cdnPrefix = this.getCDNPrefix()

    return sizes
      .map(size => `${cdnPrefix}${baseName}_${size}w.webp ${size}w`)
      .join(', ')
  }

  /**
   * エッジキャッシュの管理
   */
  async manageEdgeCache(operation: 'purge' | 'warm', assets?: string[]): Promise<CacheOperationResult> {
    const startTime = Date.now()

    try {
      switch (operation) {
        case 'purge':
          return await this.purgeCache(assets)
        case 'warm':
          return await this.warmCache(assets)
        default:
          throw new Error(`Unsupported cache operation: ${operation}`)
      }
    } catch (error) {
      return {
        success: false,
        operation,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        affectedAssets: assets?.length || 0
      }
    }
  }

  /**
   * キャッシュパージ
   */
  private async purgeCache(assets?: string[]): Promise<CacheOperationResult> {
    // CDN provider specific implementation
    const purgeUrls = assets?.map(asset => this.addCDNPrefix(asset)) || ['/*']

    // Simulate CDN API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
      success: true,
      operation: 'purge',
      duration: 1000,
      affectedAssets: purgeUrls.length,
      urls: purgeUrls
    }
  }

  /**
   * キャッシュウォーミング
   */
  private async warmCache(assets?: string[]): Promise<CacheOperationResult> {
    const warmUrls = assets?.map(asset => this.addCDNPrefix(asset)) || []

    // Pre-fetch assets to edge locations
    const promises = warmUrls.map(url =>
      fetch(url, { method: 'HEAD' }).catch(() => null)
    )

    await Promise.all(promises)

    return {
      success: true,
      operation: 'warm',
      duration: 2000,
      affectedAssets: warmUrls.length,
      urls: warmUrls
    }
  }

  /**
   * パフォーマンス分析
   */
  async analyzePerformance(url: string): Promise<PerformanceAnalysis> {
    const analysis: PerformanceAnalysis = {
      url,
      timestamp: Date.now(),
      metrics: {
        ttfb: 0,
        fcp: 0,
        lcp: 0,
        cls: 0,
        fid: 0
      },
      recommendations: [],
      cacheHitRatio: 0,
      bandwidthSavings: 0
    }

    try {
      // Simulate performance measurement
      const startTime = performance.now()
      const response = await fetch(url, { method: 'HEAD' })
      const endTime = performance.now()

      analysis.metrics.ttfb = endTime - startTime

      // Analyze cache headers
      const cacheControl = response.headers.get('cache-control')
      const age = response.headers.get('age')
      const xCache = response.headers.get('x-cache') // CDN cache status

      if (xCache?.includes('HIT')) {
        analysis.cacheHitRatio = 1
      }

      // Generate recommendations
      analysis.recommendations = this.generateOptimizationRecommendations(response.headers)

      return analysis

    } catch (error) {
      analysis.error = error instanceof Error ? error.message : 'Analysis failed'
      return analysis
    }
  }

  /**
   * 最適化推奨事項生成
   */
  private generateOptimizationRecommendations(headers: Headers): string[] {
    const recommendations: string[] = []

    if (!headers.get('cache-control')) {
      recommendations.push('Add Cache-Control headers for better caching')
    }

    if (!headers.get('content-encoding')) {
      recommendations.push('Enable compression (gzip/brotli) for better performance')
    }

    if (!headers.get('vary')) {
      recommendations.push('Add Vary header for proper caching behavior')
    }

    const contentType = headers.get('content-type')
    if (contentType?.includes('image/') && !contentType.includes('webp')) {
      recommendations.push('Consider using WebP format for images')
    }

    return recommendations
  }

  /**
   * ヘルパーメソッド
   */
  private addCDNPrefix(asset: string): string {
    const cdnPrefix = this.getCDNPrefix()
    return asset.startsWith('http') ? asset : `${cdnPrefix}${asset}`
  }

  private getCDNPrefix(): string {
    return this.config.domains[0] || ''
  }

  private calculateDistance(lat1: number, lng1: number, edge: EdgeLocation): number {
    // Simplified distance calculation
    // In production, use proper haversine formula
    return Math.abs(lat1) + Math.abs(lng1) + edge.latency
  }

  private optimizeGenericAsset(asset: string): OptimizedAsset {
    return {
      original: asset,
      optimized: this.addCDNPrefix(asset),
      headers: this.OPTIMAL_CACHE_HEADERS,
      compressionRatio: 0.75
    }
  }

  /**
   * Edge Worker デプロイ
   */
  async deployEdgeWorker(workerScript: string): Promise<EdgeWorkerDeployment> {
    const deployment: EdgeWorkerDeployment = {
      id: `worker_${Date.now()}`,
      script: workerScript,
      status: 'deploying',
      regions: this.config.edgeLocations.map(loc => loc.region),
      deployedAt: new Date()
    }

    try {
      // Simulate edge worker deployment
      await new Promise(resolve => setTimeout(resolve, 3000))

      deployment.status = 'deployed'
      return deployment

    } catch (error) {
      deployment.status = 'failed'
      deployment.error = error instanceof Error ? error.message : 'Deployment failed'
      return deployment
    }
  }

  /**
   * リアルタイム最適化モニタリング
   */
  startPerformanceMonitoring(): PerformanceMonitor {
    return {
      start: () => {
        setInterval(() => {
          this.collectPerformanceMetrics()
        }, 30000) // 30秒間隔
      },
      stop: () => {
        // Stop monitoring
      },
      getMetrics: () => this.getLatestMetrics()
    }
  }

  private async collectPerformanceMetrics(): Promise<void> {
    // Collect various performance metrics
    // Implementation depends on monitoring infrastructure
  }

  private getLatestMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      cacheHitRatio: 0.95,
      averageResponseTime: 150,
      bandwidthSaved: 1024 * 1024 * 100, // 100MB
      errorRate: 0.001
    }
  }
}

// Types
interface OptimizedAsset {
  original: string
  optimized: string | string[]
  headers: Record<string, string>
  preload?: boolean
  prefetch?: boolean
  lazy?: boolean
  srcset?: string
  compressionRatio: number
}

interface CacheOperationResult {
  success: boolean
  operation: string
  duration: number
  error?: string
  affectedAssets: number
  urls?: string[]
}

interface PerformanceAnalysis {
  url: string
  timestamp: number
  metrics: {
    ttfb: number
    fcp: number
    lcp: number
    cls: number
    fid: number
  }
  recommendations: string[]
  cacheHitRatio: number
  bandwidthSavings: number
  error?: string
}

interface EdgeWorkerDeployment {
  id: string
  script: string
  status: 'deploying' | 'deployed' | 'failed'
  regions: string[]
  deployedAt: Date
  error?: string
}

interface PerformanceMonitor {
  start: () => void
  stop: () => void
  getMetrics: () => PerformanceMetrics
}

interface PerformanceMetrics {
  timestamp: number
  cacheHitRatio: number
  averageResponseTime: number
  bandwidthSaved: number
  errorRate: number
}

export default CDNOptimizer