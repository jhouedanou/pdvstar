-- ============================================================
-- BABI VIBES — Migrations SQL complètes
-- À exécuter dans Supabase SQL Editor (dans l'ordre)
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 2. TABLE users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone       TEXT UNIQUE NOT NULL,
    name        TEXT,
    pseudo      TEXT,
    email       TEXT DEFAULT '',
    avatar      TEXT,
    following   TEXT[] DEFAULT '{}',
    role        TEXT DEFAULT 'consumer' CHECK (role IN ('consumer','organizer','admin','user')),
    role_v2     TEXT DEFAULT 'consumer' CHECK (role_v2 IN ('consumer','organizer','admin')),
    space_name      TEXT,
    organizer_name  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role_v2 ON public.users(role_v2);

-- ============================================================
-- 3. TABLE events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title               TEXT NOT NULL,
    description         TEXT,
    date                TIMESTAMPTZ,
    location            TEXT,
    organizer           TEXT,
    image               TEXT,
    type                TEXT DEFAULT 'image',
    video_url           TEXT,
    background_music    TEXT,
    music_title         TEXT,
    promo_text          TEXT,
    coords_lat          FLOAT,
    coords_lng          FLOAT,
    geom                geography(POINT, 4326),
    distance            TEXT,
    participant_count   INTEGER DEFAULT 0,
    is_registered       BOOLEAN DEFAULT FALSE,
    is_premium          BOOLEAN DEFAULT FALSE,
    price               INTEGER DEFAULT 0,
    features            TEXT[] DEFAULT '{}',
    quartier            TEXT,
    ville               TEXT DEFAULT 'Abidjan',
    tags                TEXT[] DEFAULT '{}',
    status              TEXT DEFAULT 'approved' CHECK (status IN ('draft','pending','approved','rejected')),
    rejection_reason    TEXT,
    ticketing_enabled   BOOLEAN DEFAULT FALSE,
    ticket_price        INTEGER DEFAULT 0,
    ticket_capacity     INTEGER,
    commission_rate     FLOAT DEFAULT 5,
    created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_quartier ON public.events(quartier);
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_geom ON public.events USING GIST(geom);

-- Trigger : sync coords → geom automatiquement
CREATE OR REPLACE FUNCTION sync_event_geom() RETURNS trigger AS $$
BEGIN
    IF NEW.coords_lat IS NOT NULL AND NEW.coords_lng IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.coords_lng, NEW.coords_lat), 4326)::geography;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_geom_sync ON public.events;
CREATE TRIGGER events_geom_sync
    BEFORE INSERT OR UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION sync_event_geom();

-- Backfill geom pour événements existants
UPDATE public.events
SET geom = ST_SetSRID(ST_MakePoint(coords_lng, coords_lat), 4326)::geography
WHERE coords_lat IS NOT NULL AND coords_lng IS NOT NULL AND geom IS NULL;

