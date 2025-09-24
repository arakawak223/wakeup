/**
 * オーディオエフェクト処理ライブラリ
 * リアルタイムオーディオエフェクトの適用
 */

export interface AudioEffectOptions {
  reverb?: ReverbOptions
  delay?: DelayOptions
  distortion?: DistortionOptions
  filter?: FilterOptions
  compressor?: CompressorOptions
  chorus?: ChorusOptions
}

export interface ReverbOptions {
  roomSize: number // 0-1
  decay: number // 0-1
  wet: number // 0-1
  dry: number // 0-1
}

export interface DelayOptions {
  delayTime: number // seconds
  feedback: number // 0-1
  wet: number // 0-1
}

export interface DistortionOptions {
  amount: number // 0-100
  tone: number // 0-1
  wet: number // 0-1
}

export interface FilterOptions {
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch'
  frequency: number // Hz
  Q: number // Quality factor
}

export interface CompressorOptions {
  threshold: number // dB
  ratio: number
  attack: number // seconds
  release: number // seconds
}

export interface ChorusOptions {
  rate: number // Hz
  depth: number // 0-1
  wet: number // 0-1
}

export class AudioEffectsProcessor {
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private effectNodes: AudioNode[] = []
  private outputNode: GainNode | null = null
  private destinationStream: MediaStreamAudioDestinationNode | null = null

