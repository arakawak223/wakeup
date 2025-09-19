import { createBrowserClient } from "@supabase/ssr";

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase環境変数が設定されていません');
    }

    supabaseInstance = createBrowserClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          // 開発環境ではメール確認をスキップ
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        }
      }
    );
  }
  return supabaseInstance;
}

// Supabase接続テスト関数
export async function testSupabaseConnection() {
  try {
    const client = createClient();
    const { data, error } = await client.from('profiles').select('count', { count: 'exact', head: true });

    if (error) {
      console.error('Supabase接続テストエラー:', error);
      return { success: false, error: error.message };
    }

    console.log('Supabase接続テスト成功');
    return { success: true, data };
  } catch (error) {
    console.error('Supabase接続テスト失敗:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
