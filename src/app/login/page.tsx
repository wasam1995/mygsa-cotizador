'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// useSearchParams() obliga a envolver en Suspense para que Next.js pueda prerenderizar
// el resto de la página estáticamente (de lo contrario falla el build de producción).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password });
    setCargando(false);
    if (error) {
      setError('Correo o contraseña incorrectos.');
      return;
    }
    router.replace(params.get('next') || '/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-800 via-navy-700 to-brand-orangeDark px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold backdrop-blur">
            MG
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Estructuras MG</h1>
          <p className="text-sm text-white/70">Sistema de Cotizaciones, Inventario y Comisiones</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-7 shadow-xl">
          <h2 className="mb-5 text-lg font-semibold text-slate-800">Iniciar sesión</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="label">Correo electrónico</label>
            <input
              type="email" required autoFocus value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="input" placeholder="vendedor@mygsa.com.gt"
            />
          </div>

          <div className="mb-2">
            <label className="label">Contraseña</label>
            <input
              type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input" placeholder="••••••••"
            />
          </div>

          <div className="mb-5 text-right">
            <Link href="/reset-password" className="text-xs font-medium text-navy-600 hover:underline">
              Olvidé mi contraseña
            </Link>
          </div>

          <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-white/60">
          ¿Problemas para ingresar? Contacte a su Administrador del sistema.
        </p>
      </div>
    </div>
  );
}
