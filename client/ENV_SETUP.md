# Client Environment Setup

This document explains how to configure the Torrent Hunt client for local development.

## Prerequisites

You need to have the following from your Auth0 and Google Cloud setup:
- Auth0 domain (e.g., `your-domain.us.auth0.com`)
- Auth0 application client ID
- Auth0 API audience identifier
- Google Cloud OAuth 2.0 Client ID
- Main API base URL (default: `http://localhost:3000`)

## Configuration Files

### `.env.local` (Development - **Do not commit**)
This file contains your actual credentials for local development. It's ignored by git.

```bash
VITE_AUTH0_DOMAIN=your-auth0-domain.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_CALLBACK_URL=http://localhost:5173
VITE_AUTH_IDENTIFIER=https://your-api-identifier
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_ENVIRONMENT=development
```

### `.env.example` (Reference)
This file documents all required environment variables without sensitive values.

## Setup Steps

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your credentials:**
   - Get your Auth0 domain from your Auth0 tenant
   - Get your client ID from the Auth0 application settings
   - Get the API identifier (audience) from your Auth0 API settings
   - Get your Google Client ID from Google Cloud Console
   - Set the API base URL (usually `http://localhost:3000` for local development)

3. **Start the dev server:**
   ```bash
   npm run dev
   ```

The Vite dev server will automatically load the environment variables from `.env.local`.

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_AUTH0_DOMAIN` | Auth0 tenant domain | `your-domain.us.auth0.com` |
| `VITE_AUTH0_CLIENT_ID` | Auth0 SPA application ID | `abc123xyz` |
| `VITE_AUTH0_CALLBACK_URL` | OAuth redirect URL | `http://localhost:5173` |
| `VITE_AUTH_IDENTIFIER` | Auth0 API audience | `https://api.torrenthunt.local` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | `123.apps.googleusercontent.com` |
| `VITE_API_BASE_URL` | Main API endpoint | `http://localhost:3000` |
| `VITE_APP_ENVIRONMENT` | Environment mode | `development`, `staging`, or `production` |

## Troubleshooting

### "Invalid configuration. Check your environment variables."
- Ensure all required variables in `.env.local` are set
- Verify they're not empty or undefined
- Check that URLs are valid (http/https protocol required for `VITE_AUTH0_CALLBACK_URL` and `VITE_API_BASE_URL`)

### Changes not reflected
- Environment variables are loaded at build/dev server startup
- Restart the dev server after changing `.env.local`:
  ```bash
  # Stop the dev server (Ctrl+C)
  npm run dev
  ```

## Production Deployment

For production builds, use GitHub Secrets or your platform's environment variable management:
- Set the same `VITE_*` environment variables in your CI/CD pipeline
- Never commit `.env.local` to version control
- Always use `.env.example` as documentation for required variables
