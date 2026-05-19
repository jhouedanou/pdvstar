-- =========================================================
-- PHASE 1 — Socle produit
-- Géoloc PostGIS, pseudo, rôles stricts, table RSVP, statut event
-- =========================================================

-- 1. Extension PostGIS (géoloc)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Users : pseudo + role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('consumer', 'organizer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pseudo TEXT,
    ADD COLUMN IF NOT EXISTS role_v2 user_role DEFAULT 'consumer';

-- Migrer role text -> enum (consumer par défaut, organizer/admin si déjà set)
UPDATE users SET role_v2 = 'organizer'::user_role WHERE role = 'organizer';
UPDATE users SET role_v2 = 'admin'::user_role     WHERE role = 'admin';
UPDATE users SET role_v2 = 'consumer'::user_role  WHERE role NOT IN ('organizer', 'admin') OR role IS NULL;

-- Init pseudo depuis name si vide
UPDATE users SET pseudo = name WHERE pseudo IS NULL;

CREATE INDEX IF NOT EXISTS users_pseudo_idx ON users (pseudo);
CREATE INDEX IF NOT EXISTS users_role_v2_idx ON users (role_v2);

-- 3. Events : status modération + index géo
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('draft','pending','approved','rejected')),
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS quartier TEXT,
    ADD COLUMN IF NOT EXISTS ville TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Colonne géoloc (point PostGIS) pour requêtes spatiales
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo GEOGRAPHY(POINT, 4326);

-- Trigger : maintient `geo` à jour à partir de coords_lat/lng
CREATE OR REPLACE FUNCTION events_sync_geo() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.coords_lat IS NOT NULL AND NEW.coords_lng IS NOT NULL THEN
        NEW.geo := ST_SetSRID(ST_MakePoint(NEW.coords_lng, NEW.coords_lat), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_sync_geo ON events;
CREATE TRIGGER trg_events_sync_geo
BEFORE INSERT OR UPDATE OF coords_lat, coords_lng ON events
FOR EACH ROW EXECUTE FUNCTION events_sync_geo();

-- Backfill geo
UPDATE events SET geo = ST_SetSRID(ST_MakePoint(coords_lng, coords_lat), 4326)::geography
WHERE geo IS NULL AND coords_lat IS NOT NULL AND coords_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_geo_gist     ON events USING GIST (geo);
CREATE INDEX IF NOT EXISTS events_date_idx     ON events (date);
CREATE INDEX IF NOT EXISTS events_status_idx   ON events (status);
CREATE INDEX IF NOT EXISTS events_quartier_idx ON events (quartier);
CREATE INDEX IF NOT EXISTS events_tags_gin     ON events USING GIN (tags);

-- 4. RSVPs structurés ("J'y vais")
CREATE TABLE IF NOT EXISTS rsvps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    pseudo   TEXT NOT NULL,
    phone    TEXT NOT NULL,
    source   TEXT DEFAULT 'app',  -- app | qr | whatsapp
    notified_organizer BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id, phone)
);

CREATE INDEX IF NOT EXISTS rsvps_event_idx ON rsvps (event_id);
CREATE INDEX IF NOT EXISTS rsvps_phone_idx ON rsvps (phone);

ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;

-- RLS : lecture par orga de l'event + admin, insertion par tous (auth utilisateur en couche app)
DROP POLICY IF EXISTS rsvps_read ON rsvps;
CREATE POLICY rsvps_read ON rsvps FOR SELECT USING (true);

DROP POLICY IF EXISTS rsvps_insert ON rsvps;
CREATE POLICY rsvps_insert ON rsvps FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS rsvps_update ON rsvps;
CREATE POLICY rsvps_update ON rsvps FOR UPDATE USING (true);

DROP POLICY IF EXISTS rsvps_delete ON rsvps;
CREATE POLICY rsvps_delete ON rsvps FOR DELETE USING (true);

-- 5. RPC : événements proches d'un point + filtres
CREATE OR REPLACE FUNCTION nearby_events(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km INTEGER DEFAULT 50,
    filter_quartier TEXT DEFAULT NULL,
    filter_tag TEXT DEFAULT NULL,
    filter_date_from TIMESTAMPTZ DEFAULT NULL,
    filter_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF events AS $$
    SELECT * FROM events
    WHERE status = 'approved'
      AND (user_lat IS NULL OR user_lng IS NULL OR geo IS NULL
           OR ST_DWithin(geo, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_km * 1000))
      AND (filter_quartier IS NULL OR quartier = filter_quartier)
      AND (filter_tag      IS NULL OR filter_tag = ANY(tags))
      AND (filter_date_from IS NULL OR date >= filter_date_from)
      AND (filter_date_to   IS NULL OR date <= filter_date_to)
    ORDER BY
        CASE WHEN user_lat IS NULL OR geo IS NULL THEN date END ASC,
        CASE WHEN user_lat IS NOT NULL AND geo IS NOT NULL
             THEN ST_Distance(geo, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) END ASC;
$$ LANGUAGE SQL STABLE;

-- 6. RPC : compteur participants depuis rsvps
CREATE OR REPLACE FUNCTION event_rsvp_count(eid UUID) RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM rsvps WHERE event_id = eid;
$$ LANGUAGE SQL STABLE;
