import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import { days, eventById } from '../lib/programa'
import { publicUrl, type AlbumPhoto } from '../lib/supabase'
import { IconChevronL, IconChevronR, IconDownload, IconShare, IconX } from './Icons'
import { useToast } from './Toast'

interface Props {
  photos: AlbumPhoto[]
  index: number
  total: number
  onIndex: (i: number) => void
  onClose: () => void
  onNearEnd?: () => void
}

export default function Lightbox({ photos, index, total, onIndex, onClose, onNearEnd }: Props) {
  const { t, L } = useI18n()
  const toast = useToast()
  const photo = photos[index]
  const touchX = useRef<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const prev = () => index > 0 && onIndex(index - 1)
  const next = () => index < photos.length - 1 && onIndex(index + 1)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  })

  // pré-carregar vizinhas e pedir mais fotos perto do fim da lista
  useEffect(() => {
    for (const p of [photos[index - 1], photos[index + 1]]) if (p) new Image().src = publicUrl(p.path)
    if (index >= photos.length - 5) onNearEnd?.()
  }, [index, photos, onNearEnd])

  if (!photo) return null
  const src = publicUrl(photo.path)
  const ev = eventById(photo.event_id)
  const day = days.find((d) => d.day === photo.day)

  async function share() {
    const url = `${window.location.origin}/?foto=${photo.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Pyne Awards Africa 2026', url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast(t('lb.copied'), 'success')
    } catch {
      /* partilha cancelada */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#060d16]"
      role="dialog"
      aria-modal="true"
      aria-label={`${t('album.photo')} ${index + 1} / ${total}`}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (dx > 50) prev()
        else if (dx < -50) next()
        touchX.current = null
      }}
    >
      <div className="flex items-center justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-sm text-white/80">
        <span className="tabular-nums">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={share} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 font-medium text-white hover:bg-white/20">
            <IconShare className="h-5 w-5" />
            <span className="hidden sm:inline">{t('lb.share')}</span>
          </button>
          <a
            href={`${src}?download=pyne-awards-2026-${photo.id.slice(0, 8)}.webp`}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-3.5 py-2 font-semibold text-navy hover:brightness-105"
          >
            <IconDownload className="h-5 w-5" />
            <span className="hidden sm:inline">{t('lb.download')}</span>
          </a>
          <button ref={closeRef} onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label={t('lb.close')}>
            <IconX className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={onClose}>
        <img
          key={photo.id}
          src={src}
          alt={ev ? L(ev.title) : t('album.photo')}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          className="animate-pop-in max-h-full max-w-full rounded object-contain"
          style={{ backgroundColor: photo.color ?? '#1b3350', backgroundImage: `url(${publicUrl(photo.thumb_path)})`, backgroundSize: 'cover' }}
          onClick={(e) => e.stopPropagation()}
        />
        {index > 0 && (
          <button
            onClick={(e) => (e.stopPropagation(), prev())}
            className="absolute left-2 hidden rounded-full bg-black/50 p-3 text-white hover:bg-black/80 sm:block"
            aria-label={t('lb.prev')}
          >
            <IconChevronL className="h-7 w-7" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            onClick={(e) => (e.stopPropagation(), next())}
            className="absolute right-2 hidden rounded-full bg-black/50 p-3 text-white hover:bg-black/80 sm:block"
            aria-label={t('lb.next')}
          >
            <IconChevronR className="h-7 w-7" />
          </button>
        )}
      </div>

      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm">
        {ev && <p className="font-medium text-gold">{L(ev.title)}</p>}
        {day && <p className="text-white/60">{L(day.label)}</p>}
      </div>
    </div>
  )
}