-- ============================================================
-- 4. RPC nearby_events (PostGIS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.nearby_events(
    user_lat        FLOAT DEFAULT NULL,
    user_lng        FLOAT DEFAULT NULL,
    radius_km       FLOAT DEFAULT 50,
    filter_quartier TEXT  DEFAULT NULL,
    filter_tag      TEXT  DEFAULT NULL,
    filter_date_from TIMESTAMPTZ DEFAULT NULL,
    filter_date_to   TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF public.events
LANGUAGE sql STABLE AS $$
    SELECT * FROM public.events
    WHERE status = 'approved'
      AND (user_lat IS NULL OR user_lng IS NULL OR
           ST_DWithin(geom,
               ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
               radius_km * 1000))
      AND (filter_quartier IS NULL OR quartier = filter_quartier)
      AND (filter_tag      IS NULL OR filter_tag = ANY(tags))
      AND (filter_date_from IS NULL OR date >= filter_date_from)
      AND (filter_date_to   IS NULL OR date <= filter_date_to)
    ORDER BY
        CASE WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND geom IS NOT NULL
            THEN ST_Distance(geom, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography)
            ELSE 0
        END ASC,
        date ASC;
$$;

-- ============================================================
-- 5. TABLE rsvps
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rsvps (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES public.users(id) ON DELETE SET NULL,
    pseudo              TEXT NOT NULL,
    phone               TEXT NOT NULL,
    source              TEXT DEFAULT 'app',
    notified_organizer  BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON public.rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user_id  ON public.rsvps(user_id);

-- ============================================================
-- 6. TABLE tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tickets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    buyer_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
    buyer_phone     TEXT NOT NULL,
    buyer_pseudo    TEXT,
    price           INTEGER NOT NULL DEFAULT 0,
    commission      INTEGER DEFAULT 0,
    payment_method  TEXT,
    payment_ref     TEXT,
    qr_token        UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    payment_status  TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
    status          TEXT DEFAULT 'valid'   CHECK (status          IN ('valid','used','cancelled')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_event_id   ON public.tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_buyer_id   ON public.tickets(buyer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_token   ON public.tickets(qr_token);
CREATE INDEX IF NOT EXISTS idx_tickets_pay_status ON public.tickets(payment_status);

-- RPC redeem_ticket (idempotent)
CREATE OR REPLACE FUNCTION public.redeem_ticket(token TEXT, admin_uid TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
    t public.tickets%ROWTYPE;
BEGIN
    SELECT * INTO t FROM public.tickets WHERE qr_token = token::UUID;
    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'reason', 'Billet introuvable');
    END IF;
    IF t.status = 'used' THEN
        RETURN json_build_object('ok', false, 'reason', 'Billet déjà utilisé', 'ticket', row_to_json(t));
    END IF;
    IF t.status = 'cancelled' THEN
        RETURN json_build_object('ok', false, 'reason', 'Billet annulé');
    END IF;
    IF t.payment_status != 'paid' THEN
        RETURN json_build_object('ok', false, 'reason', 'Paiement non confirmé');
    END IF;
    UPDATE public.tickets SET status = 'used' WHERE qr_token = token::UUID;
    RETURN json_build_object('ok', true, 'ticket', row_to_json(t));
END $$;

-- ============================================================
-- 7. TABLE ads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    image           TEXT DEFAULT '',
    link            TEXT DEFAULT '#',
    sponsor         TEXT NOT NULL,
    sponsor_logo    TEXT,
    cta_text        TEXT DEFAULT 'En savoir plus',
    is_active       BOOLEAN DEFAULT TRUE,
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    click_count     INTEGER DEFAULT 0,
    view_count      INTEGER DEFAULT 0,
    position        INTEGER DEFAULT 0,
    format          TEXT DEFAULT 'banner' CHECK (format IN ('banner','fullscreen','video','story')),
    target_quartier TEXT,
    target_pdv      TEXT,
    video_url       TEXT,
    advertiser_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_position  ON public.ads(position);
CREATE INDEX IF NOT EXISTS idx_ads_is_active ON public.ads(is_active);

-- RPC increment stats pubs
CREATE OR REPLACE FUNCTION public.increment_ad_click(ad_id UUID)
RETURNS VOID LANGUAGE sql AS $$
    UPDATE public.ads SET click_count = click_count + 1 WHERE id = ad_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_ad_view(ad_id UUID)
RETURNS VOID LANGUAGE sql AS $$
    UPDATE public.ads SET view_count = view_count + 1 WHERE id = ad_id;
$$;

-- ============================================================
-- 8. TABLE user_passes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_passes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pass_type       TEXT NOT NULL CHECK (pass_type IN ('decouverte','standard','premium')),
    purchased_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    payment_method  TEXT,
    payment_ref     TEXT,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passes_user_id ON public.user_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_passes_expires ON public.user_passes(expires_at);

-- ============================================================
-- 9. TABLE tags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tags (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        TEXT UNIQUE NOT NULL,
    label       TEXT NOT NULL,
    emoji       TEXT,
    color       TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tags par défaut Abidjan
INSERT INTO public.tags (slug, label, emoji, sort_order) VALUES
    ('concert',   'Concert',        '🎵', 1),
    ('soiree',    'Soirée',         '🥂', 2),
    ('sport',     'Sport',          '⚽', 3),
    ('food',      'Food & Drinks',  '🍽️', 4),
    ('culture',   'Culture',        '🎭', 5),
    ('maquis',    'Maquis',         '🍺', 6),
    ('gratuit',   'Gratuit',        '🆓', 7),
    ('vip',       'VIP',            '👑', 8)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 10. TABLE moderation_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moderation_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
    admin_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL CHECK (action IN ('approve','reject','delete','edit')),
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modlog_event_id ON public.moderation_log(event_id);

-- ============================================================
-- 11. TABLE push_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint            TEXT NOT NULL DEFAULT 'onesignal',
    onesignal_player_id TEXT,
    quartier            TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- ============================================================
-- 12. RLS (Row Level Security)
-- ============================================================
-- Activer RLS sur toutes les tables
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_passes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- IMPORTANT : Supabase anon key = accès public contrôlé par RLS.
-- L'app utilise auth.uid() si Supabase Auth est activé.
-- Si auth custom (localStorage), utiliser service_role pour les écritures sensibles.

-- Politique permissive temporaire (MVP) — À RESTREINDRE en prod
-- Lecture publique events approuvés
CREATE POLICY "public read approved events" ON public.events
    FOR SELECT USING (status = 'approved');

-- Lecture publique tags, ads actives
CREATE POLICY "public read tags"     ON public.tags FOR SELECT USING (true);
CREATE POLICY "public read active ads" ON public.ads FOR SELECT USING (is_active = true);

-- Accès total via service_role (admin, Edge Functions)
-- Ces policies utilisent la anon key — à sécuriser avec auth.uid() en prod.
-- Pour MVP complet sans Supabase Auth :
-- Dans Supabase Dashboard → Table Editor → chaque table → Disable RLS temporairement
-- OU utiliser service_role key côté Edge Function uniquement.

-- ============================================================
-- 13. VUES MATÉRIALISÉES (optionnel, pour stats)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.stats_by_quartier AS
SELECT
    quartier,
    COUNT(*) FILTER (WHERE status = 'approved') AS event_count,
    SUM(participant_count)                       AS total_rsvps,
    AVG(ticket_price) FILTER (WHERE ticketing_enabled) AS avg_ticket_price
FROM public.events
WHERE quartier IS NOT NULL
GROUP BY quartier
ORDER BY event_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_quartier ON public.stats_by_quartier(quartier);

-- Rafraîchir avec : REFRESH MATERIALIZED VIEW CONCURRENTLY public.stats_by_quartier;
-- Planifier via Supabase pg_cron ou Edge Function cron.

-- ============================================================
-- 14. STORAGE BUCKET media (à créer via Dashboard ou SQL)
-- ============================================================
-- Via Supabase Dashboard → Storage → New bucket → "media" → Public
-- Ou via SQL (nécessite extension storage) :
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true)
-- ON CONFLICT DO NOTHING;

-- Policy lecture publique bucket media :
-- CREATE POLICY "public read media" ON storage.objects
--     FOR SELECT USING (bucket_id = 'media');
-- CREATE POLICY "auth write media" ON storage.objects
--     FOR INSERT WITH CHECK (bucket_id = 'media');

-- ============================================================
-- 15. TABLE reports (signalements users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID REFERENCES public.events(id) ON DELETE CASCADE,
    reporter_phone  TEXT,
    reason          TEXT NOT NULL,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_event_id ON public.reports(event_id);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON public.reports(status);
