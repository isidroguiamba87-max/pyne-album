import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import imageCompression from 'browser-image-compression'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconCheck, IconEyeOff, IconStar, IconUpload } from '../components/Icons'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n'
import { classify, readTakenAt } from '../lib/classify'
import { days, eventById, events } from '../lib/programa'
import { BUCKET, publicUrl, supabase, type AlbumPhoto } from '../lib/supabase'
import AdminVideos from './AdminVideos'

// ---------- login ----------

function Login() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setErr(false)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(true)
  }

  const field = 'mt-1.5 w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-ink focus:border-gold focus:bg-white focus:outline-none'
  return (
    <form onSubmit={submit} className="relative mx-auto mt-8 max-w-sm space-y-4 overflow-hidden rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(19,38,61,0.35)] ring-1 ring-paper-line">
      <div className="bg-gold-grad absolute inset-x-0 top-0 h-1.5" aria-hidden />
      <label className="block text-sm font-semibold">
        {t('admin.email')}
        <input type="email" required autoComplete="username" className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold">
        {t('admin.password')}
        <input type="password" required autoComplete="current-password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {err && <p className="rounded-lg bg-red/10 px-3 py-2 text-sm font-medium text-red ring-1 ring-red/30">{t('admin.loginError')}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-navy py-3 font-semibold text-gold shadow-md hover:bg-navy-soft disabled:opacity-60">
        {t('admin.login')}
      </button>
    </form>
  )
}

// ---------- envio pelo browser ----------

type Status = 'queued' | 'working' | 'done' | 'dup' | 'error'
interface Job {
  id: string
  file: File
  preview: string
  status: Status
  progress: number
  error?: string
  day: number | null // null = automático
  eventId: string | null
}

async function sha10(file: File) {
  const buf = await crypto.subtle.digest('SHA-1', await file.arrayBuffer())
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10)
}

