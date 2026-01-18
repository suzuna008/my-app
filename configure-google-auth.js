#!/usr/bin/env node

/**
 * Configure Google OAuth in Supabase via Management API
 * 
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=your_token GOOGLE_CLIENT_ID=your_id GOOGLE_CLIENT_SECRET=your_secret node configure-google-auth.js
 * 
 * Or set them in a .env file:
 *   SUPABASE_ACCESS_TOKEN=...
 *   GOOGLE_CLIENT_ID=...
 *   GOOGLE_CLIENT_SECRET=...
 */

const SUPABASE_PROJECT_REF = 'wbyfmkrjmpabxxalgxhf';
const SUPABASE_API_URL = 'https://api.supabase.com';

async function configureGoogleAuth() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!accessToken) {
    console.error('❌ Error: SUPABASE_ACCESS_TOKEN is required');
    console.log('\n📝 Get your token from: https://supabase.com/dashboard/account/tokens');
    console.log('   Make sure it has "auth:write" scope');
    process.exit(1);
  }

  if (!googleClientId) {
    console.error('❌ Error: GOOGLE_CLIENT_ID is required');
    console.log('\n📝 Get your Google Client ID from: https://console.cloud.google.com/apis/credentials');
    console.log('   See setup-google-auth.md for detailed instructions');
    process.exit(1);
  }

  if (!googleClientSecret) {
    console.warn('⚠️  Warning: GOOGLE_CLIENT_SECRET not provided');
    console.log('   Client Secret is required for OAuth flow on the web');
    console.log('   Get it from the same place as your Client ID');
  }

  const url = `${SUPABASE_API_URL}/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`;
  
  const payload = {
    external_google_enabled: true,
    external_google_client_id: googleClientId,
  };

  // Add client secret if provided (required for OAuth flow)
  if (googleClientSecret) {
    payload.external_google_secret = googleClientSecret;
  }

  try {
    console.log('🔄 Configuring Google OAuth...');
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log('✅ Google OAuth configured successfully!');
    console.log(`   Client ID: ${googleClientId}`);
    console.log('\n🎉 Google Sign-In is now ready to use in your app!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

configureGoogleAuth();
