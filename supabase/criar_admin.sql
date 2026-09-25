-- ============================================================
-- Criar a conta de administrador do ÁLBUM (acesso a /admin) no projecto Supabase do álbum.
-- 1) Editar o email/password no fim do ficheiro
-- 2) Colar tudo no Supabase > SQL Editor > Run
-- Pode correr várias vezes: se o email já existir, só actualiza a password.
-- ============================================================

create or replace function pg_temp.criar_utilizador(v_email text, v_pass text)
returns text language plpgsql as $$
declare
  uid uuid;
begin
  v_email := lower(trim(v_email));
  select id into uid from auth.users where email = v_email;

  if uid is not null then
    update auth.users
       set encrypted_password = extensions.crypt(v_pass, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = uid;
    return v_email || ' — já existia, password actualizada';
  end if;

  uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_pass, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  return v_email || ' — criado';
end $$;

-- ---------- EDITAR AQUI: a conta única de administrador ----------
select pg_temp.criar_utilizador('admin@pyne.co.mz', 'MudarEsta-Password-2026');

-- Ver quem tem acesso
select email, email_confirmed_at, created_at from auth.users order by created_at;
