-- ============================================================
-- BABI VIBES — Diagnostic compte administrateur
-- ============================================================
-- Exécuter dans Supabase Dashboard → SQL Editor
-- pour vérifier l'état du compte admin AVANT de relancer
-- create_admin_user.sql
-- ============================================================

SELECT
    u.id,
    u.email,
    u.role          AS auth_role,
    u.aud,
    u.email_confirmed_at IS NOT NULL AS email_confirmed,
    u.is_anonymous,
    -- Vérifie le préfixe du hash (doit être $2b$, pas $2a$)
    LEFT(u.encrypted_password, 4)    AS bcrypt_prefix,
    u.created_at,
    u.updated_at,
    -- Données côté public.users
    pu.role                          AS public_role,
    pu.role_v2                       AS public_role_v2
FROM auth.users u
LEFT JOIN public.users pu ON pu.id = u.id
WHERE u.email = 'jeanluc@bigfiveabidjan.com';
