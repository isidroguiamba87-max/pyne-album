# Álbum oficial — Pyne Awards Africa 2026

Site próprio para **todas** as fotos do evento (1000+), separado do site principal
(`pyne-awards`) para não afectar a sua performance nem os seus deploys.

- **Site:** grelha com filtros por dia e sessão, destaques, lightbox com descarregar e partilhar, link directo por foto (`?foto=`).
- **Admin (`/admin`):** adicionar fotos pelo browser, esconder, destacar, apagar.
- **Script (`npm run upload`):** envio em lote a partir de uma pasta do PC.

Stack: Vite + React + TypeScript + Tailwind, Supabase (Postgres + Storage), Vercel.

## Configuração (uma vez)

1. **Supabase — projecto NOVO** (não usar o do site principal):
   1. supabase.com → New project (ex.: `pyne-album`).
   2. SQL Editor → correr `supabase/schema.sql`.
   3. Editar email/password em `supabase/criar_admin.sql` e correr no SQL Editor.
   4. Authentication → Sign In / Providers → **desligar "Allow new users to sign up"**.
   5. Project Settings → API: copiar o **Project URL** e a **Publishable key** (`sb_publishable_…`).
2. **Ficheiros locais** (nunca vão para o git):
   - `.env.local` — copiar de `.env.example` e preencher.
   - `.env.script` — copiar de `.env.script.example` e preencher (inclui a password do admin, só para o script).
3. **Vercel:** importar o repositório, pôr as 3 variáveis de `.env.example`, deploy.
   Domínio sugerido: `fotos.<domínio>` (CNAME → `cname.vercel-dns.com`).
4. **Site principal:** mudar o link do botão "Ver mais fotos" para o endereço do álbum.

## Enviar as fotos

```powershell
npm.cmd install
npm.cmd run upload -- "D:\Fotos\Pyne"                         # dia e sessão automáticos (hora da foto)
npm.cmd run upload -- "D:\Fotos\Gala" --dia 2 --evento gala   # forçar dia/sessão
npm.cmd run upload -- "D:\Fotos\Pyne" --dry-run               # testar sem enviar nada
```

- Lê subpastas, corrige a orientação, gera WebP de 1600 px (~130 KB) e miniatura de 480 px (~30 KB).
- **Pode ser interrompido e voltado a correr** — fotos já enviadas são ignoradas (identificadas pelo conteúdo).
- A sessão é atribuída pela hora EXIF da foto, com margem de 60 min antes e 90 min depois de cada bloco do programa.
- IDs de sessão: `elevate-breakfast`, `welcome-mixer`, `b2b-meetings`, `gala`, `fam-trip`.

## Limites a vigiar (plano gratuito do Supabase)

- Armazenamento: 1 GB → ~1000 fotos ocupam ~160 MB.
- Tráfego (egress): 5 GB/mês. Ver em Supabase → Usage. Se o álbum for muito visto,
  passar a Pro (US$25/mês) ou mover o bucket para Cloudflare R2 (tráfego gratuito).
