import { createClient } from '@/lib/supabase/client'

export async function uploadVoiceMessage(
  audioBlob: Blob,
  fileName: string,
  userId: string
): Promise<{ url: string; path: string } | null> {
  try {
    const supabase = createClient()

    // ファイルパスを生成（ユーザーIDとタイムスタンプを含む）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileExtension = getFileExtension(audioBlob.type)
    const filePath = `voice-messages/${userId}/${timestamp}-${fileName}.${fileExtension}`

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .upload(filePath, audioBlob, {
        contentType: audioBlob.type,
        upsert: false
      })

    if (error) {
      console.error('アップロードエラー:', error)
      return null
    }

    // 公開URLを取得
    const { data: { publicUrl } } = supabase.storage
      .from('voice-messages')
      .getPublicUrl(data.path)

    return {
      url: publicUrl,
      path: data.path
    }
  } catch (error) {
    console.error('音声ファイルアップロードに失敗しました:', error)
    return null
  }
}

export async function deleteVoiceMessage(filePath: string): Promise<boolean> {
  try {
    const supabase = createClient()

    const { error } = await supabase.storage
      .from('voice-messages')
      .remove([filePath])

    if (error) {
      console.error('ファイル削除エラー:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('音声ファイル削除に失敗しました:', error)
    return false
  }
}

function getFileExtension(mimeType: string): string {
  switch (mimeType) {
    case 'audio/webm':
    case 'audio/webm;codecs=opus':
      return 'webm'
    case 'audio/mp4':
    case 'audio/mp4;codecs=mp4a.40.2':
      return 'm4a'
    case 'audio/wav':
    case 'audio/wave':
      return 'wav'
    case 'audio/ogg':
    case 'audio/ogg;codecs=opus':
      return 'ogg'
    default:
      return 'webm' // デフォルト
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}