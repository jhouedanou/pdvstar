# Guide Organisateur

Rôle `organizer`. Crée et gère événements, billetterie, publicités.

## Devenir organisateur

Pré-requis : être connecté en tant que consumer.

1. Aller sur `/pro` (bouton "Espace Organisateur" dans profil)
2. Modal "Devenir Organisateur" s'ouvre auto si role != organizer
3. Saisir :
   - Nom de l'espace (ex: "Le Balafon Lounge")
   - Nom organisateur (optionnel, défaut = pseudo)
4. Valider -> `users.role = organizer`, `space_name`, `organizer_name` persistés Supabase
5. Session locale mise à jour (toujours `pdvstar_session_user`)

## Persistance

Source vérité : `users.role_v2` Supabase. Cache localStorage 7j. Connexion sur nouveau device avec même téléphone -> rôle restauré via `findUserByPhone` au login.

## Accès espaces

Depuis profil, boutons :
- "Espace Organisateur" -> `/pro` (dashboard)
- "Créer event" -> `/pro/create` (wizard 6 étapes)
- "Mes pubs" -> `/admin/ads`
- "Scan QR" -> `/billet/scan`

## Dashboard `/pro`

- Liste de tes événements (tous statuts)
- Stats RSVP, billets vendus, revenus
- Filtre par statut : draft / pending / approved / rejected
- Export CSV (xlsx côté client)
- Quota : 5 publications gratuites max. Au-delà -> achat pass requis.

## Créer un événement

Route `/pro/create` -> Wizard 6 étapes :

1. **Média** : photo ou vidéo (upload Supabase Storage)
2. **Titre + date** : datetime-local
3. **Description** : champ texte. 2 outils :
   - Bouton IA Groq : génère 80 mots à partir titre/lieu/tags (besoin `VITE_GROQ_API_KEY`)
   - Bouton dictée : Web Speech API FR-fr
4. **Lieu + tags** : adresse, quartier, ville, tags, géoloc (lat/lng auto via Leaflet picker)
5. **Billetterie** : toggle, prix XOF, capacité, commission % (défaut 5%)
6. **Preview + submit** : event passe en `status = pending` -> attente modération admin

## Workflow modération

1. Tu soumets event -> `pending`
2. Admin reçoit dans `/admin/dashboard`, filtre pending
3. Admin approuve ou rejette avec motif
4. Notif GreenAPI t'arrive sur changement statut
5. Si rejeté, `events.rejection_reason` visible dans ton dashboard
6. Tu peux corriger et resoumettre via `submitEventForReview`

## Billetterie

Activée via wizard étape 5. Quand activée :
- Bouton "Acheter" apparaît sur card event côté user
- Achat -> PawaPay Mobile Money -> ticket créé avec QR token UUID v4
- Commission auto = `price * commission_rate / 100`
- Ticket `payment_status = pending` puis `paid` après webhook
- Statut `valid` jusqu'à scan -> `used`

### Scanner QR à l'entrée

Route `/billet/scan` :
1. Autoriser caméra
2. Scan QR billet
3. RPC `redeem_ticket(token, admin_uid)` valide + marque used (idempotent)
4. Affichage : valide / déjà utilisé / invalide

## Régie pub

Route `/admin/ads` (organizer voit ses propres pubs uniquement).

Création pub :
- Format : banner / fullscreen / video / story
- Ciblage : quartier, PDV
- Media : image ou video URL
- CTA : texte + lien
- Période : start/end date

Tracking auto :
- `view_count` increment à impression
- `click_count` increment à clic

## Stats

Disponibles via `statsService` :
- RSVP par event
- Billets vendus, revenus, commission
- Taux conversion vue -> RSVP -> billet
- Pertinence event (algo trie feed)

## Pass organizer

Au-delà des 5 publications gratuites : achat pass via `/admin/dashboard` -> bouton "Acheter Pass". Active publications illimitées.

## Variables env requises

| Var | Usage | Obligatoire |
|---|---|---|
| VITE_GROQ_API_KEY | IA description | Non (feature optionnelle) |
| VITE_PAWAPAY_TOKEN | Mobile Money | Oui si billetterie |
| VITE_PAWAPAY_BASE_URL | sandbox/prod | Oui |
| VITE_ONESIGNAL_APP_ID | Push | Non |
| VITE_GREENAPI_INSTANCE / TOKEN | WhatsApp notif | Oui si notif RSVP |
