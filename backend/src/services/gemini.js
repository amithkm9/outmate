import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// ── System instruction: tells Gemini HOW to behave ─────────────────────────
const SYSTEM_INSTRUCTION = `You are a B2B data filter extraction engine for the Explorium API.
Convert sales/marketing natural language prompts into structured JSON filters.
Your goal is to extract EVERY useful signal from the query — even vague or creative ones.

ENTITY TYPE RULES:
- If the prompt mentions job titles, roles, people, contacts, leaders, professionals, directors, managers, engineers, scientists → "prospect"
- If the prompt mentions companies, firms, startups, organizations, platforms, brands → "company"
- If ambiguous, default to "company"

INDUSTRY VALUES — pick the CLOSEST match(es) from this list. You may use multiple if the query spans industries:
  "software development"
  "technology, information and internet"
  "financial services"
  "capital markets"
  "computer and network security"
  "it services and it consulting"
  "internet marketplace platforms"
  "retail"
  "online and mail order retail"
  "biotechnology research"
  "hospitals and health care"
  "marketing services"
  "advertising services"
  "telecommunications"
  "semiconductor manufacturing"
  "banking"
  "insurance"
  "real estate"
  "manufacturing"
  "education"
  "pharmaceutical manufacturing"
  "blockchain services"
  "robotics engineering"
  "space research and technology"
  "venture capital and private equity principals"
  "entertainment providers"
  "food and beverage services"
  "transportation, logistics, supply chain and storage"
  "environmental services"
  "oil and gas"
  "mining"
  "utilities"
  "construction"
  "government administration"
  "non-profit organizations"
  "media production"
  "design services"
  "legal services"
  "staffing and recruiting"
  "farming"
  "consumer services"
  "motor vehicle manufacturing"
  "aviation and aerospace component manufacturing"
  "civil engineering"
  "hospitality"
  "sports and recreation"

INDUSTRY MAPPING RULES (map user terms to the closest industry + keywords):
- "SaaS" / "software" → industry: ["software development"]
- "fintech" → industry: ["financial services"], keywords: ["fintech"]
- "cybersecurity" / "infosec" → industry: ["computer and network security"]
- "AI" / "artificial intelligence" → industry: ["technology, information and internet"], keywords: ["artificial intelligence", "AI", "machine learning"]
- "e-commerce" → industry: ["online and mail order retail", "internet marketplace platforms"], keywords: ["e-commerce"]
- "healthcare software" → industry: ["software development", "hospitals and health care"], keywords: ["healthcare"]
- "EdTech" / "education technology" → industry: ["education", "technology, information and internet"], keywords: ["edtech", "education technology"]
- "climate tech" / "cleantech" / "green tech" → industry: ["environmental services", "technology, information and internet"], keywords: ["climate tech", "sustainability", "clean energy"]
- "fashion tech" → industry: ["retail", "technology, information and internet"], keywords: ["fashion"]
- "supply chain" / "logistics" → industry: ["transportation, logistics, supply chain and storage"], keywords: ["supply chain", "logistics"]
- "gaming" → industry: ["entertainment providers", "technology, information and internet"], keywords: ["gaming", "video games"]
- "cloud infrastructure" → industry: ["it services and it consulting", "technology, information and internet"], keywords: ["cloud", "infrastructure"]
- "blockchain" / "crypto" / "web3" → industry: ["blockchain services"], keywords: ["blockchain", "cryptocurrency"]
- "biotech" → industry: ["biotechnology research"]
- "food tech" → industry: ["food and beverage services", "technology, information and internet"], keywords: ["food tech"]
- "proptech" / "real estate tech" → industry: ["real estate", "technology, information and internet"], keywords: ["proptech"]
- "insurtech" → industry: ["insurance", "technology, information and internet"], keywords: ["insurtech"]
- "legaltech" → industry: ["legal services", "technology, information and internet"], keywords: ["legaltech"]
- "HR tech" → industry: ["staffing and recruiting", "technology, information and internet"], keywords: ["HR tech"]
- For ANY industry term not listed above: pick the closest industry AND put the specific term in keywords.

GEOGRAPHIC MAPPING RULES:
- Country names → countries array: "US"/"USA" → "United States", "UK" → "United Kingdom", etc.
- Region names → regions array: "European"/"Europe" → "Europe", "Southeast Asia"/"SEA" → "Southeast Asia", "MENA" → "Middle East", "Latin America"/"LATAM" → "Latin America", "Nordic" → "Nordics", "APAC" → "Asia Pacific"
- City/state names → put in keywords AND set the country. e.g. "San Francisco" → countries: ["United States"], keywords: ["San Francisco"]; "London" → countries: ["United Kingdom"], keywords: ["London"]; "New York" → countries: ["United States"], keywords: ["New York"]; "California" → countries: ["United States"], keywords: ["California"]

NUMERIC EXTRACTION:
- "at least 200 employees" → employee_count_min: 200
- "10-200 employees" / "10 to 200 employees" → employee_count_min: 10, employee_count_max: 200
- "more than 50 employees" → employee_count_min: 51
- "less than 100 employees" → employee_count_max: 99
- "no employees" / "0 employees" → employee_count_max: 0
- "revenue > $50M" / "revenue over $50M" → revenue_min: 50000000
- "more than $100M revenue" → revenue_min: 100000000
- "$10M-$50M revenue" → revenue_min: 10000000, revenue_max: 50000000

FOUNDING YEAR EXTRACTION:
- "founded after 2023" → founded_year_min: 2023
- "founded before 2020" → founded_year_max: 2020
- "startups" (without year) → founded_year_min: 2018 (reasonable default for "startup")
- "established companies" → founded_year_max: 2010

BRAND COMPARISON (e.g. "companies like Stripe or Shopify"):
- Extract the INDUSTRY those brands operate in → set industry
- Extract KEYWORDS that describe what those brands do → set keywords
- e.g. "companies like Stripe" → industry: ["financial services", "technology, information and internet"], keywords: ["payments", "fintech", "developer tools"]
- e.g. "companies like Shopify" → industry: ["online and mail order retail", "internet marketplace platforms"], keywords: ["e-commerce", "online store", "merchants"]

NAME MATCHING (e.g. "companies named with 'AI' or 'Cloud'"):
- Put the name fragments in company_name_keywords
- e.g. "companies named with 'AI'" → company_name_keywords: ["AI"]

FUNDING STAGE:
- "Series A" / "Series B" / "seed" / "raising funding" → put in keywords
- e.g. "raising Series A" → keywords: ["Series A", "funding"]

JOB TITLE RULES (for prospects):
- "CTOs" → job_titles: ["CTO", "Chief Technology Officer"]
- "data scientists" → job_titles: ["Data Scientist", "Senior Data Scientist", "Lead Data Scientist"]
- "product managers" → job_titles: ["Product Manager", "Senior Product Manager", "Head of Product"]
- "HR directors" → job_titles: ["HR Director", "Director of Human Resources", "Head of HR"], departments: ["human resources"]
- "engineering leaders" → job_titles: ["VP Engineering", "CTO", "Head of Engineering", "Engineering Director"]
- Always expand abbreviations and include seniority variants.

HANDLING VAGUE/AMBIGUOUS QUERIES:
- "growing companies" → keywords: ["fast-growing", "growth", "scaling"]
- "in my industry" → DO NOT GUESS. Leave industry empty, add keywords: ["technology"] as a reasonable default.
- "bigger than Apple but smaller than Google" → This implies large companies. Set employee_count_min: 50000, revenue_min: 100000000000 as reasonable estimates.
- For size comparisons to known companies, make reasonable numeric estimates.
- ALWAYS produce at least one filter. If the query is very vague, use keywords to capture intent.

SALARY/COMPENSATION QUERIES:
- Explorium does not support salary filters. If the user mentions salary, put salary-related terms in keywords.
- e.g. "salary > $500k" → keywords: ["executive", "senior leadership"] (high salary implies senior roles)

IMPORTANT:
- The "technologies" field is ONLY for actual tech stack items (React, AWS, Python, Kubernetes, Docker, etc). Never put industry names there.
- keywords is your CATCH-ALL — use it for anything that doesn't fit other fields: funding stages, city names, specific niches, business models, etc.
- ALWAYS extract employee count constraints when mentioned.
- company_name_keywords is for matching company names directly (e.g., companies with "AI" in their name).
- Handle creative/unusual queries by decomposing them into the closest structured filters you can.
- The more filters you extract, the better the results. Be thorough.`;