async function dominantColor(blob: Blob) {
  try {
    const bmp = await createImageBitmap(blob, { resizeWidth: 1, resizeHeight: 1, resizeQuality: 'medium' })
    const c = new OffscreenCanvas(1, 1)
    const ctx = c.getContext('2d')!
    ctx.drawImage(bmp, 0, 0)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

async function processJob(job: Job, update: (p: Partial<Job>) => void) {
  const sb = supabase!
  update({ status: 'working', progress: 3 })
  const hash = await sha10(job.file)
  const fileName = `${job.file.name}__${hash}`
  const { data: exists } = await sb.from('album_photos').select('id').eq('file_name', fileName).maybeSingle()
  if (exists) return update({ status: 'dup', progress: 100 })

  const taken = await readTakenAt(job.file)
  const auto = classify(taken)
  const day = job.day ?? auto.day
  const eventId = job.eventId ?? (auto.day === day ? auto.event_id : null)

  const large = await imageCompression(job.file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 1,
    initialQuality: 0.8,
    fileType: 'image/webp',
    useWebWorker: true,
    onProgress: (p) => update({ progress: 5 + Math.round(p * 0.5) }),
  })
  const thumb = await imageCompression(large, { maxWidthOrHeight: 480, maxSizeMB: 0.1, initialQuality: 0.7, fileType: 'image/webp', useWebWorker: true })
  let width: number | null = null
  let height: number | null = null
  try {
    const bmp = await createImageBitmap(large)
    width = bmp.width
    height = bmp.height
    bmp.close()
  } catch {
    /* opcional */
  }
  const color = await dominantColor(thumb)

  const slug = job.file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
  const dir = day ?? 0
  const path = `${dir}/${slug}-${hash}.webp`
  const thumbPath = `${dir}/thumbs/${slug}-${hash}.webp`
  const opts = { contentType: 'image/webp', cacheControl: '31536000', upsert: true }

  update({ progress: 60 })
  const up1 = await sb.storage.from(BUCKET).upload(path, large, opts)
  if (up1.error) throw up1.error
  update({ progress: 85 })
  const up2 = await sb.storage.from(BUCKET).upload(thumbPath, thumb, opts)
  if (up2.error) throw up2.error

  const { error } = await sb.from('album_photos').insert({
    file_name: fileName,
    taken_at: taken?.toISOString() ?? null,
    day,
    event_id: eventId,
    path,
    thumb_path: thumbPath,
    width,
    height,
    color,
    bytes: large.size,
  })
  if (error && error.code !== '23505') throw error
  update({ status: 'done', progress: 100 })
}

function Uploader({ onUploaded }: { onUploaded: () => void }) {
  const { t, L } = useI18n()
  const [day, setDay] = useState<number | null>(null)
  const [eventId, setEventId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [drag, setDrag] = useState(false)
  const running = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const update = useCallback((id: string, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j))), [])

  useEffect(() => {
    const free = 3 - running.current
    if (free <= 0) return
    for (const j of jobs.filter((x) => x.status === 'queued').slice(0, free)) {
      running.current++
      update(j.id, { status: 'working' })
      processJob(j, (p) => update(j.id, p))
        .catch((e: unknown) => update(j.id, { status: 'error', error: e instanceof Error ? e.message : String(e) }))
        .finally(() => {
          running.current--
          setJobs((js) => [...js])
          onUploaded()
        })
    }
  }, [jobs, update, onUploaded])

  function add(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    setJobs((js) => [
      ...js,
      ...list.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: 'queued' as Status, progress: 0, day, eventId })),
    ])
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer.files.length) add(e.dataTransfer.files)
  }

  const done = jobs.filter((j) => j.status === 'done' || j.status === 'dup').length
  const field = 'mt-1.5 w-full rounded-xl border border-paper-line bg-paper px-3 py-3 text-ink focus:border-gold focus:outline-none'

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-paper-line md:p-6">
      <h2 className="font-serif text-2xl font-bold">{t('admin.upload.title')}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t('admin.upload.hint')}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          {t('admin.upload.day')}
          <select
            className={field}
            value={day ?? ''}
            onChange={(e) => {
              const d = e.target.value ? Number(e.target.value) : null
              setDay(d)
              setEventId(null)
            }}
          >
            <option value="">{t('admin.upload.auto')}</option>
            {days.map((d) => (
              <option key={d.day} value={d.day}>
                {L(d.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          {t('admin.upload.event')}
          <select className={field} value={eventId ?? ''} onChange={(e) => setEventId(e.target.value || null)} disabled={!day}>
            <option value="">{t('admin.upload.auto')}</option>
            {events
              .filter((ev) => ev.day === day)
              .map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {L(ev.title)}
                </option>
              ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          drag ? 'border-gold bg-gold/10' : 'border-gold/50 hover:bg-gold/5'
        }`}
      >
        <IconUpload className="h-8 w-8 text-gold-deep" />
        <span className="font-semibold text-gold-deep">{t('admin.upload.pick')}</span>
        <span className="text-sm text-ink-soft">{t('admin.upload.drop')}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) add(e.target.files)
          e.target.value = ''
        }}
      />

      {jobs.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
            <span>
              {done}/{jobs.length} <IconCheck className="inline h-4 w-4 text-gold-deep" />
            </span>
            {done > 0 && (
              <button
                onClick={() =>
                  setJobs((js) => {
                    js.filter((j) => j.status === 'done' || j.status === 'dup').forEach((j) => URL.revokeObjectURL(j.preview))
                    return js.filter((j) => j.status !== 'done' && j.status !== 'dup')
                  })
                }
                className="rounded-lg px-3 py-1.5 hover:bg-paper"
              >
                {t('admin.upload.clear')}
              </button>
            )}
          </div>
          <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-3 rounded-xl bg-paper p-2">
                <img src={j.preview} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{j.file.name}</span>
                    <span className={`shrink-0 font-semibold ${j.status === 'error' ? 'text-red' : j.status === 'done' ? 'text-gold-deep' : 'text-ink-soft'}`}>
                      {t(`admin.status.${j.status}`)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-line">
                    <div className={`h-full rounded-full transition-all ${j.status === 'error' ? 'bg-red' : 'bg-gold'}`} style={{ width: `${j.status === 'error' ? 100 : j.progress}%` }} />
                  </div>
                  {j.error && <p className="mt-1 truncate text-xs text-ink-soft">{j.error}</p>}
                </div>
                {j.status === 'error' && (
                  <button onClick={() => update(j.id, { status: 'queued', progress: 0, error: undefined })} className="shrink-0 rounded-lg border border-gold px-2 py-1 text-xs text-gold-deep">
                    {t('retry')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// ---------- gestão ----------

const LIST_PAGE = 48

function Manager({ reloadKey }: { reloadKey: number }) {
  const { t, L } = useI18n()
  const toast = useToast()
  const [photos, setPhotos] = useState<AlbumPhoto[]>([])
  const [onlyHidden, setOnlyHidden] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [confirm, setConfirm] = useState<AlbumPhoto | null>(null)

  const load = useCallback(
    async (from: number) => {
      if (!supabase) return
      let q = supabase.from('album_photos').select('*').order('created_at', { ascending: false }).range(from, from + LIST_PAGE - 1)
      if (onlyHidden) q = q.eq('hidden', true)
      const { data } = await q
      const rows = (data ?? []) as AlbumPhoto[]
      setPhotos((xs) => (from === 0 ? rows : [...xs, ...rows]))
      setHasMore(rows.length === LIST_PAGE)
    },
    [onlyHidden],
  )

  useEffect(() => {
    load(0)
  }, [load, reloadKey])

  async function patch(p: AlbumPhoto, change: Partial<AlbumPhoto>) {
    const { error } = await supabase!.from('album_photos').update(change).eq('id', p.id)
    if (error) return toast(error.message, 'error')
    setPhotos((xs) => xs.map((x) => (x.id === p.id ? { ...x, ...change } : x)))
  }

  async function remove(p: AlbumPhoto) {
    setConfirm(null)
    const { error } = await supabase!.from('album_photos').delete().eq('id', p.id)
    if (error) return toast(error.message, 'error')
    await supabase!.storage.from(BUCKET).remove([p.path, p.thumb_path])
    setPhotos((xs) => xs.filter((x) => x.id !== p.id))
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-bold">{t('admin.list.title')}</h2>
        <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={onlyHidden} onChange={(e) => setOnlyHidden(e.target.checked)} className="h-4 w-4 accent-navy" />
          {t('admin.list.showHidden')}
        </label>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {photos.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-paper-line">
            <div className="relative aspect-square" style={{ backgroundColor: p.color ?? '#e6dfcf' }}>
              <img src={publicUrl(p.thumb_path)} alt="" loading="lazy" className={`h-full w-full object-cover ${p.hidden ? 'opacity-30 grayscale' : ''}`} />
              {p.hidden && <span className="absolute top-2 left-2 rounded-full bg-red px-2 py-0.5 text-xs font-bold text-white">{t('admin.hidden')}</span>}
              {p.featured && (
                <span className="absolute top-2 right-2 rounded-full bg-gold p-1 text-navy">
                  <IconStar className="h-3 w-3 fill-navy" />
                </span>
              )}
            </div>
            <p className="truncate px-2 pt-1.5 text-[11px] text-ink-soft">
              {p.day ? `Dia ${p.day}` : '—'} · {L(eventById(p.event_id)?.title) || '—'}
            </p>
            <div className="grid grid-cols-3 gap-1 p-2">
              <button onClick={() => patch(p, { featured: !p.featured })} title={p.featured ? t('admin.unfeature') : t('admin.feature')} className="flex justify-center rounded-lg border border-paper-line py-1.5 hover:border-gold">
                <IconStar className={`h-4 w-4 ${p.featured ? 'fill-gold text-gold-deep' : 'text-ink-soft'}`} />
              </button>
              <button onClick={() => patch(p, { hidden: !p.hidden })} title={p.hidden ? t('admin.show') : t('admin.hide')} className="flex justify-center rounded-lg border border-paper-line py-1.5 hover:border-gold">
                <IconEyeOff className={`h-4 w-4 ${p.hidden ? 'text-red' : 'text-ink-soft'}`} />
              </button>
              <button onClick={() => setConfirm(p)} title={t('admin.delete')} className="rounded-lg border border-red/50 py-1.5 text-[11px] font-semibold text-red hover:bg-red hover:text-white">
                {t('admin.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="mt-4 text-center">
          <button onClick={() => load(photos.length)} className="rounded-xl bg-navy px-5 py-2.5 font-semibold text-gold shadow-md hover:bg-navy-soft">
            {t('album.more')}
          </button>
        </div>
      )}
      <ConfirmDialog open={!!confirm} message={t('admin.confirmDelete')} onCancel={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} />
    </section>
  )
}

export default function Admin() {
  const { t } = useI18n()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const bump = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <>
      <section className="hero-bg relative text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pt-9 pb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-gold uppercase">{t('album.kicker')}</p>
            <h1 className="mt-2 font-serif text-4xl font-bold">{t('admin.title')}</h1>
          </div>
          {session && (
            <div className="flex items-center gap-3 text-sm text-white/75">
              <span className="hidden sm:inline">{session.user.email}</span>
              <button onClick={() => supabase?.auth.signOut()} className="rounded-lg border border-white/30 px-3 py-1.5 text-white hover:border-gold hover:text-gold">
                {t('admin.logout')}
              </button>
            </div>
          )}
        </div>
        <div className="gold-rule absolute inset-x-0 bottom-0" aria-hidden />
      </section>
      <div className="mx-auto max-w-7xl px-4 pt-6">
        {!supabase ? (
          <p className="rounded-2xl bg-white p-5 text-ink-soft shadow-sm ring-1 ring-paper-line">{t('offline')}</p>
        ) : !ready ? null : !session ? (
          <Login />
        ) : (
          <>
            <Uploader onUploaded={bump} />
            <AdminVideos />
            <Manager reloadKey={reloadKey} />
          </>
        )}
      </div>
    </>
  )
}
