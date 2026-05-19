-- =========================================================
-- PHASE 5 - Socle Babivibes BtoBtoC
-- Migration progressive: profiles, attendances, interactions,
-- champs evenementiels modernes, preparation ads et tickets.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------
-- Helpers de role bases sur Supabase Auth.
-- L'application conserve le fallback local, mais ces fonctions
-- permettent des RLS strictes quand auth.uid() est disponible.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID UNIQUE,
    role TEXT NOT NULL DEFAULT 'consumer' CHECK (role IN ('consumer', 'organizer', 'admin')),
    full_name TEXT,
    pseudo TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT,
    district TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    consent_data BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON profiles (phone);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles (role);
CREATE INDEX IF NOT EXISTS profiles_city_district_idx ON profiles (city, district);

DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        INSERT INTO profiles (
            id,
            user_id,
            role,
            full_name,
            pseudo,
            phone,
            email,
            created_at
        )
        SELECT
            u.id,
            u.id,
            CASE
                WHEN COALESCE(u.role_v2::TEXT, u.role, 'consumer') IN ('consumer', 'organizer', 'admin')
                    THEN COALESCE(u.role_v2::TEXT, u.role, 'consumer')
                ELSE 'consumer'
            END,
            u.name,
            COALESCE(u.pseudo, u.name),
            u.phone,
            NULLIF(u.email, ''),
            COALESCE(u.created_at, NOW())
        FROM users u
        WHERE u.phone IS NOT NULL
        ON CONFLICT (phone) DO UPDATE SET
            role = EXCLUDED.role,
            full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
            pseudo = COALESCE(profiles.pseudo, EXCLUDED.pseudo),
            email = COALESCE(profiles.email, EXCLUDED.email),
            updated_at = NOW();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID AS $$
    SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ---------------------------------------------------------
-- Events: ajout des champs du modele Babivibes sans casser
-- les colonnes historiques date/location/image/type/etc.
-- ---------------------------------------------------------
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS location_name TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS organizer_name TEXT,
    ADD COLUMN IF NOT EXISTS organizer_phone TEXT,
    ADD COLUMN IF NOT EXISTS media_url TEXT,
    ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image',
    ADD COLUMN IF NOT EXISTS music_url TEXT,
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_ticketing_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS capacity INTEGER,
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by_profile UUID REFERENCES profiles(id);

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS promo_text TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS participant_count INTEGER DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'events'
          AND column_name = 'created_by'
    ) THEN
        ALTER TABLE events ADD COLUMN created_by UUID;
    END IF;
END $$;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events
    ADD CONSTRAINT events_status_check
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived'));

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_media_type_check;
ALTER TABLE events
    ADD CONSTRAINT events_media_type_check
    CHECK (media_type IN ('image', 'video', 'youtube', 'youtube_short', 'tiktok'));

UPDATE events SET
    event_date = COALESCE(event_date, date),
    location_name = COALESCE(location_name, location),
    city = COALESCE(city, ville),
    district = COALESCE(district, quartier),
    latitude = COALESCE(latitude, coords_lat),
    longitude = COALESCE(longitude, coords_lng),
    organizer_name = COALESCE(organizer_name, organizer),
    media_url = COALESCE(media_url, image),
    media_type = COALESCE(NULLIF(media_type, ''), type, 'image'),
    music_url = COALESCE(music_url, background_music),
    tags = COALESCE(NULLIF(tags, '{}'), features, '{}'),
    is_ticketing_enabled = COALESCE(is_ticketing_enabled, ticketing_enabled, false),
    capacity = COALESCE(capacity, ticket_capacity),
    view_count = COALESCE(view_count, 0),
    click_count = COALESCE(click_count, 0)
WHERE true;

CREATE INDEX IF NOT EXISTS events_event_date_idx ON events (event_date);
CREATE INDEX IF NOT EXISTS events_status_event_date_idx ON events (status, event_date);
CREATE INDEX IF NOT EXISTS events_city_district_idx ON events (city, district);
CREATE INDEX IF NOT EXISTS events_organizer_id_idx ON events (organizer_id);
CREATE INDEX IF NOT EXISTS events_featured_idx ON events (is_featured) WHERE is_featured = true;

ALTER TABLE events ADD COLUMN IF NOT EXISTS geo GEOGRAPHY(POINT, 4326);

CREATE OR REPLACE FUNCTION events_sync_geo() RETURNS TRIGGER AS $$
BEGIN
    NEW.latitude := COALESCE(NEW.latitude, NEW.coords_lat);
    NEW.longitude := COALESCE(NEW.longitude, NEW.coords_lng);

    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_sync_geo ON events;
