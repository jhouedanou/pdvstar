# Quick Start Guide

Get pdvstar up and running in 5 minutes!

## 1. Clone & Install (2 minutes)

```bash
# Clone the repository
git clone <your-repo-url>
cd pdvstar

# Install dependencies
npm install
```

## 2. Configure Environment (1 minute)

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your GreenAPI credentials
# Get credentials from https://green-api.com/
nano .env
```

**Required values**:
- `VITE_GREEN_ID_INSTANCE`: Your instance ID from GreenAPI
- `VITE_GREEN_API_TOKEN`: Your API token from GreenAPI

## 3. Run Locally (1 minute)

```bash
# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

## 4. Test Features (1 minute)

1. **Create Profile**: Fill in the modal that appears
   - Name: Your name
   - Phone: +22545029721 (or your number)
   - Email: Optional

2. **Explore Events**: Scroll through the event feed

3. **Test WhatsApp**: Click "J'y vais" on any event
   - Should receive a WhatsApp message
   - Check for success/error notification

## 5. Deploy to Netlify (5 minutes)

### Option A: Web Dashboard (Easiest)

```bash
# Push to GitHub
git add .
git commit -m "Initial commit"
git push origin main
```

Then:
1. Go to https://app.netlify.com
2. Click "New site from Git"
3. Connect GitHub and select your repo
4. Netlify auto-detects settings
5. Add environment variables in Site settings
6. Deploy!

### Option B: Netlify CLI

```bash
# Install CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

## Common Issues

### "GreenAPI configuration is missing"

**Fix**: Check your `.env` file has all 4 variables set correctly.

```bash
# Verify .env exists
cat .env

# Should show:
# VITE_GREEN_API_URL=...
# VITE_GREEN_MEDIA_URL=...
# VITE_GREEN_ID_INSTANCE=...
# VITE_GREEN_API_TOKEN=...
```

### WhatsApp message not sending

**Fix**: 
1. Verify phone number is in international format (+country code)
2. Check GreenAPI credentials are correct
3. Ensure GreenAPI account is active
4. Check browser console for error messages

### Build fails

**Fix**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

## Project Structure

```
pdvstar/
├── src/
│   ├── components/        # Vue components
│   ├── stores/           # Pinia stores (state)
│   ├── services/         # API services
│   ├── views/            # Page components
│   └── App.vue           # Root component
├── public/               # Static assets
├── dist/                 # Production build (generated)
├── .env                  # Environment variables (local)
├── .env.example          # Environment template
├── netlify.toml          # Netlify config
├── vite.config.js        # Vite config
├── tailwind.config.js    # TailwindCSS config
└── package.json          # Dependencies
```

## Available Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Other
npm install              # Install dependencies
npm update               # Update dependencies
```

## Key Files to Know

- **FeedUser.vue**: Main event feed page
- **UserProfileModal.vue**: User profile creation
- **greenApiService.js**: WhatsApp integration
- **userStore.js**: User profile state
- **eventStore.js**: Event data

## Next Steps

1. ✅ Get it running locally
2. ✅ Test all features
3. ✅ Deploy to Netlify
4. ✅ Share with users
5. ⏭️ Add more events
6. ⏭️ Integrate with backend
7. ⏭️ Add user authentication

## Documentation

- **README.md**: Full project documentation
- **DEPLOYMENT.md**: Detailed deployment guide
- **GREENAPI_SETUP.md**: WhatsApp setup guide
- **NETLIFY_ENV_SETUP.md**: Environment variables guide
- **CHECKLIST.md**: MVP completion checklist

## Support Resources

- **Vite Docs**: https://vitejs.dev/
- **Vue 3 Docs**: https://vuejs.org/
- **Pinia Docs**: https://pinia.vuejs.org/
- **TailwindCSS**: https://tailwindcss.com/
- **GreenAPI**: https://green-api.com/
- **Netlify**: https://docs.netlify.com/

## Tips & Tricks

### Speed up development
```bash
# Use npm ci instead of npm install for faster installs
npm ci
```

### Debug WhatsApp messages
```bash
# Check browser console (F12) for detailed error messages
# Check GreenAPI dashboard for API logs
```

### Optimize build size
```bash
# Analyze bundle size
npm run build -- --analyze
```

### Test on mobile
```bash
# Get your local IP
ipconfig getifaddr en0  # macOS
ipconfig /all           # Windows

# Visit http://YOUR_IP:5173 on mobile
```

## Troubleshooting Checklist

- [ ] Node.js version 16+ installed
- [ ] npm install completed without errors
- [ ] .env file created with all 4 variables
- [ ] GreenAPI credentials are valid
- [ ] npm run dev starts without errors
- [ ] Browser opens to http://localhost:5173
- [ ] Profile modal appears on first load
- [ ] Can scroll through events
- [ ] "J'y vais" button is clickable
- [ ] WhatsApp message is received

## Getting Help

1. Check the relevant documentation file
2. Review error messages in browser console (F12)
3. Check GreenAPI dashboard for API errors
4. Review Netlify build logs for deployment issues
5. Check GitHub issues if available

---

**Ready to launch?** 🚀

```bash
npm run dev
```

Then visit http://localhost:5173

**Questions?** Check the documentation files or the support resources above.

**Happy coding!** 🎉
