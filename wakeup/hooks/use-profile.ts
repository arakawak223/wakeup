'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          // プロフィールが存在しない場合は作成
          if (error.code === 'PGRST116') {
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email!,
              })
              .select()
              .single()

            if (insertError) throw insertError
            setProfile(newProfile)
          } else {
            throw error
          }
        } else {
          setProfile(data)
        }
      } catch (err) {
        console.error('プロフィール読み込みエラー:', err)
        setError(err instanceof Error ? err.message : 'プロフィールの読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user, supabase])

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !profile) return null

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return data
    } catch (err) {
      console.error('プロフィール更新エラー:', err)
      setError(err instanceof Error ? err.message : 'プロフィールの更新に失敗しました')
      return null
    }
  }

  return {
    profile,
    loading,
    error,
    updateProfile,
    setProfile,
  }
}