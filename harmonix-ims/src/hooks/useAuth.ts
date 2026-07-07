import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data ?? null)
    setLoading(false)
  }

  async function login(username: string, password: string): Promise<string | null> {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles').select('email').eq('username', username.trim()).single()

    if (profileError || !profileData?.email) return 'Username not found'

    const { error } = await supabase.auth.signInWithPassword({
      email: profileData.email,
      password,
    })
    if (error) return 'Incorrect password'
    return null
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return { profile, loading, login, logout }
}
