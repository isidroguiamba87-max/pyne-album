import data from '../../data/programa.json'

export type Lang = 'pt' | 'en'
export type Localized = Record<Lang, string>

export interface ProgramEvent {
  id: string
  day: number
  date: string
  title: Localized
  venue: string
  time: string
  highlight?: boolean
}

export interface Day {
  day: number
  date: string
  label: Localized
  theme: Localized
}

const programa = data as unknown as { days: Day[]; events: ProgramEvent[] }

export const days = programa.days
export const events = programa.events

export function eventById(id: string | null | undefined) {
  return events.find((e) => e.id === id)
}
