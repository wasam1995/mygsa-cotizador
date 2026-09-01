import { requireSesion } from '@/lib/auth';
import Shell from '@/components/Shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireSesion();

  return (
    <Shell nombreCompleto={sesion.nombreCompleto} rolNombre={sesion.rolNombre} permisos={sesion.permisos}>
      {children}
    </Shell>
  );
}
