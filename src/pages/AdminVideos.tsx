import { useState, type FormEvent } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n'
import { eventById, events } from '../lib/programa'
import { supabase } from '../lib/supabase'
import { OWN_SOURCE, parseYouTubeId, thumbUrl, useVideos, watchUrl, type Video } from '../lib/videos'

export default function AdminVideos() {
  const { t, L } = useI18n()
  const toast = useToast()
  const { videos, refresh } = useVideos(true)
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [eventId, setEventId] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Video | null>(null)

  const ytId = parseYouTubeId(link)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    if (!ytId) return toast(t('video.admin.badLink'), 'error')
    if (!title.trim()) return toast(t('video.admin.needTitle'), 'error')
    setBusy(true)
    const { error } = await supabase.from('videos').insert({ youtube_id: ytId, title: title.trim().slice(0, 140), event_id: eventId || null })
    setBusy(false)
    if (error) return toast(error.code === '23505' ? t('video.admin.dup') : error.message, 'error')
    setLink('')
    setTitle('')
    setEventId('')
    toast(t('video.admin.added'), 'success')
    refresh()
  }

  async function toggle(v: Video) {
    const { error } = await supabase!.from('videos').update({ hidden: !v.hidden }).eq('id', v.id)
    if (error) return toast(error.message, 'error')
    refresh()
  }

  async function remove(v: Video) {
    setConfirm(null)
    const { error } = await supabase!.from('videos').delete().eq('id', v.id)
    if (error) return toast(error.message, 'error')
    refresh()
  }

  const field = 'mt-1.5 w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-ink focus:border-gold focus:bg-white focus:outline-none'

  return (
    <div className="mt-6 space-y-8">
      <form onSubmit={submit} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-paper-line md:p-6">
        <h2 className="font-serif text-2xl font-bold">{t('video.admin.add')}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t('video.admin.hint')}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            <label className="block text-sm font-semibold">
              {t('video.admin.link')}
              <input className={field} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" required />
              {link && !ytId && <span className="mt-1 block text-xs font-medium text-red">{t('video.admin.badLink')}</span>}
            </label>
            <label className="block text-sm font-semibold">
              {t('video.admin.titleField')}
              <input className={field} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder={t('video.admin.titlePh')} required />
            </label>
            <label className="block text-sm font-semibold">
              {t('admin.upload.event')} <span className="font-normal text-ink-soft">({t('video.admin.optional')})</span>
              <select className={field} value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">—</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {L(ev.title)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* pré-visualização */}
          <div className="overflow-hidden rounded-2xl bg-paper ring-1 ring-paper-line">
            <div className="aspect-video bg-navy">{ytId && <img src={thumbUrl(ytId)} alt="" className="h-full w-full object-cover" />}</div>
            <p className="p-3 text-sm font-semibold text-ink">{title || <span className="text-ink-soft">{t('video.admin.preview')}</span>}</p>
          </div>
        </div>
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-navy px-5 py-3 font-semibold text-gold shadow-md hover:bg-navy-soft disabled:opacity-60 md:w-auto">
          {t('video.admin.save')}
        </button>
      </form>

      <section>
        <h2 className="font-serif text-2xl font-bold">
          {t('video.title')} <span className="text-base font-normal text-ink-soft">({videos.length})</span>
        </h2>
        {videos.length === 0 && <p className="mt-4 text-ink-soft">{t('album.empty')}</p>}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => {
            const own = v.source === OWN_SOURCE
            return (
              <li key={v.source + v.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-paper-line">
                <a href={watchUrl(v.youtube_id)} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-navy">
                  <img src={thumbUrl(v.youtube_id)} alt="" loading="lazy" className={`h-full w-full object-cover ${v.hidden ? 'opacity-30 grayscale' : ''}`} />
                  {v.hidden && <span className="absolute top-2 left-2 rounded-full bg-red px-2 py-0.5 text-xs font-bold text-white">{t('admin.hidden')}</span>}
                </a>
                <div className="p-3">
                  <p className="leading-snug font-semibold text-ink">{v.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {eventById(v.event_id) ? L(eventById(v.event_id)!.title) + ' · ' : ''}
                    {own ? t('video.admin.fromHere') : t('video.admin.fromOther')}
                  </p>
                  {own ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => toggle(v)} className="rounded-lg border border-paper-line py-1.5 text-xs font-semibold hover:border-gold">
                        {v.hidden ? t('admin.show') : t('admin.hide')}
                      </button>
                      <button onClick={() => setConfirm(v)} className="rounded-lg border border-red/60 py-1.5 text-xs font-semibold text-red hover:bg-red hover:text-white">
                        {t('admin.delete')}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-ink-soft">{t('video.admin.otherHint')}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <ConfirmDialog open={!!confirm} message={t('video.admin.confirmDelete')} onCancel={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} />
    </div>
  )
}
