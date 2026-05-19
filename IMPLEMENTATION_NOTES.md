# Implementation Notes - Babivibes

## Synthese

Cette integration fait evoluer `pdvstar` vers une base Babivibes BtoBtoC sans casser le modele historique.

Les anciennes tables `users`, `events`, `rsvps`, `ads` et `tickets` restent compatibles. La migration `migrations/phase5_babivibes.sql` ajoute le modele cible :

- `profiles`
- `event_attendances`
- `event_interactions`
- champs evenementiels modernes sur `events`
- preparation regie publicitaire sur `ads`
- preparation billetterie sur `tickets`

## Frontend

Routes ajoutees :

- `/profile`
- `/organizer`
- `/organizer/events/new`
- `/organizer/events/:id`
- `/organizer/ads`
- `/admin/events`
- `/admin/events/:id`
- `/admin/stats`

Le feed conserve le scroll vertical plein ecran et filtre les evenements approuves. Il ajoute des filtres rapides par date, prix et proximite.

Le bouton `J'y vais` :

- ouvre le profil rapide si necessaire ;
- enregistre dans `event_attendances`, avec fallback `rsvps` ;
- evite les doublons cote UI et via contrainte `(event_id, phone)` ;
- trace `click_going` dans `event_interactions` ;
- tente une notification GreenAPI vers `organizerPhone`.

## Supabase et RLS

La migration active des RLS plus strictes pour le modele cible. Les politiques s'appuient sur Supabase Auth via `auth.uid()` et les fonctions `current_profile_id()` / `current_profile_role()`.

Important : l'app conserve encore un fallback de session locale pour rester compatible avec l'existant. En production stricte, les roles `organizer` et `admin` doivent etre relies a Supabase Auth pour beneficier pleinement des RLS.

## Billetterie et paiement

La structure tickets est preparee. Le paiement reel est bloque cote UI tant que `VITE_PAWAPAY_TOKEN` n'est pas configure. Le bouton reservation affiche alors un placeholder propre.

## GreenAPI

Les messages ajoutes sont sans emoji. La notification organisateur utilise `event.organizerPhone`. Si ce champ manque, la participation est bien enregistree mais l'envoi WhatsApp est ignore.

## A appliquer en base

Executer dans Supabase SQL Editor :

```sql
-- migrations/phase5_babivibes.sql
```

Puis verifier les policies avec un compte Supabase Auth disposant d'un profil `admin`.
