# Guide Utilisateur (Consumer)

App Babi Vibes. Rôle par défaut. Aucun setup compte requis avant action.

## Connexion

1. Ouvrir app web (PWA installable depuis navigateur).
2. Cliquer sur une action requérant identité : "J'y vais", achat billet, profil.
3. Modal `UserProfileModal` s'ouvre. Saisir :
   - Pseudo (ex: "DJ Arafat Jr.")
   - Téléphone format international (`+22507XXXXXXXX`)
   - Photo optionnelle
4. Validation -> compte créé/retrouvé dans Supabase `users`, role = `consumer`.

Session locale 90 jours glissants, clé `pdvstar_session_user`. Reconnect auto si même device.

## Navigation principale

Barre bottom 4 onglets :
- Feed (par défaut) : liste événements approuvés, tri par pertinence + distance
- Recherche : filtres date, prix, lieu, quartier, catégorie
- Map : Leaflet, markers événements, modal détail
- Profil : infos compte, pass, accès espaces

## Actions disponibles

### "J'y vais"
Bouton coeur sur card event. Insère ligne dans `rsvps(event_id, user_id, phone, pseudo)`. Idempotent (UNIQUE event_id+phone). Trigger Edge Function envoie message WhatsApp à organisateur via GreenAPI.

### Itinéraire / VTC
Map ou modal Maps :
- Bouton WhatsApp : envoie lat/lng à un contact
- Boutons VTC : Uber, Yango, Waze ouvrent deep-link app native vers destination event

### Achat billet
Event avec `ticketing_enabled` :
1. Clic "Acheter billet" -> route `/billet/:id`
2. Saisir num Mobile Money (`+225...`)
3. Détection auto opérateur (Orange/MTN/Moov/Wave) via PawaPay
4. Validation paiement sur tel
5. QR code généré, stocké, montrable à entrée
6. Notif WhatsApp avec QR

### Pass premium
Profil -> "Obtenir un Pass" :
- Découverte 5000 XOF / 3j
- Standard 15000 XOF / 30j
- Premium 30000 XOF / 30j (sans pub)
Paiement PawaPay. Active accès contenu premium.

### Partage
Bouton partage event -> navigator.share natif ou copie lien.

### Suivi organisateurs
Bouton coeur sur profil organisateur -> ajoute à `users.following`.

## Notifications push (optionnel)

Modal demande permission à activation. OneSignal -> reçoit push sur :
- Nouveaux événements quartier abonné
- Confirmation RSVP
- Statut billet

## Filtres feed

- Date : aujourd'hui / demain / weekend / cette semaine / personnalisée
- Lieu : géoloc auto via navigator.geolocation (fallback IP ipapi.co)
- Quartier : Plateau, Cocody, Marcory, etc.
- Catégorie/tags : concert, soirée, sport, food, etc.
- Prix : gratuit, payant, fourchette

## Données stockées

| Clé localStorage | Contenu | Durée |
|---|---|---|
| pdvstar_session_user | profil + role | 90j glissants |
| pdvstar_active_pass_<id> | cache pass actif | selon pass |
| last_phone_input | tel pré-rempli modal | persistant |
| last_name_input | pseudo pré-rempli | persistant |

## Déconnexion

Profil -> bouton déconnexion. Vide `pdvstar_session_user`.

Force reset (DevTools console) :
```js
localStorage.removeItem('pdvstar_session_user')
location.reload()
```
