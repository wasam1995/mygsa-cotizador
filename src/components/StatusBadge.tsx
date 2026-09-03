import { ESTADOS_COLOR, ESTADOS_LABEL, type EstadoCotizacion } from '@/lib/types';
import { classNames } from '@/lib/utils';

// Deriva el color del punto indicador a partir del mismo tono ya definido en ESTADOS_COLOR
// (p. ej. "bg-amber-100 text-amber-800 ..." → "bg-amber-500"), sin duplicar la paleta.
function colorPunto(clases: string): string {
  const m = clases.match(/bg-(\w+)-100/);
  return m ? `bg-${m[1]}-500` : 'bg-slate-400';
}

export default function StatusBadge({ estado }: { estado: EstadoCotizacion }) {
  return (
    <span className={classNames(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold',
      ESTADOS_COLOR[estado]
    )}>
      <span className={classNames('badge-dot', colorPunto(ESTADOS_COLOR[estado]))} />
      {ESTADOS_LABEL[estado]}
    </span>
  );
}
