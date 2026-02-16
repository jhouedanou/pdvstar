-- =============================================
-- BABI VIBES - Supabase Events Table Setup
-- Exécuter ce script dans le SQL Editor de Supabase:
-- https://zbowizpdsekljkudfjgx.supabase.co/project/default/sql/new
-- =============================================

-- Créer la table events
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    date TIMESTAMPTZ NOT NULL,
    location TEXT,
    organizer TEXT,
    image TEXT,
    coords_lat DOUBLE PRECISION,
    coords_lng DOUBLE PRECISION,
    distance TEXT,
    participant_count INTEGER DEFAULT 0,
    is_registered BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    price INTEGER DEFAULT 0,
    features TEXT[] DEFAULT '{}',
    type TEXT DEFAULT 'image',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer la sécurité au niveau des lignes
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Politique: tout le monde peut lire les événements
CREATE POLICY "Enable read access for all users" ON events 
    FOR SELECT USING (true);

-- Politique: tout le monde peut créer des événements (via admin)
CREATE POLICY "Enable insert for all users" ON events 
    FOR INSERT WITH CHECK (true);

-- Politique: tout le monde peut modifier des événements (via admin)
CREATE POLICY "Enable update for all users" ON events 
    FOR UPDATE USING (true);

-- Politique: tout le monde peut supprimer des événements (via admin)
CREATE POLICY "Enable delete for all users" ON events 
    FOR DELETE USING (true);
