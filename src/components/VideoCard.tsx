import { useState } from 'react'
import { useI18n } from '../i18n'
import { eventById } from '../lib/programa'
import { thumbUrl, type Video } from '../lib/videos'

/** Capa do YouTube com botão play; o leitor só carrega depois do clique (página leve) */
export default function VideoCard({ v }: { v: Video }) {
  const { t, L } = useI18n()
  const [playing, setPlaying] = useState(false)
  const ev = eventById(v.event_id)

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-paper-line">
      <div className="relative aspect-video bg-navy">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={v.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label={`${t('video.play')}: ${v.title}`}>
            <img src={thumbUrl(v.youtube_id)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden />
            <span className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red text-white shadow-xl ring-4 ring-white/30 transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor" aria-hidden>
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="leading-snug font-semibold text-ink">{v.title}</h3>
        {ev && <p className="mt-1 text-sm font-medium text-gold-deep">{L(ev.title)}</p>}
      </div>
    </article>
  )
}
