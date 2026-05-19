-- =========================================================
-- PHASE 2 — Organisateur + modération
-- Tags catalogue, organisateur profile, audit modération
-- =========================================================

-- 1. Tags catalogue
CREATE TABLE IF NOT EXISTS tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tags (slug, label, emoji, sort_order) VALUES
    ('concert',  'Concert',   '🎤', 1),
    ('clubbing', 'Clubbing',  '🪩', 2),
    ('afterwork','Afterwork', '🍸', 3),
    ('culture',  'Culture',   '🎭', 4),
    ('sport',    'Sport',     '⚽', 5),
    ('food',     'Food',      '🍽️', 6),
    ('festival', 'Festival',  '🎪', 7),
    ('autre',    'Autre',     '✨', 99)
ON CONFLICT (slug) DO NOTHING;

-- 2. Organisateur : profil enrichi
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS organizer_bio TEXT,
    ADD COLUMN IF NOT EXISTS organizer_logo TEXT,
    ADD COLUMN IF NOT EXISTS organizer_verified BOOLEAN DEFAULT false;

-- 3. Audit modération
CREATE TABLE IF NOT EXISTS moderation_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id),
    action TEXT NOT NULL CHECK (action IN ('approve','reject','edit','delete')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_event_idx ON moderation_log (event_id);

-- 4. Vue dashboard organisateur
CREATE OR REPLACE VIEW organizer_event_stats AS
SELECT
    e.id,
    e.title,
    e.date,
    e.status,
    e.created_by,
    COUNT(DISTINCT r.id) AS rsvp_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.notified_organizer) AS notified_count
FROM events e
LEFT JOIN rsvps r ON r.event_id = e.id
GROUP BY e.id;
