import { ESTADOS_COLOR, ESTADOS_LABEL, type EstadoCotizacion } from '@/lib/types';
import { classNames } from '@/lib/utils';

export default function StatusBadge({ estado }: { estado: EstadoCotizacion }) {
  return (
    <span className={classNames(
      'inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold',
      ESTADOS_COLOR[estado]
    )}>
      {ESTADOS_LABEL[estado]}
    </span>
  );
}
