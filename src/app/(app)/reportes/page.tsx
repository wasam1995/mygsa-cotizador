import { requireSesion } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import ReporteGeneral from './ReporteGeneral';
import ReporteVentas from './ReporteVentas';
import ReporteCostos from './ReporteCostos';

export const dynamic = 'force-dynamic';

type Tab = 'general' | 'ventas' | 'costos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'ventas', label: 'Ventas del mes' },
  { id: 'costos', label: 'Costos por período' },
];

export default async function ReportesPage({
  searchParams,
}: { searchParams: Record<string, string | undefined> }) {
  const sesion = await requireSesion('REPORTES_VER');
  const tab: Tab = (searchParams.tab as Tab) || 'general';

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Reportes"
        subtitulo="Reporte general de cotizaciones, ventas del mes por producto y costos por período."
      />

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`/reportes?tab=${t.id}`}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'border-brand-orange text-brand-orangeDark'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {tab === 'general' && <ReporteGeneral searchParams={searchParams} />}
      {tab === 'ventas' && <ReporteVentas sesion={sesion} searchParams={searchParams} />}
      {tab === 'costos' && <ReporteCostos sesion={sesion} searchParams={searchParams} />}
    </div>
  );
}
