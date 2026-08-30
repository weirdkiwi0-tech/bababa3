import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 클라우드 동기화는 선택 사항: 환경변수가 없으면 로컬 저장(localStorage/IndexedDB)만 사용한다.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

let cloudUserIdPromise: Promise<string | null> | null = null

export function getOrCreateCloudUserId(): Promise<string | null> {
  if (!supabase) {
    return Promise.resolve(null)
  }

  if (!cloudUserIdPromise) {
    cloudUserIdPromise = supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user.id) {
        return data.session.user.id
      }

      const { data: signInData, error } = await supabase.auth.signInAnonymously()

      if (error) {
        return null
      }

      return signInData.user?.id ?? null
    })
  }

  return cloudUserIdPromise
}
