// テスト用のダミー音声を生成する関数

export function generateDummyAudioBlob(durationSeconds: number = 3): Blob {
  // Web Audio APIを使用してテスト用の音声を生成
  const sampleRate = 44100
  const numChannels = 1
  const numSamples = sampleRate * durationSeconds

  // AudioBufferを作成
  const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const audioBuffer = audioContext.createBuffer(numChannels, numSamples, sampleRate)

  // 簡単なサイン波を生成
  const channelData = audioBuffer.getChannelData(0)
  for (let i = 0; i < numSamples; i++) {
    // 440Hz (ラの音) のサイン波
    channelData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1
    // フェードイン・フェードアウトを適用
    const fadeLength = sampleRate * 0.1 // 0.1秒のフェード
    if (i < fadeLength) {
      channelData[i] *= i / fadeLength
    } else if (i > numSamples - fadeLength) {
      channelData[i] *= (numSamples - i) / fadeLength
    }
  }

  // WAV形式でエンコード
  const wavBuffer = audioBufferToWav(audioBuffer)
  return new Blob([wavBuffer], { type: 'audio/wav' })
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
  const view = new DataView(arrayBuffer)

  // WAVヘッダーを書き込み
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * numberOfChannels * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numberOfChannels * 2, true)
  view.setUint16(32, numberOfChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length * numberOfChannels * 2, true)

  // 音声データを書き込み
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }

  return arrayBuffer
}

// ダミー音声メッセージを作成する関数
export function createDummyVoiceMessage(title: string, category?: string): {
  title: string
  category: string | null
  audioBlob: Blob
  duration: number
} {
  const duration = Math.floor(Math.random() * 10) + 3 // 3-12秒のランダムな長さ
  const audioBlob = generateDummyAudioBlob(duration)

  return {
    title,
    category: category || null,
    audioBlob,
    duration
  }
}

// 利用可能なダミーメッセージテンプレート
export const dummyMessageTemplates = [
  { title: 'おはよう！今日もがんばろう', category: '応援' },
  { title: '今日はお疲れ様でした', category: 'お疲れ様' },
  { title: 'ありがとうございます', category: '感謝' },
  { title: '今日の出来事報告', category: '日常' },
  { title: '近況をお知らせします', category: '近況報告' },
  { title: 'ちょっと相談があります', category: '相談' },
  { title: '愛してるよ', category: 'その他' }
]