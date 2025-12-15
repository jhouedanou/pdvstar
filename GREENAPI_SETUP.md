# GreenAPI Setup Guide

This guide explains how to set up WhatsApp integration using GreenAPI.

## What is GreenAPI?

GreenAPI is a service that provides WhatsApp API integration, allowing you to send messages programmatically via WhatsApp.

## Getting Started

### Step 1: Create a GreenAPI Account

1. Visit [GreenAPI](https://green-api.com/)
2. Sign up for a free account
3. Verify your account via email

### Step 2: Get Your Credentials

After logging in to GreenAPI dashboard:

1. **Instance ID**: Found in your account dashboard under "My Instances"
2. **API Token**: Generated in the API settings section

### Step 3: Configure Your WhatsApp Account

1. In GreenAPI dashboard, link your WhatsApp Business account
2. Verify your phone number
3. Get the account ready for API integration

### Step 4: Update Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and replace the placeholder values:

```
VITE_GREEN_API_URL="https://7105.api.greenapi.com"
VITE_GREEN_MEDIA_URL="https://7105.media.greenapi.com"
VITE_GREEN_ID_INSTANCE="YOUR_INSTANCE_ID"
VITE_GREEN_API_TOKEN="YOUR_API_TOKEN"
```

### Step 5: Test the Integration

1. Start the development server: `npm run dev`
2. Open the app in your browser
3. Create a user profile with a valid phone number
4. Click "J'y vais" on an event
5. Check if you receive a WhatsApp message

## Message Format

When a user clicks "J'y vais", the following message is sent:

```
🎉 Nouvel inscrit pour l'événement "[Event Name]"
📍 Lieu: [Location]
👤 Nom: [User Name]
📱 Téléphone: [User Phone]
⏰ [Timestamp]
```

## Troubleshooting

### Message not sending?

1. **Check credentials**: Verify your Instance ID and API Token are correct
2. **Phone format**: Ensure phone numbers are in international format (e.g., +22545029721)
3. **API limits**: Check if you've exceeded your API quota
4. **Network**: Ensure your server can reach GreenAPI endpoints

### Common Errors

- **"GreenAPI configuration is missing"**: Check your `.env` file has all required variables
- **"Phone number must be in international format"**: Add country code to phone number
- **"Invalid API Token"**: Verify your token in GreenAPI dashboard

## Security Best Practices

1. **Never commit `.env`**: The file is in `.gitignore` for security
2. **Use environment variables**: On Netlify, set variables in Site settings
3. **Rotate tokens**: Periodically change your API token
4. **Monitor usage**: Check GreenAPI dashboard for suspicious activity

## API Documentation

For more details, visit [GreenAPI Documentation](https://green-api.com/en/docs/)

## Support

- GreenAPI Support: https://green-api.com/en/support/
- Documentation: https://green-api.com/en/docs/
