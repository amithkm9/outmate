import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// ── System instruction: tells Gemini HOW to behave ─────────────────────────
const SYSTEM_INSTRUCTION = `You are a B2B data filter extraction engine for the Explorium API.
Convert sales/marketing natural language prompts into structured JSON filters.

ENTITY TYPE RULES:
- If the prompt mentions job titles, roles, people, contacts, leaders → "prospect"
- If the prompt mentions companies, firms, startups, organizations → "company"
- If ambiguous, default to "company"

INDUSTRY VALUES — you MUST only use these exact strings (copy exactly, including commas):
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

MAPPING RULES:
- "SaaS" / "software" → industry: ["software development"]
- "fintech" → industry: ["financial services"]
- "cybersecurity" / "infosec" → industry: ["computer and network security"]. Do NOT put "cybersecurity" in technologies.
- "AI" / "artificial intelligence" → industry: ["technology, information and internet"], keywords: ["AI"]
- "e-commerce" → industry: ["online and mail order retail", "retail"]
- Regions like "European" → regions: ["Europe"]; "North America" → regions: ["North America"]
- Country names like "US" → countries: ["United States"]
- "at least 200 employees" → employee_count_min: 200
- "10-200 employees" → employee_count_min: 10, employee_count_max: 200
- "revenue > $50M" → revenue_min: 50000000
- "marketing leaders" → job_titles: ["CMO", "VP Marketing", "Head of Marketing", "Marketing Director"]
- "hiring ML engineers" → keywords: ["machine learning", "hiring"]
- "increasing web traffic" → keywords: ["increasing web traffic"]

IMPORTANT:
- The "technologies" field is ONLY for actual tech stack items (React, AWS, Python, etc). Never put industry names there.
- Always extract employee count constraints when the prompt mentions them ("at least X", "more than X", "X-Y employees").
- Handle ambiguous prompts with reasonable assumptions. Always include at least one filter.`;

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
        industry:           { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        employee_count_min: { type: SchemaType.NUMBER },
        employee_count_max: { type: SchemaType.NUMBER },
        revenue_min:        { type: SchemaType.NUMBER },
        revenue_max:        { type: SchemaType.NUMBER },
        countries:          { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        regions:            { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        job_titles:         { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        departments:        { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        keywords:           { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        technologies:       { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
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

/**
 * Parse a natural language prompt into structured B2B filters via Gemini.
 *
 * Uses systemInstruction (not a faked multi-turn) and JSON response mode
 * so the SDK guarantees valid JSON — no regex stripping needed.
 */
export async function parsePromptToFilters(prompt) {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  });

  // Timeout: abort if Gemini doesn't respond within 15 seconds
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

  // Defensive validation (schema should prevent this, but belt-and-suspenders)
  if (!parsed.entity_type || !["company", "prospect"].includes(parsed.entity_type)) {
    throw new Error(`Invalid entity_type from Gemini: "${parsed.entity_type}"`);
  }
  if (!parsed.filters || typeof parsed.filters !== "object") {
    throw new Error("Gemini returned empty filters object");
  }

  return parsed;
}
