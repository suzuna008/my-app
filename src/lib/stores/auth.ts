import { writable } from 'svelte/store';
import { supabase, getProfile, updateProfile, type Profile } from '$lib/supabase';
import type { User } from '@supabase/supabase-js';

// Create a writable store for the user
export const user = writable<User | null>(null);
export const profile = writable<Profile | null>(null);
export const loading = writable(true);

// Collect browser/environment data
function collectBrowserData() {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language || navigator.languages?.[0] || 'en',
    user_agent: navigator.userAgent
  };
}

// Load profile for the current user
async function loadProfile(userId: string) {
  const { data, error } = await getProfile(userId);
  if (error) {
    console.error('Error loading profile:', error);
    profile.set(null);
    return;
  }

  const currentUser = await supabase.auth.getUser();
  if (!currentUser.data.user) {
    profile.set(data);
    return;
  }

  const browserData = collectBrowserData();
  const updates: any = {};

  // Sync email from auth if missing
  if (!data?.email && currentUser.data.user.email) {
    updates.email = currentUser.data.user.email;
  }

  // Update last login time
  updates.last_login_at = new Date().toISOString();
  
  // Increment sign in count
  updates.sign_in_count = (data?.sign_in_count || 0) + 1;

  // Sync browser data if missing
  if (!data?.timezone && browserData.timezone) {
    updates.timezone = browserData.timezone;
  }
  if (!data?.language && browserData.language) {
    updates.language = browserData.language;
  }
  if (!data?.user_agent && browserData.user_agent) {
    updates.user_agent = browserData.user_agent;
  }

  // Sync email_confirmed_at from auth
  if (currentUser.data.user.email_confirmed_at && !data?.email_confirmed_at) {
    updates.email_confirmed_at = currentUser.data.user.email_confirmed_at;
  }

  // Sync account_created_at from auth
  if (currentUser.data.user.created_at && !data?.account_created_at) {
    updates.account_created_at = currentUser.data.user.created_at;
  }

  // Update provider if available
  const provider = currentUser.data.user.app_metadata?.provider || 
                   currentUser.data.user.user_metadata?.provider || 
                   'email';
  if (!data?.provider || data.provider !== provider) {
    updates.provider = provider;
  }

  // Sync locale from Google OAuth metadata if available
  const locale = currentUser.data.user.user_metadata?.locale;
  if (locale && !data?.locale) {
    updates.locale = locale;
  }

  // Sync first_name and last_name from Google OAuth if available
  const givenName = currentUser.data.user.user_metadata?.given_name;
  const familyName = currentUser.data.user.user_metadata?.family_name;
  if (givenName && !data?.first_name) {
    updates.first_name = givenName;
  }
  if (familyName && !data?.last_name) {
    updates.last_name = familyName;
  }

  // Only update if there are changes
  if (Object.keys(updates).length > 0) {
    await updateProfile(updates);
    // Reload profile with updated data
    const { data: updatedData } = await getProfile(userId);
    profile.set(updatedData);
  } else {
    profile.set(data);
  }
}

// Initialize auth state
export async function initAuth() {
  loading.set(true);
  
  // Get initial session
  const { data: { session } } = await supabase.auth.getSession();
  user.set(session?.user ?? null);
  
  // Load profile if user is logged in
  if (session?.user) {
    await loadProfile(session.user.id);
  } else {
    profile.set(null);
  }
  
  loading.set(false);
  
  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (_event, session) => {
    user.set(session?.user ?? null);
    
    // Load profile when user logs in, clear when they log out
    if (session?.user) {
      await loadProfile(session.user.id);
    } else {
      profile.set(null);
    }
  });
}

// Refresh profile data
export async function refreshProfile() {
  const currentUser = await supabase.auth.getUser();
  if (currentUser.data.user) {
    await loadProfile(currentUser.data.user.id);
  }
}