CREATE TRIGGER trg_events_sync_geo
BEFORE INSERT OR UPDATE OF latitude, longitude, coords_lat, coords_lng ON events
FOR EACH ROW EXECUTE FUNCTION events_sync_geo();

UPDATE events SET geo = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE geo IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_geo_gist ON events USING GIST (geo);

-- ---------------------------------------------------------
-- Intentions "J'y vais"
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_attendances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    pseudo TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT,
    district TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    source TEXT DEFAULT 'feed',
    whatsapp_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id, phone)
);

CREATE INDEX IF NOT EXISTS event_attendances_event_idx ON event_attendances (event_id);
CREATE INDEX IF NOT EXISTS event_attendances_profile_idx ON event_attendances (profile_id);
CREATE INDEX IF NOT EXISTS event_attendances_phone_idx ON event_attendances (phone);

DO $$
BEGIN
    IF to_regclass('public.rsvps') IS NOT NULL THEN
        INSERT INTO event_attendances (
            event_id,
            profile_id,
            pseudo,
            phone,
            source,
            whatsapp_sent,
            created_at
        )
        SELECT
            r.event_id,
            r.user_id,
            r.pseudo,
            r.phone,
            COALESCE(NULLIF(r.source, ''), 'feed'),
            COALESCE(r.notified_organizer, false),
            COALESCE(r.created_at, NOW())
        FROM rsvps r
        ON CONFLICT (event_id, phone) DO NOTHING;
    END IF;
END $$;

-- ---------------------------------------------------------
-- Interactions et compteurs
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    interaction_type TEXT NOT NULL CHECK (
        interaction_type IN ('view', 'click_going', 'share', 'reservation_click', 'ad_click')
    ),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_interactions_event_idx ON event_interactions (event_id);
CREATE INDEX IF NOT EXISTS event_interactions_type_idx ON event_interactions (interaction_type);
CREATE INDEX IF NOT EXISTS event_interactions_created_idx ON event_interactions (created_at);

