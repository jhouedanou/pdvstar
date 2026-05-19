-- =============================================
-- Suppression des événements en double dans Supabase
-- Garde le plus récent (created_at le plus grand) pour chaque titre+date
-- =============================================

-- 1. Voir combien de doublons existent (optionnel, diagnostic)
SELECT title, date, COUNT(*) AS nb
FROM events
GROUP BY title, date
HAVING COUNT(*) > 1
ORDER BY nb DESC;

-- 2. Supprimer les doublons (garde l'entrée avec l'id le plus récent/grand)
DELETE FROM events
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY title, date
                   ORDER BY created_at DESC, id DESC
               ) AS rn
        FROM events
    ) sub
    WHERE rn > 1
);

-- 3. Vérifier le résultat
SELECT COUNT(*) AS total_events FROM events;
