# Guide connexion — 3 types d'utilisateurs

App expose 3 rôles : **consumer** (par défaut), **organizer**, **admin**.
Chaque rôle accède à des écrans différents et persiste sa session dans `localStorage`.

---

## 1. Consumer (utilisateur standard)

### Comment se connecter
1. Aller sur `/` (page d'accueil = feed événements)
2. Cliquer sur n'importe quelle action (`J'y vais`, profil…) qui exige une identité
3. Modal `UserProfileModal` s'ouvre
4. Saisir :
   - **Pseudo** (ex: `Le Boss du Plateau`)
   - **Téléphone** (format international, ex: `+22507XXXXXXXX`)
5. Valider → user créé/retrouvé en base `users` avec `role_v2 = 'consumer'`

### Session
- Stockée dans `localStorage` clé `pdvstar_session_user`
- Durée : 7 jours
- Logique : `src/stores/userStore.js` → `authenticate()`

### Ce que peut faire un consumer
- Lire feed approuvé
- "J'y vais" → écrit `rsvps` + notif WhatsApp orga
- Acheter billet → `/billet/:id` (PawaPay Mobile Money)
- Filtres géo/quartier/tag/date

### Pas d'accès à
- `/pro/*`
- `/admin/*`
- `/billet/scan`

---

## 2. Organizer

### Comment devenir organizer
**Pré-requis** : être déjà connecté comme consumer (étape 1 ci-dessus).

1. Aller sur `/pro`
2. Si non-organizer, modal `Devenir Organisateur` s'ouvre auto
3. Saisir :
   - **Nom de l'espace** (ex: `Le Balafon Lounge`)
   - **Nom organisateur** (optionnel, défaut = pseudo)
4. Valider → `userStore.becomeOrganizer()` met à jour `role` à `organizer` dans Supabase + session locale

### Session
- Même session que consumer (`pdvstar_session_user`)
- Champ `role: 'organizer'` ajouté
- Route guard `meta.requiresRole: ['organizer','admin']` vérifie via `localStorage`

### Ce que peut faire un organizer
- `/pro` — dashboard : ses events + stats RSVP/billets/revenus
- `/pro/create` — wizard 6 étapes (photo, titre, date, desc, billet, review)
- Events publiés en `status: 'pending'` (modération admin requise)
- `/admin/ads` — créer ses propres pubs (format, ciblage quartier/PDV)
- `/billet/scan` — scanner QR billets à l'entrée
- IA Groq pour générer description event (`VITE_GROQ_API_KEY` requis)

### Quota
- 5 publications gratuites max (constante `FREE_PUBLICATION_LIMIT`)
- Pass actif (`pdvstar_active_pass_*`) → illimité

---

## 3. Admin

### Identifiants par défaut
```
URL: /admin
Login: admin
Mot de passe: admin
```
Définis dans `src/stores/adminStore.js:20-21` (à changer en prod via env var).

### Comment se connecter
1. Aller sur `/admin`
2. Saisir `admin` / `admin`
3. Redirection auto vers `/admin/dashboard`

### Session
- `localStorage` clé `pdvstar_admin_session`
- Durée : 24 heures
- **Indépendante** de la session user (`pdvstar_session_user`)
- Possibilité d'avoir 2 sessions simultanées (admin + consumer)

### Ce que peut faire un admin
- `/admin/dashboard` — modération events (approve / reject avec motif, log dans `moderation_log`)
- Voir tous events, tous statuts (`pending|approved|rejected`)
- CRUD events directs (création passe en `approved` direct, pas modération)
- `/admin/ads` — toutes pubs, tous annonceurs
- `/billet/scan` — accès également
- Stats globales (`global_stats`, `stats_by_quartier` via `statsService`)
- Gestion tags (via `tagsService.createTag/updateTag/deleteTag`)

### Sécurité prod ⚠️
**Hardcoded `admin/admin` à remplacer**. Options :
- Variables env `VITE_ADMIN_USERNAME` / `VITE_ADMIN_PASSWORD_HASH`
- Mieux : table `users` avec `role_v2 = 'admin'` + Supabase Auth password
- Encore mieux : politique RLS Supabase basée sur `auth.jwt() -> role`

---

## Résumé des routes par rôle

| Route | consumer | organizer | admin |
|---|:-:|:-:|:-:|
| `/` (feed) | ✅ | ✅ | ✅ |
| `/billet/:id` (achat) | ✅ | ✅ | ✅ |
| `/pro` | ❌ | ✅ | ✅ |
| `/pro/create` | ❌ | ✅ | ✅ |
| `/billet/scan` | ❌ | ✅ | ✅ |
| `/admin` (login) | ✅ | ✅ | ✅ |
| `/admin/dashboard` | ❌ | ❌* | ✅ |
| `/admin/ads` | ❌ | ✅ (ses pubs) | ✅ (toutes) |

*Organisateur ne devrait pas accéder à `/admin/dashboard` strictement. Guard actuel autorise admin OU organizer (cf `src/main.js` `requiresAdmin` → permissif). À durcir si besoin.

---

## Comment changer de rôle pendant le dev

### Se déconnecter complètement
```js
localStorage.removeItem('pdvstar_session_user')
localStorage.removeItem('pdvstar_admin_session')
```
Puis recharger.

### Forcer un rôle (debug rapide)
Console navigateur :
```js
const s = JSON.parse(localStorage.getItem('pdvstar_session_user'))
s.user.role = 'organizer'  // ou 'admin' ou 'consumer'
localStorage.setItem('pdvstar_session_user', JSON.stringify(s))
location.reload()
```

### Promouvoir un user en base
Supabase SQL Editor :
```sql
UPDATE users
SET role = 'admin', role_v2 = 'admin'
WHERE phone = '+22507XXXXXXXX';
```

---

## Tableau récap des sessions localStorage

| Clé | Rôle | Expire | Source |
|---|---|---|---|
| `pdvstar_session_user` | consumer / organizer | 7 jours | `userStore.authenticate()` |
| `pdvstar_admin_session` | admin | 24 h | `adminStore.login()` |
| `pdvstar_active_pass_<userId>` | pass payant | selon pass | `userStore.buyPass()` |

---

## Toi → comment te connecter MAINTENANT

**En tant que consumer (utilisateur normal) :**
1. `npx vite` → ouvrir `http://localhost:5173`
2. Cliquer sur cœur "J'y vais" d'un event
3. Modal pseudo + tel → renseigner → c'est fait

**En tant qu'organizer :**
1. Étape consumer ci-dessus
2. Naviguer vers `/pro`
3. Modal devenir organisateur → renseigner nom espace → valider

**En tant qu'admin :**
1. Aller sur `/admin`
2. `admin` / `admin`
3. Redirection `/admin/dashboard`
