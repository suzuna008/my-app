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

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null; // From Google OAuth (given_name)
  last_name: string | null; // From Google OAuth (family_name)
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  date_of_birth: string | null;
  website: string | null;
  // Auto-collectible fields
  locale: string | null; // From Google OAuth or browser
  timezone: string | null; // From browser
  language: string | null; // From browser navigator.language
  user_agent: string | null; // Browser/device info
  last_login_at: string | null; // Track login times
  last_activity_at: string | null; // Track last app interaction
  email_confirmed_at: string | null; // From auth.users
  account_created_at: string | null; // From auth.users.created_at
  sign_in_count: number | null; // Count logins
  provider: string | null; // 'google', 'email', etc.
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

// Profile operations
export async function getProfile(userId?: string) {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };
  
  const targetUserId = userId || user.id;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();
  return { data, error };
}

export async function updateProfile(updates: Partial<Profile>) {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  return { data, error };
}

export async function upsertProfile(profile: Partial<Profile>) {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };
  
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...profile })
    .select()
    .single();
  return { data, error };
}

// Track user activity (call this periodically or on key interactions)
export async function updateLastActivity() {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };
  
  const { data, error } = await supabase
    .from('profiles')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single();
  return { data, error };
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

// Tag operations
export async function getTags() {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };
  
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true });
  return { data, error };
}

export async function createTag(name: string) {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };
  
  // Check if tag already exists for this user
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name.trim())
    .single();
  
  if (existing) {
    return { data: existing, error: null };
  }
  
  const { data, error } = await supabase
    .from('tags')
    .insert({ name: name.trim(), user_id: user.id })
    .select()
    .single();
  return { data, error };
}

export async function deleteTag(id: string) {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id);
  return { error };
}

// Spot-Tag relationship operations
export async function addTagToSpot(spotId: string, tagId: string) {
  // Check if the relationship already exists
  const { data: existing } = await supabase
    .from('spot_tags')
    .select('spot_id, tag_id')
    .eq('spot_id', spotId)
    .eq('tag_id', tagId)
    .single();
  
  // If it already exists, return success without inserting
  if (existing) {
    return { data: existing, error: null };
  }
  
  // Otherwise, insert the new relationship
  const { data, error } = await supabase
    .from('spot_tags')
    .insert({ spot_id: spotId, tag_id: tagId })
    .select()
    .single();
  return { data, error };
}

export async function removeTagFromSpot(spotId: string, tagId: string) {
  const { error } = await supabase
    .from('spot_tags')
    .delete()
    .eq('spot_id', spotId)
    .eq('tag_id', tagId);
  return { error };
}

export async function getSpotTags(spotId: string) {
  const { data, error } = await supabase
    .from('spot_tags')
    .select(`
      tag_id,
      tags:tags(id, name)
    `)
    .eq('spot_id', spotId);
  
  if (error) return { data: null, error };
  
  const tags = (data || []).map((item: any) => ({
    id: item.tags.id,
    name: item.tags.name
  }));
  
  return { data: tags, error: null };
}

export async function getSpotsByTag(tagId: string) {
  const { data, error } = await supabase
    .from('spot_tags')
    .select(`
      spot_id,
      spots:spots(*)
    `)
    .eq('tag_id', tagId);
  
  if (error) return { data: null, error };
  
  const spots = (data || []).map((item: any) => item.spots);
  return { data: spots, error: null };
}

// Get all categories with their spots (including tags)
export async function getCategoriesWithSpots() {
  const { data: categories, error: catError } = await getCategories();
  if (catError || !categories) return { data: null, error: catError };
  
  const { data: spots, error: spotError } = await getSpots();
  if (spotError) return { data: null, error: spotError };
  
  // Get all tags for all spots
  const spotIds = (spots || []).map(s => s.id);
  const { data: spotTagsData } = await supabase
    .from('spot_tags')
    .select(`
      spot_id,
      tags:tags(id, name)
    `)
    .in('spot_id', spotIds);
  
  // Create a map of spot_id -> tags[]
  const tagsMap = new Map<string, Array<{ id: string; name: string }>>();
  (spotTagsData || []).forEach((item: any) => {
    if (!tagsMap.has(item.spot_id)) {
      tagsMap.set(item.spot_id, []);
    }
    tagsMap.get(item.spot_id)!.push({
      id: item.tags.id,
      name: item.tags.name
    });
  });
  
  // Group spots by category and add tags
  const categoriesWithSpots = categories.map(cat => ({
    ...cat,
    spots: (spots || [])
      .filter(spot => spot.category_id === cat.id)
      .map(spot => ({
        ...spot,
        tags: tagsMap.get(spot.id) || []
      }))
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
