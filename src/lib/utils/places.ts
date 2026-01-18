// Google Places API utilities
import type { PlaceDetails } from '$lib/types';

declare var google: any;

// Calculate distance between two coordinates (in km)
export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Escape HTML for safe rendering
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format place types to readable labels
export function formatPlaceType(types: string[]): string {
    if (!types?.length) return 'Place';
    
    const excludeTypes = ['point_of_interest', 'establishment', 'geocode', 'premise'];
    const filteredTypes = types.filter(type => !excludeTypes.includes(type));
    
    if (!filteredTypes.length) return 'Place';
    
    const typeMap: Record<string, string> = {
        restaurant: 'Restaurant',
        cafe: 'Cafe',
        bar: 'Bar',
        lodging: 'Hotel',
        park: 'Park',
        museum: 'Museum',
        shopping_mall: 'Shopping Mall',
        store: 'Store',
        gas_station: 'Gas Station',
        hospital: 'Hospital',
        school: 'School',
        church: 'Church',
        tourist_attraction: 'Tourist Attraction',
        amusement_park: 'Amusement Park',
        zoo: 'Zoo',
        aquarium: 'Aquarium',
        library: 'Library',
        gym: 'Gym',
        pharmacy: 'Pharmacy',
        bank: 'Bank',
        atm: 'ATM',
        subway_station: 'Subway Station',
        bus_station: 'Bus Station',
        airport: 'Airport',
        movie_theater: 'Movie Theater',
        night_club: 'Night Club',
        spa: 'Spa',
        beauty_salon: 'Beauty Salon'
    };
    
    const primaryType = filteredTypes[0];
    return typeMap[primaryType] || primaryType.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Check if a name looks like an address
export function isAddressPattern(name: string): boolean {
    return !!(
        name.match(/^\d+[-chōme]/) ||
        name.match(/^\d+\s+[A-Z]/) ||
        name.match(/\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)/i)
    );
}

// Get place details by ID
export function getPlaceDetailsById(
    placesService: any,
    placeId: string
): Promise<PlaceDetails | null> {
    return new Promise((resolve) => {
        if (!placesService || !placeId) {
            resolve(null);
            return;
        }
        
        placesService.getDetails({
            placeId,
            fields: [
                'name', 'formatted_address', 'types', 'geometry', 'place_id',
                'photos', 'reviews', 'rating', 'user_ratings_total',
                'price_level', 'website', 'formatted_phone_number', 'opening_hours'
            ]
        }, (place: any, status: any) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
                resolve(null);
                return;
            }
            
            resolve({
                name: place.name,
                address: place.formatted_address || '',
                types: place.types || [],
                placeId: place.place_id,
                photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 300 }),
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                reviews: place.reviews?.slice(0, 3).map((r: any) => ({
                    author_name: r.author_name,
                    rating: r.rating,
                    text: r.text,
                    relative_time_description: r.relative_time_description,
                    profile_photo_url: r.profile_photo_url
                })),
                price_level: place.price_level,
                website: place.website,
                phone: place.formatted_phone_number,
                opening_hours: place.opening_hours ? {
                    open_now: place.opening_hours.open_now,
                    weekday_text: place.opening_hours.weekday_text
                } : undefined,
                geometry: place.geometry
            });
        });
    });
}

// Search for nearby places
export function searchNearby(
    placesService: any,
    lat: number,
    lng: number,
    radius: number = 100
): Promise<any[]> {
    return new Promise((resolve) => {
        if (!placesService) {
            resolve([]);
            return;
        }
        
        placesService.nearbySearch({
            location: new google.maps.LatLng(lat, lng),
            radius,
            type: ['establishment', 'point_of_interest']
        }, (results: any[], status: any) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                resolve(results);
            } else {
                resolve([]);
            }
        });
    });
}

// Text search for places
export function textSearch(
    placesService: any,
    query: string
): Promise<any | null> {
    return new Promise((resolve) => {
        if (!placesService) {
            resolve(null);
            return;
        }
        
        placesService.textSearch({
            query,
            fields: ['name', 'geometry', 'formatted_address', 'place_id']
        }, (results: any[], status: any) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
                resolve(results[0]);
            } else {
                resolve(null);
            }
        });
    });
}

// Get autocomplete suggestions
export function getAutocompleteSuggestions(
    autocompleteService: any,
    query: string,
    location: any
): Promise<any[]> {
    return new Promise((resolve) => {
        if (!autocompleteService) {
            resolve([]);
            return;
        }
        
        autocompleteService.getPlacePredictions({
            input: query,
            types: ['establishment', 'geocode'],
            location,
            radius: 50000
        }, (predictions: any[], status: any) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                resolve(predictions);
            } else {
                resolve([]);
            }
        });
    });
}
