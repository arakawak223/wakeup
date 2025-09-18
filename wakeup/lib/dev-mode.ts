import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

// 開発モードかどうかを判定
export const isDevMode = () => {
  return process.env.NODE_ENV === 'development' ||
         typeof window !== 'undefined' && window.location.hostname === 'localhost'
}

// 開発用テストアカウント情報
export const getDevTestAccounts = () => [
  { email: 'test1@example.com', password: 'testpass123' },
  { email: 'test2@example.com', password: 'testpass123' },
  { email: 'family@example.com', password: 'testpass123' }
]

// ダミー家族メンバーのデータ（フロントエンドでモック）
export const getDummyFamilyMembers = (): Profile[] => [
  {
    id: 'dummy-mom-' + Date.now(),
    email: 'dummy.mom@example.com',
    display_name: 'お母さん',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'dummy-dad-' + Date.now(),
    email: 'dummy.dad@example.com',
    display_name: 'お父さん',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'dummy-sister-' + Date.now(),
    email: 'dummy.sister@example.com',
    display_name: '姉',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'dummy-brother-' + Date.now(),
    email: 'dummy.brother@example.com',
    display_name: '弟',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'dummy-grandma-' + Date.now(),
    email: 'dummy.grandma@example.com',
    display_name: 'おばあちゃん',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// LocalStorageを使用したモックデータ管理
const MOCK_DATA_KEY = 'wakeup_dev_mock_data'

interface MockData {
  dummyProfiles: Profile[]
  dummyMessages: any[]
  userId: string
}

// モックデータをローカルストレージに保存
function saveMockData(data: MockData): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(data))
  }
}

// モックデータをローカルストレージから取得
function getMockData(userId: string): MockData | null {
  if (typeof window === 'undefined') return null

  try {
    const saved = localStorage.getItem(MOCK_DATA_KEY)
    if (!saved) return null

    const data = JSON.parse(saved) as MockData
    return data.userId === userId ? data : null
  } catch {
    return null
  }
}

// モックデータをクリア
function clearMockData(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MOCK_DATA_KEY)
  }
}

// ダミー家族メンバーを設定（モック）
export async function setupDummyFamily(userId: string): Promise<Profile[]> {
  if (!isDevMode()) return []

  try {
    const dummyProfiles = getDummyFamilyMembers()

    // ダミーメッセージも生成
    const dummyMessages = [
      {
        id: 'msg-1-' + Date.now(),
        sender_id: dummyProfiles[0].id,
        receiver_id: userId,
        title: 'お疲れ様の気持ち',
        category: 'お疲れ様',
        audio_url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+D2vWoeBC6HzvLZiTcIGGS57OihUwwOUarm7bliFgU7k9n1unEiBC19yO/eizEKGmW56+OmWBEIUaqp7bNeFgNFnd327mAeBC6Byzbe'
      },
      {
        id: 'msg-2-' + Date.now(),
        sender_id: dummyProfiles[1].id,
        receiver_id: userId,
        title: '今日もお疲れさま！',
        category: '日常',
        audio_url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+D2vWoeBC6HzvLZiTcIGGS57OihUwwOUarm7bliFgU7k9n1unEiBC19yO/eizEKGmW56+OmWBEIUaqp7bNeFgNFnd327mAeBC6Byzbe'
      }
    ]

    const mockData: MockData = {
      dummyProfiles,
      dummyMessages,
      userId
    }

    saveMockData(mockData)
    return dummyProfiles
  } catch (error) {
    console.error('ダミー家族セットアップエラー:', error)
    return []
  }
}

// モックの家族メンバーを取得
export function getMockFamilyMembers(userId: string): Profile[] {
  if (!isDevMode()) return []

  const mockData = getMockData(userId)
  return mockData?.dummyProfiles || []
}

// モックメッセージを取得
export function getMockMessages(userId: string): any[] {
  if (!isDevMode()) return []

  const mockData = getMockData(userId)
  return mockData?.dummyMessages || []
}

// モックデータをクリーンアップ
export async function cleanupMockData(): Promise<void> {
  clearMockData()
}

// 開発モードセットアップ（簡易版）
export async function setupDevMode(userId: string): Promise<Profile[]> {
  if (!isDevMode()) return []

  return await setupDummyFamily(userId)
}