// Same categories and plan rules as OutNYC (web/app/explore/nyc.ts)

export const RADII_MILES = [1, 2, 3] as const;
export const BUDGETS = ["$", "$$", "$$$"] as const;

// `google`: Google place types. `primaryOnly` matches a place's main type only,
// so a sandwich chain that also counts as a bakery isn't "Dessert".
export const CATEGORIES = {
  coffee: { label: "Coffee", google: ["cafe", "coffee_shop"], primaryOnly: true },
  restaurants: { label: "Restaurants", google: ["restaurant"], primaryOnly: false },
  bars: { label: "Bars", google: ["bar", "pub", "wine_bar"], primaryOnly: false },
  clubs: { label: "Clubs", google: ["night_club"], primaryOnly: false },
  museums: { label: "Museums", google: ["museum", "art_gallery"], primaryOnly: false },
  parks: { label: "Parks", google: ["park"], primaryOnly: false },
  bookstores: { label: "Bookstores", google: ["book_store"], primaryOnly: true },
  dessert: {
    label: "Dessert",
    google: ["bakery", "ice_cream_shop", "dessert_shop", "confectionery"],
    primaryOnly: true,
  },
} as const;

export type Category = keyof typeof CATEGORIES;

// Every plan has 3–4 stops
export const STOPS = { min: 3, max: 4 };

// Where a plan starts: the rough center of each neighborhood (no address lookup needed)
export const NEIGHBORHOODS = [
  { name: "Hell's Kitchen, Manhattan", lat: 40.7638, lon: -73.9918 },
  { name: "Midtown, Manhattan", lat: 40.7549, lon: -73.984 },
  { name: "Chelsea, Manhattan", lat: 40.7465, lon: -74.0014 },
  { name: "West Village, Manhattan", lat: 40.7358, lon: -74.0036 },
  { name: "East Village, Manhattan", lat: 40.7265, lon: -73.9815 },
  { name: "SoHo, Manhattan", lat: 40.7233, lon: -74.003 },
  { name: "Lower East Side, Manhattan", lat: 40.715, lon: -73.9843 },
  { name: "Financial District, Manhattan", lat: 40.7075, lon: -74.0113 },
  { name: "Upper West Side, Manhattan", lat: 40.787, lon: -73.9754 },
  { name: "Upper East Side, Manhattan", lat: 40.7736, lon: -73.9566 },
  { name: "Morningside Heights, Manhattan", lat: 40.809, lon: -73.962 },
  { name: "Harlem, Manhattan", lat: 40.8116, lon: -73.9465 },
  { name: "Williamsburg, Brooklyn", lat: 40.7081, lon: -73.9571 },
  { name: "DUMBO, Brooklyn", lat: 40.7033, lon: -73.9881 },
  { name: "Astoria, Queens", lat: 40.7644, lon: -73.9235 },
] as const;
