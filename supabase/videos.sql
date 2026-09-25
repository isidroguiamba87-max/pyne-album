-- ============================================================
-- Álbum — Vídeos do YouTube
-- Correr no SQL Editor do projecto Supabase do ÁLBUM (uma vez).
-- (O site tem o seu próprio ficheiro: pyne-awards-site/supabase/videos_e_momentos.sql)
-- Os vídeos dos dois projectos aparecem juntos no site e no álbum.
-- ============================================================

create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  youtube_id  text not null unique check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title       text not null check (char_length(title) between 1 and 140),
  event_id    text,
  hidden      boolean not null default false
);

alter table public.videos enable row level security;

create policy "videos_public_read" on public.videos
  for select using (hidden = false or auth.role() = 'authenticated');
create policy "videos_admin_insert" on public.videos
  for insert to authenticated with check (true);
create policy "videos_admin_update" on public.videos
  for update to authenticated using (true);
create policy "videos_admin_delete" on public.videos
  for delete to authenticated using (true);
