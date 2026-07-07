import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string

export const supabase = createClient(url, key)

// Admin client for user creation — uses service role key (internal tool only)
export const supabaseAdmin = serviceKey
  ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : supabase
