# Changelog

All notable changes to pdvstar will be documented in this file.

## [1.1.0] - 2024-12-19

### Added - Responsivité & Affichage Multi-Écrans

#### Écrans Pliables & Atypiques
- **Media Queries Flexibles**: Support complet pour Samsung Galaxy Fold et autres écrans pliables
- **Adaptation Automatique**: Layout s'adapte aux modes fermé (~280px) et déplié (~512px-884px)
- **Ratios d'Aspect**: Gestion des écrans ultra-larges (21:9) et ultra-hauts
- **Wrapping Intelligent**: Flexbox/Grid pour éviter les débordements

#### Mode Paysage
- **Optimisation Android/iOS**: Layout optimisé pour le mode paysage sur les deux OS
- **Espacement Adaptatif**: Réduction des espacements verticaux en paysage court (<500px)
- **Boutons d'Action**: Taille réduite automatiquement en mode paysage
- **Centrage Tablette**: Centrage automatique sur grands écrans en paysage
- **Masquage Intelligent**: Éléments non essentiels masqués en paysage court

#### PWA & Mobile
- **Manifest PWA**: Fichier `manifest.json` avec orientation portrait suggérée
- **Meta Tags**: Tags PWA pour meilleure expérience d'installation mobile
- **Dynamic Viewport**: Utilisation de `dvh` pour gérer les barres d'adresse
- **Safe Area**: Gestion améliorée des safe areas sur appareils notched

#### Composants
- **RotateDeviceMessage**: Nouveau composant optionnel pour inviter à la rotation
- **Classes CSS Utilitaires**: 
  - `.responsive-container` pour conteneurs adaptatifs
  - `.flex-wrap-safe` pour wrapping sécurisé
  - `.grid-auto-fit` pour grilles auto-adaptatives

#### Documentation
- **RESPONSIVE.md**: Guide complet de responsivité avec:
  - Problèmes résolus et solutions
  - Breakpoints de l'application
  - Instructions de test
  - Configuration et déploiement
  - Décisions de design

### Changed

#### CSS
- **src/style.css**: Ajout de ~200 lignes de media queries et utilities
- **Prevention Débordements**: Rule `max-width: 100%` sur tous les éléments
- **Images/Vidéos**: `object-fit: cover` pour éviter les déformations

#### Composants Vue
- **FeedUser.vue**: Ajout de classes sémantiques pour ciblage CSS:
  - `.header-tabs`, `.feed-container`, `.event-slide`
  - `.action-buttons`, `.action-button`, `.action-button-text`
  - `.event-content`, `.music-ticker`, `.bottom-nav`

#### HTML
- **index.html**: 
  - Ajout du lien vers `manifest.json`
  - Meta tags PWA (theme-color, mobile-web-app-capable, etc.)
  - Titre amélioré

### Technical Details

#### Nouveaux Fichiers
- `public/manifest.json` - PWA manifest avec orientation portrait
- `src/components/RotateDeviceMessage.vue` - Composant de rotation (optionnel)
- `RESPONSIVE.md` - Documentation complète de responsivité

#### Fichiers Modifiés
- `src/style.css` - Media queries et utilities responsives
- `src/views/FeedUser.vue` - Classes CSS sémantiques
- `index.html` - Meta tags et manifest PWA

### Breakpoints

| Breakpoint | Largeur | Appareil Type | Adaptations |
|------------|---------|---------------|-------------|
| **XS** | < 320px | Galaxy Fold fermé | Texte réduit, espacement minimal |
| **SM** | 320px - 512px | Mobiles standard | Layout normal |
| **MD** | 512px - 884px | Galaxy Fold déplié | Contenu 70% largeur |
| **LG** | 768px+ | Tablettes | Centrage avec max-width 600px |
| **XL** | > 1024px | Desktop | Centrage avec max-width 60vh |

### Browser Support

- ✅ Chrome/Edge (Mobile & Desktop)
- ✅ Safari (iOS & macOS)
- ✅ Firefox (Mobile & Desktop)
- ✅ Samsung Internet
- ✅ Opera Mobile

### Testing

Tests recommandés sur:
- Samsung Galaxy Fold (fermé & déplié)
- Galaxy Z Flip
- iPhone SE (écran étroit)
- iPhone 14 Pro Max (écran large)
- iPad Mini & iPad Pro
- Mode paysage Android & iOS

### Notes

- Le composant `RotateDeviceMessage` est **désactivé par défaut**
- L'application reste utilisable en mode paysage (pas de blocage)
- L'orientation portrait est **suggérée** via le manifest, pas forcée
- Tous les débordements horizontaux sont prévenus

