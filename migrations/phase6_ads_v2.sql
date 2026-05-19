-- =============================================================
-- Phase 6 : Système de publicités organisateur avec modération
-- =============================================================

-- 1. Nouvelles colonnes sur la table ads
ALTER TABLE ads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';
-- organizer_id et approved_by : UUID référençant users(id) qui est UUID
ALTER TABLE ads ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_city TEXT;

-- Contrainte sur statut
ALTER TABLE ads ADD CONSTRAINT ads_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'archived'));

-- 2. Mettre les pubs existantes (sans statut) en "approved"
UPDATE ads SET status = 'approved' WHERE status IS NULL;

-- 3. Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);
CREATE INDEX IF NOT EXISTS idx_ads_created_by ON ads(created_by);
CREATE INDEX IF NOT EXISTS idx_ads_organizer_id ON ads(organizer_id);
CREATE INDEX IF NOT EXISTS idx_ads_is_active_status ON ads(is_active, status);

-- 4. RLS — activer si pas déjà fait
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "ads_select_public" ON ads;
DROP POLICY IF EXISTS "ads_select_admin" ON ads;
DROP POLICY IF EXISTS "ads_select_own_organizer" ON ads;
DROP POLICY IF EXISTS "ads_insert_organizer" ON ads;
DROP POLICY IF EXISTS "ads_update_organizer" ON ads;
DROP POLICY IF EXISTS "ads_delete_organizer" ON ads;
DROP POLICY IF EXISTS "ads_admin_all" ON ads;

-- 4a. Public / utilisateurs : ne voit que les pubs approuvées et actives
CREATE POLICY "ads_select_public" ON ads
    FOR SELECT TO anon, authenticated
    USING (status = 'approved' AND is_active = true);

-- 4b. Service role (backend admin) : accès complet
-- L'app n'utilise pas Supabase Auth (connexion custom par téléphone),
-- donc auth.uid() est toujours NULL. Les opérations organisateur
-- et admin passent par la clé service_role côté serveur.
CREATE POLICY "ads_admin_all" ON ads
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 4c. Opérations anon autorisées (app utilise anon key pour les organisateurs)
-- Insertion : statut pending uniquement
CREATE POLICY "ads_insert_anon" ON ads
    FOR INSERT TO anon, authenticated
    WITH CHECK (status = 'pending');

-- 4d. Mise à jour : autorisée pour anon/authenticated
-- (le contrôle d'accès est géré au niveau applicatif)
CREATE POLICY "ads_update_anon" ON ads
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4e. Suppression : autorisée pour anon/authenticated
CREATE POLICY "ads_delete_anon" ON ads
    FOR DELETE TO anon, authenticated
    USING (true);

-- 5. Vue utilitaire pour l'admin : pubs avec infos organisateur
CREATE OR REPLACE VIEW ads_admin_view AS
SELECT
    a.*,
    u.pseudo AS organizer_username,
    u.name AS organizer_full_name,
    u.phone AS organizer_phone,
    CASE
        WHEN a.approved_at IS NOT NULL THEN
            'Approuvée le ' || to_char(a.approved_at, 'DD/MM/YYYY')
        WHEN a.status = 'pending' THEN
            'En attente depuis ' || to_char(a.created_at, 'DD/MM/YYYY')
        WHEN a.status = 'rejected' THEN
            'Rejetée : ' || COALESCE(a.rejection_reason, 'sans motif')
        ELSE a.status
    END AS status_label
FROM ads a
LEFT JOIN users u ON u.id = a.organizer_id;

-- 6. Fonction RPC pour qu'un admin approuve une pub
CREATE OR REPLACE FUNCTION admin_approve_ad(ad_id UUID, admin_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE ads
    SET status = 'approved',
        is_active = true,
        approved_by = admin_user_id,
        approved_at = NOW()
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fonction RPC pour qu'un admin rejette une pub
CREATE OR REPLACE FUNCTION admin_reject_ad(ad_id UUID, reason TEXT)
RETURNS void AS $$
BEGIN
    IF reason IS NULL OR trim(reason) = '' THEN
        RAISE EXCEPTION 'Le motif de rejet est obligatoire';
    END IF;
    UPDATE ads
    SET status = 'rejected',
        is_active = false,
        rejection_reason = trim(reason)
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Notification WhatsApp organisateur lors d'une approbation/rejet
-- (à implémenter côté Edge Function ou webhook Supabase)
-- Commentaire : Créer une Edge Function `notify-ad-status` qui écoute
-- les updates sur ads.status et envoie un message WhatsApp via GreenAPI

COMMENT ON TABLE ads IS 'Table des publicités avec workflow de modération : pending → approved/rejected/archived';
COMMENT ON COLUMN ads.status IS 'Statut modération : pending | approved | rejected | archived';
COMMENT ON COLUMN ads.organizer_id IS 'Référence optionnelle vers profil organisateur';
COMMENT ON COLUMN ads.rejection_reason IS 'Motif de rejet communiqué à l organisateur';
COMMENT ON COLUMN ads.approved_by IS 'ID admin ayant approuvé la publicité';
COMMENT ON COLUMN ads.approved_at IS 'Date/heure d approbation';
