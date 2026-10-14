import { useEffect, useState } from 'react'
import type { Slot } from './programa'

// Maputo = UTC+2 todo o ano (sem horário de Verão). Todas as horas dos programas
// são convertidas para instantes absolutos com este offset, por isso o "agora"
// é correcto independentemente do fuso do dispositivo.
const MAPUTO_OFFSET = '+02:00'
export const TZ = 'Africa/Maputo'

// Para testar: ?now=2026-10-14T13:35 (hora de Maputo). O relógio continua a andar.
let offsetMs = 0
try {
  const fake = new URLSearchParams(window.location.search).get('now')
  if (fake) {
    const t = Date.parse(fake.length <= 16 ? `${fake}:00${MAPUTO_OFFSET}` : fake)
    if (!Number.isNaN(t)) offsetMs = t - Date.now()
  }
} catch {
  /* ignorar */
}

export function now() {
  return Date.now() + offsetMs
}

export function at(date: string, hhmm: string) {
  return Date.parse(`${date}T${hhmm}:00${MAPUTO_OFFSET}`)
}

/** Data actual em Maputo no formato YYYY-MM-DD */
export function maputoDate(ms = now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms)
}

export function maputoTime(ms = now()) {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(ms)
}

export function isLive(s: Slot, t = now()) {
  return s.end !== null && s.start <= t && t < s.end
}

export function isDone(s: Slot, t = now()) {
  return (s.end ?? s.start) <= t && !isLive(s, t)
}

/** Re-renderiza o componente a cada `intervalMs` e devolve o instante actual */
export function useNow(intervalMs = 30_000) {
  const [t, setT] = useState(now)
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return t
}
