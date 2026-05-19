# Services tiers — pdvstar / Babi Vibes

Inventaire des services gratuits ou freemium à intégrer pour les 4 phases. Aucun lock-in : tout service peut être swappé via la couche `src/services/`.

---

## 1. Backend & données

### Supabase (déjà intégré)
- **Usage** : Postgres + Auth + Storage + Realtime + Edge Functions
- **Plan gratuit** : 500 MB DB, 1 GB storage, 50k MAU, 2M Edge Function invocations/mois
- **Activer** : extension PostGIS pour géoloc (`CREATE EXTENSION IF NOT EXISTS postgis;`)
- **URL** : https://supabase.com

---

## 2. Authentification

### Supabase Auth Phone OTP
- **Usage** : OTP SMS pour inscription pseudo + téléphone
- **Plan gratuit** : limité (~100 SMS/mois)
- **Provider SMS requis** : Twilio, MessageBird, Vonage (payant)

### Firebase Auth Phone (recommandé pour la CI)
- **Usage** : OTP SMS gratuit illimité (quotas Google généreux)
- **Plan gratuit** : 10k vérifications/mois free tier
- **URL** : https://firebase.google.com/docs/auth/web/phone-auth

### Alternative low-cost
- **GreenAPI** (déjà intégré) → envoyer un code OTP via WhatsApp au lieu de SMS
- Coût : déjà payé via abonnement GreenAPI existant

---

## 3. Géolocalisation

### navigator.geolocation
- **Usage** : natif navigateur, gratuit
- **Limites** : nécessite HTTPS + consentement utilisateur

### ipapi.co (fallback IP)
- **Usage** : géoloc approximative si GPS refusé
- **Plan gratuit** : 1 000 requêtes/jour
- **URL** : https://ipapi.co

### Leaflet + OpenStreetMap (déjà intégré)
- **Usage** : cartes, tiles, itinéraires
- **Plan gratuit** : illimité (OSM)

### Plugin Leaflet Routing Machine
- **Usage** : itinéraires + ETA
- **Backend** : OSRM public ou Mapbox free tier (50k req/mois)

---

## 4. Médias & stockage

### Supabase Storage (déjà dispo)
- **Plan gratuit** : 1 GB, 2 GB bandwidth/mois
- **Limite** : suffit pour MVP, pas pour vidéos longues

### Cloudinary (recommandé pour vidéos)
- **Usage** : transcodage vidéo, thumbnails, CDN, optimisation auto
- **Plan gratuit** : 25 GB storage, 25 GB bandwidth, 25k transformations/mois
- **URL** : https://cloudinary.com

### Bunny.net (alternative CDN low-cost)
- **Usage** : storage + CDN
- **Coût** : ~$0.01/GB, pas de free tier mais ultra-cheap

---

## 5. Paiement Mobile Money (Côte d'Ivoire)

### PawaPay (RETENU)
- **Usage** : Orange Money CI, MTN MoMo CI, Moov Money CI, Wave CI
- **Sandbox** : gratuit, `https://api.sandbox.pawapay.io`
- **Prod** : `https://api.pawapay.io`
- **Auth** : Bearer token
- **Doc** : https://docs.pawapay.io
- **Coût** : commission négociée par contrat (≈ 1-2%)
- **Flow** : `predict-provider` → `POST /deposits` → polling `GET /deposits/{id}` ou webhook

### Variables d'env
```env
VITE_PAWAPAY_BASE_URL=https://api.sandbox.pawapay.io
VITE_PAWAPAY_TOKEN=eyJ...
VITE_PAWAPAY_CALLBACK_URL=https://<edge-function-url>/pawapay-webhook
```

### Alternatives (non retenues)
- **CinetPay** — agrégateur multi-MMO + CB
- **PayDunya** — agrégateur Afrique de l'Ouest
- **Paystack** — carte bancaire principalement

---

## 6. IA — Génération de descriptions

