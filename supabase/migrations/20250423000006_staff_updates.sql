DO $$
DECLARE
  v_user_id UUID;
  v_target UUID;
BEGIN
  -- 1) Esra Tane → Esra Tanc + neue Mail + Passwort-Reset
  SELECT id INTO v_target FROM auth.users WHERE email = 'esra.tane@praxis-koenigstrasse.de';
  IF v_target IS NOT NULL THEN
    UPDATE auth.users
    SET email = 'esra.tanc@praxis-koenigstrasse.de',
        encrypted_password = crypt('3DnNzH9wdT', gen_salt('bf')),
        updated_at = now()
    WHERE id = v_target;
    UPDATE auth.identities
    SET provider_id = v_target::text,
        identity_data = jsonb_set(identity_data, '{email}', '"esra.tanc@praxis-koenigstrasse.de"'),
        updated_at = now()
    WHERE user_id = v_target AND provider = 'email';
    UPDATE admin_profiles SET display_name = 'Esra Tanc' WHERE id = v_target;
  END IF;

  -- 2) Khatuna Khatuna → Khatuna Ketiladze + neue Mail + Passwort-Reset
  SELECT id INTO v_target FROM auth.users WHERE email = 'khatuna.khatuna@praxis-koenigstrasse.de';
  IF v_target IS NOT NULL THEN
    UPDATE auth.users
    SET email = 'khatuna.ketiladze@praxis-koenigstrasse.de',
        encrypted_password = crypt('r6DMoRextr', gen_salt('bf')),
        updated_at = now()
    WHERE id = v_target;
    UPDATE auth.identities
    SET identity_data = jsonb_set(identity_data, '{email}', '"khatuna.ketiladze@praxis-koenigstrasse.de"'),
        updated_at = now()
    WHERE user_id = v_target AND provider = 'email';
    UPDATE admin_profiles SET display_name = 'Khatuna Ketiladze' WHERE id = v_target;
  END IF;

  -- 3) Neuer MFA: Altun Seha
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'altun.seha@praxis-koenigstrasse.de') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'altun.seha@praxis-koenigstrasse.de', crypt('Mh6jQwvT3m', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Altun Seha')
    );
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id::text, v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', 'altun.seha@praxis-koenigstrasse.de'),
            'email', now(), now(), now());
    INSERT INTO admin_profiles (id, display_name, role, is_active)
    VALUES (v_user_id, 'Altun Seha', 'mfa', true);
  END IF;

  -- 4) Neuer MFA: Burcu Tandogan
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'burcu.tandogan@praxis-koenigstrasse.de') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'burcu.tandogan@praxis-koenigstrasse.de', crypt('DKS78ECfEi', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Burcu Tandogan')
    );
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id::text, v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', 'burcu.tandogan@praxis-koenigstrasse.de'),
            'email', now(), now(), now());
    INSERT INTO admin_profiles (id, display_name, role, is_active)
    VALUES (v_user_id, 'Burcu Tandogan', 'mfa', true);
  END IF;
END $$;
