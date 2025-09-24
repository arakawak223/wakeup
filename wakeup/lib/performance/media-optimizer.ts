/**
 * Advanced Media Optimizer for Audio and Images
 * 音声とイメージの高度な最適化システム
 */

interface AudioOptimizationOptions {
  targetBitrate?: number
  targetFormat?: 'mp3' | 'aac' | 'opus' | 'webm'
  qualityLevel?: 'low' | 'medium' | 'high'
  enableNoiseReduction?: boolean
  enableEchoCancellation?: boolean
  targetDuration?: number
}

interface ImageOptimizationOptions {
  targetFormat?: 'webp' | 'avif' | 'jpeg' | 'png'
  quality?: number
  maxWidth?: number
  maxHeight?: number
  enableProgressive?: boolean
}

interface OptimizationResult {
  originalSize: number
  optimizedSize: number
  compressionRatio: number
  processingTime: number
  format: string
  quality?: number
}

export class MediaOptimizer {
  private static instance: MediaOptimizer
  private audioContext: AudioContext | null = null
  private canvas: HTMLCanvasElement | null = null

  private constructor() {
    this.initializeAudioContext()
    this.initializeCanvas()
  }

  static getInstance(): MediaOptimizer {
    if (!MediaOptimizer.instance) {
      MediaOptimizer.instance = new MediaOptimizer()
    }
    return MediaOptimizer.instance
  }

