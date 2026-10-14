import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import EventCard from './components/EventCard'
import Layout from './components/Layout'
import { DEFAULT_EVENT_SLUG, eventBySlug, eventsTodayFirst } from './events'
import { EventNotFound, EventProvider, useEventTheme } from './events/EventContext'
import { useI18n } from './i18n'
import Album from './pages/Album'

// o painel de admin (e a compressão de imagens) só carrega para quem entra em /admin
const Admin = lazy(() => import('./pages/Admin'))

/** /:eventSlug — valida o evento e aplica o seu tema */
function EventRoute() {
  const { eventSlug } = useParams()
  const event = eventBySlug(eventSlug)
  if (!event) return <EventNotFound />
  return (
    <EventProvider event={event}>
      <Outlet />
    </EventProvider>
  )
}

/** Raiz: links antigos (?foto=, ?dia=, ?ver=…) vão para o Pyne; sem query mostra a escolha do evento */
function Home() {
  const { t } = useI18n()
  const { search } = useLocation()
  useEventTheme(null)
  if (search) return <Navigate to={`/${DEFAULT_EVENT_SLUG}${search}`} replace />
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 pb-6 md:pt-16">
      <h1 className="font-serif text-4xl font-bold text-ink md:text-5xl">{t('events.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('events.sub')}</p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {eventsTodayFirst().map((e) => (
          <EventCard key={e.slug} event={e} to={`/${e.slug}`} />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      }
    >
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/:eventSlug" element={<Admin />} />
          <Route path="videos" element={<Navigate to={`/${DEFAULT_EVENT_SLUG}?ver=videos`} replace />} />
        </Route>
        <Route path=":eventSlug" element={<EventRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Album />} />
            <Route path="*" element={<EventNotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
