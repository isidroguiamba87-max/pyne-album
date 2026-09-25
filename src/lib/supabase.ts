import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null enquanto o Supabase do álbum não estiver configurado */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const BUCKET = 'album'

export const MAIN_SITE_URL = ((import.meta.env.VITE_MAIN_SITE_URL as string | undefined) || '').replace(/\/+$/, '')

export interface AlbumPhoto {
  id: string
  created_at: string
  taken_at: string | null
  day: number | null
  event_id: string | null
  file_name: string
  path: string
  thumb_path: string
  width: number | null
  height: number | null
  color: string | null
  bytes: number | null
  featured: boolean
  hidden: boolean
}

export function publicUrl(path: string) {
  if (!supabase) return ''
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
