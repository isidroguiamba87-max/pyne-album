// Envio em lote das fotos do evento para o álbum (Supabase).
//
// Uso:
//   npm run upload -- "D:\Fotos\Pyne"                 (atribui dia/sessão pela hora da foto)
//   npm run upload -- "D:\Fotos\Gala" --dia 2 --evento gala
//   npm run upload -- "D:\Fotos\Pyne" --dry-run        (só mostra o que faria, não envia)
//
// Pode ser interrompido e voltado a correr: fotos já enviadas são ignoradas.
// Precisa de .env.script (ver .env.script.example).

import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import exifr from 'exifr'
import sharp from 'sharp'

const programa = JSON.parse(await readFile(new URL('../data/programa.json', import.meta.url), 'utf8'))

// ---------- argumentos ----------
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const folder = args.find((a, i) => !a.startsWith('--') && !['--dia', '--evento', '--concorrencia'].includes(args[i - 1]))
const DRY = args.includes('--dry-run')
const FORCE_DAY = flag('--dia') ? Number(flag('--dia')) : null
const FORCE_EVENT = flag('--evento') ?? null
const CONCURRENCY = Number(flag('--concorrencia') ?? 4)

if (!folder) {
  console.error('Indique a pasta das fotos. Ex.: npm run upload -- "D:\\Fotos\\Pyne"')
  process.exit(1)
}
if (FORCE_EVENT && !programa.events.some((e) => e.id === FORCE_EVENT)) {
  console.error(`--evento inválido. Use um de: ${programa.events.map((e) => e.id).join(', ')}`)
  process.exit(1)
}

// ---------- programa → janelas de tempo (hora de Maputo, UTC+2) ----------
const at = (date, hhmm) => Date.parse(`${date}T${hhmm}:00+02:00`)
const windows = programa.events.map((e) => {
  const first = e.items[0]
  const last = e.items[e.items.length - 1]
  return {
    id: e.id,
    day: e.day,
    // margem: 60 min antes (chegadas) e 90 min depois (fotos de grupo, networking)
    from: at(e.date, first.start) - 60 * 60_000,
    to: at(e.date, last.end ?? last.start) + 90 * 60_000,
  }
})
const dayByDate = Object.fromEntries(programa.days.map((d) => [d.date, d.day]))

function classify(takenAt) {
  if (FORCE_DAY || FORCE_EVENT) {
    const ev = programa.events.find((e) => e.id === FORCE_EVENT)
    return { day: FORCE_DAY ?? ev?.day ?? null, event_id: FORCE_EVENT }
  }
  if (!takenAt) return { day: null, event_id: null }
  const t = takenAt.getTime()
  const w = windows.find((x) => x.from <= t && t <= x.to)
  if (w) return { day: w.day, event_id: w.id }
  const date = new Date(t + 2 * 3600_000).toISOString().slice(0, 10) // data em Maputo
  return { day: dayByDate[date] ?? null, event_id: null }
}

// A câmara grava a hora local sem fuso: interpretamos como hora de Maputo
async function readTakenAt(file) {
  try {
    const x = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal'], reviveValues: false })
    const raw = x?.DateTimeOriginal ?? x?.CreateDate
    if (!raw) return null
    const m = String(raw).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
    if (!m) return null
    const offset = x?.OffsetTimeOriginal ?? '+02:00'
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

// ---------- ficheiros ----------
const EXT = /\.(jpe?g|png|webp|tiff?)$/i
async function walk(dir) {
  const out = []
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...(await walk(p)))
    else if (EXT.test(ent.name)) out.push(p)
  }
  return out
}

async function processImage(file) {
  const buf = await readFile(file)
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 10)
  const base = path.basename(file)
  const img = sharp(buf, { failOn: 'none' }).rotate() // respeita a orientação EXIF
  const large = await img
    .clone()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })
  const thumb = await img.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toBuffer()
  const { dominant } = await sharp(thumb).stats()
  const color = '#' + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('')
  return {
    fileName: `${base}__${hash}`,
    slug: base.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase(),
    hash,
    large: large.data,
    width: large.info.width,
    height: large.info.height,
    thumb,
    color,
  }
}

async function retry(fn, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= tries) throw e
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}

