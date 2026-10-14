-- ============================================================
-- Álbum — mudar as credenciais (email e/ou password) do admin
-- Correr no SQL Editor do projecto Supabase do ÁLBUM.
--
-- 1) Preencher as 3 linhas em "EDITAR AQUI"
--    - para mudar só a password, repetir o email actual em email_novo
-- 2) Run
-- 3) Actualizar também o ficheiro .env.script (ALBUM_ADMIN_EMAIL / ALBUM_ADMIN_PASSWORD)
-- ============================================================

do $$
declare
  -- ---------- EDITAR AQUI ----------
  email_actual text := 'admin@pyne.co.mz';
  email_novo   text := 'novo-email@exemplo.co.mz';
  pass_nova    text := 'Nova-Password-Forte-2026';
  -- ---------------------------------
  uid uuid;
begin
  email_actual := lower(trim(email_actual));
  email_novo   := lower(trim(email_novo));

  if length(pass_nova) < 8 then
    raise exception 'A password nova deve ter pelo menos 8 caracteres.';
  end if;

  select id into uid from auth.users where email = email_actual;
  if uid is null then
    raise exception 'Não existe nenhuma conta com o email %', email_actual;
  end if;

  if email_novo <> email_actual and exists (select 1 from auth.users where email = email_novo) then
    raise exception 'O email % já está a ser usado por outra conta.', email_novo;
  end if;

  -- email + password
  update auth.users
     set email              = email_novo,
         encrypted_password = extensions.crypt(pass_nova, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id = uid;

  -- o login por email também lê o email da identidade
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(email_novo)),
         updated_at    = now()
   where user_id = uid and provider = 'email';

  -- termina as sessões abertas: quem entrou com as credenciais antigas tem de entrar de novo
  delete from auth.sessions where user_id = uid;
  delete from auth.refresh_tokens where user_id = uid::text;

  raise notice 'Credenciais actualizadas: % → %', email_actual, email_novo;
end $$;

-- Confirmar quem tem acesso
select email, email_confirmed_at, updated_at from auth.users order by created_at;
