import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { EventMeta } from './index'

const Ctx = createContext<EventMeta | null>(null)

/** Aplica o tema do evento (variáveis CSS em index.css: html[data-event="<slug>"]) */
export function useEventTheme(slug: string | null) {
  useEffect(() => {
    const root = document.documentElement
    if (slug) root.dataset.event = slug
    else delete root.dataset.event
    return () => {
      delete root.dataset.event
    }
  }, [slug])
}

export function EventProvider({ event, children }: { event: EventMeta; children: ReactNode }) {
  useEventTheme(event.slug)
  return <Ctx.Provider value={event}>{children}</Ctx.Provider>
}

/** Evento activo; null fora de um evento (escolha do evento) */
export function useEventOptional() {
  return useContext(Ctx)
}

export function useEvent(): EventMeta {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEvent fora de um EventProvider')
  return v
}

export function EventNotFound() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-serif text-6xl font-bold text-gold-deep">404</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-navy px-5 py-3 font-semibold text-gold">
        {t('events.all')}
      </Link>
    </div>
  )
}