// ---------- principal ----------
const root = path.resolve(folder)
if (!(await stat(root).catch(() => null))?.isDirectory()) {
  console.error(`Pasta não encontrada: ${root}`)
  process.exit(1)
}

const files = (await walk(root)).sort()
console.log(`${files.length} fotos encontradas em ${root}${DRY ? '  (modo de teste — nada é enviado)' : ''}`)
if (!files.length) process.exit(0)

let sb = null
const existing = new Set()
if (!DRY) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, ALBUM_ADMIN_EMAIL, ALBUM_ADMIN_PASSWORD } = process.env
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ALBUM_ADMIN_EMAIL || !ALBUM_ADMIN_PASSWORD) {
    console.error('Falta configurar .env.script (ver .env.script.example).')
    process.exit(1)
  }
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await sb.auth.signInWithPassword({ email: ALBUM_ADMIN_EMAIL, password: ALBUM_ADMIN_PASSWORD })
  if (error) {
    console.error('Login falhou:', error.message)
    process.exit(1)
  }
  // o que já foi enviado (para retomar sem duplicar)
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await sb.from('album_photos').select('file_name').range(from, from + 999)
    if (e) throw e
    data.forEach((r) => existing.add(r.file_name))
    if (data.length < 1000) break
  }
  if (existing.size) console.log(`${existing.size} fotos já estão no álbum — serão ignoradas.`)
}

const stats = { ok: 0, skipped: 0, failed: 0, bytes: 0 }
const failures = []
let done = 0
const t0 = Date.now()

async function handle(file) {
  const rel = path.relative(root, file)
  try {
    const taken = await readTakenAt(file)
    const p = await processImage(file)
    if (existing.has(p.fileName)) {
      stats.skipped++
      return
    }
    const { day, event_id } = classify(taken)
    const dir = day ?? 0
    const pathLarge = `${dir}/${p.slug}-${p.hash}.webp`
    const pathThumb = `${dir}/thumbs/${p.slug}-${p.hash}.webp`

    if (!DRY) {
      const opts = { contentType: 'image/webp', cacheControl: '31536000', upsert: true }
      await retry(async () => {
        const r = await sb.storage.from('album').upload(pathLarge, p.large, opts)
        if (r.error) throw r.error
      })
      await retry(async () => {
        const r = await sb.storage.from('album').upload(pathThumb, p.thumb, opts)
        if (r.error) throw r.error
      })
      await retry(async () => {
        const r = await sb.from('album_photos').insert({
          file_name: p.fileName,
          taken_at: taken?.toISOString() ?? null,
          day,
          event_id,
          path: pathLarge,
          thumb_path: pathThumb,
          width: p.width,
          height: p.height,
          color: p.color,
          bytes: p.large.length,
        })
        if (r.error && r.error.code !== '23505') throw r.error // 23505 = já existe
      })
    }
    stats.ok++
    stats.bytes += p.large.length + p.thumb.length
    const tag = `${day ? `Dia ${day}` : 'sem dia'}${event_id ? ` · ${event_id}` : ''}`
    const kb = Math.round((p.large.length + p.thumb.length) / 1024)
    console.log(`[${++done + stats.skipped}/${files.length}] ${DRY ? 'teste' : 'ok'}  ${rel}  →  ${tag}  (${kb} KB)`)
  } catch (e) {
    stats.failed++
    failures.push(`${rel}: ${e?.message ?? e}`)
    console.log(`[erro] ${rel}: ${e?.message ?? e}`)
  }
}

// fila com concorrência limitada
let next = 0
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
    while (next < files.length) await handle(files[next++])
  }),
)

const min = ((Date.now() - t0) / 60_000).toFixed(1)
console.log('\n──────── Resumo ────────')
console.log(`${DRY ? 'Processadas (teste)' : 'Enviadas'}: ${stats.ok}   Já existiam: ${stats.skipped}   Erros: ${stats.failed}   Tempo: ${min} min`)
console.log(`Volume ${DRY ? 'estimado' : 'enviado'}: ${(stats.bytes / 1024 / 1024).toFixed(1)} MB`)
if (failures.length) {
  console.log('\nFalharam (volte a correr o mesmo comando para tentar de novo):')
  failures.forEach((f) => console.log('  - ' + f))
}
