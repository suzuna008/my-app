import { writable, derived, get } from 'svelte/store';
import type { Category, Spot, Tag } from '$lib/types';
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
    getTags as getTagsFromDb,
    createTag as createTagInDb,
    deleteTag as deleteTagInDb,
    addTagToSpot as addTagToSpotInDb,
    removeTagFromSpot as removeTagFromSpotInDb,
    type Category as DbCategory,
    type Spot as DbSpot
} from '$lib/supabase';

// Default category names
const DEFAULT_CATEGORIES = ['Favourite', 'Blacklist'];

// Core state
export const categories = writable<Category[]>([]);
export const loading = writable(false);
export const tags = writable<Tag[]>([]);
export const selectedTagFilter = writable<string | null>(null);

// Derived state
export const totalSpots = derived(categories, $categories => 
    $categories.reduce((sum, cat) => sum + cat.spots.length, 0)
);

// Filtered categories based on selected tag
export const filteredCategories = derived(
    [categories, selectedTagFilter],
    ([$categories, $selectedTagFilter]) => {
        if (!$selectedTagFilter) {
            return $categories;
        }
        
        return $categories.map(cat => ({
            ...cat,
            spots: cat.spots.filter(spot => 
                spot.tags?.some(tag => tag.id === $selectedTagFilter)
            )
        })).filter(cat => cat.spots.length > 0);
    }
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

function dbSpotToLocal(spot: DbSpot & { tags?: Tag[] }): Spot {
    return {
        id: spot.id,
        name: spot.name,
        address: spot.address || '',
        lat: spot.lat,
        lng: spot.lng,
        placeId: spot.place_id || '',
        display_order: spot.display_order,
        tags: spot.tags || []
    };
}

// Ensure default categories exist
async function ensureDefaultCategories(existingCategories: Category[]) {
    const existingNames = existingCategories.map(c => c.name.toLowerCase());
    const newCategories: Category[] = [];
    
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        const defaultName = DEFAULT_CATEGORIES[i];
        if (!existingNames.includes(defaultName.toLowerCase())) {
            try {
                const { data, error } = await createCategoryInDb(defaultName, i);
                if (error) {
                    console.error(`Error creating default category ${defaultName}:`, error);
                } else if (data) {
                    const newCategory = dbCategoryToLocal(data, []);
                    newCategories.push(newCategory);
                }
            } catch (e) {
                console.error(`Failed to create default category ${defaultName}:`, e);
            }
        }
    }
    
    // Update store with new default categories if any were created
    if (newCategories.length > 0) {
        categories.update(cats => {
            const updated = [...cats, ...newCategories];
            return updated.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        });
    }
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
        const loadedCategories = data.map(cat => ({
            id: cat.id,
            name: cat.name,
            expanded: cat.expanded,
            display_order: cat.display_order,
            spots: cat.spots.map((spot: any) => dbSpotToLocal(spot))
        }));
        
        categories.set(loadedCategories);
        
        // Ensure default categories exist after loading
        await ensureDefaultCategories(loadedCategories);
    }
    
    // Load tags
    await loadTags();
    
    loading.set(false);
}

// Load all tags
export async function loadTags() {
    const { data, error } = await getTagsFromDb();
    if (error) {
        console.error('Error loading tags:', error);
        return;
    }
    
    if (data) {
        tags.set(data.map(tag => ({ id: tag.id, name: tag.name })));
    }
}

// Clear all data (on logout)
export function clearCategories() {
    categories.set([]);
    tags.set([]);
    selectedTagFilter.set(null);
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

export async function updateCategoryName(id: string, newName: string) {
    if (!newName.trim()) {
        throw new Error('Category name cannot be empty');
    }
    
    const { error } = await updateCategoryInDb(id, { name: newName.trim() });
    if (error) throw error;
    
    categories.update(cats => cats.map(c => 
        c.id === id ? { ...c, name: newName.trim() } : c
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

// Tag operations
export async function addTag(name: string): Promise<Tag> {
    const { data, error } = await createTagInDb(name);
    if (error) throw error;
    if (!data) throw new Error('No data returned');
    
    const newTag = { id: data.id, name: data.name };
    tags.update(tags => {
        const exists = tags.find(t => t.id === newTag.id);
        if (exists) return tags;
        return [...tags, newTag].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return newTag;
}

export async function removeTag(id: string) {
    const { error } = await deleteTagInDb(id);
    if (error) throw error;
    
    tags.update(tags => tags.filter(t => t.id !== id));
    
    // Clear filter if the removed tag was selected
    const currentFilter = get(selectedTagFilter);
    if (currentFilter === id) {
        selectedTagFilter.set(null);
    }
}

export async function addTagToSpot(spotId: string, tagId: string) {
    // Check if tag already exists on this spot before calling database
    const currentCategories = get(categories);
    const spot = currentCategories
        .flatMap(cat => cat.spots)
        .find(s => s.id === spotId);
    
    if (spot && spot.tags?.some(t => t.id === tagId)) {
        // Tag already exists, no need to add it again
        return;
    }
    
    const { error } = await addTagToSpotInDb(spotId, tagId);
    if (error) {
        // Check if it's a duplicate key error (unique constraint violation)
        // This can happen if the tag was added between our check and the insert
        if (error.message?.includes('duplicate') || error.code === '23505') {
            // Tag already exists in database, just update local state
            const currentTags = get(tags);
            const tag = currentTags.find(t => t.id === tagId);
            if (tag) {
                categories.update(cats => cats.map(cat => ({
                    ...cat,
                    spots: cat.spots.map(s => {
                        if (s.id === spotId) {
                            const existingTags = s.tags || [];
                            if (!existingTags.find(t => t.id === tagId)) {
                                return { ...s, tags: [...existingTags, tag] };
                            }
                        }
                        return s;
                    })
                })));
            }
            return; // Successfully handled, don't throw error
        }
        throw error;
    }
    
    // Update local state
    const currentTags = get(tags);
    const tag = currentTags.find(t => t.id === tagId);
    if (!tag) return;
    
    categories.update(cats => cats.map(cat => ({
        ...cat,
        spots: cat.spots.map(spot => {
            if (spot.id === spotId) {
                const existingTags = spot.tags || [];
                if (existingTags.find(t => t.id === tagId)) {
                    return spot; // Tag already exists
                }
                return {
                    ...spot,
                    tags: [...existingTags, tag]
                };
            }
            return spot;
        })
    })));
}

export async function removeTagFromSpot(spotId: string, tagId: string) {
    const { error } = await removeTagFromSpotInDb(spotId, tagId);
    if (error) throw error;
    
    categories.update(cats => cats.map(cat => ({
        ...cat,
        spots: cat.spots.map(spot => {
            if (spot.id === spotId) {
                return {
                    ...spot,
                    tags: (spot.tags || []).filter(t => t.id !== tagId)
                };
            }
            return spot;
        })
    })));
}

export function setTagFilter(tagId: string | null) {
    selectedTagFilter.set(tagId);
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
                            spots: c.spots.map(s => {
                                if (s.id === newData.id) {
                                    // Preserve existing tags when updating
                                    const existingSpot = c.spots.find(sp => sp.id === newData.id);
                                    return {
                                        ...s,
                                        name: newData.name,
                                        address: newData.address || '',
                                        display_order: newData.display_order,
                                        tags: existingSpot?.tags || []
                                    };
                                }
                                return s;
                            }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
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
