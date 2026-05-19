# Guide Développeur — Intégrations & APIs

État des intégrations + steps pour activer/intégrer ce qui manque.

## État actuel

### Intégré
| Service | Fichier | Var env |
|---|---|---|
| Supabase (DB + Auth + Storage) | src/services/supabase.js | hardcodé ligne 3-4 |
| ipapi.co (IP geo fallback) | src/components/UserProfileModal.vue:36 | aucune |
| Geolocation navigator | @vueuse useGeolocation | aucune |
| PawaPay (Mobile Money) | src/services/paymentService.js | VITE_PAWAPAY_TOKEN, VITE_PAWAPAY_BASE_URL, VITE_PAWAPAY_CALLBACK_URL |
| Groq (IA description) | src/services/aiService.js | VITE_GROQ_API_KEY |
| Web Speech API (dictée) | src/composables/useDictation.js | aucune (natif) |
| OneSignal (push) | src/services/pushService.js | VITE_ONESIGNAL_APP_ID |
| GreenAPI (WhatsApp) | src/services/greenApiService.js | VITE_GREENAPI_INSTANCE, VITE_GREENAPI_TOKEN |
| Leaflet + OSM | FeedUser.vue:541 | aucune |
| QR generation | src/services/ticketService.js:11 (UUID v4) | aucune |
| vue-qrcode-reader (scan) | src/views/TicketScan.vue | aucune |

### Manquant ou partiel
| Item | Statut | Priorité |
|---|---|---|
| RLS policies Supabase | Absent | Critique |
| Migrations SQL versionnées | Absent du repo | Critique |
| PostGIS `nearby_events` RPC | Appelé client, RPC à créer DB | Haute |
| HMAC signature QR ticket | UUID v4 seul, non signé | Moyenne |
| Supabase Auth phone OTP | Auth actuel = pseudo+tel sans OTP | Moyenne |
| Materialized views stats | Pas d'agrégats matérialisés | Basse |
| Charts dashboard (chart.js) | Pas intégré | Basse |
| Leaflet.heat (carte chaleur) | Pas intégré | Basse |
| xlsx export CSV/Excel | À confirmer dans package.json | Basse |
| Cloudinary (alternative storage) | Supabase Storage seul | Optionnelle |
| Deepgram (fallback dictée) | Web Speech seul | Optionnelle |

## Setup local

```bash
git clone <repo>
cd pdvstar
npm install
cp .env.example .env  # à créer si absent
# remplir .env (voir section variables ci-dessous)
npx vite
```

URL dev : `http://localhost:5173`.

## Variables env complètes

Fichier `.env` à la racine :

```env
# Supabase (optionnel : actuellement hardcodé src/services/supabase.js)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Paiement
VITE_PAWAPAY_TOKEN=Bearer-xxx
VITE_PAWAPAY_BASE_URL=https://api.sandbox.pawapay.io
VITE_PAWAPAY_CALLBACK_URL=https://<domain>/api/pawapay-webhook

# IA
VITE_GROQ_API_KEY=gsk_xxx

# Push
VITE_ONESIGNAL_APP_ID=xxx-xxx-xxx-xxx

# WhatsApp
VITE_GREENAPI_INSTANCE=1101000000
VITE_GREENAPI_TOKEN=xxx

# Admin (à ajouter pour durcir)
VITE_ADMIN_USERNAME=
VITE_ADMIN_PASSWORD_HASH=
```

## Intégrations à faire

### 1. RLS Supabase (CRITIQUE)

Sans RLS, anon key permet lecture/écriture totale. À activer immédiatement.

Migration SQL à exécuter Supabase SQL Editor :

```sql
-- Activer RLS sur toutes les tables sensibles
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_log ENABLE ROW LEVEL SECURITY;

-- Events : lecture publique des approved, écriture par créateur
CREATE POLICY "public read approved events" ON events
    FOR SELECT USING (status = 'approved' OR auth.uid() = created_by);

CREATE POLICY "organizer can insert own events" ON events
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "organizer can update own events" ON events
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "admin can do all on events" ON events
    USING (auth.jwt() ->> 'role' = 'admin');

-- Tickets : lecture par buyer, écriture admin/organizer
CREATE POLICY "buyer reads own tickets" ON tickets
    FOR SELECT USING (auth.uid() = buyer_id);

-- RSVP : user voit/écrit ses propres
CREATE POLICY "user own rsvps" ON rsvps
    FOR ALL USING (auth.uid() = user_id);

-- Pareil pour les autres tables. Adapter selon besoins.
```

