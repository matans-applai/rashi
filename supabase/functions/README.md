# Supabase Edge Functions

## ai-request-router

Server-side endpoint that calls OpenAI on behalf of the browser. The browser
never sees the OpenAI API key.

### Two modes

| `mode` | What it does |
|---|---|
| `route` | Initial classification of a free-text request → returns routing JSON (route, confidence, summary, triggers, missing-info questions). |
| `legal_intake` | Chat-based legal-intake extraction → returns a `legal_case` object + follow-up questions. |

Both modes use OpenAI **Structured Outputs** (`response_format: json_schema`)
so the reply strictly matches the schemas in `schemas.ts`.

### Files

- `index.ts` — HTTP handler, OpenAI caller.
- `schemas.ts` — JSON schemas for the two response shapes.
- `prompts.ts` — Hebrew system prompts for both modes.
- `deno.json` — Deno tasks config.

### Required secrets

Set these once via the Supabase CLI (do **not** commit):

```bash
supabase login                                       # one-time
supabase link --project-ref obektqmbcyevqhervrsp     # link this repo to the project
supabase secrets set OPENAI_API_KEY=sk-...           # your OpenAI key
# Optional override — defaults to gpt-4o-mini:
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

You can also set secrets in the Supabase Studio UI:
*Project Settings → Edge Functions → Secrets*.

### Deploy

```bash
supabase functions deploy ai-request-router --no-verify-jwt
```

`--no-verify-jwt` makes the function callable from the browser with the
project's anon key. Auth is still enforced at the DB layer via RLS.

### Local development

```bash
# In one terminal:
supabase functions serve ai-request-router --env-file ./supabase/.env.local

# Where ./supabase/.env.local contains:
#   OPENAI_API_KEY=sk-...
#   OPENAI_MODEL=gpt-4o-mini   (optional)
```

⚠ Never commit `supabase/.env.local`. It's in `.gitignore`.

### Testing the deployed function

```bash
curl -X POST \
  "https://obektqmbcyevqhervrsp.supabase.co/functions/v1/ai-request-router" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "route",
    "messages": [
      { "role": "user", "content": "אנחנו רוצים להזמין את מחשוב ישיר להתקנת ציוד מחשוב, 18000 ש״ח. יש הצעת מחיר נקייה." }
    ]
  }'
```

### Model choice

The user asked for `gpt-5.4-mini` which doesn't exist on OpenAI as of this
writing. The default falls back to `gpt-4o-mini` (same fast/cheap tier and
supports strict `json_schema` outputs). To swap, set the `OPENAI_MODEL` secret.
