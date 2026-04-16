/**
 * Shared geographic lookup tables used by both Gemini post-processing
 * and Explorium filter mapping. Single source of truth for country names,
 * ISO codes, region groupings, and city-to-country resolution.
 */

// ── Country name → canonical name (for Gemini post-processing) ──────────
export const COUNTRY_NAMES = {
  "us": "United States", "usa": "United States", "united states": "United States", "america": "United States",
  "uk": "United Kingdom", "united kingdom": "United Kingdom", "england": "United Kingdom", "britain": "United Kingdom",
  "canada": "Canada", "germany": "Germany", "france": "France",
  "india": "India", "australia": "Australia", "japan": "Japan",
  "china": "China", "brazil": "Brazil", "mexico": "Mexico",
  "spain": "Spain", "italy": "Italy", "netherlands": "Netherlands",
  "sweden": "Sweden", "switzerland": "Switzerland", "singapore": "Singapore",
  "israel": "Israel", "south korea": "South Korea", "ireland": "Ireland",
  "norway": "Norway", "denmark": "Denmark", "finland": "Finland",
  "portugal": "Portugal", "belgium": "Belgium", "austria": "Austria",
  "poland": "Poland", "new zealand": "New Zealand", "south africa": "South Africa",
  "uae": "United Arab Emirates", "united arab emirates": "United Arab Emirates",
  "thailand": "Thailand", "vietnam": "Vietnam", "indonesia": "Indonesia",
  "philippines": "Philippines", "malaysia": "Malaysia",
  "argentina": "Argentina", "colombia": "Colombia", "chile": "Chile", "peru": "Peru",
  "czech republic": "Czech Republic", "romania": "Romania", "hungary": "Hungary",
  "greece": "Greece", "turkey": "Turkey", "ukraine": "Ukraine",
  "saudi arabia": "Saudi Arabia", "qatar": "Qatar", "egypt": "Egypt",
  "nigeria": "Nigeria", "kenya": "Kenya",
  "taiwan": "Taiwan", "hong kong": "Hong Kong", "pakistan": "Pakistan",
};

// ── Country name → ISO Alpha-2 code (for Explorium API) ─────────────────
export const COUNTRY_CODE_MAP = {
  "united states": "us", "usa": "us", "us": "us", "america": "us",
  "united kingdom": "gb", "uk": "gb", "england": "gb", "britain": "gb", "great britain": "gb",
  "canada": "ca", "germany": "de", "france": "fr",
  "india": "in", "australia": "au", "japan": "jp",
  "china": "cn", "brazil": "br", "mexico": "mx",
  "spain": "es", "italy": "it", "netherlands": "nl", "holland": "nl",
  "sweden": "se", "switzerland": "ch", "singapore": "sg",
  "israel": "il", "south korea": "kr", "korea": "kr", "ireland": "ie",
  "norway": "no", "denmark": "dk", "finland": "fi",
  "portugal": "pt", "belgium": "be", "austria": "at",
  "poland": "pl", "new zealand": "nz", "south africa": "za",
  "uae": "ae", "united arab emirates": "ae",
  "thailand": "th", "vietnam": "vn", "indonesia": "id",
  "philippines": "ph", "malaysia": "my", "myanmar": "mm", "cambodia": "kh",
  "argentina": "ar", "colombia": "co", "chile": "cl", "peru": "pe",
  "venezuela": "ve", "ecuador": "ec", "uruguay": "uy",
  "czech republic": "cz", "czechia": "cz", "romania": "ro", "hungary": "hu",
  "greece": "gr", "croatia": "hr", "ukraine": "ua", "turkey": "tr",
  "luxembourg": "lu", "estonia": "ee", "latvia": "lv", "lithuania": "lt",
  "saudi arabia": "sa", "qatar": "qa", "bahrain": "bh", "kuwait": "kw",
  "oman": "om", "egypt": "eg", "nigeria": "ng", "kenya": "ke", "ghana": "gh",
  "taiwan": "tw", "hong kong": "hk", "bangladesh": "bd", "pakistan": "pk",
  "sri lanka": "lk",
};

