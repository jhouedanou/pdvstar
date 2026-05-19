-- =============================================================
-- Phase 7 : Colonne category sur les événements + classification
-- =============================================================

-- 1. Ajouter la colonne si absente
ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';

-- 2. Index pour les filtres par catégorie
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- 3. Classifier les événements EXISTANTS d'après le titre
--    Même logique que deriveCategory() dans eventStore.js

UPDATE events SET category = CASE
    -- Brunch
    WHEN title ILIKE '%brunch%'
        THEN 'brunch'

    -- DJ / Club / Électro
    WHEN title ILIKE '% dj %'
      OR title ILIKE 'dj %'
      OR title ILIKE '%dj session%'
      OR title ILIKE '%club%'
      OR title ILIKE '%électro%'
      OR title ILIKE '%electro%'
      OR title ILIKE '%techno%'
      OR title ILIKE '%house music%'
        THEN 'dj'

    -- Festival
    WHEN title ILIKE '%festival%'
        THEN 'festival'

    -- Sport
    WHEN title ILIKE '%sport%'
      OR title ILIKE '%foot%'
      OR title ILIKE '%football%'
      OR title ILIKE '%basket%'
      OR title ILIKE '% match %'
      OR title ILIKE '%tournoi%'
      OR title ILIKE '%compétition%'
        THEN 'sport'

    -- Art / Expo / Culture
    WHEN title ILIKE '% art %'
      OR title ILIKE '%expo%'
      OR title ILIKE '%exposition%'
      OR title ILIKE '%culture%'
      OR title ILIKE '%galerie%'
      OR title ILIKE '%théâtre%'
      OR title ILIKE '%vernissage%'
        THEN 'art'

    -- Comédie / Humour / Stand-up / Karaoké
    WHEN title ILIKE '%comédie%'
      OR title ILIKE '%comedie%'
      OR title ILIKE '%humour%'
      OR title ILIKE '%stand-up%'
      OR title ILIKE '%stand up%'
      OR title ILIKE '%karaoké%'
      OR title ILIKE '%karaoke%'
        THEN 'comedie'

    -- Afterwork
    WHEN title ILIKE '%afterwork%'
      OR title ILIKE '%after work%'
        THEN 'afterwork'

    -- Musique / Concert / Genres
    WHEN title ILIKE '%concert%'
      OR title ILIKE '% live %'
      OR title ILIKE '%zouglou%'
      OR title ILIKE '% rap %'
      OR title ILIKE '%gospel%'
      OR title ILIKE '%afrobeat%'
      OR title ILIKE '%musique%'
      OR title ILIKE '%coupé décalé%'
      OR title ILIKE '%coupé-décalé%'
      OR title ILIKE '%reggae%'
      OR title ILIKE '%jazz%'
      OR title ILIKE '%rnb%'
      OR title ILIKE '%r&b%'
      OR title ILIKE '%soirée musicale%'
        THEN 'musique'

    -- Soirée générale / Fête / Nuit / Boîte
    WHEN title ILIKE '%soirée%'
      OR title ILIKE '%party%'
      OR title ILIKE '%nuit%'
      OR title ILIKE '%boîte%'
      OR title ILIKE '%nightlife%'
      OR title ILIKE '%gala%'
        THEN 'soiree'

    ELSE ''
END
WHERE category IS NULL OR category = '';

-- 4. Vue pratique pour vérifier la classification
CREATE OR REPLACE VIEW events_category_check AS
SELECT
    id,
    title,
    category,
    created_at
FROM events
ORDER BY
    CASE WHEN category = '' OR category IS NULL THEN 1 ELSE 0 END,
    created_at DESC;

-- 5. Fonction utilitaire : re-classifier un seul événement
CREATE OR REPLACE FUNCTION classify_event_category(event_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_title TEXT;
    v_category TEXT := '';
BEGIN
    SELECT title INTO v_title FROM events WHERE id = event_id;
    IF v_title IS NULL THEN RETURN ''; END IF;

    SELECT CASE
        WHEN v_title ILIKE '%brunch%' THEN 'brunch'
        WHEN v_title ILIKE '% dj %' OR v_title ILIKE 'dj %' OR v_title ILIKE '%club%' OR v_title ILIKE '%électro%' OR v_title ILIKE '%electro%' THEN 'dj'
        WHEN v_title ILIKE '%festival%' THEN 'festival'
        WHEN v_title ILIKE '%sport%' OR v_title ILIKE '%foot%' OR v_title ILIKE '%basket%' OR v_title ILIKE '%tournoi%' THEN 'sport'
        WHEN v_title ILIKE '% art %' OR v_title ILIKE '%expo%' OR v_title ILIKE '%culture%' OR v_title ILIKE '%galerie%' THEN 'art'
        WHEN v_title ILIKE '%comédie%' OR v_title ILIKE '%humour%' OR v_title ILIKE '%stand-up%' OR v_title ILIKE '%karaoke%' THEN 'comedie'
        WHEN v_title ILIKE '%afterwork%' OR v_title ILIKE '%after work%' THEN 'afterwork'
        WHEN v_title ILIKE '%concert%' OR v_title ILIKE '%zouglou%' OR v_title ILIKE '%musique%' OR v_title ILIKE '%gospel%' OR v_title ILIKE '%afrobeat%' THEN 'musique'
        WHEN v_title ILIKE '%soirée%' OR v_title ILIKE '%party%' OR v_title ILIKE '%nuit%' OR v_title ILIKE '%gala%' THEN 'soiree'
        ELSE ''
    END INTO v_category;

    UPDATE events SET category = v_category WHERE id = event_id;
    RETURN v_category;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN events.category IS 'Catégorie : brunch | dj | festival | sport | art | comedie | afterwork | musique | soiree | (vide = non classé)';