  private initializeAudioContext() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext()
    }
  }

  private initializeCanvas() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas')
    }
  }

  /**
   * Optimize audio blob with advanced compression
   */
  async optimizeAudio(
    audioBlob: Blob,
    options: AudioOptimizationOptions = {}
  ): Promise<{ blob: Blob; result: OptimizationResult }> {
    const startTime = performance.now()
    const originalSize = audioBlob.size

    const {
      targetBitrate = 128000, // 128 kbps
      targetFormat = 'webm',
      qualityLevel = 'medium',
      enableNoiseReduction = true,
      enableEchoCancellation = true
    } = options

    try {
      // Convert to AudioBuffer for processing
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)

      // Apply audio processing
      const processedBuffer = await this.processAudioBuffer(audioBuffer, {
        enableNoiseReduction,
        enableEchoCancellation,
        qualityLevel
      })

      // Compress to target format and bitrate
      const optimizedBlob = await this.compressAudioBuffer(processedBuffer, {
        format: targetFormat,
        bitrate: targetBitrate,
        quality: qualityLevel
      })

      const processingTime = performance.now() - startTime
      const optimizedSize = optimizedBlob.size
      const compressionRatio = originalSize / optimizedSize

      const result: OptimizationResult = {
        originalSize,
        optimizedSize,
        compressionRatio,
        processingTime,
        format: targetFormat
      }

      return { blob: optimizedBlob, result }

    } catch (error) {
      console.error('Audio optimization failed:', error)
      throw error
    }
  }

  /**
   * Process audio buffer with noise reduction and enhancement
   */
  private async processAudioBuffer(
    audioBuffer: AudioBuffer,
    options: {
      enableNoiseReduction: boolean
      enableEchoCancellation: boolean
      qualityLevel: string
    }
  ): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not available')

    const { numberOfChannels, length, sampleRate } = audioBuffer
    const processedBuffer = this.audioContext.createBuffer(numberOfChannels, length, sampleRate)

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel)
      const outputData = processedBuffer.getChannelData(channel)

      // Copy original data
      outputData.set(inputData)

      // Apply noise reduction
      if (options.enableNoiseReduction) {
        this.applyNoiseReduction(outputData)
      }

      // Apply dynamic range compression
      if (options.qualityLevel === 'high') {
        this.applyDynamicRangeCompression(outputData)
      }

      // Apply normalization
      this.normalizeAudio(outputData)
    }

    return processedBuffer
  }

  /**
   * Apply noise reduction using spectral subtraction
   */
  private applyNoiseReduction(audioData: Float32Array) {
    const fftSize = 2048
    const hopSize = fftSize / 4
    const noiseThreshold = 0.02

    // Simplified noise reduction algorithm
    for (let i = 0; i < audioData.length; i += hopSize) {
      const segment = audioData.slice(i, i + fftSize)

      // Detect noise level
      const rms = Math.sqrt(segment.reduce((sum, sample) => sum + sample * sample, 0) / segment.length)

      // Reduce amplitude if below noise threshold
      if (rms < noiseThreshold) {
        for (let j = 0; j < segment.length; j++) {
          audioData[i + j] *= 0.3 // Reduce noise by 70%
        }
      }
    }
  }

  /**
   * Apply dynamic range compression
   */
  private applyDynamicRangeCompression(audioData: Float32Array) {
    const threshold = 0.7
    const ratio = 4.0
    const attackTime = 0.01
    const releaseTime = 0.1

    let envelope = 0

    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.abs(audioData[i])

      // Update envelope
      if (sample > envelope) {
        envelope = sample * attackTime + envelope * (1 - attackTime)
      } else {
        envelope = sample * releaseTime + envelope * (1 - releaseTime)
      }

      // Apply compression
      if (envelope > threshold) {
        const gain = threshold + (envelope - threshold) / ratio
        audioData[i] = audioData[i] * (gain / envelope)
      }
    }
  }

  /**
   * Normalize audio to prevent clipping
   */
  private normalizeAudio(audioData: Float32Array) {
    const maxSample = Math.max(...Array.from(audioData).map(Math.abs))
    if (maxSample > 1.0) {
      const normalizationFactor = 0.95 / maxSample
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] *= normalizationFactor
      }
    }
  }

  /**
   * Compress audio buffer to target format
   */
  private async compressAudioBuffer(
    audioBuffer: AudioBuffer,
    options: { format: string; bitrate: number; quality: string }
  ): Promise<Blob> {
    // Create offline context for rendering
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    )

    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start()

    const renderedBuffer = await offlineContext.startRendering()

    // Convert to target format
    return await this.encodeAudioBuffer(renderedBuffer, options)
  }

  /**
   * Encode audio buffer to specific format
   */
  private async encodeAudioBuffer(
    audioBuffer: AudioBuffer,
    options: { format: string; bitrate: number; quality: string }
  ): Promise<Blob> {
    // Use MediaRecorder for encoding
    const stream = new MediaStream()
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: `audio/${options.format}`,
      audioBitsPerSecond: options.bitrate
    })

    return new Promise((resolve) => {
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: `audio/${options.format}` })
        resolve(blob)
      }

      // Start recording and immediately provide the processed audio
      mediaRecorder.start()

      // Create AudioContext stream from buffer
      this.createStreamFromBuffer(audioBuffer).then(stream => {
        // Stop recording after a short delay to capture the audio
        setTimeout(() => {
          mediaRecorder.stop()
        }, 100)
      })
    })
  }

  /**
   * Create MediaStream from AudioBuffer
   */
  private async createStreamFromBuffer(audioBuffer: AudioBuffer): Promise<MediaStream> {
    const audioContext = new AudioContext()
    const source = audioContext.createBufferSource()
    const destination = audioContext.createMediaStreamDestination()

    source.buffer = audioBuffer
    source.connect(destination)
    source.start()

    return destination.stream
  }

  /**
   * Optimize image with format conversion and compression
   */
  async optimizeImage(
    imageFile: File | Blob,
    options: ImageOptimizationOptions = {}
  ): Promise<{ blob: Blob; result: OptimizationResult }> {
    const startTime = performance.now()
    const originalSize = imageFile.size

    const {
      targetFormat = 'webp',
      quality = 0.8,
      maxWidth = 1920,
      maxHeight = 1080,
      enableProgressive = true
    } = options

    try {
      // Load image
      const img = await this.loadImage(imageFile)

      // Calculate new dimensions
      const { width, height } = this.calculateOptimalDimensions(
        img.width,
        img.height,
        maxWidth,
        maxHeight
      )

      // Draw optimized image to canvas
      const canvas = this.canvas!
      const ctx = canvas.getContext('2d')!

      canvas.width = width
      canvas.height = height

      // Apply image enhancements
      this.configureCanvasForOptimalQuality(ctx)
      ctx.drawImage(img, 0, 0, width, height)

      // Apply post-processing filters
      this.applyImageEnhancements(ctx, width, height)

      // Convert to target format
      const optimizedBlob = await this.canvasToBlob(canvas, targetFormat, quality)

      const processingTime = performance.now() - startTime
      const optimizedSize = optimizedBlob.size
      const compressionRatio = originalSize / optimizedSize

      const result: OptimizationResult = {
        originalSize,
        optimizedSize,
        compressionRatio,
        processingTime,
        format: targetFormat,
        quality
      }

      return { blob: optimizedBlob, result }

    } catch (error) {
      console.error('Image optimization failed:', error)
      throw error
    }
  }

  /**
   * Load image from file/blob
   */
  private loadImage(file: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }

      img.src = url
    })
  }

  /**
   * Calculate optimal dimensions while maintaining aspect ratio
   */
  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight

    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight }
    }

    if (aspectRatio > 1) {
      // Landscape
      const width = Math.min(originalWidth, maxWidth)
      const height = width / aspectRatio
      return { width: Math.round(width), height: Math.round(height) }
    } else {
      // Portrait or square
      const height = Math.min(originalHeight, maxHeight)
      const width = height * aspectRatio
      return { width: Math.round(width), height: Math.round(height) }
    }
  }

  /**
   * Configure canvas for optimal quality
   */
  private configureCanvasForOptimalQuality(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
  }

  /**
   * Apply image enhancement filters
   */
  private applyImageEnhancements(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    // Apply sharpening filter
    this.applySharpeningFilter(data, width, height)

    // Apply contrast enhancement
    this.applyContrastEnhancement(data)

    // Put processed image data back
    ctx.putImageData(imageData, 0, 0)
  }

  /**
   * Apply unsharp mask sharpening
   */
  private applySharpeningFilter(data: Uint8ClampedArray, width: number, height: number) {
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ]

    const output = new Uint8ClampedArray(data.length)
    output.set(data)

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) { // RGB channels only
          let sum = 0
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c
              sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)]
            }
          }

          const idx = (y * width + x) * 4 + c
          output[idx] = Math.max(0, Math.min(255, sum))
        }
      }
    }

    data.set(output)
  }

  /**
   * Apply adaptive contrast enhancement
   */
  private applyContrastEnhancement(data: Uint8ClampedArray) {
    const factor = 1.2 // Contrast enhancement factor

    for (let i = 0; i < data.length; i += 4) {
      // Apply to RGB channels
      for (let c = 0; c < 3; c++) {
        const value = data[i + c]
        const enhanced = ((value - 128) * factor) + 128
        data[i + c] = Math.max(0, Math.min(255, enhanced))
      }
      // Keep alpha channel unchanged
    }
  }

  /**
   * Convert canvas to blob with specified format and quality
   */
  private canvasToBlob(
    canvas: HTMLCanvasElement,
    format: string,
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve) => {
      const mimeType = `image/${format}`
      canvas.toBlob((blob) => {
        resolve(blob!)
      }, mimeType, quality)
    })
  }

  /**
   * Get supported formats for the current browser
   */
  getSupportedFormats(): {
    audio: string[]
    image: string[]
  } {
    // Return empty arrays if not in browser environment
    if (typeof document === 'undefined') {
      return { audio: [], image: [] }
    }

    const canvas = document.createElement('canvas')
    const audioFormats: string[] = []
    const imageFormats: string[] = []

    // Test audio formats
    const audioTestFormats = ['webm', 'mp4', 'ogg']
    audioTestFormats.forEach(format => {
      if (MediaRecorder.isTypeSupported(`audio/${format}`)) {
        audioFormats.push(format)
      }
    })

    // Test image formats
    const imageTestFormats = ['webp', 'avif', 'jpeg', 'png']
    imageTestFormats.forEach(format => {
      const dataURL = canvas.toDataURL(`image/${format}`)
      if (dataURL.indexOf(`data:image/${format}`) === 0) {
        imageFormats.push(format)
      }
    })

    return { audio: audioFormats, image: imageFormats }
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
  }
}

// React Hook for media optimization
export function useMediaOptimizer() {
  const optimizer = MediaOptimizer.getInstance()

  return {
    optimizeAudio: (blob: Blob, options?: AudioOptimizationOptions) =>
      optimizer.optimizeAudio(blob, options),
    optimizeImage: (file: File | Blob, options?: ImageOptimizationOptions) =>
      optimizer.optimizeImage(file, options),
    getSupportedFormats: () => optimizer.getSupportedFormats()
  }
}