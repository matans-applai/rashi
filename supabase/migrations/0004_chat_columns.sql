-- =====================================================================
-- Chat-first migration: store the LLM conversation and structured outputs.
-- Additive — does NOT break existing rows or RLS.
-- =====================================================================

alter table public.requests
  add column if not exists chat_messages    jsonb,    -- [{role, content, ts}]
  add column if not exists llm_output       jsonb,    -- latest routing JSON
  add column if not exists legal_case       jsonb,    -- latest legal-intake JSON
  add column if not exists selected_route   text,     -- after user approval
  add column if not exists route_confidence text;     -- low | medium | high

-- No new RLS policies needed — the existing "own rows" policies cover these
-- columns automatically.
