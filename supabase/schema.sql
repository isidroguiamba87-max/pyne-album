-- ============================================================
-- Pyne Awards Africa 2026 — Álbum de fotos (projecto Supabase PRÓPRIO)
-- Colar no Supabase > SQL Editor do projecto NOVO e executar uma vez.
-- ============================================================

create table if not exists public.album_photos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  taken_at    timestamptz,                 -- data/hora da fotografia (EXIF); ordena o álbum
  day         smallint check (day between 1 and 3),
  event_id    text,                        -- 'elevate-breakfast', 'welcome-mixer', 'b2b-meetings', 'gala', 'fam-trip'
  file_name   text not null unique,        -- nome original; evita duplicados ao voltar a correr o script
  path        text not null,               -- foto grande (~1600 px, WebP)
  thumb_path  text not null,               -- miniatura (~480 px, WebP)
  width       int,
  height      int,
  color       text,                        -- cor dominante (#rrggbb) para mostrar enquanto carrega
  bytes       int,                         -- tamanho da foto grande
  featured    boolean not null default false,
  hidden      boolean not null default false
);

-- Ordenação e filtros rápidos mesmo com milhares de fotos
create index if not exists album_photos_order_idx on public.album_photos (taken_at desc nulls last, id);
create index if not exists album_photos_day_idx   on public.album_photos (day, taken_at desc nulls last);
create index if not exists album_photos_event_idx on public.album_photos (event_id, taken_at desc nulls last);

alter table public.album_photos enable row level security;

-- Público vê fotos não escondidas; admin vê tudo
create policy "album_public_read" on public.album_photos
  for select using (hidden = false or auth.role() = 'authenticated');

create policy "album_admin_insert" on public.album_photos
  for insert to authenticated with check (true);
create policy "album_admin_update" on public.album_photos
  for update to authenticated using (true);
create policy "album_admin_delete" on public.album_photos
  for delete to authenticated using (true);

-- Contagens por dia e por sessão (para os filtros), sem descarregar as linhas todas
create or replace view public.album_counts
with (security_invoker = true) as
  select day, event_id, count(*)::int as n
  from public.album_photos
  where hidden = false
  group by day, event_id;

grant select on public.album_counts to anon, authenticated;

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album', 'album', true, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "album_storage_public_read" on storage.objects
  for select using (bucket_id = 'album');
create policy "album_storage_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'album');
create policy "album_storage_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'album');
create policy "album_storage_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'album');

-- Depois: criar a conta de admin (ver supabase/criar_admin.sql)
-- e DESLIGAR "Allow new users to sign up" em Authentication.
