import data from '../../data/programa.json'

// Mesma regra do scripts/upload.mjs: a hora da foto (Maputo, UTC+2) decide o dia e a sessão.
interface Ev {
  id: string
  day: number
  date: string
  items: { start: string; end: string | null }[]
}
const programa = data as unknown as { days: { day: number; date: string }[]; events: Ev[] }
const at = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+02:00`)

const windows = programa.events.map((e) => {
  const last = e.items[e.items.length - 1]
  return { id: e.id, day: e.day, from: at(e.date, e.items[0].start) - 60 * 60_000, to: at(e.date, last.end ?? last.start) + 90 * 60_000 }
})

export function classify(taken: Date | null): { day: number | null; event_id: string | null } {
  if (!taken) return { day: null, event_id: null }
  const t = taken.getTime()
  const w = windows.find((x) => x.from <= t && t <= x.to)
  if (w) return { day: w.day, event_id: w.id }
  const date = new Date(t + 2 * 3600_000).toISOString().slice(0, 10)
  return { day: programa.days.find((d) => d.date === date)?.day ?? null, event_id: null }
}

/** Lê a hora da foto do EXIF (a câmara grava hora local; assumimos Maputo se não houver fuso) */
export async function readTakenAt(file: File): Promise<Date | null> {
  try {
    const { default: exifr } = await import('exifr')
    const x = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal'], reviveValues: false })
    const raw = x?.DateTimeOriginal ?? x?.CreateDate
    const m = raw && String(raw).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
    if (!m) return null
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${x?.OffsetTimeOriginal ?? '+02:00'}`)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}
