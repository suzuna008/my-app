// Shared types for the application

export interface Spot {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    placeId: string;
    display_order?: number;
}

export interface Category {
    id: string;
    name: string;
    spots: Spot[];
    expanded?: boolean;
    display_order?: number;
}

export interface SelectedPlace {
    name: string;
    address: string;
    lat: number;
    lng: number;
    placeId: string;
}

export interface PlaceDetails {
    name: string;
    address: string;
    types: string[];
    placeId: string;
    photoUrl?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: PlaceReview[];
    price_level?: number;
    website?: string;
    phone?: string;
    opening_hours?: {
        open_now: boolean;
        weekday_text: string[];
    };
    geometry?: {
        location: {
            lat: () => number;
            lng: () => number;
        }
    };
}

export interface PlaceReview {
    author_name: string;
    rating: number;
    text: string;
    relative_time_description: string;
    profile_photo_url?: string;
}