---

## [1.0.0] - 2025-01-15

### Added

#### User Management
- **User Profile Modal**: New modal component for user profile creation on first launch
- **User Store**: Pinia store for managing user profile data with localStorage persistence
- **Profile Fields**: 
  - Full name (required)
  - Professional phone number (default: +22545029721)
  - Email (optional)

#### WhatsApp Integration
- **GreenAPI Service**: Complete WhatsApp messaging service
- **"J'y vais" Button**: Interactive button on each event to signal interest
- **Message Formatting**: Automatic message generation with event and user details
- **Toast Notifications**: Success/error feedback for message sending
- **Loading State**: Visual feedback while message is being sent

#### UI/UX Improvements
- **Event Descriptions**: Dynamic descriptions visible on each event slide
- **Enhanced Event Data**: All events now include detailed descriptions
- **Toast Messages**: Success and error notifications for user actions
- **Loading Indicators**: Spinner animation on "J'y vais" button during message sending

#### Configuration & Security
- **.env File**: Environment variables for GreenAPI credentials
- **.gitignore Update**: Added .env files to prevent accidental commits
- **netlify.toml**: Netlify deployment configuration with SPA redirects
- **.env.example**: Template file for environment variables

#### Documentation
- **README.md**: Comprehensive project documentation with:
  - Feature overview
  - Tech stack details
  - Installation instructions
  - Development and build commands
  - Deployment guide
  - Project structure
  - Feature explanations
- **GREENAPI_SETUP.md**: Detailed GreenAPI configuration guide
- **DEPLOYMENT.md**: Step-by-step Netlify deployment instructions
- **CHANGELOG.md**: This file

### Technical Details

#### New Files
- `src/stores/userStore.js` - User profile state management
- `src/components/UserProfileModal.vue` - User profile creation UI
- `src/services/greenApiService.js` - WhatsApp API integration
- `.env` - Environment variables (template)
- `.env.example` - Environment variables example
- `netlify.toml` - Netlify deployment config
- `GREENAPI_SETUP.md` - GreenAPI setup guide
- `DEPLOYMENT.md` - Deployment instructions
- `CHANGELOG.md` - Version history

#### Modified Files
- `src/views/FeedUser.vue` - Added profile modal, WhatsApp integration, toast notifications
- `src/stores/eventStore.js` - Added descriptions to event data
- `.gitignore` - Added .env files
- `README.md` - Complete rewrite with comprehensive documentation

### Features

#### Mobile-First Design
- ✅ TikTok-style vertical scrolling (100vh snap)
- ✅ Dark, modern aesthetic
- ✅ Responsive mobile-optimized layout
- ✅ Safe area support for notched devices

#### Event Discovery
- ✅ Image and video support
- ✅ Event descriptions visible on slides
- ✅ Location and distance information
- ✅ Organizer avatars with DiceBear API
- ✅ Promotional badges and music ticker

#### User Engagement
- ✅ Simple one-time profile setup
- ✅ WhatsApp integration for event interest
- ✅ Automatic message formatting
- ✅ Real-time feedback (toast notifications)

#### Developer Experience
- ✅ Vue 3 with Composition API
- ✅ Pinia for state management
- ✅ TailwindCSS for styling
- ✅ Vite for fast development
- ✅ Environment variable management
- ✅ Comprehensive documentation

### Known Limitations

- Mock event data (no backend integration yet)
- No user authentication system
- No event creation by users (pro dashboard placeholder)
- No real-time notifications
- Limited to GreenAPI for WhatsApp (no SMS or other channels)

### Future Enhancements

- [ ] Backend API integration
- [ ] User authentication (OAuth, email)
- [ ] Event creation and management
- [ ] User favorites/bookmarks
- [ ] Real-time notifications
- [ ] Event filtering and search
- [ ] User reviews and ratings
- [ ] Payment integration
- [ ] Analytics dashboard
- [ ] Multi-language support

### Breaking Changes

None - This is the initial release.

### Migration Guide

N/A - Initial release

### Contributors

- Development Team

### Support

For issues, questions, or suggestions:
1. Check the documentation files
2. Review GREENAPI_SETUP.md for WhatsApp issues
3. Check DEPLOYMENT.md for deployment issues
4. Open an issue on GitHub

---

## Version History

### [Unreleased]

- Features in development
- Performance optimizations
- Additional testing

---

**Last Updated**: January 15, 2025
**Status**: MVP Complete ✅
