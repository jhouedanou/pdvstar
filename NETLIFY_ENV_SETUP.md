# Netlify Environment Variables Setup

This guide explains how to configure environment variables on Netlify for the pdvstar application.

## Why Environment Variables?

Environment variables allow you to:
- Keep sensitive credentials out of your code
- Use different values for development and production
- Easily update credentials without redeploying
- Follow security best practices

## Variables Required

The pdvstar application requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_GREEN_API_URL` | GreenAPI base URL | `https://7105.api.greenapi.com` |
| `VITE_GREEN_MEDIA_URL` | GreenAPI media URL | `https://7105.media.greenapi.com` |
| `VITE_GREEN_ID_INSTANCE` | Your GreenAPI instance ID | `7105319958` |
| `VITE_GREEN_API_TOKEN` | Your GreenAPI API token | `YOUR_TOKEN_HERE` |

## Setting Up on Netlify

### Method 1: Using Netlify Web Dashboard

#### Step 1: Navigate to Environment Settings

1. Log in to [Netlify](https://app.netlify.com)
2. Select your site
3. Go to **Site settings** (top menu)
4. Click **Build & deploy** in the left sidebar
5. Click **Environment** section

#### Step 2: Add Variables

1. Click **Edit variables** button
2. Add each variable:

```
Key: VITE_GREEN_API_URL
Value: https://7105.api.greenapi.com
```

```
Key: VITE_GREEN_MEDIA_URL
Value: https://7105.media.greenapi.com
```

```
Key: VITE_GREEN_ID_INSTANCE
Value: YOUR_INSTANCE_ID
```

```
Key: VITE_GREEN_API_TOKEN
Value: YOUR_API_TOKEN
```

3. Click **Save** after each variable

#### Step 3: Redeploy

1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. Wait for build to complete
4. Variables will be available during build and at runtime

### Method 2: Using Netlify CLI

#### Step 1: Set Variables

```bash
netlify env:set VITE_GREEN_API_URL "https://7105.api.greenapi.com"
netlify env:set VITE_GREEN_MEDIA_URL "https://7105.media.greenapi.com"
netlify env:set VITE_GREEN_ID_INSTANCE "YOUR_INSTANCE_ID"
netlify env:set VITE_GREEN_API_TOKEN "YOUR_API_TOKEN"
```

#### Step 2: Verify Variables

```bash
netlify env:list
```

This will show all set variables.

#### Step 3: Redeploy

```bash
netlify deploy --prod
```

### Method 3: Using netlify.toml

You can also set variables in `netlify.toml`:

```toml
[context.production.environment]
  VITE_GREEN_API_URL = "https://7105.api.greenapi.com"
  VITE_GREEN_MEDIA_URL = "https://7105.media.greenapi.com"
  VITE_GREEN_ID_INSTANCE = "YOUR_INSTANCE_ID"
  VITE_GREEN_API_TOKEN = "YOUR_API_TOKEN"
```

**Note**: This method is NOT recommended for sensitive values like API tokens. Use the dashboard or CLI instead.

## Getting Your GreenAPI Credentials

### Instance ID

1. Log in to [GreenAPI Dashboard](https://app.green-api.com/)
2. Go to **My Instances**
3. Find your instance
4. Copy the **Instance ID** (e.g., `7105319958`)

### API Token

1. In GreenAPI Dashboard, go to **API Settings**
2. Find your instance
3. Copy the **API Token**
4. Keep this secure - never share it

## Verification

### Test Variables Are Set

1. After deployment, go to **Deploys** tab
2. Click the latest deploy
3. Check the build log for environment variables being used
4. Look for messages like: "Using environment variable VITE_GREEN_API_URL"

### Test WhatsApp Integration

1. Visit your deployed site
2. Create a user profile
3. Click "J'y vais" on an event
4. Verify WhatsApp message is received

## Troubleshooting

### Variables Not Working

**Problem**: WhatsApp messages not sending after deployment

**Solutions**:
1. Verify variables are set in Netlify dashboard
2. Check variable names are exactly correct (case-sensitive)
3. Ensure values don't have extra spaces
4. Redeploy after changing variables
5. Check browser console for error messages

### Build Fails with Missing Variables

**Problem**: Build fails with "GreenAPI configuration is missing"

**Solutions**:
1. Verify all 4 variables are set
2. Check for typos in variable names
3. Ensure values are not empty
4. Redeploy to apply changes

### API Token Exposed

**Problem**: You accidentally committed your API token

**Solutions**:
1. Immediately rotate your token in GreenAPI dashboard
2. Update the token in Netlify environment variables
3. Remove the token from git history (use `git filter-branch` or `BFG Repo-Cleaner`)
4. Force push to repository

## Best Practices

### Security

1. **Never commit credentials**: Use `.env` in `.gitignore`
2. **Use Netlify dashboard**: More secure than netlify.toml
3. **Rotate tokens regularly**: Change API token every 90 days
4. **Monitor usage**: Check GreenAPI dashboard for suspicious activity
5. **Use strong tokens**: Ensure your API token is complex

### Organization

1. **Use consistent naming**: Prefix with `VITE_` for Vite exposure
2. **Document variables**: Keep a list of what each variable does
3. **Version control**: Track which variables are needed in README
4. **Test locally**: Always test with `.env` before deploying

### Maintenance

1. **Regular reviews**: Check and update credentials quarterly
2. **Audit access**: Monitor who has access to environment variables
3. **Backup tokens**: Store backup tokens securely (password manager)
4. **Update documentation**: Keep this guide updated

## Different Environments

### Development

Use `.env` file locally:
```
VITE_GREEN_API_URL="https://7105.api.greenapi.com"
VITE_GREEN_MEDIA_URL="https://7105.media.greenapi.com"
VITE_GREEN_ID_INSTANCE="YOUR_DEV_INSTANCE"
VITE_GREEN_API_TOKEN="YOUR_DEV_TOKEN"
```

### Production (Netlify)

Use Netlify dashboard or CLI to set variables.

### Staging (Optional)

If you have a staging site on Netlify:

```bash
netlify env:set VITE_GREEN_API_TOKEN "YOUR_STAGING_TOKEN" --context=deploy-preview
```

## Support

- Netlify Docs: https://docs.netlify.com/configure-builds/environment-variables/
- GreenAPI Docs: https://green-api.com/en/docs/
- Netlify Support: https://support.netlify.com/

## Checklist

Before going live:

- [ ] All 4 environment variables are set
- [ ] Variables are set in Netlify (not just netlify.toml)
- [ ] Build completes successfully
- [ ] WhatsApp integration works on production site
- [ ] No credentials are in git repository
- [ ] .env is in .gitignore
- [ ] Documentation is updated
- [ ] Team members know how to update variables

---

**Last Updated**: January 15, 2025