### 2. PostGIS + RPC nearby_events

```sql
-- Activer extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Index GIST
ALTER TABLE events ADD COLUMN geom geography(POINT, 4326);
UPDATE events SET geom = ST_SetSRID(ST_MakePoint(coords_lng, coords_lat), 4326)
WHERE coords_lat IS NOT NULL;
CREATE INDEX events_geom_idx ON events USING GIST(geom);

-- Trigger sync coords -> geom
CREATE OR REPLACE FUNCTION sync_event_geom() RETURNS trigger AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.coords_lng, NEW.coords_lat), 4326);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER events_geom_sync BEFORE INSERT OR UPDATE ON events
FOR EACH ROW WHEN (NEW.coords_lat IS NOT NULL)
EXECUTE FUNCTION sync_event_geom();

-- RPC
CREATE OR REPLACE FUNCTION nearby_events(
    user_lat float, user_lng float, radius_km float DEFAULT 50,
    filter_quartier text DEFAULT NULL, filter_tag text DEFAULT NULL,
    filter_date_from timestamptz DEFAULT NULL, filter_date_to timestamptz DEFAULT NULL
) RETURNS SETOF events AS $$
    SELECT * FROM events
    WHERE status = 'approved'
      AND (user_lat IS NULL OR ST_DWithin(geom, ST_MakePoint(user_lng, user_lat)::geography, radius_km * 1000))
      AND (filter_quartier IS NULL OR quartier = filter_quartier)
      AND (filter_tag IS NULL OR filter_tag = ANY(tags))
      AND (filter_date_from IS NULL OR date >= filter_date_from)
      AND (filter_date_to IS NULL OR date <= filter_date_to)
    ORDER BY ST_Distance(geom, ST_MakePoint(user_lng, user_lat)::geography) ASC;
$$ LANGUAGE sql STABLE;
```

Le client appelle déjà via `rsvpService.fetchNearbyEvents`. Activer extension + RPC = activation transparente.

### 3. HMAC signature QR tickets

Remplacer `genQrToken()` dans `src/services/ticketService.js:11` :

```js
import { createHmac } from 'crypto' // Edge Function
// OU client: Web Crypto API HMAC-SHA256

async function genSignedQrToken(ticketId) {
    const secret = import.meta.env.VITE_TICKET_HMAC_SECRET
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(ticketId))
    const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return `${ticketId}.${b64}`
}
```

Vérifier côté `redeem_ticket` RPC (recalcul HMAC, compare). Secret doit être en Edge Function pas exposé client. Migration recommandée : génération HMAC dans Edge Function `create-ticket` au lieu de client.

### 4. Supabase Auth Phone OTP

Remplacer auth pseudo+tel direct par OTP :

```js
// userStore.authenticate() étendu
const { error } = await supabase.auth.signInWithOtp({ phone })
// User reçoit SMS -> verify
const { data } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
```

Quota Supabase gratuit : 100 OTP/mois. Au-delà : configurer Twilio dans Supabase Dashboard ou Firebase Auth Phone (gratuit illimité).

### 5. Materialized views stats

```sql
CREATE MATERIALIZED VIEW stats_by_quartier AS
SELECT quartier,
       COUNT(*) FILTER (WHERE status = 'approved') as event_count,
       SUM(participant_count) as total_rsvps
FROM events
GROUP BY quartier;

CREATE INDEX ON stats_by_quartier(quartier);

-- Refresh périodique via cron Supabase ou Edge Function
-- REFRESH MATERIALIZED VIEW CONCURRENTLY stats_by_quartier;
```

### 6. Chart.js dashboard

```bash
npm install chart.js vue-chartjs
```

Composant dans `ProDashboard.vue` :
```vue
<script setup>
import { Bar } from 'vue-chartjs'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)
</script>

<template>
  <Bar :data="chartData" :options="chartOptions" />
</template>
```

