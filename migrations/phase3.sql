-- =========================================================
-- PHASE 3 — Monétisation : régie pub + billetterie
-- =========================================================

-- 1. Ads enrichies (table `ads` existe déjà — colonnes additionnelles)
ALTER TABLE ads
    ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'banner' CHECK (format IN ('banner','fullscreen','video','story')),
    ADD COLUMN IF NOT EXISTS target_quartier TEXT,
    ADD COLUMN IF NOT EXISTS target_pdv TEXT,
    ADD COLUMN IF NOT EXISTS video_url TEXT,
    ADD COLUMN IF NOT EXISTS advertiser_id UUID REFERENCES users(id);

-- 2. Tracking impressions / clics granulaire
CREATE TABLE IF NOT EXISTS ad_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT CHECK (event_type IN ('view','click')),
    quartier TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ad_events_ad_idx   ON ad_events (ad_id);
CREATE INDEX IF NOT EXISTS ad_events_type_idx ON ad_events (event_type);

-- RPC tracking atomique
CREATE OR REPLACE FUNCTION track_ad(ad UUID, etype TEXT, uid UUID DEFAULT NULL, q TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ad_events (ad_id, user_id, event_type, quartier) VALUES (ad, uid, etype, q);
    IF etype = 'view' THEN
        UPDATE ads SET view_count = COALESCE(view_count,0) + 1 WHERE id = ad;
    ELSIF etype = 'click' THEN
        UPDATE ads SET click_count = COALESCE(click_count,0) + 1 WHERE id = ad;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Billetterie
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS ticketing_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS ticket_price INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ticket_capacity INTEGER,
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 5.00;

CREATE TABLE IF NOT EXISTS tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id),
    buyer_phone TEXT NOT NULL,
    buyer_pseudo TEXT,
    qr_token TEXT UNIQUE NOT NULL,
    price INTEGER NOT NULL,
    commission INTEGER DEFAULT 0,
    payment_method TEXT,           -- orange_money | mtn_momo | wave | card | onsite
    payment_ref TEXT,              -- CinetPay transaction id
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
    status TEXT DEFAULT 'valid' CHECK (status IN ('valid','used','cancelled')),
    used_at TIMESTAMPTZ,
    used_by_admin UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_event_idx  ON tickets (event_id);
CREATE INDEX IF NOT EXISTS tickets_qr_idx     ON tickets (qr_token);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tickets_all ON tickets;
CREATE POLICY tickets_all ON tickets FOR ALL USING (true) WITH CHECK (true);

-- 4. Marquer un ticket utilisé (contrôle d'accès)
CREATE OR REPLACE FUNCTION redeem_ticket(token TEXT, admin_uid UUID)
RETURNS tickets AS $$
DECLARE
    t tickets;
BEGIN
    UPDATE tickets
       SET status = 'used',
           used_at = NOW(),
           used_by_admin = admin_uid
     WHERE qr_token = token
       AND status = 'valid'
       AND payment_status = 'paid'
    RETURNING * INTO t;

    IF t.id IS NULL THEN
        RAISE EXCEPTION 'Ticket invalide, déjà utilisé ou non payé: %', token;
    END IF;
    RETURN t;
END;
$$ LANGUAGE plpgsql;
