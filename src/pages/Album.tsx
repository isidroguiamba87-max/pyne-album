import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IconImage, IconStar } from '../components/Icons'
import Lightbox from '../components/Lightbox'
import { formatCount, useI18n } from '../i18n'
import { days, events } from '../lib/programa'
import { publicUrl, supabase, type AlbumPhoto } from '../lib/supabase'

const PAGE = 60
type Sort = 'recent' | 'chrono'

interface Count {
  day: number | null
  event_id: string | null
  n: number
}

function Tile({ p, onOpen, priority }: { p: AlbumPhoto; onOpen: () => void; priority: boolean }) {
  const { t } = useI18n()
  const [loaded, setLoaded] = useState(false)
  return (
    <button
      onClick={onOpen}
      className="group relative aspect-square overflow-hidden rounded-lg [contain-intrinsic-size:240px] [content-visibility:auto] focus-visible:ring-4 focus-visible:ring-gold sm:rounded-xl"
      style={{ backgroundColor: p.color ?? '#e6dfcf' }}
      aria-label={t('album.photo')}
    >
      <img
        src={publicUrl(p.thumb_path)}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {p.featured && (
        <span className="absolute top-1.5 right-1.5 rounded-full bg-gold p-1 text-navy shadow">
          <IconStar className="h-3 w-3 fill-navy" />
        </span>
      )}
    </button>
  )
}

