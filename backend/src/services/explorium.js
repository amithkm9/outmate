import { logError } from "../utils/logger.js";
import { resolveCountryCodes } from "../utils/geography.js";

const EXPLORIUM_BASE_URL = "https://api.explorium.ai/v1";
const MAX_RESULTS = 3;

// ═══════════════════════════════════════════════════════════════════════════
// Section 1: Constants — Explorium-specific enum values
// ═══════════════════════════════════════════════════════════════════════════

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

// Industry buzzwords that Gemini may misplace into the technologies field
const INDUSTRY_TERMS = new Set([
  "cybersecurity", "fintech", "saas", "ai", "machine learning",
  "artificial intelligence", "blockchain", "iot", "cloud", "devops",
  "data science", "edtech", "cleantech", "climate tech", "proptech",
  "insurtech", "legaltech", "hr tech", "food tech", "fashion tech",
  "e-commerce", "ecommerce", "deep learning", "nlp", "computer vision",
]);

// Vague/qualitative terms that don't match actual website content
const VAGUE_PATTERN = /^(increasing|growing|fast-growing|high growth|trending|top|best|leading|established|emerging)$/i;

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

// ═══════════════════════════════════════════════════════════════════════════
// Section 3: Payload Builders — assemble Explorium request bodies
// ═══════════════════════════════════════════════════════════════════════════

function buildCompanyPayload(filters) {
  const f = {};

  const countryCodes = resolveCountryCodes(filters.countries, filters.regions);
  if (countryCodes.length) f.country_code = { values: countryCodes };

  if (filters.employee_count_min != null || filters.employee_count_max != null) {
    // Handle "0 employees" / "no employees" — map to smallest range
    if (filters.employee_count_max === 0) {
      f.company_size = { values: ["1-10"] };
    } else {
      const sizes = findOverlappingRanges(EMPLOYEE_RANGES, filters.employee_count_min, filters.employee_count_max);
      if (sizes.length) f.company_size = { values: sizes };
    }
  }

  if (filters.revenue_min != null || filters.revenue_max != null) {
    const rev = findOverlappingRanges(REVENUE_RANGES, filters.revenue_min, filters.revenue_max);
    if (rev.length) f.company_revenue = { values: rev };
  }

  if (filters.industry?.length) {
    f.linkedin_category = { values: filters.industry.map((i) => i.toLowerCase()) };
  }

  // Separate real tech stack items from industry buzzwords that Gemini misclassifies
  const misplacedKeywords = [];
  if (filters.technologies?.length) {
    const realTech = [];
    for (const t of filters.technologies) {
      if (INDUSTRY_TERMS.has(t.toLowerCase())) {
        misplacedKeywords.push(t); // rescue into keywords
      } else {
        realTech.push(t);
      }
    }
    if (realTech.length) f.company_tech_stack_tech = { values: realTech };
  }

  // Collect all keyword sources into a single pool
  const allKeywords = [];

  if (filters.keywords?.length) {
    allKeywords.push(...filters.keywords);
  }

  // Rescued industry terms from technologies → keywords
  if (misplacedKeywords.length) {
    allKeywords.push(...misplacedKeywords);
  }

  // company_name_keywords → use as website keywords (Explorium doesn't have a name filter)
  if (filters.company_name_keywords?.length) {
    allKeywords.push(...filters.company_name_keywords);
  }

  // founded_year_min/max → Explorium has no direct filter, but we can add as keyword signal
  if (filters.founded_year_min) {
    allKeywords.push(`founded ${filters.founded_year_min}`);
  }

  // Filter out vague/qualitative terms that don't match website content
  const usableKeywords = allKeywords.filter((k) => !VAGUE_PATTERN.test(k.trim()));
  if (usableKeywords.length) {
    f.website_keywords = { values: usableKeywords, operator: "OR" };
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
    if (filters.employee_count_max === 0) {
      f.company_size = { values: ["1-10"] };
    } else {
      const sizes = findOverlappingRanges(EMPLOYEE_RANGES, filters.employee_count_min, filters.employee_count_max);
      if (sizes.length) f.company_size = { values: sizes };
    }
  }

  if (filters.revenue_min != null || filters.revenue_max != null) {
    const rev = findOverlappingRanges(REVENUE_RANGES, filters.revenue_min, filters.revenue_max);
    if (rev.length) f.company_revenue = { values: rev };
  }

  if (filters.industry?.length) {
    f.linkedin_category = { values: filters.industry.map((i) => i.toLowerCase()) };
  }

  // For prospects, keywords from the query can help narrow company context
  if (filters.keywords?.length) {
    const usable = filters.keywords.filter((k) => !VAGUE_PATTERN.test(k.trim()));
    if (usable.length) {
      f.company_website_keywords = { values: usable, operator: "OR" };
    }
  }

  return { mode: "full", size: MAX_RESULTS, page_size: MAX_RESULTS, page: 1, filters: f };
}

