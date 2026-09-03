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

interface NavGroup {
  titulo: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    titulo: 'General',
    items: [{ href: '/dashboard', label: 'Panel', icon: '🏠' }],
  },
  {
    titulo: 'Ventas',
    items: [
      { href: '/cotizaciones', label: 'Cotizaciones', icon: '📄' },
      { href: '/cotizaciones/nueva', label: 'Nueva cotización', icon: '➕', permiso: 'COTIZACIONES_CREAR' },
      { href: '/clientes', label: 'Clientes', icon: '🧑‍💼' },
      { href: '/vendedores', label: 'Vendedores', icon: '🧑‍💻' },
      { href: '/comisiones', label: 'Comisiones', icon: '💰' },
    ],
  },
  {
    titulo: 'Inventario',
    items: [
      { href: '/inventario', label: 'Inventario', icon: '📦', permiso: 'INVENTARIO_VER' },
      { href: '/inventario/kardex', label: 'Kardex', icon: '📊', permiso: 'INVENTARIO_VER' },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { href: '/reportes', label: 'Reportes', icon: '📈', permiso: 'REPORTES_VER' },
      { href: '/usuarios', label: 'Usuarios y roles', icon: '👤', permiso: 'USUARIOS_ADMINISTRAR' },
      { href: '/auditoria', label: 'Bitácora', icon: '📜', permiso: 'AUDITORIA_VER' },
      { href: '/plantillas', label: 'Plantillas', icon: '📝', permiso: 'PLANTILLAS_EDITAR' },
      { href: '/parametros', label: 'Parámetros', icon: '⚙️', permiso: 'PARAMETROS_EDITAR' },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

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

  const grupos = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((n) => !n.permiso || permisos.includes(n.permiso)) }))
    .filter((g) => g.items.length > 0);

  async function salir() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Overlay móvil */}
      {abierto && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={() => setAbierto(false)} />
      )}

      {/* Sidebar */}
      <aside className={classNames(
        'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col bg-sidebar-gradient text-white shadow-nav transition-transform lg:static lg:translate-x-0',
        abierto ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-sm font-bold shadow-soft">MG</div>
          <div>
            <p className="text-sm font-bold leading-tight">Estructuras MG</p>
            <p className="text-[11px] text-white/45">Cotizador · Inventario</p>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">{grupo.titulo}</p>
              <div className="flex flex-col gap-0.5">
                {grupo.items.map((item) => {
                  const activo = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setAbierto(false)}
                      className={classNames(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        activo ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                      )}>
                      {activo && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand-orange" />}
                      <span className="text-base">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
              {iniciales(nombreCompleto)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{nombreCompleto}</p>
              <p className="truncate text-xs text-white/45">{rolNombre}</p>
            </div>
          </div>
          <button onClick={salir} className="btn btn-secondary w-full !border-white/15 !bg-white/[0.06] !text-white hover:!bg-white/10">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-md lg:px-8">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setAbierto(true)}>
            ☰
          </button>
          <h1 className="text-base font-semibold text-slate-800">
            {NAV.find((n) => n.href === pathname)?.label ?? 'Panel'}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{nombreCompleto}</span>
            <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">{rolNombre}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
