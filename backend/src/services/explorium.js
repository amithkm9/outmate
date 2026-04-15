import { logError } from "../utils/logger.js";

const EXPLORIUM_BASE_URL = "https://api.explorium.ai/v1";
const MAX_RESULTS = 3;

// ═══════════════════════════════════════════════════════════════════════════
// Section 1: Constants — Explorium enum values and geographic mappings
// ═══════════════════════════════════════════════════════════════════════════

const COUNTRY_CODE_MAP = {
  "united states": "us", "usa": "us", "us": "us",
  "united kingdom": "gb", "uk": "gb", "england": "gb",
  "canada": "ca", "germany": "de", "france": "fr",
  "india": "in", "australia": "au", "japan": "jp",
  "china": "cn", "brazil": "br", "mexico": "mx",
  "spain": "es", "italy": "it", "netherlands": "nl",
  "sweden": "se", "switzerland": "ch", "singapore": "sg",
  "israel": "il", "south korea": "kr", "ireland": "ie",
  "norway": "no", "denmark": "dk", "finland": "fi",
  "portugal": "pt", "belgium": "be", "austria": "at",
  "poland": "pl", "new zealand": "nz", "south africa": "za",
  "uae": "ae", "united arab emirates": "ae",
};

const REGION_COUNTRY_CODES = {
  "europe": ["gb", "de", "fr", "es", "it", "nl", "se", "ch", "ie", "no", "dk", "fi", "pt", "be", "at", "pl"],
  "north america": ["us", "ca", "mx"],
  "asia": ["in", "jp", "cn", "sg", "kr"],
  "middle east": ["ae", "il"],
};

// Explorium's valid company_size enum values and their numeric boundaries
const EMPLOYEE_RANGES = [
  { label: "1-10",    min: 1,     max: 10 },
  { label: "11-50",   min: 11,    max: 50 },
  { label: "51-200",  min: 51,    max: 200 },
  { label: "201-500", min: 201,   max: 500 },
  { label: "501-1000", min: 501,  max: 1000 },
  { label: "1001-5000", min: 1001, max: 5000 },
  { label: "5001-10000", min: 5001, max: 10000 },
  { label: "10001+",  min: 10001, max: Infinity },
];

// Explorium's valid revenue enum values and their numeric boundaries (USD)
const REVENUE_RANGES = [
  { label: "0-500K",    min: 0,               max: 500_000 },
  { label: "500K-1M",   min: 500_000,         max: 1_000_000 },
  { label: "1M-5M",     min: 1_000_000,       max: 5_000_000 },
  { label: "5M-10M",    min: 5_000_000,       max: 10_000_000 },
  { label: "10M-25M",   min: 10_000_000,      max: 25_000_000 },
  { label: "25M-75M",   min: 25_000_000,      max: 75_000_000 },
  { label: "75M-200M",  min: 75_000_000,      max: 200_000_000 },
  { label: "200M-500M", min: 200_000_000,     max: 500_000_000 },
  { label: "500M-1B",   min: 500_000_000,     max: 1_000_000_000 },
  { label: "1B-10B",    min: 1_000_000_000,   max: 10_000_000_000 },
  { label: "10B-100B",  min: 10_000_000_000,  max: 100_000_000_000 },
  { label: "100B-1T",   min: 100_000_000_000, max: 1_000_000_000_000 },
  { label: "1T-10T",    min: 1_000_000_000_000, max: 10_000_000_000_000 },
  { label: "10T+",      min: 10_000_000_000_000, max: Infinity },
];

// ═══════════════════════════════════════════════════════════════════════════
// Section 2: Filter Mappers — convert Gemini output to Explorium format
// ═══════════════════════════════════════════════════════════════════════════

/** Find all Explorium range labels that overlap with [requestedMin, requestedMax]. */
function findOverlappingRanges(ranges, requestedMin, requestedMax) {
  const min = requestedMin ?? 0;
  const max = requestedMax ?? Infinity;
  return ranges
    .filter((r) => r.max >= min && r.min <= max)
    .map((r) => r.label);
}

