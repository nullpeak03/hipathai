import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (pairs) => {
          pairs.forEach(({ name, value, options }) => {
            try {
              store.set(name, value, options);
            } catch {
              // Server Component read-only context — middleware refreshes session
            }
          });
        },
      },
    },
  );
}
