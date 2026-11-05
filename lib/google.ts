import { CATEGORIES, type Category } from "./nyc";

// Copied from OutNYC (web/app/explore/google.ts) so the tool searches the same way

// Google Places API (New), Nearby Search. Server-only: reads the API key.
// Each request returns at most 20 places. Asking for ratings, prices or opening
// hours puts every request in Google's priciest tier (~1,000 free a month), so
// keep FIELDS as small as possible.
const NEARBY = "https://places.googleapis.com/v1/places:searchNearby";
const FIELDS = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.shortFormattedAddress",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.currentOpeningHours.openNow",
  "places.googleMapsUri",
].join(",");

export const METERS_PER_MILE = 1609.34;

// Google's content may only be shown, not stored (except the place id)
export type Place = {
  id: string;
  name: string;
  category: Category;
  // Every searched category it fits: a pub can be a restaurant and a bar, but counts as one
  fits: Category[];
  lat: number;
  lon: number;
  miles: number;
  address: string | null;
  // e.g. "Coffee shop", "Halal restaurant"
  kind: string | null;
  rating: number | null;
  ratingCount: number | null;
  // "$" to "$$$$", or null when Google doesn't know
  price: string | null;
  openNow: boolean | null;
  mapsUrl: string | null;
};

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  location: { latitude: number; longitude: number };
  shortFormattedAddress?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
};

const PRICES: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

// Straight-line distance in miles, rounded to 0.1
function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  const miles = 2 * 3958.8 * Math.asin(Math.sqrt(a));
  return Math.round(miles * 10) / 10;
}

// One Nearby Search request: the 20 most popular places matching `types` within
// the radius (by distance alone, "parks" near a campus are its lawns)
async function searchNearby(
  types: { includedTypes: readonly string[] } | { includedPrimaryTypes: readonly string[] },
  lat: number,
  lon: number,
  radiusMiles: number
) {
  const res = await fetch(NEARBY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_SERVER_KEY!,
      "X-Goog-FieldMask": FIELDS,
    },
    body: JSON.stringify({
      ...types,
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lon }, radius: Math.round(radiusMiles * METERS_PER_MILE) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${await res.text()}`);
  const data: { places?: GooglePlace[] } = await res.json();
  return (data.places ?? []).filter((place) => place.displayName?.text);
}

function toPlace(place: GooglePlace, fits: Category[], lat: number, lon: number): Place {
  return {
    id: place.id,
    name: place.displayName!.text,
    category: fits[0],
    fits,
    lat: place.location.latitude,
    lon: place.location.longitude,
    miles: milesBetween(lat, lon, place.location.latitude, place.location.longitude),
    address: place.shortFormattedAddress ?? null,
    kind: place.primaryTypeDisplayName?.text ?? null,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
    price: (place.priceLevel && PRICES[place.priceLevel]) ?? null,
    openNow: place.currentOpeningHours?.openNow ?? null,
    mapsUrl: place.googleMapsUri ?? null,
  };
}

// Which of `categories` a place fits, in their order (the first one is its category)
function categoriesOf(place: GooglePlace, categories: Category[]) {
  return categories.filter((category) => {
    const { google, primaryOnly } = CATEGORIES[category];
    const types: readonly string[] = google;
    return primaryOnly
      ? !!place.primaryType && types.includes(place.primaryType)
      : (place.types ?? []).some((type) => types.includes(type));
  });
}

// One category on its own, when the mix below didn't return any (open) place of it
export async function fetchCategory(category: Category, lat: number, lon: number, radiusMiles: number) {
  const { google, primaryOnly } = CATEGORIES[category];
  const types = primaryOnly ? { includedPrimaryTypes: google } : { includedTypes: google };
  return (await searchNearby(types, lat, lon, radiusMiles)).map((place) => toPlace(place, [category], lat, lon));
}

// Plans: ONE request for all the categories together (the 20 most popular), closest first
export async function fetchMix(categories: Category[], lat: number, lon: number, radiusMiles: number) {
  const types = [...new Set(categories.flatMap((category) => CATEGORIES[category].google))];
  const places = await searchNearby({ includedTypes: types }, lat, lon, radiusMiles);
  return places
    .flatMap((place) => {
      const fits = categoriesOf(place, categories);
      return fits.length ? [toPlace(place, fits, lat, lon)] : [];
    })
    .sort((a, b) => a.miles - b.miles);
}
