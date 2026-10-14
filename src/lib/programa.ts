// Tipos do programa de um evento (data/events/*.json).
// Em cada ficheiro, "events" são os BLOCOS do programa; o evento em si é o objecto "event".

export type Lang = 'pt' | 'en'
export type Localized = Record<Lang, string>

export interface Speaker {
  name: string
  role: Localized
  /** ex.: "proposto / proposed" */
  note?: string
}

export interface Item {
  start: string
  end: string | null
  title: Localized
  lead?: Localized
  description?: Localized
  kind?: string
  speakers?: Speaker[]
  moderator?: Speaker
}

/** Bloco do programa (ex.: "Cerimónia de Abertura", "Sessão 1", "Gala") */
export interface ProgramEvent {
  id: string
  day: number
  date: string
  title: Localized
  subtitle?: Localized
  description?: Localized
  /** temas do debate (Citizen Connect) */
  topics?: Localized
  sessionNumber?: number
  venue?: string | null
  time: string
  dressCode?: Localized | null
  audience?: Localized | null
  highlight?: boolean
  items: Item[]
}

export interface Day {
  day: number
  date: string
  label: Localized
  theme: Localized
}

export interface ProgramData {
  event: {
    name: string
    city: string
    venue?: string | null
    dates: { start: string; end: string }
    timezone: string
  }
  days: Day[]
  events: ProgramEvent[]
}

/** Item do programa com instantes absolutos (ms) */
export interface Slot {
  event: ProgramEvent
  item: Item
  start: number
  end: number | null
}
