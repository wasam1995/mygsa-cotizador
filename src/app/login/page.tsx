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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-navy-900 text-sm font-bold text-white">
            MG
          </div>
          <h1 className="text-lg font-semibold text-ink">MYGSA</h1>
          <p className="text-sm text-ink-secondary">Construcciones y Soluciones Metálicas M&amp;G</p>
        </div>

        <form onSubmit={handleSubmit} className="card">
          <h2 className="section-title mb-5">Iniciar sesión</h2>

          {error && (
            <div className="alert alert-danger mb-4">{error}</div>
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

        <p className="mt-5 text-center text-xs text-ink-muted">
          ¿Problemas para ingresar? Contacte a su Administrador del sistema.
        </p>
      </div>
    </div>
  );
}
