import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { User } from '@supabase/supabase-js';

// Create a writable store for the user
export const user = writable<User | null>(null);
export const loading = writable(true);

// Initialize auth state
export async function initAuth() {
  loading.set(true);
  
  // Get initial session
  const { data: { session } } = await supabase.auth.getSession();
  user.set(session?.user ?? null);
  loading.set(false);
  
  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    user.set(session?.user ?? null);
  });
}
