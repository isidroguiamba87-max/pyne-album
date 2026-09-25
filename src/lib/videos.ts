import { useCallback, useEffect, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Os vídeos vivem em DOIS projectos Supabase (site e álbum). Cada admin grava no seu;
// as galerias lêem os dois e juntam a lista. As chaves "publishable" são públicas.
const OTHER_URL = (import.meta.env.VITE_SITE_SUPABASE_URL as string | undefined) || 'https://gmkpbdmqankbqgfadctm.supabase.co'
const OTHER_KEY = (import.meta.env.VITE_SITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_IHdAtYbthWiVnORZ1lu6WQ_JwnSjjC6'

/** Cliente só de leitura para o projecto do outro lado (sem sessão, para não colidir com o login do admin) */
const other: SupabaseClient = createClient(OTHER_URL, OTHER_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-videos-other' },
})

export type VideoSource = 'site' | 'album'

export interface Video {
  id: string
  created_at: string
  youtube_id: string
  title: string
  event_id: string | null
  hidden: boolean
  source: VideoSource
}

/** Este projecto grava os vídeos com esta origem */
export const OWN_SOURCE: VideoSource = 'album'

/** Aceita links youtu.be, watch?v=, shorts, live, embed ou só o ID */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return valid(u.pathname.slice(1, 12))
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v')
      if (v) return valid(v)
      const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/)
      if (m) return m[2]
    }
  } catch {
    /* não é URL */
  }
  return null
}
const valid = (id: string) => (/^[A-Za-z0-9_-]{11}$/.test(id) ? id : null)

export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

async function fetchFrom(client: SupabaseClient | null, source: VideoSource, includeHidden: boolean): Promise<Video[]> {
  if (!client) return []
  let q = client.from('videos').select('*').order('created_at', { ascending: false }).limit(200)
  if (!includeHidden) q = q.eq('hidden', false)
  const { data, error } = await q
  if (error) return [] // tabela ainda não criada num dos lados: ignora
  return (data ?? []).map((v) => ({ ...(v as Omit<Video, 'source'>), source }))
}

/** Vídeos dos dois projectos, mais recentes primeiro, sem repetidos */
export function useVideos(includeHidden = false) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [own, theirs] = await Promise.all([fetchFrom(supabase, OWN_SOURCE, includeHidden), fetchFrom(other, 'site', includeHidden)])
    const seen = new Set<string>()
    const merged = [...own, ...theirs]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .filter((v) => (seen.has(v.youtube_id) ? false : (seen.add(v.youtube_id), true)))
    setVideos(merged)
    setLoading(false)
  }, [includeHidden])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { videos, loading, refresh }
}
