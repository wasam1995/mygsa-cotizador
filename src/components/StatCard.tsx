export default function StatCard({
  titulo, valor, subtitulo, tono = 'navy',
}: { titulo: string; valor: string; subtitulo?: string; tono?: 'navy' | 'orange' | 'green' | 'red' }) {
  const tonos: Record<string, string> = {
    navy: 'text-navy-700 bg-navy-50',
    orange: 'text-brand-orangeDark bg-orange-50',
    green: 'text-emerald-700 bg-emerald-50',
    red: 'text-red-700 bg-red-50',
  };
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className={`mt-2 inline-block rounded-lg px-2 py-1 text-2xl font-bold ${tonos[tono]}`}>{valor}</p>
      {subtitulo && <p className="mt-2 text-xs text-slate-500">{subtitulo}</p>}
    </div>
  );
}
