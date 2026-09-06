# Morning Light Cinema Agent

Agentic Cinema MVP (Parallel track): theme prompt → Parallel Search cited research → Gemini 6-scene cinematic storyboard.

## Setup

1. Copy `.env.example` to `.env` and set `PARALLEL_API_KEY` + `GEMINI_API_KEY`
2. `npm install`
3. `npm start` (PORT default 3000)

## API

- `GET /api/health` — providers parallel+gemini booleans (no secrets)
- `POST /api/generate` — `{ "theme": "..." }`

## Smoke

`npm run smoke` — prints key set/length; if both set, writes `sample-out.json`

## Render

Web Service from this repo. Build: `npm install`. Start: `npm start`. Set both API keys. Health check: `/api/health`.

## Stack

Express + Parallel Search + `@google/genai`. No Tavily. MIT.