### Groq (recommandé)
- **Modèle** : Llama 3.3 70B, Mixtral, Gemma
- **Plan gratuit** : rate-limited mais largement suffisant (30 req/min)
- **Latence** : très basse (<1s)
- **URL** : https://console.groq.com

### Google Gemini 1.5 Flash
- **Plan gratuit** : 1 500 requêtes/jour, 1M tokens/min
- **URL** : https://ai.google.dev

### Mistral AI free tier
- **Plan gratuit** : limité (Mistral Small)
- **URL** : https://mistral.ai

---

## 7. Reconnaissance vocale (dictée)

### Web Speech API
- **Usage** : `window.SpeechRecognition` / `webkitSpeechRecognition`
- **Coût** : natif navigateur, gratuit
- **Support** : Chrome, Edge, Safari (FR-fr OK)

### Deepgram (fallback / qualité)
- **Plan gratuit** : $200 crédit à l'inscription
- **URL** : https://deepgram.com

---

## 8. Notifications push

### OneSignal (recommandé)
- **Usage** : push web + mobile, segmentation, A/B test
- **Plan gratuit** : illimité jusqu'à 10 000 utilisateurs subscribed
- **URL** : https://onesignal.com

### Web Push API + Supabase Edge Function
- **Usage** : alternative full-OSS, sans tiers
- **Coût** : gratuit, mais à coder soi-même (VAPID keys, service worker)

---

## 9. QR codes

### qrcode (npm)
- **Usage** : génération côté client
- **Install** : `yarn add qrcode`

### vue-qrcode-reader
- **Usage** : scan caméra, contrôle d'accès billetterie
- **Install** : `yarn add vue-qrcode-reader`

---

## 10. Messagerie WhatsApp

### GreenAPI (déjà intégré)
- **Usage** : envoi notifs orga, confirmations, partage localisation
- **Coût** : abonnement déjà actif

---

## 11. Charts & dashboards

### Chart.js (recommandé)
- **Install** : `yarn add chart.js vue-chartjs`
- **Coût** : OSS gratuit

### ApexCharts (plus visuel)
- **Install** : `yarn add apexcharts vue3-apexcharts`

### Leaflet.heat
- **Usage** : heatmaps géographiques (dashboard admin)
- **Coût** : OSS

---

## 12. Exports

### xlsx (SheetJS)
- **Usage** : export Excel côté client
- **Install** : `yarn add xlsx`

### papaparse
- **Usage** : export CSV
- **Install** : `yarn add papaparse`

---

## Récap par phase

| Phase | Services à activer |
|---|---|
| **P1 — Socle** | Supabase + PostGIS, Firebase Auth Phone (ou Supabase OTP), ipapi.co, qrcode |
| **P2 — Orga + modération** | Cloudinary (upload média), GreenAPI (notifs statut), Supabase Storage |
| **P3 — Monétisation** | CinetPay (paiement MM), vue-qrcode-reader (contrôle accès), Supabase RPC tracking |
| **P4 — Optimisations** | Groq (IA desc), Web Speech API (dictée), OneSignal (push), Chart.js, xlsx |

---

## Variables d'environnement attendues

```env
# Supabase (déjà)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# GreenAPI (déjà)
VITE_GREEN_API_URL=
VITE_GREEN_ID_INSTANCE=
VITE_GREEN_API_TOKEN=

# Phase 1
VITE_IPAPI_KEY=                 # optionnel, fallback IP geoloc
VITE_FIREBASE_API_KEY=          # si Firebase Auth Phone

# Phase 2
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=

# Phase 3
VITE_PAWAPAY_BASE_URL=https://api.sandbox.pawapay.io
VITE_PAWAPAY_TOKEN=
VITE_PAWAPAY_CALLBACK_URL=

# Phase 4
VITE_GROQ_API_KEY=
VITE_ONESIGNAL_APP_ID=
```
