<script context="module" lang="ts">
    declare var google: any;
</script>

<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { user } from '$lib/stores/auth';
    import { 
        categories, 
        loading,
        loadCategories, 
        clearCategories,
        addCategory,
        removeCategory,
        toggleCategoryExpanded,
        addSpot,
        removeSpot,
        updateSpotName,
        updateCategoryOrder,
        updateSpotOrder,
        setupRealtimeSubscriptions,
        cleanupRealtimeSubscriptions
    } from '$lib/stores/spots';
    import { 
        escapeHtml, 
        formatPlaceType, 
        getPlaceDetailsById,
        getAutocompleteSuggestions,
        textSearch,
        isAddressPattern
    } from '$lib/utils/places';
    import type { SelectedPlace, PlaceDetails } from '$lib/types';
    import Auth from '$lib/components/Auth.svelte';

    // Map state (not in store - component-local)
    let map: any;
    let placesService: any;
    let autocompleteService: any;
    let markers: any[] = [];
    let currentSelectedPlace: SelectedPlace | null = null;
    let showPOIs = true;
    let infoWindow: any; // Shared InfoWindow instance
    
    // UI state
    let searchQuery = '';
    let autocompleteResults: any[] = [];
    let highlightedIndex = -1;
    let showAutocomplete = false;
    let categoryModalOpen = false;
    let spotModalOpen = false;
    let newCategoryName = '';
    let selectedCategoryId = '';

    // Auth subscription
    const unsubUser = user.subscribe(async (u) => {
        if (u) {
            await loadCategories();
            setupRealtimeSubscriptions();
        } else {
            cleanupRealtimeSubscriptions();
            clearCategories();
            clearMarkers();
        }
    });

    onMount(() => {
        // Wait for Google Maps
        const checkMaps = setInterval(() => {
            if (typeof google !== 'undefined' && google.maps) {
                clearInterval(checkMaps);
                initMap();
            }
        }, 100);
        
        // Add timeout to prevent infinite checking
        setTimeout(() => {
            clearInterval(checkMaps);
            if (typeof google === 'undefined') {
                console.error('Google Maps failed to load');
            }
        }, 10000);
    });

    onDestroy(() => {
        unsubUser();
        cleanupRealtimeSubscriptions();
    });

    // Update markers whenever categories change
    $: if (map && $categories) {
        updateMarkers();
    }

    function initMap() {
        const mapEl = document.getElementById('map');
        if (!mapEl) {
            console.warn('Map element not found, retrying...');
            setTimeout(initMap, 100);
            return;
        }

        map = new google.maps.Map(mapEl, {
            center: { lat: 37.7749, lng: -122.4194 },
            zoom: 13,
            styles: showPOIs ? [] : [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
        });

        placesService = new google.maps.places.PlacesService(map);
        autocompleteService = new google.maps.places.AutocompleteService();

        // Try to get user's location
        navigator.geolocation?.getCurrentPosition(
            (pos) => {
                map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                map.setZoom(14);
            },
            () => console.log('Geolocation unavailable')
        );

        // Map click handler
        map.addListener('click', (e: any) => {
            // Check if user clicked a POI
            if (e.placeId) {
                e.stop(); // Stop default info window
                if (placesService) {
                    getPlaceDetailsById(placesService, e.placeId).then(details => {
                        if (details) {
                            showPlaceOnMap({
                                name: details.name,
                                address: details.address,
                                lat: details.geometry?.location.lat() || e.latLng.lat(),
                                lng: details.geometry?.location.lng() || e.latLng.lng(),
                                placeId: e.placeId
                            }, details);
                        }
                    });
                }
                return;
            }

            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            reverseGeocode(lat, lng);
        });
        
        infoWindow = new google.maps.InfoWindow({ maxWidth: 320 });
    }

    function togglePOIs() {
        showPOIs = !showPOIs;
        map?.setOptions({ 
            styles: showPOIs ? [] : [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
        });
    }

    // Search & Autocomplete
    async function handleSearchInput() {
        if (searchQuery.length < 2) {
            showAutocomplete = false;
            return;
        }
        
        autocompleteResults = await getAutocompleteSuggestions(
            autocompleteService, 
            searchQuery, 
            map?.getCenter()
        );
        showAutocomplete = autocompleteResults.length > 0;
        highlightedIndex = -1;
    }

    function handleSearchKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            if (showAutocomplete && highlightedIndex >= 0) {
                selectAutocompleteItem(highlightedIndex);
            } else {
                performSearch();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, autocompleteResults.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, -1);
        } else if (e.key === 'Escape') {
            showAutocomplete = false;
        }
    }

    async function selectAutocompleteItem(index: number) {
        const prediction = autocompleteResults[index];
        if (!prediction) return;
        
        searchQuery = prediction.description;
        showAutocomplete = false;
        
        const details = await getPlaceDetailsById(placesService, prediction.place_id);
        if (details && details.geometry) {
            showPlaceOnMap({
                name: details.name,
                address: details.address,
                lat: details.geometry.location.lat(),
                lng: details.geometry.location.lng(),
                placeId: details.placeId
            }, details);
        }
    }

    async function performSearch() {
        if (!searchQuery.trim()) return;
        showAutocomplete = false;
        
        const place = await textSearch(placesService, searchQuery);
        if (place) {
            // For text search results, fetch full details including photos/reviews
            let details = null;
            if (place.place_id) {
                details = await getPlaceDetailsById(placesService, place.place_id);
            }

            showPlaceOnMap({
                name: place.name,
                address: place.formatted_address,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                placeId: place.place_id
            }, details);
        } else {
            alert('No results found');
        }
    }

    function showPlaceOnMap(place: SelectedPlace, details?: PlaceDetails | null) {
        clearMarkers();
        
        const position = { lat: place.lat, lng: place.lng };
        map.setCenter(position);
        map.setZoom(16);

        const marker = new google.maps.Marker({
            position,
            map,
            title: place.name,
            animation: google.maps.Animation.DROP
        });
        markers.push(marker);

        currentSelectedPlace = place;

        const content = buildInfoWindowContent({ ...place, name: place.name }, '', details || null, true);
        
        if (infoWindow) {
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
        }

        // Add listener to reopen on click
        marker.addListener('click', () => {
            if (infoWindow) {
                infoWindow.setContent(content);
                infoWindow.open(map, marker);
            }
        });

        // Expose for InfoWindow button
        (window as any).openSpotModal = () => { spotModalOpen = true; };
    }

    function reverseGeocode(lat: number, lng: number) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, async (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
                const address = results[0].formatted_address;
                const streetAddress = address.split(',')[0];
                
                // Try to get place details if we have a place_id
                let placeName = streetAddress;
                let placeId = results[0].place_id || '';
                
                // If there's a place_id, try to fetch place details to get the actual name
                let details = null;
                if (placeId && placesService) {
                    details = await getPlaceDetailsById(placesService, placeId);
                    if (details && details.name) {
                        // Use the place name if available, otherwise use street address
                        placeName = details.name;
                    }
                }
                
                showPlaceOnMap({
                    name: placeName,
                    address: address,
                    lat,
                    lng,
                    placeId: placeId
                }, details);
            }
        });
    }

    function clearMarkers() {
        markers.forEach(m => m.setMap(null));
        markers = [];
        currentSelectedPlace = null;
    }

    function updateMarkers() {
        // Clear existing saved spot markers
        markers.filter(m => m.isSavedSpot).forEach(m => m.setMap(null));
        markers = markers.filter(m => !m.isSavedSpot);

        $categories.forEach(category => {
            category.spots.forEach(spot => {
                const marker = new google.maps.Marker({
                    position: { lat: spot.lat, lng: spot.lng },
                    map,
                    title: spot.name,
                    label: { text: category.name.charAt(0).toUpperCase(), color: 'white', fontSize: '12px', fontWeight: 'bold' },
                    icon: { url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }
                });
                (marker as any).isSavedSpot = true;

                marker.addListener('click', async () => {
                    if (infoWindow) {
                        infoWindow.setContent('<div style="padding:12px; min-width:150px; text-align:center; color:#666;">Loading details...</div>');
                        infoWindow.open(map, marker);
                    }

                    try {
                        const details = spot.placeId 
                            ? await getPlaceDetailsById(placesService, spot.placeId)
                            : null;
                        
                        if (infoWindow) {
                            infoWindow.setContent(buildInfoWindowContent(spot, category.name, details));
                        }
                    } catch (e) {
                        console.error('Error fetching details:', e);
                        if (infoWindow) {
                            infoWindow.setContent(buildInfoWindowContent(spot, category.name, null));
                        }
                    }
                });

                markers.push(marker);
            });
        });
    }

    function buildInfoWindowContent(spot: any, categoryName: string, details: PlaceDetails | null, showSaveButton: boolean = false): string {
        const name = details?.name && !isAddressPattern(details.name) ? details.name : spot.name;
        let content = `<div style="padding: 0px; min-width: 260px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">`;
        
        // Photo
        if (details?.photoUrl) {
            content += `<div style="width: 100%; height: 160px; background-image: url('${details.photoUrl}'); background-size: cover; background-position: center; border-radius: 8px 8px 0 0;"></div>`;
            content += `<div style="padding: 12px;">`;
        } else {
             content += `<div style="padding: 12px;">`;
        }
        
        // Header
        content += `<h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #202124;">${escapeHtml(name)}</h3>`;
        
        // Rating
        if (details?.rating) {
            const stars = '★'.repeat(Math.round(details.rating)) + '☆'.repeat(5 - Math.round(details.rating));
            content += `<div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px; font-size: 13px;">
                <span style="color: #faaf00;">${stars}</span>
                <span style="font-weight: 500; color: #202124;">${details.rating.toFixed(1)}</span>
                <span style="color: #70757a;">(${details.user_ratings_total?.toLocaleString() || 0})</span>
            </div>`;
        }
        
        // Type & Status
        const types = details?.types ? formatPlaceType(details.types) : '';
        const isOpen = details?.opening_hours?.open_now;
        
        if (types || isOpen !== undefined) {
             content += `<div style="display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px; color: #70757a;">`;
             if (types) content += `<span>${types}</span>`;
             if (types && isOpen !== undefined) content += `<span>•</span>`;
             if (isOpen !== undefined) {
                 content += `<span style="color: ${isOpen ? '#188038' : '#d93025'}; font-weight: 500;">${isOpen ? 'Open' : 'Closed'}</span>`;
             }
             content += `</div>`;
        }

        // Address
        const address = details?.address || spot.address;
        if (address) {
            content += `<div style="display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px; color: #3c4043;">
                <span style="flex-shrink: 0;">📍</span>
                <span>${escapeHtml(address)}</span>
            </div>`;
        }

        // Phone
        if (details?.phone) {
             content += `<div style="display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px; color: #3c4043;">
                <span style="flex-shrink: 0;">📞</span>
                <a href="tel:${details.phone}" style="color: #3c4043; text-decoration: none;">${details.phone}</a>
            </div>`;
        }

        // Website
        if (details?.website) {
             content += `<div style="display: flex; gap: 8px; margin-bottom: 12px; font-size: 13px;">
                <span style="flex-shrink: 0;">🌐</span>
                <a href="${details.website}" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: none;">Website</a>
            </div>`;
        }

        // Reviews (First 2)
        if (details?.reviews?.length) {
            content += `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8eaed;">`;
            details.reviews.slice(0, 2).forEach(review => {
                 content += `<div style="margin-bottom: 8px; font-size: 12px; color: #3c4043;">
                    <div style="font-weight: 500; margin-bottom: 2px;">${escapeHtml(review.author_name)} <span style="color: #faaf00;">${'★'.repeat(Math.round(review.rating))}</span></div>
                    <div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-style: italic;">"${escapeHtml(review.text)}"</div>
                 </div>`;
            });
            content += `</div>`;
        }

        // Category / Save Button
        if (showSaveButton) {
            content += `<button onclick="window.openSpotModal()" style="width: 100%; margin-top: 12px; padding: 8px 16px; background: #1a73e8; color: white; border: none; border-radius: 18px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <span>💾</span>
                <span>Save Spot</span>
            </button>`;
        } else {
             content += `<div style="margin-top: 8px; font-size: 12px; color: #70757a; display: flex; align-items: center; gap: 4px;">
                <span>📁</span> 
                <span>Saved in <strong>${escapeHtml(categoryName)}</strong></span>
            </div>`;
        }
        
        content += `</div></div>`; // Close padding div and wrapper
        
        return content;
    }

    // Category management
    async function handleCreateCategory() {
        if (!newCategoryName.trim()) return;
        if (!$user) {
            alert('Please sign in to create categories');
            return;
        }
        
        try {
            await addCategory(newCategoryName.trim());
            newCategoryName = '';
            categoryModalOpen = false;
        } catch (e) {
            console.error('Failed to create category:', e);
            alert('Failed to create category');
        }
    }

    async function handleDeleteCategory(id: string) {
        if (!confirm('Delete this category and all its spots?')) return;
        if (!$user) {
            alert('Please sign in');
            return;
        }
        
        try {
            await removeCategory(id);
        } catch (e) {
            console.error('Failed to delete category:', e);
        }
    }

    // Spot management
    async function handleSaveSpot() {
        if (!selectedCategoryId || !currentSelectedPlace) return;
        if (!$user) {
            alert('Please sign in to save spots');
            return;
        }
        
        try {
            await addSpot(selectedCategoryId, currentSelectedPlace);
            spotModalOpen = false;
            selectedCategoryId = '';
        } catch (e) {
            console.error('Failed to save spot:', e);
            alert('Failed to save spot');
        }
    }

    async function handleDeleteSpot(categoryId: string, spotId: string) {
        if (!$user) {
            alert('Please sign in');
            return;
        }
        
        try {
            await removeSpot(categoryId, spotId);
        } catch (e) {
            console.error('Failed to delete spot:', e);
        }
    }

    async function showSpotOnMap(spot: any, categoryName: string) {
        clearMarkers();
        const position = { lat: spot.lat, lng: spot.lng };
        map.setCenter(position);
        map.setZoom(16);

        const marker = new google.maps.Marker({
            position,
            map,
            title: spot.name,
            animation: google.maps.Animation.DROP
        });
        markers.push(marker);

        // Show loading state immediately
        if (infoWindow) {
            infoWindow.setContent('<div style="padding:12px; min-width:150px; text-align:center; color:#666;">Loading details...</div>');
            infoWindow.open(map, marker);
        }

        try {
            const details = spot.placeId 
                ? await getPlaceDetailsById(placesService, spot.placeId)
                : null;
            
            if (infoWindow) {
                infoWindow.setContent(buildInfoWindowContent(spot, categoryName, details));
            }
        } catch (e) {
            console.error('Error fetching details:', e);
            if (infoWindow) {
                infoWindow.setContent(buildInfoWindowContent(spot, categoryName, null));
            }
        }

        // Add click listener to re-open if closed
        marker.addListener('click', async () => {
            if (infoWindow) {
                infoWindow.setContent('<div style="padding:12px; min-width:150px; text-align:center; color:#666;">Loading details...</div>');
                infoWindow.open(map, marker);
            }
            try {
                const details = spot.placeId ? await getPlaceDetailsById(placesService, spot.placeId) : null;
                if (infoWindow) infoWindow.setContent(buildInfoWindowContent(spot, categoryName, details));
            } catch (e) {
                if (infoWindow) infoWindow.setContent(buildInfoWindowContent(spot, categoryName, null));
            }
        });
    }
