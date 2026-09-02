'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { classNames } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  permiso?: string;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Panel', icon: '🏠' },
  { href: '/cotizaciones', label: 'Cotizaciones', icon: '📄' },
  { href: '/cotizaciones/nueva', label: 'Nueva cotización', icon: '➕', permiso: 'COTIZACIONES_CREAR' },
  { href: '/inventario', label: 'Inventario', icon: '📦', permiso: 'INVENTARIO_VER' },
  { href: '/inventario/kardex', label: 'Kardex', icon: '📊', permiso: 'INVENTARIO_VER' },
  { href: '/clientes', label: 'Clientes', icon: '🧑‍💼' },
  { href: '/comisiones', label: 'Comisiones', icon: '💰' },
  { href: '/reportes', label: 'Reportes', icon: '📈', permiso: 'REPORTES_VER' },
  { href: '/usuarios', label: 'Usuarios y roles', icon: '👤', permiso: 'USUARIOS_ADMINISTRAR' },
  { href: '/auditoria', label: 'Bitácora', icon: '📜', permiso: 'AUDITORIA_VER' },
  { href: '/plantillas', label: 'Plantillas', icon: '📝', permiso: 'PLANTILLAS_EDITAR' },
  { href: '/parametros', label: 'Parámetros', icon: '⚙️', permiso: 'PARAMETROS_EDITAR' },
];

export default function Shell({
  children, nombreCompleto, rolNombre, permisos,
}: {
  children: React.ReactNode;
  nombreCompleto: string;
  rolNombre: string;
  permisos: string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const items = NAV.filter((n) => !n.permiso || permisos.includes(n.permiso));

  async function salir() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Overlay móvil */}
      {abierto && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setAbierto(false)} />
      )}

      {/* Sidebar */}
      <aside className={classNames(
        'fixed inset-y-0 left-0 z-40 w-64 transform bg-navy-800 text-white transition-transform lg:static lg:translate-x-0',
        abierto ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-orange font-bold">MG</div>
          <div>
            <p className="text-sm font-bold leading-tight">Estructuras MG</p>
            <p className="text-[11px] text-white/50">Cotizador · Inventario</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => {
            const activo = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setAbierto(false)}
                className={classNames(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  activo ? 'bg-brand-orange text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                )}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold">{nombreCompleto}</p>
          <p className="mb-3 text-xs text-white/50">{rolNombre}</p>
          <button onClick={salir} className="btn btn-secondary w-full !bg-white/10 !text-white !border-white/20 hover:!bg-white/20">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-8">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setAbierto(true)}>
            ☰
          </button>
          <h1 className="text-base font-semibold text-slate-800">
            {NAV.find((n) => n.href === pathname)?.label ?? 'Panel'}
          </h1>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{nombreCompleto}</span>
            <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">{rolNombre}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
