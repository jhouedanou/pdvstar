-- =========================================================
-- PHASE 4 — Optimisations : notifs push, stats avancées
-- =========================================================

-- 1. Push subscriptions (Web Push ou OneSignal mirror)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT,
    auth TEXT,
    onesignal_player_id TEXT,
    quartier TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_user_idx ON push_subscriptions (user_id);

-- 2. Vue stats globales (dashboard admin)
CREATE OR REPLACE VIEW global_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE role_v2 = 'consumer') AS consumers,
    (SELECT COUNT(*) FROM users WHERE role_v2 = 'organizer') AS organizers,
    (SELECT COUNT(*) FROM events WHERE status = 'approved') AS events_approved,
    (SELECT COUNT(*) FROM events WHERE status = 'pending')  AS events_pending,
    (SELECT COUNT(*) FROM rsvps) AS total_rsvps,
    (SELECT COUNT(*) FROM tickets WHERE payment_status = 'paid') AS tickets_sold,
    (SELECT COALESCE(SUM(price),0) FROM tickets WHERE payment_status = 'paid') AS revenue_total,
    (SELECT COALESCE(SUM(commission),0) FROM tickets WHERE payment_status = 'paid') AS commission_total,
    (SELECT SUM(view_count) FROM ads)  AS ad_views,
    (SELECT SUM(click_count) FROM ads) AS ad_clicks;

-- 3. Stats par quartier
CREATE OR REPLACE VIEW stats_by_quartier AS
SELECT
    e.quartier,
    COUNT(DISTINCT e.id) AS events_count,
    COUNT(DISTINCT r.id) AS rsvps_count,
    COUNT(DISTINCT t.id) FILTER (WHERE t.payment_status = 'paid') AS tickets_count
FROM events e
LEFT JOIN rsvps r   ON r.event_id = e.id
LEFT JOIN tickets t ON t.event_id = e.id
WHERE e.quartier IS NOT NULL
GROUP BY e.quartier;
