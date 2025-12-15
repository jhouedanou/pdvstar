# Changelog

All notable changes to pdvstar will be documented in this file.

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