CREATE OR REPLACE FUNCTION track_event_interaction(
    p_event_id UUID,
    p_profile_id UUID DEFAULT NULL,
    p_interaction_type TEXT DEFAULT 'view',
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO event_interactions (event_id, profile_id, interaction_type, metadata)
    VALUES (p_event_id, p_profile_id, p_interaction_type, COALESCE(p_metadata, '{}'));

    IF p_interaction_type = 'view' THEN
        UPDATE events SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_event_id;
    ELSIF p_interaction_type IN ('click_going', 'reservation_click') THEN
        UPDATE events SET click_count = COALESCE(click_count, 0) + 1 WHERE id = p_event_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION nearby_events(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km INTEGER DEFAULT 50,
    filter_quartier TEXT DEFAULT NULL,
    filter_tag TEXT DEFAULT NULL,
    filter_date_from TIMESTAMPTZ DEFAULT NULL,
    filter_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF events AS $$
    SELECT *
    FROM events
    WHERE status = 'approved'
      AND COALESCE(event_date, date) >= DATE_TRUNC('day', NOW())
      AND (
        user_lat IS NULL OR user_lng IS NULL OR geo IS NULL
        OR ST_DWithin(
            geo,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
            radius_km * 1000
        )
      )
      AND (filter_quartier IS NULL OR district = filter_quartier OR quartier = filter_quartier)
      AND (filter_tag IS NULL OR filter_tag = ANY(tags) OR filter_tag = ANY(features))
      AND (filter_date_from IS NULL OR COALESCE(event_date, date) >= filter_date_from)
      AND (filter_date_to IS NULL OR COALESCE(event_date, date) <= filter_date_to)
    ORDER BY
      CASE
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND geo IS NOT NULL
        THEN ST_Distance(geo, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography)
      END ASC NULLS LAST,
      is_featured DESC,
      COALESCE(event_date, date) ASC;
$$ LANGUAGE SQL STABLE;

-- ---------------------------------------------------------
-- Regie publicitaire: compatibilite avec l'ancien modele ads.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image TEXT,
    link TEXT,
    sponsor TEXT,
    sponsor_logo TEXT,
    cta_text TEXT,
    is_active BOOLEAN DEFAULT false,
    position INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ads
    ADD COLUMN IF NOT EXISTS advertiser_name TEXT,
    ADD COLUMN IF NOT EXISTS media_url TEXT,
    ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image',
    ADD COLUMN IF NOT EXISTS target_city TEXT,
    ADD COLUMN IF NOT EXISTS target_district TEXT,
    ADD COLUMN IF NOT EXISTS target_event_tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS destination_url TEXT,
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_media_type_check;
ALTER TABLE ads
    ADD CONSTRAINT ads_media_type_check
    CHECK (media_type IN ('image', 'video'));

UPDATE ads SET
    advertiser_name = COALESCE(advertiser_name, sponsor),
    media_url = COALESCE(media_url, image, video_url),
    media_type = COALESCE(media_type, CASE WHEN video_url IS NOT NULL THEN 'video' ELSE 'image' END),
    target_district = COALESCE(target_district, target_quartier),
    destination_url = COALESCE(destination_url, link),
    view_count = COALESCE(view_count, 0),
    click_count = COALESCE(click_count, 0)
WHERE true;

CREATE INDEX IF NOT EXISTS ads_active_dates_idx ON ads (is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS ads_target_idx ON ads (target_city, target_district);

-- ---------------------------------------------------------
-- Billetterie: colonnes du brief ajoutees au modele existant.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    buyer_id UUID,
    buyer_phone TEXT,
    buyer_pseudo TEXT,
    qr_token TEXT UNIQUE,
    price INTEGER DEFAULT 0,
    commission INTEGER DEFAULT 0,
    payment_method TEXT,
    payment_ref TEXT,
    payment_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'valid',
    used_at TIMESTAMPTZ,
    used_by_admin UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS qr_code TEXT,
    ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_payment_status_check;
ALTER TABLE tickets
    ADD CONSTRAINT tickets_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cash_at_entry', 'refunded'));

UPDATE tickets SET
    profile_id = COALESCE(profile_id, buyer_id),
    phone = COALESCE(phone, buyer_phone),
    amount = COALESCE(amount, price, 0),
    qr_code = COALESCE(qr_code, qr_token),
    checked_in = COALESCE(checked_in, status = 'used'),
    checked_in_at = COALESCE(checked_in_at, used_at)
WHERE true;

-- ---------------------------------------------------------
-- Vues stats dashboard
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW global_stats AS
SELECT
    (SELECT COUNT(*) FROM events) AS events_total,
    (SELECT COUNT(*) FROM events WHERE status = 'pending') AS events_pending,
    (SELECT COUNT(*) FROM events WHERE status = 'approved') AS events_approved,
    (SELECT COUNT(*) FROM event_attendances) AS total_attendances,
    (SELECT COUNT(DISTINCT phone) FROM event_attendances) AS qualified_contacts,
    (SELECT COALESCE(SUM(view_count), 0) FROM events) AS event_views,
    (SELECT COALESCE(SUM(click_count), 0) FROM events) AS event_clicks,
    (SELECT COUNT(*) FROM profiles WHERE role = 'consumer') AS consumers,
    (SELECT COUNT(*) FROM profiles WHERE role = 'organizer') AS organizers,
    (SELECT COUNT(*) FROM tickets WHERE payment_status = 'paid') AS tickets_sold,
    (SELECT COALESCE(SUM(amount), 0) FROM tickets WHERE payment_status = 'paid') AS revenue_total,
    (SELECT COALESCE(SUM(view_count), 0) FROM ads) AS ad_views,
    (SELECT COALESCE(SUM(click_count), 0) FROM ads) AS ad_clicks;

CREATE OR REPLACE VIEW organizer_event_stats AS
SELECT
    e.id,
    e.title,
    COALESCE(e.event_date, e.date) AS event_date,
    e.status,
    e.organizer_id,
    e.created_by_profile,
    e.created_by,
    COUNT(DISTINCT ea.id) AS attendance_count,
    COUNT(DISTINCT ea.id) FILTER (WHERE ea.whatsapp_sent) AS whatsapp_sent_count,
    COALESCE(e.view_count, 0) AS view_count,
    COALESCE(e.click_count, 0) AS click_count
FROM events e
LEFT JOIN event_attendances ea ON ea.event_id = e.id
GROUP BY e.id;

-- ---------------------------------------------------------
-- RLS securisees. Les vieux comptes locaux restent supportes
-- par le frontend, mais les politiques ci-dessous ciblent
-- Supabase Auth pour la production.
-- ---------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own ON profiles
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS profiles_read_own_or_admin ON profiles;
CREATE POLICY profiles_read_own_or_admin ON profiles
FOR SELECT USING (
    user_id = auth.uid()
    OR current_profile_role() = 'admin'
);

DROP POLICY IF EXISTS profiles_update_own_or_admin ON profiles;
CREATE POLICY profiles_update_own_or_admin ON profiles
FOR UPDATE USING (
    user_id = auth.uid()
    OR current_profile_role() = 'admin'
) WITH CHECK (
    user_id = auth.uid()
    OR current_profile_role() = 'admin'
);

DROP POLICY IF EXISTS "Enable read access for all users" ON events;
DROP POLICY IF EXISTS "Enable insert for all users" ON events;
DROP POLICY IF EXISTS "Enable update for all users" ON events;
DROP POLICY IF EXISTS "Enable delete for all users" ON events;
DROP POLICY IF EXISTS events_public_read_approved ON events;
CREATE POLICY events_public_read_approved ON events
FOR SELECT USING (
    status = 'approved'
    OR current_profile_role() = 'admin'
    OR organizer_id = current_profile_id()
    OR created_by_profile = current_profile_id()
    OR created_by::TEXT = current_profile_id()::TEXT
);

DROP POLICY IF EXISTS events_insert_organizer_pending ON events;
CREATE POLICY events_insert_organizer_pending ON events
FOR INSERT WITH CHECK (
    current_profile_role() = 'admin'
    OR (
        current_profile_role() = 'organizer'
        AND status IN ('draft', 'pending')
    )
);

DROP POLICY IF EXISTS events_update_owner_or_admin ON events;
CREATE POLICY events_update_owner_or_admin ON events
FOR UPDATE USING (
    current_profile_role() = 'admin'
    OR (
        status <> 'approved'
        AND (
            organizer_id = current_profile_id()
            OR created_by_profile = current_profile_id()
            OR created_by::TEXT = current_profile_id()::TEXT
        )
    )
) WITH CHECK (
    current_profile_role() = 'admin'
    OR (
        status <> 'approved'
        AND (
            organizer_id = current_profile_id()
            OR created_by_profile = current_profile_id()
            OR created_by::TEXT = current_profile_id()::TEXT
        )
    )
);

DROP POLICY IF EXISTS event_attendances_insert_public ON event_attendances;
CREATE POLICY event_attendances_insert_public ON event_attendances
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS event_attendances_read_owner_or_admin ON event_attendances;
CREATE POLICY event_attendances_read_owner_or_admin ON event_attendances
FOR SELECT USING (
    current_profile_role() = 'admin'
    OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = event_attendances.event_id
          AND (
            e.organizer_id = current_profile_id()
            OR e.created_by_profile = current_profile_id()
            OR e.created_by::TEXT = current_profile_id()::TEXT
          )
    )
);

DROP POLICY IF EXISTS event_attendances_update_owner_or_admin ON event_attendances;
CREATE POLICY event_attendances_update_owner_or_admin ON event_attendances
FOR UPDATE USING (
    current_profile_role() = 'admin'
    OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = event_attendances.event_id
          AND (
            e.organizer_id = current_profile_id()
            OR e.created_by_profile = current_profile_id()
            OR e.created_by::TEXT = current_profile_id()::TEXT
          )
    )
);

DROP POLICY IF EXISTS event_interactions_insert_public ON event_interactions;
CREATE POLICY event_interactions_insert_public ON event_interactions
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS event_interactions_read_admin ON event_interactions;
CREATE POLICY event_interactions_read_admin ON event_interactions
FOR SELECT USING (current_profile_role() = 'admin');

DROP POLICY IF EXISTS ads_read_active_public ON ads;
CREATE POLICY ads_read_active_public ON ads
FOR SELECT USING (
    is_active = true
    OR current_profile_role() = 'admin'
);

DROP POLICY IF EXISTS ads_write_admin ON ads;
CREATE POLICY ads_write_admin ON ads
FOR ALL USING (current_profile_role() = 'admin')
WITH CHECK (current_profile_role() = 'admin');

DROP POLICY IF EXISTS tickets_insert_public ON tickets;
CREATE POLICY tickets_insert_public ON tickets
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS tickets_read_owner_organizer_admin ON tickets;
CREATE POLICY tickets_read_owner_organizer_admin ON tickets
FOR SELECT USING (
    profile_id = current_profile_id()
    OR current_profile_role() = 'admin'
    OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = tickets.event_id
          AND (
            e.organizer_id = current_profile_id()
            OR e.created_by_profile = current_profile_id()
            OR e.created_by::TEXT = current_profile_id()::TEXT
          )
    )
);
