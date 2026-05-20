import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_CONFIGURED = Boolean(url && anonKey);

export const supabase = SUPABASE_CONFIGURED
  ? createClient(url!, anonKey!)
  : // Stub that throws clearly when used without config — keeps types simple.
    (new Proxy(
      {},
      {
        get() {
          throw new Error(
            "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env"
          );
        },
      }
    ) as ReturnType<typeof createClient>);

export const REQUESTS_TABLE = "requests";
export const FILES_BUCKET = "request-files";
