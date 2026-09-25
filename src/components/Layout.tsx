import { Link, Outlet } from 'react-router-dom'
import { useI18n } from '../i18n'
import { MAIN_SITE_URL } from '../lib/supabase'
import { IconChevronL } from './Icons'

function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="flex rounded-full border border-gold/40 p-0.5 text-xs font-semibold" role="group" aria-label={t('lang.switch')}>
      {(['pt', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-3 py-1.5 uppercase transition ${lang === l ? 'bg-gold text-navy' : 'text-white/75 hover:text-white'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export default function Layout() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-navy">
        {t('skip')}
      </a>
      <header className="sticky top-0 z-40 border-b border-navy-line/70 bg-navy/90 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={`Media Craft Mozambique · ${t('brand.album')}`}>
            <img src="/mediacraft-logo.png" alt="Media Craft Mozambique" width={979} height={285} className="h-8 w-auto sm:h-9" />
            <span className="h-7 w-px bg-white/25" aria-hidden />
            <span className="text-[10px] leading-tight font-bold tracking-[0.2em] text-gold/90 uppercase sm:text-[11px]">{t('brand.album')}</span>
          </Link>
          <div className="flex items-center gap-3">
            {MAIN_SITE_URL && (
              <a href={MAIN_SITE_URL} className="hidden items-center gap-1 text-sm font-medium text-white/80 hover:text-gold sm:inline-flex">
                <IconChevronL className="h-4 w-4" />
                {t('back')}
              </a>
            )}
            <LangSwitch />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 bg-paper pb-16 text-ink">
        <Outlet />
      </main>

      <footer className="border-t-2 border-gold/70 bg-[#14253d] px-4 py-6 text-xs text-white/50">
        <div className="flex flex-col items-center gap-1">
          {MAIN_SITE_URL && (
            <a href={MAIN_SITE_URL} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-gold sm:hidden">
              <IconChevronL className="h-4 w-4" />
              {t('back')}
            </a>
          )}
          <p>© 2026 The Pyne Hospitality Company · Maputo</p>
          <a href="https://www.smartbp.tech/" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 transition hover:text-white/75">
            <img src="/smartbp-logo.png" alt="" width={20} height={20} className="h-5 w-5 opacity-80 group-hover:opacity-100" loading="lazy" />
            <span>
              {t('footer.builtWith')} <span className="text-red/70">♥</span> {t('footer.by')}{' '}
              <span className="font-medium text-white/65 group-hover:text-white/90">SmartBP Tech</span>
            </span>
          </a>
        </div>
      </footer>
    </div>
  )
}
