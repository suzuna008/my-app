# Setup Google OAuth for Supabase

## Current Status
✅ Google sign-in is **enabled** in Supabase  
❌ **Missing**: Google Client ID (required)

## Step 1: Get Google OAuth Credentials

### Prerequisites Setup

1. **Prepare Google Cloud Project**
   - Go to [Google Cloud Platform](https://console.cloud.google.com/)
   - Create a new project if necessary

2. **Configure OAuth Consent Screen**
   - Go to **APIs & Services** → **OAuth consent screen**
   - Choose "External" (for public apps) or "Internal" (for Google Workspace)
   - Fill in required fields:
     - App name
     - Support email
     - Developer contact information
   - Add your email as a test user (if using External)

3. **Setup Required Scopes**
   - Go to **Data Access (Scopes)** screen
   - Ensure these scopes are configured:
     - `openid` (add manually if not present)
     - `.../auth/userinfo.email` (added by default)
     - `.../auth/userinfo.profile` (added by default)

### Create OAuth Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth 2.0 Client ID**
3. Choose **Web application** as the application type
4. Configure:
   - **Name**: Your app name (e.g., "My App - Supabase")
   - **Authorized JavaScript origins**: Add your application URLs
     - For local dev: `http://localhost:5173` (or your dev port)
     - For production: `https://yourdomain.com`
   - **Authorized redirect URIs**: Add:
     ```
     https://wbyfmkrjmpabxxalgxhf.supabase.co/auth/v1/callback
     ```
     For local development, also add:
     ```
     http://localhost:3000/auth/v1/callback
     ```
5. Click **Create**
6. **Copy both**:
   - **Client ID** (looks like: `123456789-abcdefg.apps.googleusercontent.com`)
   - **Client Secret** (click "Show" to reveal it)

## Step 2: Configure in Supabase

### Option A: Via Dashboard (Easiest)
1. Go back to your Supabase dashboard → **Authentication** → **Providers** → **Google**
2. Paste the **Client ID** into the **"Client IDs"** field
3. Paste the **Client Secret** into the **"Client Secret (for OAuth)"** field
4. Click **Save**

### Option B: Via Management API
If you have a Supabase access token, you can run:
```bash
# Set environment variables
export SUPABASE_ACCESS_TOKEN=your_supabase_token
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_CLIENT_SECRET=your_google_client_secret

# Run the configuration script
node configure-google-auth.js
```

To get your Supabase access token:
1. Go to https://supabase.com/dashboard/account/tokens
2. Click **Generate new token**
3. Give it a name and ensure it has `auth:write` scope
4. Copy the token

## That's it!
Once the Client ID is added, Google Sign-In will work in your app.
