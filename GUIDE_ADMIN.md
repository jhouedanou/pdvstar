# Guide Admin

Rôle super-utilisateur. Modération events, gestion globale, stats.

## Connexion

```
URL  : /admin
Login: admin
Pass : admin
```

Hardcodé [src/stores/adminStore.js:20-21](src/stores/adminStore.js#L20-L21).

Session séparée des consumers/organizers :
- Clé localStorage : `pdvstar_admin_session`
- Durée : 24h
- Peut coexister avec session consumer (double session)

Redirection auto post-login : `/admin/dashboard`.

## Sécurité prod

Hardcoded `admin/admin` doit être remplacé. Options par ordre de robustesse :

1. **Vars env** : `VITE_ADMIN_USERNAME` + `VITE_ADMIN_PASSWORD_HASH` (bcrypt côté client = faible).
2. **Auth Supabase** : créer admin dans `users` avec `role_v2 = 'admin'`, login via email+password Supabase Auth, vérifier role à l'auth.
3. **RLS** : policies Supabase basées sur `auth.jwt() ->> 'role' = 'admin'`. Bloque toute manip table même si JS bypassé.

Recommandation : option 3 (RLS) obligatoire prod.

## Dashboard `/admin/dashboard`

### Modération events

Filtre status (boutons) :
- All / Pending / Approved / Rejected
- Compteur par bucket

Sur event `pending`, 2 boutons :
- **Approuver** : update `status=approved`, log `moderation_log(action=approve)`
- **Rejeter** : ouvre modale -> saisir motif obligatoire -> update `status=rejected`, `rejection_reason`, log `action=reject`

Trigger notif GreenAPI envoyé à organisateur sur changement statut.

### CRUD events admin

- Créer event direct -> passe en `approved` sans modération
- Modifier n'importe quel event (tous organisateurs)
- Supprimer event via portail anti-suppression abusive :
  - Étape 1 : confirmation
  - Étape 2 : mot de passe admin
  - Cooldown si suppression abusive détectée
  - Historique dans localStorage

### Gestion tags

Via `tagsService` :
- `createTag(label, slug)`
- `updateTag(id, ...)`
- `deleteTag(id)`

### Stats globales

- `global_stats` : total events, users, RSVP, revenus
- `stats_by_quartier` : breakdown
- `stats_by_organizer` : top organisateurs

## Régie pub `/admin/ads`

Admin voit toutes pubs (vs organizer = ses pubs uniquement).

Actions :
- CRUD pubs tous annonceurs
- Activer/désactiver (`is_active`)
- Reorder (`position`)
- Stats clicks + views par pub
- Filtrer par format / quartier / annonceur

## Scan billets `/billet/scan`

Admin a accès. Idem flow organizer mais peut scanner billets de tous les events.

## Routes accessibles admin

| Route | Description |
|---|---|
| `/` | Feed (lecture seule) |
| `/admin` | Login |
| `/admin/dashboard` | Modération + CRUD |
| `/admin/ads` | Régie pub globale |
| `/billet/scan` | Scan QR |
| `/pro` | Dashboard organizer (admin a accès aussi) |
| `/pro/create` | Wizard création |

## Garde routes

[src/main.js:58-68](src/main.js#L58-L68) :
- `requiresAdmin` : accepte admin OU organizer (permissif, à durcir)
- `requiresRole: ['organizer', 'admin']` : idem

Pour durcir admin-only :
```js
if (to.meta.requiresAdmin && !checkAdminSession()) return next('/admin')
```

## Promouvoir un user en admin

Console Supabase SQL Editor :
```sql
UPDATE users
SET role = 'admin', role_v2 = 'admin'
WHERE phone = '+22507XXXXXXXX';
```

## Logs modération

Table `moderation_log(event_id, admin_id, action, reason, created_at)`. Fetch via `fetchModerationLog(eventId)`.

## Déconnexion admin

`adminStore.logout()` -> vide `pdvstar_admin_session`. Session user éventuelle conservée.
