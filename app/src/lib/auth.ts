import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

const here = () => window.location.origin + window.location.pathname

// Everyone gets a real (anonymous) Supabase user on first visit, so row level
// security protects their garden from the start. No sign-up needed.
export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(session?.user ?? null)
    })
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        if (alive) setUser(data.session.user)
        return
      }
      const { data: anon, error: anonError } = await supabase.auth.signInAnonymously()
      if (!alive) return
      if (anonError) setError(anonError.message)
      else setUser(anon.user)
    })()
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, error }
}

// Turn this device's anonymous garden into a real account, keeping every tree.
export async function saveWithEmail(email: string, password: string) {
  const { error: emailError } = await supabase.auth.updateUser({ email })
  if (emailError) throw emailError
  const { error: passwordError } = await supabase.auth.updateUser({ password })
  if (passwordError) throw passwordError
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function continueWithGoogle(isAnonymous: boolean) {
  if (isAnonymous) {
    // Keeps the trees: links Google to the current anonymous user.
    const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: here() } })
    if (!error) return
    if (!/already|exists|linked/i.test(error.message)) throw error
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
  await supabase.auth.signInAnonymously()
}
