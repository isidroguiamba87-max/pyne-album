import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Lang, Localized } from './lib/programa'
import { getItem, setItem } from './lib/storage'

const pt = {
  'brand.album': 'Álbum oficial',
  'back': 'Voltar ao site',
  'lang.switch': 'Mudar idioma',
  'skip': 'Saltar para o conteúdo',

  'album.kicker': 'The Pyne Awards Africa 2026',
  'album.title': 'Álbum oficial',
  'album.sub': 'Todas as fotos do evento · Maputo, 24–26 Setembro 2026',
  'album.count.one': '1 foto',
  'album.count.many': '{n} fotos',
  'album.all': 'Todos',
  'album.allSessions': 'Todas as sessões',
  'album.featured': 'Destaques',
  'album.empty': 'Ainda não há fotos aqui. Volte em breve!',
  'album.loading': 'A carregar…',
  'album.more': 'Carregar mais',
  'album.end': 'Viu todas as fotos desta selecção.',
  'album.photo': 'Foto',
  'video.title': 'Vídeos',
  'video.play': 'Ver vídeo',
  'video.admin.add': 'Adicionar vídeo do YouTube',
  'video.admin.hint': 'O vídeo aparece no álbum e na galeria do site.',
  'video.admin.link': 'Link do YouTube',
  'video.admin.titleField': 'Título (aparece na galeria)',
  'video.admin.titlePh': 'Ex.: Destaques da Gala 2026',
  'video.admin.optional': 'opcional',
  'video.admin.preview': 'Pré-visualização',
  'video.admin.save': 'Publicar vídeo',
  'video.admin.badLink': 'Link do YouTube inválido.',
  'video.admin.needTitle': 'Escreva um título.',
  'video.admin.dup': 'Este vídeo já foi adicionado.',
  'video.admin.added': 'Vídeo publicado!',
  'video.admin.fromHere': 'Adicionado aqui',
  'video.admin.fromOther': 'Adicionado no site',
  'video.admin.otherHint': 'Para editar, use o admin do site.',
  'video.admin.confirmDelete': 'Apagar este vídeo?',
  'album.photos': 'Fotos',


  'lb.download': 'Descarregar',
  'lb.share': 'Partilhar',
  'lb.copied': 'Link copiado!',
  'lb.close': 'Fechar',
  'lb.prev': 'Anterior',
  'lb.next': 'Seguinte',

  'offline': 'O álbum ainda não está ligado ao servidor (Supabase por configurar).',
  'loadError': 'Erro ao carregar. Verifique a ligação.',
  'retry': 'Tentar de novo',
  'cancel': 'Cancelar',
  'confirm': 'Confirmar',

  'footer.builtWith': 'Desenvolvido com',
  'footer.by': 'pela',

  'admin.title': 'Gestão do álbum',
  'admin.email': 'Email',
  'admin.password': 'Palavra-passe',
  'admin.login': 'Entrar',
  'admin.logout': 'Sair',
  'admin.loginError': 'Email ou palavra-passe incorrectos.',
  'admin.upload.title': 'Adicionar fotos',
  'admin.upload.hint': 'Para centenas de fotos use o script (npm run upload). Aqui é para ir juntando fotos novas.',
  'admin.upload.auto': 'Automático (pela hora da foto)',
  'admin.upload.day': 'Dia',
  'admin.upload.event': 'Sessão',
  'admin.upload.pick': 'Escolher fotos',
  'admin.upload.drop': 'Toque para escolher várias fotos (ou arraste para aqui)',
  'admin.upload.clear': 'Limpar concluídos',
  'admin.status.queued': 'Em fila',
  'admin.status.working': 'A processar',
  'admin.status.done': 'Concluído',
  'admin.status.dup': 'Já existia',
  'admin.status.error': 'Erro',
  'admin.list.title': 'Fotos no álbum',
  'admin.list.showHidden': 'Mostrar só escondidas',
  'admin.hide': 'Esconder',
  'admin.show': 'Mostrar',
  'admin.feature': 'Destacar',
  'admin.unfeature': 'Tirar destaque',
  'admin.delete': 'Apagar',
  'admin.hidden': 'Escondida',
  'admin.confirmDelete': 'Apagar esta foto definitivamente?',
}

type Key = keyof typeof pt