### 7. Leaflet.heat carte chaleur

```bash
npm install leaflet.heat
```

Dans `FeedUser.vue` setup map :
```js
import 'leaflet.heat'
const points = events.value.map(e => [e.coords.lat, e.coords.lng, e.participantCount])
L.heatLayer(points, { radius: 25 }).addTo(map)
```

### 8. xlsx export

```bash
npm install xlsx
```

```js
import * as XLSX from 'xlsx'
const ws = XLSX.utils.json_to_sheet(rsvps)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'RSVPs')
XLSX.writeFile(wb, `event-${id}-rsvps.xlsx`)
```

### 9. Edge Functions Supabase

Une seule existe : `supabase/functions/pawapay-webhook`. À ajouter :

- `notify-organizer-rsvp` : trigger sur insert rsvps -> GreenAPI message
- `notify-organizer-moderation` : trigger sur update events.status -> GreenAPI
- `create-ticket-signed` : génération HMAC côté serveur
- `redeem-ticket` : RPC sécurisé (déjà appelé client)

Deploy :
```bash
supabase functions deploy <name>
supabase secrets set GREENAPI_TOKEN=xxx
```

### 10. Cloudinary (optionnel)

Si Storage Supabase 1GB insuffisant :
```bash
npm install cloudinary-vue
```

```js
import { Cloudinary } from '@cloudinary/url-gen'
const cld = new Cloudinary({ cloud: { cloudName: 'xxx' }})
// Upload signé via Edge Function (preset upload non-signed pour MVP)
```

Remplacer `processImage` dans `src/utils/imageUpload.js` pour pousser vers Cloudinary au lieu de base64 inline.

## Architecture résumée

```
Frontend Vue 3 + Pinia + Vite
    |
    | (REST + Realtime)
    |
Supabase
    |-- PostgreSQL (events, users, rsvps, tickets, ads, ...)
    |-- Auth (anon + phone OTP à activer)
    |-- Storage (medias)
    |-- Edge Functions (pawapay-webhook + à ajouter)
    |-- RLS policies (à écrire)
    |
External APIs
    |-- PawaPay (Mobile Money)
    |-- Groq (IA)
    |-- OneSignal (push)
    |-- GreenAPI (WhatsApp)
    |-- ipapi.co (IP geo)
```

## Schéma DB principal

| Table | Colonnes clés |
|---|---|
| users | id, phone, pseudo, role, role_v2, space_name, organizer_name |
| events | id, title, date, coords_lat/lng, quartier, tags, status, rejection_reason, created_by, ticketing_enabled, ticket_price, commission_rate |
| rsvps | event_id, user_id, phone, pseudo (UNIQUE event_id+phone) |
| tickets | id, event_id, buyer_id, buyer_phone, price, commission, qr_token, payment_status, status |
| ads | id, format, target_quartier, target_pdv, video_url, click_count, view_count, advertiser_id |
| user_passes | user_id, pass_type, purchased_at, expires_at, status |
| moderation_log | event_id, admin_id, action, reason |
| push_subscriptions | user_id, endpoint, onesignal_player_id, quartier |

## Tests à écrire

Aucun test actuellement. Suggéré :
- Vitest pour stores Pinia + services
- Playwright pour flows critiques : signup, RSVP, achat billet, scan QR

## Build prod

```bash
npm run build
# dist/ -> hébergement statique (Vercel, Netlify, Cloudflare Pages)
```

PWA déjà configurée via `vite-plugin-pwa` (cf vite.config.js).

## Checklist déploiement prod

- [ ] RLS activée toutes tables
- [ ] Migrations SQL versionnées dans `supabase/migrations/`
- [ ] Admin password retiré du code, env var ou auth Supabase
- [ ] Anon key Supabase via env var (pas hardcodé)
- [ ] HMAC tickets côté Edge Function
- [ ] PawaPay en mode prod (`api.pawapay.io`)
- [ ] OneSignal en mode prod (vs allowLocalhostAsSecureOrigin)
- [ ] CORS Edge Functions verrouillé sur domaine
- [ ] Sentry ou équivalent pour erreurs JS
- [ ] CGU/CGV à jour (LegalPages.vue)