// ── Region name → list of ISO codes ─────────────────────────────────────
export const REGION_COUNTRY_CODES = {
  "europe": ["gb", "de", "fr", "es", "it", "nl", "se", "ch", "ie", "no", "dk", "fi", "pt", "be", "at", "pl", "cz", "ro", "hu", "gr", "hr", "lu", "ee", "lv", "lt"],
  "north america": ["us", "ca", "mx"],
  "asia": ["in", "jp", "cn", "sg", "kr", "tw", "hk", "bd", "pk", "lk"],
  "asia pacific": ["in", "jp", "cn", "sg", "kr", "au", "nz", "tw", "hk", "th", "vn", "id", "ph", "my"],
  "southeast asia": ["th", "vn", "id", "ph", "my", "sg", "mm", "kh"],
  "sea": ["th", "vn", "id", "ph", "my", "sg", "mm", "kh"],
  "middle east": ["ae", "il", "sa", "qa", "bh", "kw", "om"],
  "mena": ["ae", "il", "sa", "qa", "bh", "kw", "om", "eg"],
  "latin america": ["br", "mx", "ar", "co", "cl", "pe", "ve", "ec", "uy"],
  "latam": ["br", "mx", "ar", "co", "cl", "pe", "ve", "ec", "uy"],
  "nordics": ["se", "no", "dk", "fi"],
  "africa": ["za", "ng", "ke", "gh", "eg"],
  "south asia": ["in", "bd", "pk", "lk"],
};

// ── Region name variants → canonical region name ────────────────────────
export const REGION_CANONICAL = {
  "european": "Europe", "europe": "Europe",
  "north america": "North America",
  "asia": "Asia", "asia pacific": "Asia Pacific", "apac": "Asia Pacific",
  "southeast asia": "Southeast Asia", "south east asia": "Southeast Asia", "sea": "Southeast Asia",
  "middle east": "Middle East", "mena": "Middle East",
  "latin america": "Latin America", "latam": "Latin America",
  "nordics": "Nordics", "nordic": "Nordics",
  "africa": "Africa", "south asia": "South Asia",
};

export const REGION_NAMES = new Set(Object.keys(REGION_CANONICAL));

// ── City → country (for rescuing city names from keywords) ──────────────
export const CITY_COUNTRY_MAP = {
  "san francisco": "United States", "new york": "United States", "los angeles": "United States",
  "chicago": "United States", "boston": "United States", "seattle": "United States",
  "austin": "United States", "denver": "United States", "miami": "United States",
  "atlanta": "United States", "dallas": "United States", "houston": "United States",
  "silicon valley": "United States", "bay area": "United States", "palo alto": "United States",
  "london": "United Kingdom", "manchester": "United Kingdom", "edinburgh": "United Kingdom",
  "berlin": "Germany", "munich": "Germany", "hamburg": "Germany", "frankfurt": "Germany",
  "paris": "France", "lyon": "France",
  "toronto": "Canada", "vancouver": "Canada", "montreal": "Canada",
  "bangalore": "India", "bengaluru": "India", "mumbai": "India", "delhi": "India",
  "new delhi": "India", "hyderabad": "India", "pune": "India", "chennai": "India",
  "tokyo": "Japan", "osaka": "Japan",
  "sydney": "Australia", "melbourne": "Australia",
  "amsterdam": "Netherlands", "stockholm": "Sweden", "zurich": "Switzerland",
  "dublin": "Ireland", "tel aviv": "Israel",
  "dubai": "United Arab Emirates", "abu dhabi": "United Arab Emirates",
  "são paulo": "Brazil", "sao paulo": "Brazil",
  "lagos": "Nigeria", "nairobi": "Kenya", "cape town": "South Africa",
  "jakarta": "Indonesia", "bangkok": "Thailand", "ho chi minh": "Vietnam",
  "kuala lumpur": "Malaysia", "manila": "Philippines",
};

// ── US states (for inferring country = US) ──────────────────────────────
export const US_STATES = new Set([
  "california", "texas", "new york state", "florida", "illinois",
  "washington", "massachusetts", "colorado", "georgia", "north carolina",
  "virginia", "pennsylvania", "ohio", "michigan", "arizona", "oregon",
  "minnesota", "maryland", "connecticut", "utah", "tennessee", "indiana",
  "missouri", "wisconsin", "nevada",
]);

// ── Shared helpers ──────────────────────────────────────────────────────

/** Resolve country names and region names into ISO Alpha-2 codes. */
export function resolveCountryCodes(countries, regions) {
  const codes = new Set();
  for (const c of countries || []) {
    const code = COUNTRY_CODE_MAP[c.toLowerCase()];
    if (code) codes.add(code);
  }
  for (const r of regions || []) {
    const regionCodes = REGION_COUNTRY_CODES[r.toLowerCase()];
    if (regionCodes) regionCodes.forEach((c) => codes.add(c));
  }
  return [...codes];
}