/** Resolve country names and region names into ISO Alpha-2 codes. */
function resolveCountryCodes(countries, regions) {
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

// ═══════════════════════════════════════════════════════════════════════════
// Section 3: Payload Builders — assemble Explorium request bodies
// ═══════════════════════════════════════════════════════════════════════════

function buildCompanyPayload(filters) {
  const f = {};

  const countryCodes = resolveCountryCodes(filters.countries, filters.regions);
  if (countryCodes.length) f.country_code = { values: countryCodes };

  if (filters.employee_count_min != null || filters.employee_count_max != null) {
    const sizes = findOverlappingRanges(EMPLOYEE_RANGES, filters.employee_count_min, filters.employee_count_max);
    if (sizes.length) f.company_size = { values: sizes };
  }

  if (filters.revenue_min != null || filters.revenue_max != null) {
    const rev = findOverlappingRanges(REVENUE_RANGES, filters.revenue_min, filters.revenue_max);
    if (rev.length) f.company_revenue = { values: rev };
  }

  if (filters.industry?.length) {
    f.linkedin_category = { values: filters.industry.map((i) => i.toLowerCase()) };
  }

  // website_keywords searches actual site content — skip vague/qualitative terms
  // that describe trends rather than what a website would literally contain
  if (filters.keywords?.length) {
    const VAGUE_PATTERNS = /\b(increasing|growing|fast-growing|high growth|trending|top|best|leading)\b/i;
    const usable = filters.keywords.filter((k) => !VAGUE_PATTERNS.test(k));
    if (usable.length) {
      f.website_keywords = { values: usable, operator: "OR" };
    }
  }

  // Only pass actual tech stack names (e.g. "React", "AWS"), not industry terms
  // that Gemini sometimes misclassifies as technologies
  const INDUSTRY_TERMS = new Set([
    "cybersecurity", "fintech", "saas", "ai", "machine learning",
    "blockchain", "iot", "cloud", "devops", "data science",
  ]);
  if (filters.technologies?.length) {
    const realTech = filters.technologies.filter((t) => !INDUSTRY_TERMS.has(t.toLowerCase()));
    if (realTech.length) f.company_tech_stack_tech = { values: realTech };
  }

  return { mode: "full", size: MAX_RESULTS, page_size: MAX_RESULTS, page: 1, filters: f };
}

function buildProspectPayload(filters) {
  const f = {};

  if (filters.job_titles?.length) {
    f.job_title = { values: filters.job_titles, include_related_job_titles: true };
  }

  if (filters.departments?.length) {
    f.job_department = { values: filters.departments.map((d) => d.toLowerCase()) };
  }

  const countryCodes = resolveCountryCodes(filters.countries, filters.regions);
  if (countryCodes.length) f.company_country_code = { values: countryCodes };

  if (filters.employee_count_min != null || filters.employee_count_max != null) {
    const sizes = findOverlappingRanges(EMPLOYEE_RANGES, filters.employee_count_min, filters.employee_count_max);
    if (sizes.length) f.company_size = { values: sizes };
  }

  if (filters.revenue_min != null || filters.revenue_max != null) {
    const rev = findOverlappingRanges(REVENUE_RANGES, filters.revenue_min, filters.revenue_max);
    if (rev.length) f.company_revenue = { values: rev };
  }

  if (filters.industry?.length) {
    f.linkedin_category = { values: filters.industry.map((i) => i.toLowerCase()) };
  }

  return { mode: "full", size: MAX_RESULTS, page_size: MAX_RESULTS, page: 1, filters: f };
}

// ═══════════════════════════════════════════════════════════════════════════
// Section 4: Normalizers — convert raw Explorium records to clean shapes
// ═══════════════════════════════════════════════════════════════════════════

/** Title-case geographic strings only ("united states" → "United States"). */
function geoTitleCase(str) {
  if (!str) return "N/A";
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeCompany(raw) {
  return {
    type: "company",
    name: raw.name || "N/A",
    domain: raw.domain || raw.website || "N/A",
    industry: raw.naics_description || raw.linkedin_category || raw.sic_code_description || "N/A",
    revenue: raw.yearly_revenue_range || "N/A",
    employee_count: raw.number_of_employees_range || "N/A",
    country: geoTitleCase(raw.country_name),
    city: geoTitleCase(raw.city_name),
    state: geoTitleCase(raw.region),
    linkedin_url: raw.linkedin_profile || raw.linkedin_url || "N/A",
    website: raw.website || "N/A",
    founded_year: raw.year_founded || "N/A",
    description: raw.business_description || "N/A",
    tech_stack: raw.tech_stack || raw.technologies || [],
    key_contacts: raw.key_contacts || raw.contacts || [],
    logo: raw.logo || null,
    business_id: raw.business_id || "N/A",
    raw,
  };
}

function normalizeProspect(raw) {
  return {
    type: "prospect",
    name: raw.full_name || `${raw.first_name || ""} ${raw.last_name || ""}`.trim() || "N/A",
    title: raw.job_title || "N/A",
    company: raw.company_name || "N/A",
    email: raw.email || "N/A",
    phone: raw.phone || "N/A",
    country: geoTitleCase(raw.country_name),
    city: geoTitleCase(raw.city),
    linkedin_url: raw.linkedin || "N/A",
    department: raw.job_department_main || "N/A",
    seniority: raw.job_level_main || "N/A",
    skills: raw.skills || [],
    prospect_id: raw.prospect_id || "N/A",
    raw,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Section 5: API Client — call Explorium with retry-on-422 logic
// ═══════════════════════════════════════════════════════════════════════════

function getApiKey() {
  if (!process.env.EXPLORIUM_API_KEY) {
    throw new Error("EXPLORIUM_API_KEY is not configured");
  }
  return process.env.EXPLORIUM_API_KEY;
}

/**
 * Make a single Explorium API call. Returns the raw response or throws.
 */
async function callExplorium(endpoint, payload, apiKey) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "API_KEY": apiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "No response body");
    return { ok: false, status: response.status, errorBody };
  }

  return { ok: true, data: await response.json() };
}

/**
 * Parse a 422 error body and return the filter field name(s) that caused it.
 * Explorium 422 format: { detail: [{ loc: ["body","filters","<field>"], msg: "..." }] }
 */
function extractInvalidFilters(errorBody) {
  try {
    const { detail } = JSON.parse(errorBody);
    if (!Array.isArray(detail)) return [];
    const fields = new Set();
    for (const d of detail) {
      // loc looks like ["body", "filters", "linkedin_category"] or deeper
      const filterIdx = d.loc?.indexOf("filters");
      if (filterIdx !== -1 && d.loc[filterIdx + 1]) {
        fields.add(d.loc[filterIdx + 1]);
      }
    }
    return [...fields];
  } catch {
    return [];
  }
}

/**
 * Search and enrich via Explorium. If a 422 occurs due to an invalid filter,
 * removes the offending filter(s) and retries once — so a single bad
 * linkedin_category from Gemini doesn't kill the entire request.
 */
export async function searchAndEnrich(entityType, filters) {
  const apiKey = getApiKey();
  const isCompany = entityType === "company";
  const endpoint = isCompany
    ? `${EXPLORIUM_BASE_URL}/businesses`
    : `${EXPLORIUM_BASE_URL}/prospects`;

  let payload = isCompany ? buildCompanyPayload(filters) : buildProspectPayload(filters);

  if (process.env.NODE_ENV === "development") {
    console.log("[EXPLORIUM] Request:", endpoint, JSON.stringify(payload, null, 2));
  }

  let result = await callExplorium(endpoint, payload, apiKey);

  // ── Retry logic: if 422, strip the bad filter(s) and try once more ──
  if (!result.ok && result.status === 422) {
    const badFields = extractInvalidFilters(result.errorBody);

    if (badFields.length > 0 && Object.keys(payload.filters).length > badFields.length) {
      console.warn(`[EXPLORIUM] Stripping invalid filters [${badFields.join(", ")}] and retrying`);
      for (const field of badFields) {
        delete payload.filters[field];
      }
      result = await callExplorium(endpoint, payload, apiKey);
    }
  }

  // ── If still failing, throw a descriptive error ──
  if (!result.ok) {
    logError("explorium_api", new Error(`Explorium ${result.status}: ${result.errorBody}`));

    const messages = {
      401: "Invalid or unauthorized API key",
      403: "Invalid or unauthorized API key",
      429: "Explorium rate limit exceeded — please wait a moment",
      422: "Search filters are not compatible with Explorium — try rephrasing",
    };
    throw new Error(messages[result.status] || `Explorium API error (${result.status})`);
  }

  // ── Normalize and enforce the 3-record limit ──
  const records = (result.data.data || []).slice(0, MAX_RESULTS);
  return records.map(isCompany ? normalizeCompany : normalizeProspect);
}
