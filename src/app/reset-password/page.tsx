'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { esTelefonoGuatemalaValido, normalizarTelefonoGuatemala } from '@/lib/utils';

type Tab = 'correo' | 'sms';
type PasoSms = 'telefono' | 'codigo' | 'nueva_clave';

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('correo');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // --- Flujo por correo ---
  const [correo, setCorreo] = useState('');
  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError(null); setMensaje(null);
    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/auth/actualizar-clave`,
    });
    setCargando(false);
    if (error) { setError(error.message); return; }
    setMensaje('Le enviamos un enlace de recuperación a su correo. Revise también spam/promociones.');
  }

  // --- Flujo por SMS/WhatsApp (+502 y 8 dígitos) ---
  const [pasoSms, setPasoSms] = useState<PasoSms>('telefono');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [claveNueva, setClaveNueva] = useState('');

  async function enviarSms(e: React.FormEvent) {
    e.preventDefault();
    const tel = normalizarTelefonoGuatemala(telefono);
    if (!esTelefonoGuatemalaValido(tel)) {
      setError('Ingrese un número de Guatemala válido: +502 seguido de 8 dígitos.');
      return;
    }
    setCargando(true); setError(null); setMensaje(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: tel });
    setCargando(false);
    if (error) { setError(error.message); return; }
    setTelefono(tel);
    setPasoSms('codigo');
    setMensaje('Le enviamos un código de verificación por SMS.');
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: telefono, token: codigo, type: 'sms' });
    setCargando(false);
    if (error) { setError('Código incorrecto o vencido.'); return; }
    setPasoSms('nueva_clave');
    setMensaje(null);
  }

  async function guardarNuevaClave(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password: claveNueva });
    setCargando(false);
    if (error) { setError(error.message); return; }
    setMensaje('Contraseña actualizada. Ya puede iniciar sesión.');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="card w-full max-w-sm">
        <h2 className="section-title mb-1">Recuperar contraseña</h2>
        <p className="mb-5 text-sm text-ink-secondary">Elija cómo desea recibir las instrucciones.</p>

        <div className="mb-5 flex rounded-md border border-line bg-slate-50 p-1 text-sm font-medium">
          <button className={`flex-1 rounded-md py-1.5 transition-colors ${tab === 'correo' ? 'bg-white text-ink shadow-card' : 'text-ink-secondary'}`}
                  onClick={() => { setTab('correo'); setError(null); setMensaje(null); }}>
            Correo
          </button>
          <button className={`flex-1 rounded-md py-1.5 transition-colors ${tab === 'sms' ? 'bg-white text-ink shadow-card' : 'text-ink-secondary'}`}
                  onClick={() => { setTab('sms'); setError(null); setMensaje(null); }}>
            SMS / WhatsApp
          </button>
        </div>

        {error && <div className="alert alert-danger mb-4">{error}</div>}
        {mensaje && <div className="alert alert-success mb-4">{mensaje}</div>}

        {tab === 'correo' && (
          <form onSubmit={enviarCorreo} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)}
                     className="input" placeholder="vendedor@mygsa.com.gt" />
            </div>
            <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
              {cargando ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        )}

        {tab === 'sms' && pasoSms === 'telefono' && (
          <form onSubmit={enviarSms} className="space-y-4">
            <div>
              <label className="label">Número de teléfono (Guatemala)</label>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)}
                     className="input" placeholder="+502 5555 5555" required />
              <p className="mt-1 text-xs text-ink-muted">Formato: +502 seguido de 8 dígitos.</p>
            </div>
            <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
              {cargando ? 'Enviando…' : 'Enviar código por SMS'}
            </button>
            <p className="text-xs text-ink-muted">
              Requiere que el Administrador tenga configurado un proveedor SMS (Twilio u otro) en Supabase Auth.
            </p>
          </form>
        )}

        {tab === 'sms' && pasoSms === 'codigo' && (
          <form onSubmit={verificarCodigo} className="space-y-4">
            <div>
              <label className="label">Código recibido por SMS</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="input" placeholder="123456" required />
            </div>
            <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
              {cargando ? 'Verificando…' : 'Verificar código'}
            </button>
          </form>
        )}

        {tab === 'sms' && pasoSms === 'nueva_clave' && (
          <form onSubmit={guardarNuevaClave} className="space-y-4">
            <div>
              <label className="label">Nueva contraseña</label>
              <input type="password" minLength={8} required value={claveNueva}
                     onChange={(e) => setClaveNueva(e.target.value)} className="input" />
            </div>
            <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
              {cargando ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link href="/login" className="text-xs font-medium text-navy-600 hover:underline">Volver a iniciar sesión</Link>
        </div>
      </div>
    </div>
  );
}