// ═══════════════════════════════════════════════════════════════════════════
// Section 4: Normalizers — convert raw Explorium records to clean shapes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pick the best LinkedIn URL from Explorium data.
 * Explorium returns an encoded opaque ID in `linkedin` (e.g. "linkedin.com/in/ACoAAA...")
 * and sometimes a `linkedin_url_array` that contains the real vanity URL as the 2nd entry.
 * Prefer the vanity URL since the encoded one returns 404 on LinkedIn.
 */
function pickBestLinkedInUrl(raw, urlField, arrayField) {
  // First try the array — find a vanity URL (one that doesn't start with "ACo")
  const arr = raw[arrayField];
  if (Array.isArray(arr) && arr.length > 0) {
    const vanity = arr.find((u) => u && !u.includes("/ACoA"));
    if (vanity) return ensureHttps(vanity);
    // fallback to first entry in array
    return ensureHttps(arr[0]);
  }
  // Fallback to the single field
  const single = raw[urlField];
  if (single) return ensureHttps(single);
  return null;
}

function ensureHttps(url) {
  if (!url || url === "N/A") return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed}`;
}

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
    linkedin_url: ensureHttps(raw.linkedin_profile || raw.linkedin_url || raw.company_linkedin) || "N/A",
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
    linkedin_url: pickBestLinkedInUrl(raw, "linkedin", "linkedin_url_array") || "N/A",
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
 * Progressively relax filters to find results. Returns a list of filter keys
 * ordered from least important (drop first) to most important (drop last).
 */
function getRelaxationOrder(isCompany) {
  // Drop least essential filters first; keep geography and core identity last.
  // Keywords/tech are dropped first since they over-constrain website content.
  // Geography (country_code) is kept as long as possible since wrong-country
  // results are worse than fewer results.
  if (isCompany) {
    return ["company_tech_stack_tech", "website_keywords", "company_revenue", "company_size", "linkedin_category", "country_code"];
  }
  return ["company_website_keywords", "company_revenue", "company_size", "linkedin_category", "job_department", "company_country_code", "job_title"];
}

/**
 * Search and enrich via Explorium. Handles:
 * 1. 422 errors: strips invalid filter(s) and retries
 * 2. Empty results: progressively relaxes filters to broaden the search
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

  // ── Relaxation: if results are empty, progressively drop filters ──
  if (result.ok && (!result.data.data || result.data.data.length === 0)) {
    const relaxOrder = getRelaxationOrder(isCompany);
    for (const filterKey of relaxOrder) {
      if (!payload.filters[filterKey]) continue;
      // Keep at least one filter
      if (Object.keys(payload.filters).length <= 1) break;

      console.warn(`[EXPLORIUM] No results — relaxing filter: ${filterKey}`);
      delete payload.filters[filterKey];
      result = await callExplorium(endpoint, payload, apiKey);

      if (result.ok && result.data.data?.length > 0) break;
      if (!result.ok) break;
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
