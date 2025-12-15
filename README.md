# pdvstar - Event Discovery App 🎉

A mobile-first event discovery application with TikTok-style vertical scrolling and WhatsApp integration.

## Features

✨ **Mobile-First UI**
- TikTok-style vertical scroll (100vh snap scrolling)
- Dark, modern aesthetic
- Responsive design optimized for mobile devices

👤 **User Management**
- Simple profile creation on first launch
- Professional phone number field (default: +22545029721)
- Local storage persistence

📱 **WhatsApp Integration**
- "J'y vais" (I'm going) button on each event
- Automatic WhatsApp message via GreenAPI
- Sends user info and event details to organizer

🎬 **Event Display**
- Support for images and videos
- Event descriptions visible on each slide
- Location and distance information
- Organizer avatars

## Tech Stack

- **Frontend**: Vue 3 + Vite
- **State Management**: Pinia
- **Styling**: TailwindCSS
- **Icons**: Lucide Vue Next
- **API Integration**: GreenAPI (WhatsApp)
- **Deployment**: Netlify

## Getting Started

### Prerequisites
- Node.js 16+ and npm

### Installation

```bash
# Install dependencies
npm install

# Create .env file with GreenAPI credentials
cp .env.example .env
# Edit .env with your GreenAPI credentials
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
VITE_GREEN_API_URL="https://7105.api.greenapi.com"
VITE_GREEN_MEDIA_URL="https://7105.media.greenapi.com"
VITE_GREEN_ID_INSTANCE="7105319958"
VITE_GREEN_API_TOKEN="YOUR_TOKEN_HERE"
```

**Important**: Never commit `.env` to version control. The file is already in `.gitignore`.

## Deployment on Netlify

### Option 1: Using Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy to production
netlify deploy --prod --dir=dist
```

### Option 2: Using Netlify Web Dashboard

1. Push your code to GitHub
2. Go to [Netlify](https://app.netlify.com)
3. Click "New site from Git"
4. Connect your GitHub repository
5. Set build command: `npm run build`
6. Set publish directory: `dist`
7. Add environment variables in Site settings → Build & deploy → Environment
8. Deploy

### Environment Variables on Netlify

In Netlify dashboard, go to **Site settings → Build & deploy → Environment** and add:
- `VITE_GREEN_API_URL`
- `VITE_GREEN_MEDIA_URL`
- `VITE_GREEN_ID_INSTANCE`
- `VITE_GREEN_API_TOKEN`

## Project Structure

```
src/
├── components/
│   ├── CreateEventWizard.vue      # Event creation form
│   ├── UserProfileModal.vue        # User profile setup
│   └── HelloWorld.vue
├── stores/
│   ├── eventStore.js               # Event data management
│   └── userStore.js                # User profile management
├── services/
│   └── greenApiService.js          # WhatsApp API integration
├── views/
│   ├── FeedUser.vue                # Main event feed
│   └── ProDashboard.vue            # Pro dashboard
├── App.vue                         # Root component
├── main.js                         # App entry point
└── style.css                       # Global styles
```

## Key Features Explained

### User Profile Modal
On first visit, users are prompted to create a profile with:
- Full name
- Professional phone number (with default +22545029721)
- Email (optional)

Profile is stored in browser's localStorage.

### Event Feed
- Vertical scroll with snap-to-section behavior
- Each event takes up 100% of viewport height
- Event details displayed at bottom with gradient overlay
- Action buttons on right side (TikTok style)

### WhatsApp Integration
When user clicks "J'y vais":
1. User profile is checked (shows modal if missing)
2. Message formatted with event and user details
3. Message sent via GreenAPI WhatsApp API
4. Success/error toast notification displayed

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT
