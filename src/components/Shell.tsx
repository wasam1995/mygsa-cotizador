'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, FileText, Plus, Users, UserCog, Wallet, Package, BarChart3,
  LineChart, Shield, ScrollText, FileEdit, Settings, Menu, X, LogOut,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { classNames } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permiso?: string;
}

interface NavGroup {
  titulo: string;
  items: NavItem[];
}

// Iconografía Lucide — sustituye los emoji que usaba la versión anterior del Shell
// (patrón típico de interfaz "hecha por IA"). Trazo fino, tamaño fijo, sin color propio
// más allá del estado activo/inactivo del enlace.
const NAV_GROUPS: NavGroup[] = [
  {
    titulo: 'General',
    items: [{ href: '/dashboard', label: 'Panel', icon: Home }],
  },
  {
    titulo: 'Ventas',
    items: [
      { href: '/cotizaciones', label: 'Cotizaciones', icon: FileText },
      { href: '/cotizaciones/nueva', label: 'Nueva cotización', icon: Plus, permiso: 'COTIZACIONES_CREAR' },
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/vendedores', label: 'Vendedores', icon: UserCog },
      { href: '/comisiones', label: 'Comisiones', icon: Wallet },
    ],
  },
  {
    titulo: 'Inventario',
    items: [
      { href: '/inventario', label: 'Inventario', icon: Package, permiso: 'INVENTARIO_VER' },
      { href: '/inventario/kardex', label: 'Kardex', icon: BarChart3, permiso: 'INVENTARIO_VER' },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { href: '/reportes', label: 'Reportes', icon: LineChart, permiso: 'REPORTES_VER' },
      { href: '/usuarios', label: 'Usuarios y roles', icon: Shield, permiso: 'USUARIOS_ADMINISTRAR' },
      { href: '/auditoria', label: 'Bitácora', icon: ScrollText, permiso: 'AUDITORIA_VER' },
      { href: '/plantillas', label: 'Plantillas', icon: FileEdit, permiso: 'PLANTILLAS_EDITAR' },
      { href: '/parametros', label: 'Parámetros', icon: Settings, permiso: 'PARAMETROS_EDITAR' },
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
      {/* Overlay móvil — sin blur decorativo, solo un fondo semitransparente funcional */}
      {abierto && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setAbierto(false)} />
      )}

      {/* Sidebar — 240px, color plano (sin gradiente), borde de separación en vez de sombra */}
      <aside className={classNames(
        'fixed inset-y-0 left-0 z-40 flex w-60 transform flex-col bg-navy-900 text-white transition-transform lg:static lg:translate-x-0',
        abierto ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-orange text-xs font-bold">MG</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">MYGSA</p>
            <p className="truncate text-[11px] text-white/40">Cotizador · Inventario</p>
          </div>
          <button
            className="ml-auto rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">{grupo.titulo}</p>
              <div className="flex flex-col gap-0.5">
                {grupo.items.map((item) => {
                  const activo = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setAbierto(false)}
                      className={classNames(
                        'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                        activo ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                      )}>
                      {activo && <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-brand-orange" />}
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2.5 flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {iniciales(nombreCompleto)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{nombreCompleto}</p>
              <p className="truncate text-[11px] text-white/40">{rolNombre}</p>
            </div>
          </div>
          <button onClick={salir} className="btn w-full justify-start gap-2.5 !px-2.5 text-[13px] text-white/60 hover:bg-white/[0.05] hover:text-white">
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:px-6">
          <button className="rounded-md p-1.5 text-ink-secondary hover:bg-slate-100 lg:hidden" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <h1 className="section-title">
            {NAV.find((n) => n.href === pathname)?.label ?? 'Panel'}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-ink-secondary sm:inline">{nombreCompleto}</span>
            <span className="badge border-navy-200 bg-navy-50 text-navy-700">{rolNombre}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