  constructor() {
    this.initializeAudioContext()
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.error('AudioContext初期化エラー:', error)
    }
  }

  /**
   * 入力ストリームにエフェクトを適用
   */
  async processAudioStream(inputStream: MediaStream, effects: AudioEffectOptions): Promise<MediaStream | null> {
    if (!this.audioContext) return null

    try {
      // 既存のノードをクリーンアップ
      this.cleanup()

      // ソースノードを作成
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream)

      // エフェクトチェーンを構築
      let currentNode: AudioNode = this.sourceNode
      this.effectNodes = []

      // リバーブ
      if (effects.reverb) {
        const reverbNode = await this.createReverbNode(effects.reverb)
        currentNode.connect(reverbNode)
        currentNode = reverbNode
        this.effectNodes.push(reverbNode)
      }

      // ディレイ
      if (effects.delay) {
        const delayNode = this.createDelayNode(effects.delay)
        currentNode.connect(delayNode)
        currentNode = delayNode
        this.effectNodes.push(delayNode)
      }

      // ディストーション
      if (effects.distortion) {
        const distortionNode = this.createDistortionNode(effects.distortion)
        currentNode.connect(distortionNode)
        currentNode = distortionNode
        this.effectNodes.push(distortionNode)
      }

      // フィルター
      if (effects.filter) {
        const filterNode = this.createFilterNode(effects.filter)
        currentNode.connect(filterNode)
        currentNode = filterNode
        this.effectNodes.push(filterNode)
      }

      // コンプレッサー
      if (effects.compressor) {
        const compressorNode = this.createCompressorNode(effects.compressor)
        currentNode.connect(compressorNode)
        currentNode = compressorNode
        this.effectNodes.push(compressorNode)
      }

      // コーラス
      if (effects.chorus) {
        const chorusNode = this.createChorusNode(effects.chorus)
        currentNode.connect(chorusNode)
        currentNode = chorusNode
        this.effectNodes.push(chorusNode)
      }

      // 出力ゲインノード
      this.outputNode = this.audioContext.createGain()
      this.outputNode.gain.value = 1.0
      currentNode.connect(this.outputNode)

      // 出力ストリーム
      this.destinationStream = this.audioContext.createMediaStreamDestination()
      this.outputNode.connect(this.destinationStream)

      return this.destinationStream.stream

    } catch (error) {
      console.error('オーディオエフェクト処理エラー:', error)
      return null
    }
  }

  /**
   * リバーブノードを作成
   */
  private async createReverbNode(options: ReverbOptions): Promise<AudioNode> {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const convolver = this.audioContext.createConvolver()
    const impulse = this.generateReverbImpulse(
      this.audioContext,
      options.roomSize,
      options.decay
    )
    convolver.buffer = impulse

    // Wet/Dry mix
    const wetGain = this.audioContext.createGain()
    const dryGain = this.audioContext.createGain()
    const mixGain = this.audioContext.createGain()

    wetGain.gain.value = options.wet
    dryGain.gain.value = options.dry

    // Create a splitter to handle wet/dry mixing
    const splitter = this.audioContext.createChannelSplitter(1)
    const merger = this.audioContext.createChannelMerger(1)

    // Connect the processing chain
    const inputGain = this.audioContext.createGain()

    // Dry path
    inputGain.connect(dryGain).connect(merger, 0, 0)

    // Wet path
    inputGain.connect(convolver).connect(wetGain).connect(merger, 0, 0)

    merger.connect(mixGain)

    // Return the input gain as the entry point
    return inputGain
  }

  /**
   * リバーブインパルスレスポンスを生成
   */
  private generateReverbImpulse(audioContext: AudioContext, roomSize: number, decay: number): AudioBuffer {
    const sampleRate = audioContext.sampleRate
    const length = Math.floor(sampleRate * (roomSize * 2 + 0.5))
    const impulse = audioContext.createBuffer(2, length, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const envelope = Math.pow(1 - i / length, decay * 10)
        channelData[i] = (Math.random() * 2 - 1) * envelope
      }
    }

    return impulse
  }

  /**
   * ディレイノードを作成
   */
  private createDelayNode(options: DelayOptions): AudioNode {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const delay = this.audioContext.createDelay(5.0) // 最大5秒のディレイ
    delay.delayTime.value = options.delayTime

    const feedback = this.audioContext.createGain()
    feedback.gain.value = options.feedback

    const wetGain = this.audioContext.createGain()
    wetGain.gain.value = options.wet

    const dryGain = this.audioContext.createGain()
    dryGain.gain.value = 1 - options.wet

    const inputGain = this.audioContext.createGain()
    const outputGain = this.audioContext.createGain()

    // ディレイチェーンの構築
    inputGain.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay) // フィードバックループ
    delay.connect(wetGain)

    // ドライ信号
    inputGain.connect(dryGain)

    // ミックス
    wetGain.connect(outputGain)
    dryGain.connect(outputGain)

    return inputGain
  }

  /**
   * ディストーションノードを作成
   */
  private createDistortionNode(options: DistortionOptions): AudioNode {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const waveshaper = this.audioContext.createWaveShaper()
    waveshaper.curve = this.generateDistortionCurve(options.amount)
    waveshaper.oversample = '4x'

    const preGain = this.audioContext.createGain()
    const postGain = this.audioContext.createGain()
    const toneFilter = this.audioContext.createBiquadFilter()

    preGain.gain.value = 1 + options.amount / 10
    postGain.gain.value = 1 / (1 + options.amount / 10)

    toneFilter.type = 'lowpass'
    toneFilter.frequency.value = 1000 + options.tone * 19000

    const wetGain = this.audioContext.createGain()
    const dryGain = this.audioContext.createGain()
    const inputGain = this.audioContext.createGain()
    const outputGain = this.audioContext.createGain()

    wetGain.gain.value = options.wet
    dryGain.gain.value = 1 - options.wet

    // 処理チェーン
    inputGain.connect(preGain)
    preGain.connect(waveshaper)
    waveshaper.connect(toneFilter)
    toneFilter.connect(postGain)
    postGain.connect(wetGain)

    // ドライ信号
    inputGain.connect(dryGain)

    // ミックス
    wetGain.connect(outputGain)
    dryGain.connect(outputGain)

    return inputGain
  }

  /**
   * ディストーションカーブを生成
   */
  private generateDistortionCurve(amount: number): Float32Array {
    const samples = 44100
    const curve = new Float32Array(samples)
    const deg = Math.PI / 180

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
    }

    return curve
  }

  /**
   * フィルターノードを作成
   */
  private createFilterNode(options: FilterOptions): AudioNode {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const filter = this.audioContext.createBiquadFilter()
    filter.type = options.type
    filter.frequency.value = options.frequency
    filter.Q.value = options.Q

    return filter
  }

  /**
   * コンプレッサーノードを作成
   */
  private createCompressorNode(options: CompressorOptions): AudioNode {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const compressor = this.audioContext.createDynamicsCompressor()
    compressor.threshold.value = options.threshold
    compressor.ratio.value = options.ratio
    compressor.attack.value = options.attack
    compressor.release.value = options.release

    return compressor
  }

  /**
   * コーラスノードを作成
   */
  private createChorusNode(options: ChorusOptions): AudioNode {
    if (!this.audioContext) throw new Error('AudioContext not initialized')

    const delay1 = this.audioContext.createDelay()
    const delay2 = this.audioContext.createDelay()
    const lfo = this.audioContext.createOscillator()
    const lfoGain = this.audioContext.createGain()

    delay1.delayTime.value = 0.02
    delay2.delayTime.value = 0.03

    lfo.frequency.value = options.rate
    lfoGain.gain.value = options.depth * 0.01

    lfo.connect(lfoGain)
    lfoGain.connect(delay1.delayTime)
    lfoGain.connect(delay2.delayTime)

    const inputGain = this.audioContext.createGain()
    const wetGain = this.audioContext.createGain()
    const dryGain = this.audioContext.createGain()
    const outputGain = this.audioContext.createGain()

    wetGain.gain.value = options.wet
    dryGain.gain.value = 1 - options.wet

    // コーラス処理
    inputGain.connect(delay1)
    inputGain.connect(delay2)
    delay1.connect(wetGain)
    delay2.connect(wetGain)

    // ドライ信号
    inputGain.connect(dryGain)

    // ミックス
    wetGain.connect(outputGain)
    dryGain.connect(outputGain)

    lfo.start()

    return inputGain
  }

  /**
   * リソースのクリーンアップ
   */
  cleanup() {
    this.effectNodes.forEach(node => {
      try {
        node.disconnect()
      } catch (e) {
        // Ignore disconnect errors
      }
    })

    this.effectNodes = []

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch (e) {
        // Ignore disconnect errors
      }
      this.sourceNode = null
    }

    if (this.outputNode) {
      try {
        this.outputNode.disconnect()
      } catch (e) {
        // Ignore disconnect errors
      }
      this.outputNode = null
    }

    this.destinationStream = null
  }

  /**
   * エフェクトパラメータの動的更新
   */
  updateEffect(effectType: keyof AudioEffectOptions, options: any) {
    // 実装は複雑になるため、基本的にはエフェクトチェーンを再構築
    console.log(`${effectType}エフェクトパラメータの更新はサポートされていません`)
  }

  /**
   * プリセット設定
   */
  static getPresets(): Record<string, AudioEffectOptions> {
    return {
      clean: {},
      warmth: {
        compressor: { threshold: -12, ratio: 3, attack: 0.01, release: 0.1 },
        filter: { type: 'lowpass', frequency: 8000, Q: 1 }
      },
      radio: {
        filter: { type: 'bandpass', frequency: 2000, Q: 5 },
        distortion: { amount: 20, tone: 0.3, wet: 0.5 }
      },
      cathedral: {
        reverb: { roomSize: 0.9, decay: 0.8, wet: 0.4, dry: 0.6 },
        filter: { type: 'highpass', frequency: 100, Q: 1 }
      },
      telephone: {
        filter: { type: 'bandpass', frequency: 1000, Q: 10 },
        distortion: { amount: 5, tone: 0.1, wet: 0.3 }
      },
      space: {
        reverb: { roomSize: 1.0, decay: 0.9, wet: 0.6, dry: 0.4 },
        delay: { delayTime: 0.3, feedback: 0.4, wet: 0.3 },
        chorus: { rate: 0.5, depth: 0.3, wet: 0.2 }
      }
    }
  }
}