# Checklist Babivibes

## Base de donnees

- [ ] Executer `migrations/phase5_babivibes.sql` dans Supabase.
- [ ] Verifier que `profiles` contient les profils existants migres depuis `users`.
- [ ] Verifier que `event_attendances` contient les anciennes lignes `rsvps`.
- [ ] Verifier que `event_interactions` existe.
- [ ] Verifier les policies RLS avec un profil `admin` authentifie Supabase.

## Consommateur

- [ ] Ouvrir `/`.
- [ ] Creer un profil rapide avec pseudo et telephone.
- [ ] Verifier que le feed affiche seulement les evenements `approved`.
- [ ] Tester les filtres `Aujourd'hui`, `Week-end`, `Semaine`, `Gratuit`, `Payant`, `Proche`.
- [ ] Cliquer sur `J'y vais`.
- [ ] Verifier l'insertion dans `event_attendances`.
- [ ] Cliquer une seconde fois et verifier qu'aucun doublon n'est cree.
- [ ] Verifier qu'une interaction `click_going` est creee.
- [ ] Scroller le feed et verifier les interactions `view`.

## WhatsApp

- [ ] Renseigner `organizerPhone` sur un evenement.
- [ ] Verifier `VITE_GREEN_API_URL`, `VITE_GREEN_ID_INSTANCE`, `VITE_GREEN_API_TOKEN`.
- [ ] Cliquer sur `J'y vais`.
- [ ] Verifier que l'organisateur recoit le message GreenAPI.
- [ ] Verifier `whatsapp_sent = true` apres envoi reussi.

## Organisateur

- [ ] Ouvrir `/organizer`.
- [ ] Creer un evenement via `/organizer/events/new`.
- [ ] Verifier que le statut cree est `pending`.
- [ ] Verifier qu'un evenement `pending` n'apparait pas dans le feed public.
- [ ] Ouvrir `/organizer/events/:id`.
- [ ] Verifier les stats vues, clics, contacts et WhatsApp.
- [ ] Verifier que le motif de rejet apparait si l'evenement est refuse.

## Admin

- [ ] Ouvrir `/admin`.
- [ ] Se connecter comme admin local ou profil Supabase admin.
- [ ] Ouvrir `/admin/events`.
- [ ] Filtrer par statut, organisateur, ville/quartier et date.
- [ ] Ouvrir `/admin/events/:id`.
- [ ] Approuver un evenement.
- [ ] Verifier `status = approved` et `approved_at`.
- [ ] Rejeter un evenement avec motif obligatoire.
- [ ] Verifier qu'un evenement rejete n'apparait pas dans le feed.
- [ ] Ouvrir `/admin/stats`.
- [ ] Verifier les cartes total, attente, approuves, contacts, vues et clics.

## Regie et billetterie

- [ ] Ouvrir `/admin/ads`.
- [ ] Creer une publicite simple.
- [ ] Activer et desactiver une publicite.
- [ ] Activer la reservation sur un evenement.
- [ ] Cliquer `Reserver` dans le feed.
- [ ] Sans `VITE_PAWAPAY_TOKEN`, verifier le placeholder `Reservation bientot disponible`.

## Build

- [ ] Lancer `npm run build`.
- [ ] Corriger toute erreur bloquante.
