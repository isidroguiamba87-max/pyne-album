-- ============================================================
-- ÁLBUM — multi-evento (Pyne Awards Africa 2026 + Citizen Connect Africa 2026)
-- Correr no SQL Editor do projecto Supabase do ÁLBUM (jqrgwtsnpnxtldncpnby).
-- Pode correr mais de uma vez. Correr ANTES do deploy do álbum novo.
-- Tudo o que já existe (fotos e vídeos) fica no Pyne.
-- ============================================================

-- 1) eventos
create table if not exists public.events (
  slug        text primary key,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  sort_order  int  not null default 0,
  active      boolean not null default true
);
alter table public.events enable row level security;
drop policy if exists "events_public_read" on public.events;
drop policy if exists "events_admin_write" on public.events;
create policy "events_public_read" on public.events for select using (true);
create policy "events_admin_write" on public.events for all to authenticated using (true) with check (true);
insert into public.events (slug, name, start_date, end_date, sort_order) values
  ('pyne-awards-2026',     'The Pyne Awards Africa 2026',         '2026-09-24', '2026-09-26', 1),
  ('citizen-connect-2026', 'Citizen Connect Africa – Moçambique', '2026-10-14', '2026-10-14', 2)
on conflict (slug) do nothing;

-- 2) event_slug nas fotos e vídeos (os existentes ficam no Pyne)
alter table public.album_photos add column if not exists event_slug text not null default 'pyne-awards-2026' references public.events(slug);
alter table public.videos       add column if not exists event_slug text not null default 'pyne-awards-2026' references public.events(slug);
create index if not exists album_photos_event_order_idx on public.album_photos (event_slug, taken_at desc nulls last, id);

-- 3) contagens por evento (filtros e total do álbum)
drop view if exists public.album_counts;
create view public.album_counts
with (security_invoker = true) as
  select event_slug, day, event_id, count(*)::int as n
  from public.album_photos
  where hidden = false
  group by event_slug, day, event_id;
grant select on public.album_counts to anon, authenticated;

-- confirmar
select event_slug, count(*) as fotos from public.album_photos group by 1 order by 1;
