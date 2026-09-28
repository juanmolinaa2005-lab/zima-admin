import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetch as undiciFetch } from "undici";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore if proxy refreshes sessions.
          }
        },
      },
      global: {
        // Next.js patches global fetch and rejects bodies ≳ 2 MB.
        fetch: undiciFetch as unknown as typeof fetch,
      },
    }
  );
}
