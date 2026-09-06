# Morning Light Cinema Agent

Agentic Cinema MVP (Parallel track): theme prompt → Parallel Search cited research → Gemini 6-scene cinematic storyboard.

## Setup

1. Copy `.env.example` to `.env` and set `PARALLEL_API_KEY` + `GEMINI_API_KEY`
2. `npm install`
3. `npm start` (PORT default 3000)

## API

- `GET /api/health` — providers parallel+gemini booleans (no secrets); reports primary Gemini model and fallbacks
- `POST /api/generate` — `{ "theme": "..." }`

## Gemini model

Default primary model is `gemini-1.5-flash` (stable). Override with `GEMINI_MODEL` in `.env`.

On 503/high-demand errors the agent retries, then falls back in order: `gemini-1.5-flash` → `gemini-2.0-flash` → `gemini-2.5-flash`.

## Smoke

`npm run smoke` — prints key set/length; if both set, writes `sample-out.json`

## Tests

`npm test` — unit tests for Gemini model chain, retry detection, and error formatting

## Render

Web Service from this repo. Build: `npm install`. Start: `npm start`. Set both API keys. Health check: `/api/health`.

## Stack

Express + Parallel Search + `@google/genai`. No Tavily. MIT.
