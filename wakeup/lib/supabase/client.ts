import { createBrowserClient } from "@supabase/ssr";

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
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
