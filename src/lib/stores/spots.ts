import { writable, derived, get } from 'svelte/store';
import type { Category, Spot } from '$lib/types';
import {
    getCategoriesWithSpots,
    createCategory as createCategoryInDb,
    updateCategory as updateCategoryInDb,
    deleteCategory as deleteCategoryInDb,
    createSpot as createSpotInDb,
    updateSpot as updateSpotInDb,
    deleteSpot as deleteSpotInDb,
    subscribeToCategories,
    subscribeToSpots,
    unsubscribeAll,
    type Category as DbCategory,
    type Spot as DbSpot
} from '$lib/supabase';

// Core state
export const categories = writable<Category[]>([]);
export const loading = writable(false);

// Derived state
export const totalSpots = derived(categories, $categories => 
    $categories.reduce((sum, cat) => sum + cat.spots.length, 0)
);

// Transform DB format to local format
function dbCategoryToLocal(cat: DbCategory, spots: Spot[] = []): Category {
    return {
        id: cat.id,
        name: cat.name,
        expanded: cat.expanded,
        display_order: cat.display_order,
        spots
    };
}

function dbSpotToLocal(spot: DbSpot): Spot {
    return {
        id: spot.id,
        name: spot.name,
        address: spot.address || '',
        lat: spot.lat,
        lng: spot.lng,
        placeId: spot.place_id || '',
        display_order: spot.display_order
    };
}

// Load all data from Supabase
export async function loadCategories() {
    loading.set(true);
    const { data, error } = await getCategoriesWithSpots();
    
    if (error) {
        console.error('Error loading categories:', error);
        loading.set(false);
        throw error;
    }
    
    if (data) {
        categories.set(data.map(cat => ({
            id: cat.id,
            name: cat.name,
            expanded: cat.expanded,
            display_order: cat.display_order,
            spots: cat.spots.map((spot: any) => dbSpotToLocal(spot))
        })));
    }
    
    loading.set(false);
}

// Clear all data (on logout)
export function clearCategories() {
    categories.set([]);
}

// Category operations
export async function addCategory(name: string): Promise<Category> {
    const currentCategories = get(categories);
    const { data, error } = await createCategoryInDb(name, currentCategories.length);
    
    if (error) throw error;
    if (!data) throw new Error('No data returned');
    
    const newCategory = dbCategoryToLocal(data, []);
    categories.update(cats => [...cats, newCategory].sort((a, b) => 
        (a.display_order || 0) - (b.display_order || 0)
    ));
    
    return newCategory;
}

export async function removeCategory(id: string) {
    const { error } = await deleteCategoryInDb(id);
    if (error) throw error;
    
    categories.update(cats => cats.filter(c => c.id !== id));
}

export async function updateCategoryOrder(id: string, newOrder: number) {
    await updateCategoryInDb(id, { display_order: newOrder });
}

export async function toggleCategoryExpanded(id: string) {
    const currentCategories = get(categories);
    const category = currentCategories.find(c => c.id === id);
    if (!category) return;
    
    const newExpanded = !category.expanded;
    await updateCategoryInDb(id, { expanded: newExpanded });
    
    categories.update(cats => cats.map(c => 
        c.id === id ? { ...c, expanded: newExpanded } : c
    ));
}

// Spot operations
export async function addSpot(categoryId: string, spot: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    placeId: string;
}): Promise<Spot> {
    const currentCategories = get(categories);
    const category = currentCategories.find(c => c.id === categoryId);
    if (!category) throw new Error('Category not found');
    
    const { data, error } = await createSpotInDb({
        category_id: categoryId,
        name: spot.name,
        address: spot.address,
        lat: spot.lat,
        lng: spot.lng,
        place_id: spot.placeId,
        display_order: category.spots.length
    });
    
    if (error) throw error;
    if (!data) throw new Error('No data returned');
    
    const newSpot = dbSpotToLocal(data);
    
    categories.update(cats => cats.map(c => {
        if (c.id === categoryId) {
            return {
                ...c,
                spots: [...c.spots, newSpot].sort((a, b) => 
                    (a.display_order || 0) - (b.display_order || 0)
                )
            };
        }
        return c;
    }));
    
    return newSpot;
}

export async function removeSpot(categoryId: string, spotId: string) {
    const { error } = await deleteSpotInDb(spotId);
    if (error) throw error;
    
    categories.update(cats => cats.map(c => {
        if (c.id === categoryId) {
            return { ...c, spots: c.spots.filter(s => s.id !== spotId) };
        }
        return c;
    }));
}

export async function updateSpotName(spotId: string, name: string) {
    await updateSpotInDb(spotId, { name });
    
    categories.update(cats => cats.map(c => ({
        ...c,
        spots: c.spots.map(s => s.id === spotId ? { ...s, name } : s)
    })));
}

export async function updateSpotOrder(spotId: string, newOrder: number) {
    await updateSpotInDb(spotId, { display_order: newOrder });
}

// Real-time subscription handlers
let unsubCats: (() => void) | null = null;
let unsubSpots: (() => void) | null = null;

export function setupRealtimeSubscriptions() {
    unsubCats = subscribeToCategories((payload) => {
        const { eventType } = payload;
        const newData = payload.new as DbCategory | null;
        const oldData = payload.old as DbCategory | null;
        
        categories.update(cats => {
            switch (eventType) {
                case 'INSERT':
                    if (newData && !cats.find(c => c.id === newData.id)) {
                        return [...cats, dbCategoryToLocal(newData, [])]
                            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                    }
                    break;
                case 'UPDATE':
                    if (newData) {
                        return cats.map(c => c.id === newData.id 
                            ? { ...c, name: newData.name, expanded: newData.expanded, display_order: newData.display_order }
                            : c
                        ).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                    }
                    break;
                case 'DELETE':
                    if (oldData) {
                        return cats.filter(c => c.id !== oldData.id);
                    }
                    break;
            }
            return cats;
        });
    });

    unsubSpots = subscribeToSpots((payload) => {
        const { eventType } = payload;
        const newData = payload.new as DbSpot | null;
        const oldData = payload.old as DbSpot | null;
        
        categories.update(cats => {
            switch (eventType) {
                case 'INSERT':
                    if (newData) {
                        return cats.map(c => {
                            if (c.id === newData.category_id && !c.spots.find(s => s.id === newData.id)) {
                                return {
                                    ...c,
                                    spots: [...c.spots, dbSpotToLocal(newData)]
                                        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                                };
                            }
                            return c;
                        });
                    }
                    break;
                case 'UPDATE':
                    if (newData) {
                        return cats.map(c => ({
                            ...c,
                            spots: c.spots.map(s => s.id === newData.id 
                                ? { ...s, name: newData.name, address: newData.address || '', display_order: newData.display_order }
                                : s
                            ).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                        }));
                    }
                    break;
                case 'DELETE':
                    if (oldData) {
                        return cats.map(c => ({
                            ...c,
                            spots: c.spots.filter(s => s.id !== oldData.id)
                        }));
                    }
                    break;
            }
            return cats;
        });
    });
}

export function cleanupRealtimeSubscriptions() {
    unsubCats?.();
    unsubSpots?.();
    unsubCats = null;
    unsubSpots = null;
    unsubscribeAll();
}
