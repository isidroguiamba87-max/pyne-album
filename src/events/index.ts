// Registo de eventos do álbum (mesmos slugs do site galeria.mediacraft.co.mz).
// Um evento novo = entrada aqui + programa em data/events/<slug>.json + linha na tabela `events` do Supabase.
import citizenConnect from '../../data/events/citizen-connect-2026.json'
import pyneAwards from '../../data/events/pyne-awards-2026.json'
import type { Lang, Localized, ProgramData } from '../lib/programa'
import { maputoDate, now } from '../lib/time'
import { buildProgram, type Program } from './program'

export interface EventMeta {
  slug: string
  order: number
  name: Localized
  shortName: string
  city: Localized
  dates: { start: string; end: string }
  program: Program
  /** 'dark' = Pyne (foto de fundo); 'light' = Citizen Connect (faixa oficial) */
  look: 'dark' | 'light'
  logo: { src: string; alt: string; width: number; height: number }
  /** foto de fundo do topo do álbum (Pyne) */
  heroImage?: string
  copyright: string
}

export const EVENTS: EventMeta[] = [
  {
    slug: 'pyne-awards-2026',
    order: 1,
    name: { pt: 'The Pyne Awards Africa 2026', en: 'The Pyne Awards Africa 2026' },
    shortName: 'Pyne Awards Africa 2026',
    city: { pt: 'Maputo, Moçambique', en: 'Maputo, Mozambique' },
    dates: { start: '2026-09-24', end: '2026-09-26' },
    program: buildProgram(pyneAwards as unknown as ProgramData),
    look: 'dark',
    logo: { src: '/pyne-emblem-gold.png', alt: 'Pyne Awards Africa', width: 182, height: 437 },
    heroImage: '/hero-elevate.webp',
    copyright: '© 2026 The Pyne Hospitality Company · Maputo',
  },
  {
    slug: 'citizen-connect-2026',
    order: 2,
    name: { pt: 'Citizen Connect Africa – Moçambique', en: 'Citizen Connect Africa – Mozambique' },
    shortName: 'Citizen Connect Africa',
    city: { pt: 'Maputo, Moçambique', en: 'Maputo, Mozambique' },
    dates: { start: '2026-10-14', end: '2026-10-14' },
    program: buildProgram(citizenConnect as unknown as ProgramData),
    look: 'light',
    logo: { src: '/events/citizen-connect-2026/header.png', alt: 'Citizen Connect Africa', width: 2109, height: 484 },
    copyright: '© 2026 VFS Global · CiX',
  },
].sort((a, b) => a.order - b.order) as EventMeta[]

export const DEFAULT_EVENT_SLUG = 'pyne-awards-2026'

export function eventBySlug(slug: string | null | undefined) {
  return EVENTS.find((e) => e.slug === slug)
}

export function eventPhase(e: EventMeta, t = now()): 'today' | 'soon' | 'past' {
  const d = maputoDate(t)
  if (d < e.dates.start) return 'soon'
  if (d > e.dates.end) return 'past'
  return 'today'
}

/** O evento que decorre hoje primeiro, depois pela ordem do registo */
export function eventsTodayFirst(t = now()) {
  return [...EVENTS].sort((a, b) => Number(eventPhase(b, t) === 'today') - Number(eventPhase(a, t) === 'today') || a.order - b.order)
}

export function formatDateRange(e: EventMeta, lang: Lang) {
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB'
  const d = (s: string) => new Date(`${s}T12:00:00Z`)
  const part = (s: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { timeZone: 'UTC', ...o }).format(d(s))
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const { start, end } = e.dates
  const month = cap(part(end, { month: 'long' }))
  const year = part(end, { year: 'numeric' })
  if (start === end) return `${part(start, { day: 'numeric' })} ${month} ${year}`
  return `${part(start, { day: 'numeric' })} – ${part(end, { day: 'numeric' })} ${month} ${year}`
}
