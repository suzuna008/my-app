# Fix: redirect_uri_mismatch Error

## The Problem
Google is rejecting the OAuth request because the redirect URI in your Google Cloud Console doesn't match what Supabase is sending.

## The Solution

You need to add the **exact** Supabase callback URL to your Google OAuth Client configuration.

### Step 1: Get Your Supabase Callback URL

Your Supabase callback URL is:
```
https://wbyfmkrjmpabxxalgxhf.supabase.co/auth/v1/callback
```

### Step 2: Add It to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your **OAuth 2.0 Client ID** (the one you're using for Supabase)
5. Under **Authorized redirect URIs**, add:
   ```
   https://wbyfmkrjmpabxxalgxhf.supabase.co/auth/v1/callback
   ```
6. **Important**: Make sure there are no trailing slashes or extra spaces
7. Click **Save**

### Step 3: For Local Development (Optional)

If you're testing locally, you may also need to add your local Supabase callback URL. However, if you're using the hosted Supabase (which you are), you typically only need the production callback URL above.

If you're running Supabase locally, add:
```
http://localhost:54321/auth/v1/callback
```

### Step 4: Verify

1. Make sure the redirect URI in Google Cloud Console **exactly** matches:
   `https://wbyfmkrjmpabxxalgxhf.supabase.co/auth/v1/callback`
2. Try signing in with Google again

## Common Mistakes

❌ **Wrong**: `https://wbyfmkrjmpabxxalgxhf.supabase.co/auth/v1/callback/` (trailing slash)
❌ **Wrong**: `https://wbyfmkrjmpabxxalgxhf.supabase.co/auth/v1/callback ` (trailing space)
❌ **Wrong**: `http://wbyfmkrjmpabxxalgxhf.supabase.co/auth/v1/callback` (http instead of https)
✅ **Correct**: `https://wbyfmkrjmpabxxalgxhf.supabase.co/auth/v1/callback`

## Still Having Issues?

1. Double-check that the redirect URI in Google Cloud Console matches exactly
2. Make sure you saved the changes in Google Cloud Console
3. Wait a few minutes for changes to propagate
4. Clear your browser cache and try again
