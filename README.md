# OutMate - NLP Enrichment Demo

A mini version of Outmate.ai's **NLP Database Enrichment** feature. Users type any natural language prompt, and the system converts it to structured B2B filters using Gemini, fetches enriched data from Explorium APIs, and displays it in a clean table.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│               (React + Vite on Vercel)                  │
│                                                         │
│   ┌──────────┐  ┌──────────────┐  ┌───────────────┐    │
│   │  Prompt   │  │   Sample     │  │   Results     │    │
│   │  Input    │──│   Prompts    │  │   Table +     │    │
│   │  Box      │  │   Section    │  │   JSON Modal  │    │
│   └─────┬────┘  └──────────────┘  └───────┬───────┘    │
│         │            POST /api/enrich      │            │
└─────────┼──────────────────────────────────┼────────────┘
          │                                  │
          ▼                                  ▲
┌─────────────────────────────────────────────────────────┐
│                      BACKEND                            │
│             (Express.js on Render)                      │
│                                                         │
│   ┌──────────┐  ┌──────────────┐  ┌───────────────┐    │
│   │  Input   │  │   Gemini     │  │  Explorium    │    │
│   │  Validate│─▶│   NLP Parse  │─▶│  Search &     │    │
│   │          │  │  → Filters   │  │  Enrich       │    │
│   └──────────┘  └──────────────┘  └───────────────┘    │
│                                                         │
│   Middleware: CORS, Rate Limit (10 req/min/IP)          │
└─────────────────────────────────────────────────────────┘
          │                      │
          ▼                      ▼
   ┌─────────────┐       ┌──────────────┐
   │ Google       │       │  Explorium   │
   │ Gemini API   │       │  REST API    │
   │ (NLP→JSON)   │       │  (B2B Data)  │
   └─────────────┘       └──────────────┘
```

## Tech Stack

| Layer      | Technology                      |
|------------|---------------------------------|
| Frontend   | React 18, Vite, CSS             |
| Backend    | Node.js, Express.js             |
| AI Model   | Google Gemini 2.5 Flash Lite    |
| Data API   | Explorium REST API              |
| Deployment | Vercel (frontend), Render (backend) |

## How to Run Locally

### Prerequisites
- Node.js 18+
- Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- Explorium API key

### Backend

```bash
cd backend
npm install

# Create .env from example
cp .env.example .env
# Edit .env and add your API keys:
#   GEMINI_API_KEY=your_key
#   EXPLORIUM_API_KEY=your_key

npm run dev
# Server starts at http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install

# Create .env from example
cp .env.example .env
# Edit .env if backend URL differs from default

npm run dev
# App starts at http://localhost:5173
```

## Environment Variables

### Backend (`backend/.env`)
| Variable           | Description                    | Required |
|--------------------|--------------------------------|----------|
| `GEMINI_API_KEY`   | Google Gemini API key          | Yes      |
| `EXPLORIUM_API_KEY`| Explorium REST API key         | Yes      |
| `PORT`             | Server port (default: 3001)    | No       |
| `FRONTEND_URL`     | Allowed CORS origin            | No       |
| `NODE_ENV`         | `development` or `production`  | No       |

### Frontend (`frontend/.env`)
| Variable       | Description                       | Required |
|----------------|-----------------------------------|----------|
| `VITE_API_URL` | Backend base URL                  | No       |

## API Contract

### `POST /api/enrich`

**Request:**
```json
{
  "prompt": "Find 3 fast-growing SaaS companies in the US with 50-500 employees"
}
```

**Success Response (200):**
```json
{
  "results": [
    {
      "type": "company",
      "name": "Sprinto",
      "domain": "sprinto.com",
      "industry": "Software Publishers",
      "revenue": "75M-200M",
      "employee_count": "201-500",
      "country": "United States",
      "city": "San Francisco",
      "state": "California",
      "linkedin_url": "https://www.linkedin.com/company/sprinto-com",
      "website": "sprinto.com",
      "founded_year": "N/A",
      "description": "Automating Information Security Compliances...",
      "logo": "https://media.licdn.com/...",
      "business_id": "89f3358b...",
      "raw": { ... }
    }
  ],
  "meta": {
    "entity_type": "company",
    "filters_used": {
      "industry": ["SaaS"],
      "employee_count_min": 50,
      "employee_count_max": 500,
      "countries": ["United States"],
      "keywords": ["fast-growing"]
    },
    "total_results": 3,
    "duration_ms": 2340
  }
}
```

**Error Response:**
```json
{
  "error": true,
  "message": "Failed to parse prompt with AI: ...",
  "error_code": "GEMINI_ERROR"
}
```

### `GET /api/health`

**Response:**
```json
{
  "status": "ok"
}
```

## Sample Prompts

1. "Find 3 fast-growing SaaS companies in the US with 50-500 employees, raising Series B or later."
2. "Give me 3 VPs of Sales in European fintech startups with more than 100 employees."
3. "Top AI infrastructure companies hiring machine learning engineers in India."
4. "3 marketing leaders at e-commerce brands in North America doing more than $50M in revenue."
5. "Cybersecurity firms with increasing web traffic and at least 200 employees."

## Project Structure

```
outmate/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server entry
│   │   ├── routes/
│   │   │   ├── enrich.js         # POST /api/enrich handler
│   │   │   └── health.js         # GET /api/health handler
│   │   ├── services/
│   │   │   ├── gemini.js         # Gemini prompt→filters parsing
│   │   │   └── explorium.js      # Explorium API search & normalize
│   │   ├── middleware/
│   │   │   └── rateLimiter.js    # 10 req/min/IP rate limit
│   │   └── utils/
│   │       └── logger.js         # Structured request logging
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Main app with state management
│   │   ├── App.css
│   │   ├── index.css             # Global styles & theme
│   │   ├── main.jsx              # React entry point
│   │   └── components/
│   │       ├── Header.jsx        # App header
│   │       ├── PromptInput.jsx   # Textarea input
│   │       ├── SamplePrompts.jsx # Clickable example prompts
│   │       ├── FilterBadges.jsx  # Shows parsed filters
│   │       ├── ResultsTable.jsx  # Data table (desktop + mobile)
│   │       └── JsonModal.jsx     # Raw JSON viewer modal
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```
