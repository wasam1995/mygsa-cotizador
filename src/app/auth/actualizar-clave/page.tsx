'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Página a la que llega el enlace de recuperación enviado por correo
// (Supabase intercepta el token de la URL y crea una sesión temporal de "recovery").
export default function ActualizarClavePage() {
  const supabase = createClient();
  const router = useRouter();
  const [clave, setClave] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (clave !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    if (clave.length < 8) { setError('Use al menos 8 caracteres.'); return; }
    setCargando(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setCargando(false);
    if (error) { setError(error.message); return; }
    setListo(true);
    setTimeout(() => router.replace('/login'), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-800 via-navy-700 to-brand-orangeDark px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl">
        <h2 className="mb-5 text-lg font-semibold text-slate-800">Nueva contraseña</h2>
        {listo ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Contraseña actualizada. Redirigiendo al inicio de sesión…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div>
              <label className="label">Nueva contraseña</label>
              <input type="password" required minLength={8} value={clave} onChange={(e) => setClave(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input type="password" required minLength={8} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="input" />
            </div>
            <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
              {cargando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