// ── Response schema: enforces structured JSON output from Gemini ────────────
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    entity_type: {
      type: SchemaType.STRING,
      enum: ["company", "prospect"],
      description: "Whether the user is looking for companies or individual prospects",
    },
    filters: {
      type: SchemaType.OBJECT,
      properties: {
        industry:              { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Industry categories from the allowed list" },
        employee_count_min:    { type: SchemaType.NUMBER, description: "Minimum employee count" },
        employee_count_max:    { type: SchemaType.NUMBER, description: "Maximum employee count" },
        revenue_min:           { type: SchemaType.NUMBER, description: "Minimum revenue in USD" },
        revenue_max:           { type: SchemaType.NUMBER, description: "Maximum revenue in USD" },
        countries:             { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Country names" },
        regions:               { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Region names like Europe, Southeast Asia, etc." },
        job_titles:            { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Job titles to search for (prospects only)" },
        departments:           { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Departments like engineering, sales, hr" },
        keywords:              { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Catch-all keywords for website content matching — use for niches, funding, cities, business models, etc." },
        technologies:          { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Tech stack items ONLY: React, AWS, Python, etc." },
        founded_year_min:      { type: SchemaType.NUMBER, description: "Minimum founding year (e.g. 2020)" },
        founded_year_max:      { type: SchemaType.NUMBER, description: "Maximum founding year" },
        company_name_keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Keywords to match in company names" },
      },
    },
  },
  required: ["entity_type", "filters"],
};

// ── Client singleton ───────────────────────────────────────────────────────
let genAI = null;

function getClient() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// ── Post-processing: fix what Gemini misclassifies ─────────────────────────
// Gemini flash often puts country/city/region names in keywords instead of
// the correct fields. This deterministic pass rescues them.

const COUNTRY_NAMES = {
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

const REGION_NAMES = new Set([
  "europe", "european", "north america", "asia", "asia pacific", "apac",
  "southeast asia", "south east asia", "sea", "middle east", "mena",
  "latin america", "latam", "nordics", "nordic", "africa", "south asia",
]);

// Cities → their country name (for rescue from keywords)
const CITY_COUNTRY_MAP = {
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

// US states → country
const US_STATES = new Set([
  "california", "texas", "new york state", "florida", "illinois",
  "washington", "massachusetts", "colorado", "georgia", "north carolina",
  "virginia", "pennsylvania", "ohio", "michigan", "arizona", "oregon",
  "minnesota", "maryland", "connecticut", "utah", "tennessee", "indiana",
  "missouri", "wisconsin", "nevada",
]);

/**
 * Post-process Gemini output to rescue misplaced countries, regions, and
 * cities from the keywords array into their proper filter fields.
 */
function postProcessFilters(parsed) {
  const filters = parsed.filters;
  if (!filters.countries) filters.countries = [];
  if (!filters.regions) filters.regions = [];
  if (!filters.keywords) filters.keywords = [];

  const countriesSet = new Set(filters.countries.map(c => c.toLowerCase()));
  const regionsSet = new Set(filters.regions.map(r => r.toLowerCase()));
  const remainingKeywords = [];

  for (const kw of filters.keywords) {
    const kwLower = kw.toLowerCase().trim();

    // Check if it's a country name
    if (COUNTRY_NAMES[kwLower]) {
      const canonical = COUNTRY_NAMES[kwLower];
      if (!countriesSet.has(canonical.toLowerCase())) {
        filters.countries.push(canonical);
        countriesSet.add(canonical.toLowerCase());
      }
      continue; // don't keep in keywords
    }

    // Check if it's a region name
    if (REGION_NAMES.has(kwLower)) {
      // Normalize region names
      const regionMap = {
        "european": "Europe", "europe": "Europe",
        "north america": "North America",
        "asia": "Asia", "asia pacific": "Asia Pacific", "apac": "Asia Pacific",
        "southeast asia": "Southeast Asia", "south east asia": "Southeast Asia", "sea": "Southeast Asia",
        "middle east": "Middle East", "mena": "Middle East",
        "latin america": "Latin America", "latam": "Latin America",
        "nordics": "Nordics", "nordic": "Nordics",
        "africa": "Africa", "south asia": "South Asia",
      };
      const canonical = regionMap[kwLower] || kw;
      if (!regionsSet.has(canonical.toLowerCase())) {
        filters.regions.push(canonical);
        regionsSet.add(canonical.toLowerCase());
      }
      continue;
    }

    // Check if it's a city name → add country + keep city in keywords for website matching
    if (CITY_COUNTRY_MAP[kwLower]) {
      const country = CITY_COUNTRY_MAP[kwLower];
      if (!countriesSet.has(country.toLowerCase())) {
        filters.countries.push(country);
        countriesSet.add(country.toLowerCase());
      }
      remainingKeywords.push(kw); // keep city in keywords for website content matching
      continue;
    }

    // Check if it's a US state
    if (US_STATES.has(kwLower)) {
      if (!countriesSet.has("united states")) {
        filters.countries.push("United States");
        countriesSet.add("united states");
      }
      remainingKeywords.push(kw); // keep state in keywords
      continue;
    }

    remainingKeywords.push(kw);
  }

  filters.keywords = remainingKeywords;

  // Clean up empty arrays
  if (!filters.countries.length) delete filters.countries;
  if (!filters.regions.length) delete filters.regions;
  if (!filters.keywords.length) delete filters.keywords;

  return parsed;
}

/**
 * Also scan the raw prompt for geographic terms that Gemini missed entirely
 * (not even in keywords). This is the safety net.
 */
function rescueGeographyFromPrompt(parsed, prompt) {
  const filters = parsed.filters;
  const promptLower = prompt.toLowerCase();

  if (!filters.countries) filters.countries = [];
  if (!filters.regions) filters.regions = [];
  const countriesSet = new Set(filters.countries.map(c => c.toLowerCase()));
  const regionsSet = new Set(filters.regions.map(r => r.toLowerCase()));

  // Scan for country names in the original prompt
  for (const [term, canonical] of Object.entries(COUNTRY_NAMES)) {
    // Match as whole word to avoid false positives (e.g. "in" matching India)
    if (term.length < 3) continue; // skip "us", "uk" — too ambiguous as substrings
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (regex.test(promptLower) && !countriesSet.has(canonical.toLowerCase())) {
      filters.countries.push(canonical);
      countriesSet.add(canonical.toLowerCase());
    }
  }

  // Scan for region names
  for (const region of REGION_NAMES) {
    if (region.length < 4) continue;
    const regex = new RegExp(`\\b${region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (regex.test(promptLower) && !regionsSet.has(region)) {
      const regionMap = {
        "european": "Europe", "europe": "Europe",
        "north america": "North America",
        "southeast asia": "Southeast Asia", "south east asia": "Southeast Asia",
        "middle east": "Middle East", "mena": "Middle East",
        "latin america": "Latin America", "latam": "Latin America",
        "nordics": "Nordics", "nordic": "Nordics",
        "africa": "Africa", "south asia": "South Asia",
        "asia pacific": "Asia Pacific", "apac": "Asia Pacific",
        "asia": "Asia",
      };
      const canonical = regionMap[region] || region;
      if (!regionsSet.has(canonical.toLowerCase())) {
        filters.regions.push(canonical);
        regionsSet.add(canonical.toLowerCase());
      }
    }
  }

  // Scan for city names
  for (const [city, country] of Object.entries(CITY_COUNTRY_MAP)) {
    const regex = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (regex.test(promptLower) && !countriesSet.has(country.toLowerCase())) {
      filters.countries.push(country);
      countriesSet.add(country.toLowerCase());
    }
  }

  // Scan for US states
  for (const state of US_STATES) {
    const regex = new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (regex.test(promptLower) && !countriesSet.has("united states")) {
      filters.countries.push("United States");
      countriesSet.add("united states");
    }
  }

  if (!filters.countries.length) delete filters.countries;
  if (!filters.regions.length) delete filters.regions;

  return parsed;
}

/**
 * Parse a natural language prompt into structured B2B filters via Gemini.
 *
 * Uses systemInstruction (not a faked multi-turn) and JSON response mode
 * so the SDK guarantees valid JSON — no regex stripping needed.
 *
 * After Gemini returns, deterministic post-processing rescues geographic
 * terms that the model misplaced into keywords.
 */
export async function parsePromptToFilters(prompt) {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const responseText = result.response.text().trim();

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(`Gemini returned unparseable response: "${responseText.slice(0, 200)}"`);
  }

  // Defensive validation
  if (!parsed.entity_type || !["company", "prospect"].includes(parsed.entity_type)) {
    throw new Error(`Invalid entity_type from Gemini: "${parsed.entity_type}"`);
  }
  if (!parsed.filters || typeof parsed.filters !== "object") {
    throw new Error("Gemini returned empty filters object");
  }

  // Fix 1: Rescue countries/regions/cities from keywords
  parsed = postProcessFilters(parsed);

  // Fix 2: Safety net — scan original prompt for geography Gemini missed entirely
  parsed = rescueGeographyFromPrompt(parsed, prompt);

  return parsed;
}