const en: Record<Key, string> = {
  'brand.album': 'Official album',
  'back': 'Back to website',
  'lang.switch': 'Switch language',
  'skip': 'Skip to content',

  'album.kicker': 'The Pyne Awards Africa 2026',
  'album.title': 'Official album',
  'album.sub': 'All the event photos · Maputo, 24–26 September 2026',
  'album.count.one': '1 photo',
  'album.count.many': '{n} photos',
  'album.all': 'All',
  'album.allSessions': 'All sessions',
  'album.featured': 'Highlights',
  'album.empty': 'No photos here yet. Check back soon!',
  'album.loading': 'Loading…',
  'album.more': 'Load more',
  'album.end': 'You have seen every photo in this selection.',
  'album.photo': 'Photo',
  'video.title': 'Videos',
  'video.play': 'Watch video',
  'video.admin.add': 'Add a YouTube video',
  'video.admin.hint': 'The video appears in the album and in the website gallery.',
  'video.admin.link': 'YouTube link',
  'video.admin.titleField': 'Title (shown in the gallery)',
  'video.admin.titlePh': 'E.g.: Gala 2026 highlights',
  'video.admin.optional': 'optional',
  'video.admin.preview': 'Preview',
  'video.admin.save': 'Publish video',
  'video.admin.badLink': 'Invalid YouTube link.',
  'video.admin.needTitle': 'Please enter a title.',
  'video.admin.dup': 'This video has already been added.',
  'video.admin.added': 'Video published!',
  'video.admin.fromHere': 'Added here',
  'video.admin.fromOther': 'Added on the website',
  'video.admin.otherHint': 'To edit it, use the website admin.',
  'video.admin.confirmDelete': 'Delete this video?',
  'album.photos': 'Photos',


  'lb.download': 'Download',
  'lb.share': 'Share',
  'lb.copied': 'Link copied!',
  'lb.close': 'Close',
  'lb.prev': 'Previous',
  'lb.next': 'Next',

  'offline': 'The album is not connected to the server yet (Supabase not configured).',
  'loadError': 'Could not load. Check your connection.',
  'retry': 'Try again',
  'cancel': 'Cancel',
  'confirm': 'Confirm',

  'footer.builtWith': 'Built with',
  'footer.by': 'by',

  'admin.title': 'Album management',
  'admin.email': 'Email',
  'admin.password': 'Password',
  'admin.login': 'Sign in',
  'admin.logout': 'Sign out',
  'admin.loginError': 'Wrong email or password.',
  'admin.upload.title': 'Add photos',
  'admin.upload.hint': 'For hundreds of photos use the script (npm run upload). This is for adding new photos over time.',
  'admin.upload.auto': 'Automatic (from photo time)',
  'admin.upload.day': 'Day',
  'admin.upload.event': 'Session',
  'admin.upload.pick': 'Choose photos',
  'admin.upload.drop': 'Tap to choose several photos (or drag them here)',
  'admin.upload.clear': 'Clear finished',
  'admin.status.queued': 'Queued',
  'admin.status.working': 'Processing',
  'admin.status.done': 'Done',
  'admin.status.dup': 'Already there',
  'admin.status.error': 'Error',
  'admin.list.title': 'Photos in the album',
  'admin.list.showHidden': 'Show hidden only',
  'admin.hide': 'Hide',
  'admin.show': 'Show',
  'admin.feature': 'Feature',
  'admin.unfeature': 'Unfeature',
  'admin.delete': 'Delete',
  'admin.hidden': 'Hidden',
  'admin.confirmDelete': 'Permanently delete this photo?',
}

const dict: Record<Lang, Record<Key, string>> = { pt, en }

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
  L: (v: Localized | null | undefined) => string
}

const Ctx = createContext<I18n | null>(null)

function initialLang(): Lang {
  const q = new URLSearchParams(window.location.search).get('lang')
  if (q === 'pt' || q === 'en') return q
  return getItem('pyne.lang') === 'en' ? 'en' : 'pt'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    setItem('pyne.lang', l)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => {
        let s = dict[lang][key] ?? key
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
        return s
      },
      L: (v) => (v ? v[lang] || v.pt : ''),
    }),
    [lang, setLang],
  )

  return createElement(Ctx.Provider, { value }, children)
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n fora do I18nProvider')
  return v
}

export function formatCount(n: number, lang: Lang) {
  return new Intl.NumberFormat(lang === 'pt' ? 'pt-PT' : 'en-GB').format(n)
}
