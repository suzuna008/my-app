import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wbyfmkrjmpabxxalgxhf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndieWZta3JqbXBhYnh4YWxneGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTkxMjMsImV4cCI6MjA4Mzg3NTEyM30.9nWlPWOEwcRiuir1bYVMibvxUEBiOEem-6mP82Vvca4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database
export interface Category {
  id: string;
  user_id: string;
  name: string;
  display_order: number;
  expanded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Spot {
  id: string;
  category_id: string;
  user_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  place_id: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Auth helpers
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/v1/callback`
    }
  })
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Category operations
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });
  return { data, error };
}

export async function createCategory(name: string, displayOrder: number = 0) {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };
  
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, display_order: displayOrder, user_id: user.id })
    .select()
    .single();
  return { data, error };
}

export async function updateCategory(id: string, updates: Partial<Category>) {
  const { data, error } = await supabase
    .from('categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  return { error };
}

// Spot operations
export async function getSpots(categoryId?: string) {
  let query = supabase
    .from('spots')
    .select('*')
    .order('display_order', { ascending: true });
  
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  
  const { data, error } = await query;
  return { data, error };
}

export async function createSpot(spot: {
  category_id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  place_id?: string;
  display_order?: number;
}) {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };
  
  const { data, error } = await supabase
    .from('spots')
    .insert({ ...spot, user_id: user.id })
    .select()
    .single();
  return { data, error };
}

export async function updateSpot(id: string, updates: Partial<Spot>) {
  const { data, error } = await supabase
    .from('spots')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteSpot(id: string) {
  const { error } = await supabase
    .from('spots')
    .delete()
    .eq('id', id);
  return { error };
}

// Get all categories with their spots
export async function getCategoriesWithSpots() {
  const { data: categories, error: catError } = await getCategories();
  if (catError || !categories) return { data: null, error: catError };
  
  const { data: spots, error: spotError } = await getSpots();
  if (spotError) return { data: null, error: spotError };
  
  // Group spots by category
  const categoriesWithSpots = categories.map(cat => ({
    ...cat,
    spots: (spots || []).filter(spot => spot.category_id === cat.id)
  }));
  
  return { data: categoriesWithSpots, error: null };
}

// Real-time subscriptions
export type RealtimeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'categories' | 'spots';
  new: Category | Spot | null;
  old: Category | Spot | null;
}) => void;

let categoriesChannel: ReturnType<typeof supabase.channel> | null = null;
let spotsChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToCategories(callback: RealtimeCallback) {
  // Unsubscribe from existing channel if any
  if (categoriesChannel) {
    supabase.removeChannel(categoriesChannel);
  }

  categoriesChannel = supabase
    .channel('categories-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'categories'
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          table: 'categories',
          new: payload.new as Category | null,
          old: payload.old as Category | null
        });
      }
    )
    .subscribe();

  return () => {
    if (categoriesChannel) {
      supabase.removeChannel(categoriesChannel);
      categoriesChannel = null;
    }
  };
}

export function subscribeToSpots(callback: RealtimeCallback) {
  // Unsubscribe from existing channel if any
  if (spotsChannel) {
    supabase.removeChannel(spotsChannel);
  }

  spotsChannel = supabase
    .channel('spots-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'spots'
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          table: 'spots',
          new: payload.new as Spot | null,
          old: payload.old as Spot | null
        });
      }
    )
    .subscribe();

  return () => {
    if (spotsChannel) {
      supabase.removeChannel(spotsChannel);
      spotsChannel = null;
    }
  };
}

export function unsubscribeAll() {
  if (categoriesChannel) {
    supabase.removeChannel(categoriesChannel);
    categoriesChannel = null;
  }
  if (spotsChannel) {
    supabase.removeChannel(spotsChannel);
    spotsChannel = null;
  }
}