</script>

<div class="container">
    <header class="header">
        <div class="search-container">
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input 
                    type="text" 
                    bind:value={searchQuery}
                    on:input={handleSearchInput}
                    on:keydown={handleSearchKeydown}
                    on:blur={() => setTimeout(() => showAutocomplete = false, 200)}
                    placeholder="Search for places..." 
                    autocomplete="off"
                >
                <button class="search-btn" on:click={performSearch}>Search</button>
            </div>
            
            {#if showAutocomplete && autocompleteResults.length > 0}
                <div class="autocomplete-dropdown show">
                    {#each autocompleteResults as result, i}
                        <button 
                            type="button"
                            class="autocomplete-item" 
                            class:highlighted={i === highlightedIndex}
                            on:click={() => selectAutocompleteItem(i)}
                            on:mouseenter={() => highlightedIndex = i}
                        >
                            <span class="autocomplete-item-icon">📍</span>
                            <div class="autocomplete-item-content">
                                <div class="autocomplete-item-name">{result.structured_formatting.main_text}</div>
                                {#if result.structured_formatting.secondary_text}
                                    <div class="autocomplete-item-address">{result.structured_formatting.secondary_text}</div>
                                {/if}
                            </div>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        <div class="auth-wrapper">
            <Auth />
        </div>
    </header>

    <div class="main-content">
        <div class="map-container">
            <div id="map"></div>
            <button class="toggle-poi-btn" class:active={showPOIs} on:click={togglePOIs}>
                📍 {showPOIs ? 'Hide' : 'Show'} Places
            </button>
            {#if currentSelectedPlace}
                <button class="floating-save-btn show" on:click={() => spotModalOpen = true}>
                    <span class="save-icon">💾</span>
                    <span class="save-text">Save Spot</span>
                </button>
            {/if}
        </div>

        <aside class="sidebar">
            <div class="sidebar-header">
                <h2>Categories</h2>
                <button class="add-btn" on:click={() => categoryModalOpen = true} title="Add Category">+</button>
            </div>
            
            <div class="categories-list">
                {#if $loading}
                    <div class="empty-state">Loading...</div>
                {:else if $categories.length === 0}
                    <div class="empty-state">
                        <p>No categories yet</p>
                        <p>Click + to create one</p>
                    </div>
                {:else}
                    {#each $categories as category (category.id)}
                        <div class="category-item" class:expanded={category.expanded}>
                            <div class="category-header">
                                <button type="button" class="category-name-btn" on:click={() => toggleCategoryExpanded(category.id)}>
                                    {category.name}
                                </button>
                                <button 
                                    type="button"
                                    class="category-delete-btn" 
                                    on:click={() => handleDeleteCategory(category.id)}
                                >🗑️</button>
                            </div>
                            <div class="spots-list">
                                {#if category.spots.length === 0}
                                    <div style="padding: 0.75rem 1rem 0.75rem 2rem; color: #999; font-size: 0.875rem;">
                                        No spots saved yet
                                    </div>
                                {:else}
                                    {#each category.spots as spot (spot.id)}
                                        <div class="spot-item">
                                            <button 
                                                type="button"
                                                class="spot-name-btn" 
                                                on:click={() => showSpotOnMap(spot, category.name)}
                                            >
                                                {spot.name}
                                            </button>
                                            <button 
                                                type="button"
                                                class="spot-delete-btn" 
                                                on:click={() => handleDeleteSpot(category.id, spot.id)}
                                            >🗑️</button>
                                        </div>
                                    {/each}
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </aside>
    </div>

    <!-- Category Modal -->
    {#if categoryModalOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="modal" style="display: block" on:click|self={() => categoryModalOpen = false}>
            <div class="modal-content">
                <button type="button" class="close" on:click={() => categoryModalOpen = false}>&times;</button>
                <h3>Create New Category</h3>
                <input 
                    type="text" 
                    bind:value={newCategoryName}
                    on:keydown={(e) => e.key === 'Enter' && handleCreateCategory()}
                    placeholder="Category name (e.g., Cafe, Restaurant)"
                    id="category-name-input"
                >
                <button class="create-btn" on:click={handleCreateCategory}>Create</button>
            </div>
        </div>
    {/if}

    <!-- Spot Modal -->
    {#if spotModalOpen && currentSelectedPlace}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="modal" style="display: block" on:click|self={() => spotModalOpen = false}>
            <div class="modal-content">
                <button type="button" class="close" on:click={() => spotModalOpen = false}>&times;</button>
                <h3>{currentSelectedPlace.name}</h3>
                <p id="spot-address">{currentSelectedPlace.address}</p>
                <div class="save-to-category">
                    <label for="category-select">Save to category:</label>
                    <select id="category-select" bind:value={selectedCategoryId}>
                        <option value="">Select a category...</option>
                        {#each $categories as category}
                            <option value={category.id}>{category.name}</option>
                        {/each}
                    </select>
                    <button class="save-btn" on:click={handleSaveSpot}>Save Spot</button>
                </div>
            </div>
        </div>
    {/if}

    <div id="success-notification" class="success-notification">
        <span id="success-message"></span>
    </div>
</div>
