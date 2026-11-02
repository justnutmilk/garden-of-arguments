import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export type Person = { id: string; name: string; color: string; is_me: boolean; created_at: string }
export type Argument = {
  id: string
  title: string
  settled: boolean
  x: number
  z: number
  placed_by_meaning: boolean
  created_at: string
  updated_at: string
}
export type ArgumentPerson = { argument_id: string; person_id: string }
export type Point = { id: string; argument_id: string; person_id: string; text: string; created_at: string }
export type Match = { id: string; argument_id: string; person_id: string; text: string; similarity: number }

export const LIMITS = { title: 120, point: 2000, name: 40, people: 6 }
