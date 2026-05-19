-- ============================================================
-- BABI VIBES — Création du compte administrateur
-- ============================================================
-- À exécuter dans Supabase SQL Editor
-- (Dashboard → SQL Editor → New query)
--
-- Mot de passe : BabiV!bes_2026#Admin$Secure
-- (à changer après la 1ère connexion via /admin)
--
-- NOTE : utilise $body$ comme délimiteur pour éviter tout
--        conflit de parsing avec $2a$/$2b$ à l'intérieur.
-- ============================================================

-- Rendre phone nullable (l'admin n'a pas de numéro de téléphone)
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

DO $body$
DECLARE
    v_uid   UUID;
    v_email TEXT := 'jeanluc@bigfiveabidjan.com';
    v_pass  TEXT := 'BabiV!bes_2026#Admin$Secure';
    v_hash  TEXT;
BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- Hash bcrypt $2b$ compatible Supabase GoTrue
    -- (pgcrypto génère $2a$, on remplace le préfixe)
    v_hash := REPLACE(
        crypt(v_pass, gen_salt('bf', 10)),
        '$2a$'::text, '$2b$'::text
    );

    -- -------------------------------------------------------
    -- 1. Auth : créer ou mettre à jour le compte
    -- -------------------------------------------------------
    -- Sous-requête scalaire (évite SELECT INTO mal parsé)
    v_uid := (SELECT id FROM auth.users WHERE email = v_email LIMIT 1);

    IF v_uid IS NULL THEN
        v_uid := gen_random_uuid();

        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password,
            email_confirmed_at, role, aud,
            raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at
        ) VALUES (
            v_uid,
            '00000000-0000-0000-0000-000000000000',
            v_email,
            v_hash,
            NOW(),
            'authenticated',
            'authenticated',
            '{"provider":"email","providers":["email"]}',
            '{}',
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Compte Auth cree — UUID : %', v_uid;
    ELSE
        UPDATE auth.users
        SET encrypted_password = v_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at         = NOW()
        WHERE id = v_uid;

        RAISE NOTICE 'Mot de passe Auth mis a jour — UUID : %', v_uid;
    END IF;

    -- -------------------------------------------------------
    -- 2. public.users : promouvoir en admin (upsert par id)
    -- -------------------------------------------------------
    INSERT INTO public.users (id, name, email, role, role_v2, created_at)
    VALUES (v_uid, 'Administrateur', v_email, 'admin', 'admin', NOW())
    ON CONFLICT (id) DO UPDATE
        SET role    = 'admin',
            role_v2 = 'admin',
            email   = EXCLUDED.email;

    RAISE NOTICE 'Admin operationnel : % — mdp : BabiV!bes_2026#Admin$Secure', v_email;
    RAISE NOTICE 'UUID : %', v_uid;
    RAISE NOTICE 'IMPORTANT : changez le mot de passe apres la 1ere connexion.';

END $body$;
