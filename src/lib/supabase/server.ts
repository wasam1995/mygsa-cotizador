import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createRawClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types';

// Cliente de Supabase para Server Components / Server Actions / Route Handlers.
// Lee y escribe la sesión desde las cookies de Next.js.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Todas las tablas de la aplicación viven en el esquema "app" (no en "public").
      // Sin esto, cada .from(...) apuntaría al esquema "public" (vacío) y devolvería
      // resultados vacíos o un error silencioso. IMPORTANTE: además de esto, el
      // esquema "app" debe estar agregado en Supabase → Project Settings → API →
      // Data API → Exposed schemas, o PostgREST lo rechazará igual.
      db: { schema: 'app' },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Se puede ignorar cuando se llama desde un Server Component (Next lo maneja
            // vía middleware). Los Server Actions y Route Handlers sí pueden escribir.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // idem
          }
        },
      },
    }
  );
}

// Cliente con Service Role (solo para acciones administrativas server-side, ej. crear
// usuarios desde la pantalla de Administración). NUNCA importar desde un Client Component.
export function createAdminClient() {
  return createRawClient<Database, 'app'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: 'app' } }
  );
}
