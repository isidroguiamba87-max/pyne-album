// Tudo o que se calcula a partir do programa de UM evento: slots, "ao vivo",
// "a seguir", bloco por defeito e agrupamento de fotos por momento da agenda.
import type { Day, ProgramData, ProgramEvent, Slot } from '../lib/programa'
import { at, isLive, maputoDate, now } from '../lib/time'

// margem para ligar uma foto a um bloco: 60 min antes (chegadas) e 90 min depois (fotos de grupo, networking)
const BEFORE = 60 * 60_000
const AFTER = 90 * 60_000

export interface MomentGroup<T> {
  key: string
  event: ProgramEvent | null
  slot: Slot | null
  day: number | null
  items: T[]
  sortTime: number
}

export function buildProgram(data: ProgramData) {
  const days: Day[] = data.days
  const events: ProgramEvent[] = data.events

  const slots: Slot[] = events
    .flatMap((event) =>
      event.items.map((item) => ({
        event,
        item,
        start: at(event.date, item.start),
        end: item.end ? at(event.date, item.end) : null,
      })),
    )
    .sort((a, b) => a.start - b.start)

  const EVENT_START = slots[0].start
  const last = slots[slots.length - 1]
  const EVENT_END = last.end ?? last.start

  const eventById = (id: string | null | undefined) => events.find((e) => e.id === id)

  function eventRange(e: ProgramEvent) {
    const own = slots.filter((s) => s.event.id === e.id)
    const l = own[own.length - 1]
    return { start: own[0].start, end: l.end ?? l.start }
  }

  function programStatus(t = now()) {
    const live = slots.filter((s) => isLive(s, t))
    const next = slots.find((s) => s.start > t) ?? null
    const phase: 'before' | 'during' | 'after' = t < EVENT_START ? 'before' : t >= EVENT_END ? 'after' : 'during'
    return { phase, live, next }
  }

  /** Número do dia do evento se hoje (Maputo) for dia de evento */
  function currentDay(t = now()): number | null {
    const d = maputoDate(t)
    return days.find((x) => x.date === d)?.day ?? null
  }

  /** Bloco por defeito: o que está a decorrer, senão o próximo, senão o último */
  function defaultEventId(t = now()): string {
    const running = events.find((e) => {
      const r = eventRange(e)
      return r.start <= t && t < r.end
    })
    if (running) return running.id
    const upcoming = events.find((e) => eventRange(e).start > t)
    return (upcoming ?? events[events.length - 1]).id
  }

  // ---------- momentos (galeria) ----------
  const windows = events.map((e) => {
    const r = eventRange(e)
    return { event: e, from: r.start - BEFORE, to: r.end + AFTER, slots: slots.filter((s) => s.event.id === e.id) }
  })

  /** Se `eventId` for dado, só procura dentro desse bloco (evita pôr uma foto noutro bloco) */
  function momentAt(t: number, eventId?: string | null): { event: ProgramEvent; slot: Slot } | null {
    const w = windows.find((x) => (!eventId || x.event.id === eventId) && x.from <= t && t <= x.to)
    if (!w) return null
    let slot = w.slots[0]
    for (const s of w.slots) if (s.start <= t) slot = s
    return { event: w.event, slot }
  }

  /**
   * Agrupa por momento da agenda. `fallback` indica o bloco/dia escolhidos no upload e se a hora
   * é exacta (EXIF). Fotos sem momento ficam em "Outros momentos" desse bloco/dia.
   */
  function groupByMoment<T>(
    list: T[],
    when: (x: T) => number,
    fallback: (x: T) => { eventId: string | null; day: number | null; exact: boolean },
  ): MomentGroup<T>[] {
    const map = new Map<string, MomentGroup<T>>()
    for (const x of list) {
      const t = when(x)
      const f = fallback(x)
      const m = momentAt(t, f.exact ? null : f.eventId)
      let key: string
      let g: Omit<MomentGroup<T>, 'items' | 'sortTime'>
      if (m) {
        key = `${m.event.id}|${m.slot.item.start}`
        g = { key, event: m.event, slot: m.slot, day: m.event.day }
      } else {
        const ev = events.find((e) => e.id === f.eventId) ?? null
        key = `outros|${ev?.id ?? ''}|${f.day ?? ''}`
        g = { key, event: ev, slot: null, day: ev?.day ?? f.day }
      }
      const cur = map.get(key)
      if (cur) {
        cur.items.push(x)
        cur.sortTime = Math.max(cur.sortTime, t)
      } else map.set(key, { ...g, items: [x], sortTime: m ? m.slot.start : t })
    }
    const groups = [...map.values()]
    for (const g of groups) g.items.sort((a, b) => when(b) - when(a))
    const evStart = (g: MomentGroup<T>) => (g.event ? eventRange(g.event).start : g.sortTime)
    return groups.sort((a, b) => evStart(b) - evStart(a) || (b.slot ? b.slot.start : -Infinity) - (a.slot ? a.slot.start : -Infinity))
  }

  return {
    days,
    events,
    slots,
    EVENT_START,
    EVENT_END,
    eventById,
    eventRange,
    programStatus,
    currentDay,
    defaultEventId,
    momentAt,
    groupByMoment,
  }
}

export type Program = ReturnType<typeof buildProgram>
