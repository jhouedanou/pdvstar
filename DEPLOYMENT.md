# Deployment Guide

This guide explains how to deploy pdvstar to Netlify.

## Prerequisites

- GitHub account with your code pushed
- Netlify account (free tier available)
- GreenAPI credentials (see GREENAPI_SETUP.md)

## Deployment Steps

### Option 1: Netlify Web Dashboard (Recommended for Beginners)

#### Step 1: Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### Step 2: Connect to Netlify

1. Go to [Netlify](https://app.netlify.com)
2. Click "New site from Git"
3. Choose GitHub as your provider
4. Authorize Netlify to access your repositories
5. Select your `pdvstar` repository

#### Step 3: Configure Build Settings

Netlify should auto-detect the settings, but verify:

- **Build command**: `npm run build`
- **Publish directory**: `dist`

#### Step 4: Add Environment Variables

1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Click **Edit variables**
3. Add the following variables:

```
VITE_GREEN_API_URL = https://7105.api.greenapi.com
VITE_GREEN_MEDIA_URL = https://7105.media.greenapi.com
VITE_GREEN_ID_INSTANCE = YOUR_INSTANCE_ID
VITE_GREEN_API_TOKEN = YOUR_API_TOKEN
```

#### Step 5: Deploy

1. Click **Deploy site**
2. Wait for the build to complete
3. Your site will be live at `https://[your-site-name].netlify.app`

### Option 2: Netlify CLI (For Advanced Users)

#### Step 1: Install Netlify CLI

```bash
npm install -g netlify-cli
```

#### Step 2: Login to Netlify

```bash
netlify login
```

This will open your browser to authorize the CLI.

#### Step 3: Initialize Your Site

```bash
netlify init
```

Follow the prompts:
- Choose "Create & configure a new site"
- Select your team
- Enter site name (e.g., `pdvstar-events`)
- Build command: `npm run build`
- Publish directory: `dist`

#### Step 4: Set Environment Variables

```bash
netlify env:set VITE_GREEN_API_URL "https://7105.api.greenapi.com"
netlify env:set VITE_GREEN_MEDIA_URL "https://7105.media.greenapi.com"
netlify env:set VITE_GREEN_ID_INSTANCE "YOUR_INSTANCE_ID"
netlify env:set VITE_GREEN_API_TOKEN "YOUR_API_TOKEN"
```

#### Step 5: Deploy

```bash
netlify deploy --prod
```

## Post-Deployment

### Verify Deployment

1. Visit your site URL
2. Test the user profile creation
3. Test the "J'y vais" button with a valid phone number
4. Verify WhatsApp message is received

### Custom Domain (Optional)

1. Go to **Site settings** → **Domain management**
2. Click **Add custom domain**
3. Follow the DNS configuration instructions

### SSL Certificate

Netlify automatically provides free SSL certificates via Let's Encrypt.

## Troubleshooting

### Build Fails

**Check build logs**:
1. Go to **Deploys** tab
2. Click the failed deploy
3. Check the build log for errors

**Common issues**:
- Missing dependencies: Run `npm install` locally and commit `package-lock.json`
- Node version: Netlify uses Node 18 by default. If needed, set in `netlify.toml`:
  ```toml
  [build]
    environment = { NODE_VERSION = "18" }
  ```

### WhatsApp Messages Not Sending

1. Verify environment variables are set correctly
2. Check GreenAPI dashboard for API errors
3. Ensure phone numbers are in international format
4. Check GreenAPI account status and quota

### Site Not Loading

1. Check if build succeeded in Netlify dashboard
2. Verify `dist` folder contains `index.html`
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

## Monitoring

### Analytics

Netlify provides basic analytics. Go to **Analytics** tab to view:
- Unique visitors
- Page views
- Traffic sources

### Error Tracking

Monitor errors in:
1. Browser console (F12)
2. Netlify function logs (if using serverless functions)
3. GreenAPI dashboard for API errors

## Updating Your Site

### Making Changes

1. Make changes locally
2. Test with `npm run dev`
3. Commit and push to GitHub
4. Netlify automatically deploys on push

### Disabling Auto-Deploy

1. Go to **Site settings** → **Build & deploy** → **Deploy contexts**
2. Toggle off "Auto publish from Git"

## Rollback

If something goes wrong:

1. Go to **Deploys** tab
2. Find the previous working deploy
3. Click **Publish deploy**

## Performance Optimization

### Image Optimization

Netlify automatically optimizes images. For best results:
- Use modern formats (WebP, AVIF)
- Compress images before uploading
- Use responsive image sizes

### Caching

The `netlify.toml` file configures caching rules. Current settings:
- HTML: No cache (always fresh)
- Assets: Long-term cache (1 year)

## Security

### Environment Variables

- Never commit `.env` to Git
- Use Netlify's environment variable management
- Rotate API tokens regularly

### HTTPS

All Netlify sites use HTTPS by default.

### Content Security Policy

Consider adding CSP headers in `netlify.toml` for additional security.

## Support

- Netlify Docs: https://docs.netlify.com/
- Netlify Support: https://support.netlify.com/
- Community: https://community.netlify.com/

## Next Steps

1. Set up a custom domain
2. Configure analytics
3. Set up error monitoring
4. Optimize performance
5. Plan scaling strategy
