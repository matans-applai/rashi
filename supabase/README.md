# Supabase setup

Two ways to apply: **(A)** copy-paste SQL into Supabase Studio (simplest), or **(B)** use the Supabase CLI.

## (A) Supabase Studio (manual, recommended for POC)

1. **Create project** at https://supabase.com/dashboard → *New Project*.
2. Open **SQL Editor → New query**, paste the contents of [`migrations/0001_init.sql`](migrations/0001_init.sql), click **Run**.
3. Open **Storage → New bucket**, name it `request-files`, *Public bucket = off*, click **Create bucket**.
4. Back to **SQL Editor → New query**, paste [`migrations/0002_storage_policies.sql`](migrations/0002_storage_policies.sql), click **Run**.
5. Paste [`migrations/0003_delete_policies.sql`](migrations/0003_delete_policies.sql), click **Run**. This enables users to delete their own requests and uploaded files.
6. (Optional) Run [`seed.sql`](seed.sql) the same way to populate the demo suppliers table.
7. **Authentication → Users → Add user → Create new user** — create 1-2 demo users (e.g. `demo@rashi.org` / strong pwd). Tick **Auto Confirm User**. Optional User metadata to show a Hebrew name on the dashboard:
   ```json
   { "full_name": "מתן שמיע" }
   ```
8. **Project Settings → API** — copy *Project URL* and *anon public* key into `.env.local` at the repo root:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=ey...
   ```

## (B) Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push          # applies migrations/
psql "$DATABASE_URL" -f supabase/seed.sql   # or paste seed.sql in Studio
```
Bucket creation still needs to be done manually in Studio (or with the management API).

## What `service_role` is used for

Nothing in this POC. The web app uses only the **anon** key + RLS. **Never** put `service_role` into `.env.local` — it bypasses RLS and would be exposed to the browser.