export default function Album() {
  const { t, L, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const day = Number(params.get('dia')) || null
  const session = params.get('sessao') || null
  const sort: Sort = params.get('ordem') === 'chrono' ? 'chrono' : 'recent'

  const [photos, setPhotos] = useState<AlbumPhoto[]>([])
  const [featured, setFeatured] = useState<AlbumPhoto[]>([])
  const [counts, setCounts] = useState<Count[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [open, setOpen] = useState<{ list: 'main' | 'featured' | 'single'; index: number } | null>(null)
  const [single, setSingle] = useState<AlbumPhoto | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)
  const busy = useRef(false)
  const openRef = useRef(open)
  openRef.current = open

  const setFilter = (k: string, v: string | null) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    if (k === 'dia') p.delete('sessao')
    p.delete('foto')
    setParams(p, { replace: true })
  }

  // contagens (para os filtros e o total)
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('album_counts')
      .select('*')
      .then(({ data }) => setCounts((data ?? []) as Count[]))
  }, [])

  // destaques
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('album_photos')
      .select('*')
      .eq('featured', true)
      .eq('hidden', false)
      .order('taken_at', { ascending: true, nullsFirst: false })
      .limit(24)
      .then(({ data }) => setFeatured((data ?? []) as AlbumPhoto[]))
  }, [])

  const load = useCallback(
    async (from: number) => {
      if (!supabase || busy.current) return
      busy.current = true
      const id = ++reqId.current
      setLoading(true)
      setError(false)
      let q = supabase
        .from('album_photos')
        .select('*')
        .eq('hidden', false)
        .order('taken_at', { ascending: sort === 'chrono', nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (day) q = q.eq('day', day)
      if (session) q = q.eq('event_id', session)
      const { data, error } = await q
      busy.current = false
      if (id !== reqId.current) return
      setLoading(false)
      if (error) return setError(true)
      const rows = (data ?? []) as AlbumPhoto[]
      setPhotos((xs) => {
        if (from === 0) return rows
        const seen = new Set(xs.map((x) => x.id))
        return [...xs, ...rows.filter((r) => !seen.has(r.id))]
      })
      setHasMore(rows.length === PAGE)
    },
    [day, session, sort],
  )

  // recarregar ao mudar filtros
  useEffect(() => {
    busy.current = false
    setPhotos([])
    setHasMore(true)
    load(0)
  }, [load])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) load(photos.length)
  }, [loading, hasMore, photos.length, load])

  // scroll infinito
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && photos.length > 0 && loadMore(), { rootMargin: '1200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, photos.length, loadMore])

  // link directo para uma foto (?foto=id)
  const fotoParam = params.get('foto')
  useEffect(() => {
    // já aberto a partir da grelha/destaques: o parâmetro só acompanha a navegação
    if (!fotoParam || !supabase || openRef.current) return
    const i = photos.findIndex((p) => p.id === fotoParam)
    if (i >= 0) {
      setOpen({ list: 'main', index: i })
      return
    }
    supabase
      .from('album_photos')
      .select('*')
      .eq('id', fotoParam)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSingle(data as AlbumPhoto)
          setOpen({ list: 'single', index: 0 })
        }
      })
    // só na primeira vez que o parâmetro aparece
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoParam])

  function openAt(list: 'main' | 'featured', index: number) {
    setOpen({ list, index })
    const src = list === 'main' ? photos : featured
    const p = new URLSearchParams(params)
    p.set('foto', src[index].id)
    setParams(p, { replace: true })
  }
  function close() {
    setOpen(null)
    setSingle(null)
    const p = new URLSearchParams(params)
    p.delete('foto')
    setParams(p, { replace: true })
  }

  // números
  const total = counts.reduce((a, c) => a + c.n, 0)
  const byDay = (d: number) => counts.filter((c) => c.day === d).reduce((a, c) => a + c.n, 0)
  const byEvent = (id: string) => counts.filter((c) => c.event_id === id).reduce((a, c) => a + c.n, 0)
  const selectionTotal = session ? byEvent(session) : day ? byDay(day) : total
  const sessions = useMemo(() => events.filter((e) => !day || e.day === day), [day])

  const lbList = open?.list === 'featured' ? featured : open?.list === 'single' && single ? [single] : photos
  const showFeatured = featured.length > 0 && !day && !session

  return (
    <>
      {/* topo */}
      <section className="hero-bg relative isolate overflow-hidden text-white">
        <img src="/hero-elevate.webp" alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_45%]" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(10,23,40,0.92)_0%,rgba(19,38,61,0.78)_55%,rgba(19,38,61,0.45)_100%)]" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 pt-10 pb-10 md:pt-14 md:pb-14">
          <p className="text-[11px] font-bold tracking-[0.25em] text-gold uppercase md:text-xs">{t('album.kicker')}</p>
          <h1 className="mt-2 font-serif text-4xl font-bold md:text-6xl">{t('album.title')}</h1>
          <p className="mt-2 max-w-xl text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">{t('album.sub')}</p>
          {total > 0 && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20 backdrop-blur">
              <IconImage className="h-4 w-4 text-gold" />
              {total === 1 ? t('album.count.one') : t('album.count.many', { n: formatCount(total, lang) })}
            </p>
          )}
        </div>
        <div className="gold-rule absolute inset-x-0 bottom-0" aria-hidden />
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {!supabase ? (
          <p className="mt-8 rounded-2xl bg-white p-5 text-ink-soft shadow-sm ring-1 ring-paper-line">{t('offline')}</p>
        ) : (
          <>
            {/* filtros */}
            <div className="sticky top-16 z-30 -mx-4 border-b border-paper-line/70 bg-paper/90 px-4 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1" role="group">
                  {[{ v: null as number | null, label: t('album.all'), n: total }, ...days.map((d) => ({ v: d.day, label: L(d.label).split('·')[0].trim(), n: byDay(d.day) }))].map(
                    (f) => (
                      <button
                        key={String(f.v)}
                        onClick={() => setFilter('dia', f.v ? String(f.v) : null)}
                        aria-pressed={day === f.v}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          day === f.v ? 'bg-navy text-gold shadow-md ring-2 ring-gold' : 'bg-white text-ink shadow-sm ring-1 ring-paper-line hover:ring-gold'
                        }`}
                      >
                        {f.label}
                        {f.n > 0 && <span className={`ml-1.5 text-xs tabular-nums ${day === f.v ? 'text-gold/70' : 'text-ink-soft'}`}>{formatCount(f.n, lang)}</span>}
                      </button>
                    ),
                  )}
                </div>
                <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                  <select
                    aria-label={t('album.allSessions')}
                    value={session ?? ''}
                    onChange={(e) => setFilter('sessao', e.target.value || null)}
                    className="min-w-0 flex-1 rounded-lg border border-paper-line bg-white px-3 py-2 text-sm text-ink shadow-sm sm:flex-none"
                  >
                    <option value="">{t('album.allSessions')}</option>
                    {sessions.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {L(ev.title)} ({formatCount(byEvent(ev.id), lang)})
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Ordem"
                    value={sort}
                    onChange={(e) => setFilter('ordem', e.target.value === 'chrono' ? 'chrono' : null)}
                    className="rounded-lg border border-paper-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
                  >
                    <option value="recent">{lang === 'pt' ? 'Mais recentes' : 'Newest'}</option>
                    <option value="chrono">{lang === 'pt' ? 'Cronológica' : 'Chronological'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* destaques */}
            {showFeatured && (
              <section className="mt-6">
                <h2 className="mb-3 flex items-center gap-2 font-serif text-2xl font-bold text-ink">
                  <IconStar className="h-5 w-5 fill-gold text-gold-deep" /> {t('album.featured')}
                </h2>
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
                  {featured.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => openAt('featured', i)}
                      className="relative h-44 shrink-0 snap-start overflow-hidden rounded-2xl shadow-md ring-1 ring-paper-line md:h-56"
                      style={{ aspectRatio: p.width && p.height ? `${p.width}/${p.height}` : '3/2', backgroundColor: p.color ?? '#e6dfcf' }}
                    >
                      <img src={publicUrl(p.thumb_path)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition hover:scale-105" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(day || session) && selectionTotal > 0 && (
              <p className="mt-5 text-sm text-ink-soft">
                {selectionTotal === 1 ? t('album.count.one') : t('album.count.many', { n: formatCount(selectionTotal, lang) })}
              </p>
            )}

            {/* grelha */}
            <div className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2 md:grid-cols-5 lg:grid-cols-6">
              {photos.map((p, i) => (
                <Tile key={p.id} p={p} priority={i < 12} onOpen={() => openAt('main', i)} />
              ))}
            </div>

            {!loading && !error && photos.length === 0 && (
              <div className="mx-auto mt-8 max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-paper-line">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-gold">
                  <IconImage className="h-7 w-7" />
                </span>
                <p className="mt-4 text-ink-soft">{t('album.empty')}</p>
              </div>
            )}
            {error && (
              <div className="mt-8 text-center">
                <p className="text-ink-soft">{t('loadError')}</p>
                <button onClick={() => load(photos.length)} className="mt-3 rounded-xl bg-navy px-4 py-2 font-semibold text-gold">
                  {t('retry')}
                </button>
              </div>
            )}
            <div ref={sentinel} className="h-4" />
            {loading && (
              <div className="flex justify-center py-8" role="status" aria-label={t('album.loading')}>
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
              </div>
            )}
            {!loading && hasMore && photos.length > 0 && (
              <div className="py-4 text-center">
                <button onClick={loadMore} className="rounded-xl bg-navy px-5 py-2.5 font-semibold text-gold shadow-md hover:bg-navy-soft">
                  {t('album.more')}
                </button>
              </div>
            )}
            {!hasMore && photos.length > PAGE && <p className="py-6 text-center text-sm text-ink-soft">{t('album.end')}</p>}
          </>
        )}
      </div>

      {open && lbList[open.index] && (
        <Lightbox
          photos={lbList}
          index={open.index}
          total={open.list === 'main' ? Math.max(selectionTotal, photos.length) : lbList.length}
          onIndex={(i) => {
            setOpen({ ...open, index: i })
            const p = new URLSearchParams(params)
            p.set('foto', lbList[i].id)
            setParams(p, { replace: true })
          }}
          onClose={close}
          onNearEnd={open.list === 'main' ? loadMore : undefined}
        />
      )}
    </>
  )
}
