export default function StatCard({
  titulo, valor, subtitulo, tono = 'navy',
}: { titulo: string; valor: string; subtitulo?: string; tono?: 'navy' | 'orange' | 'green' | 'red' }) {
  const tonos: Record<string, { texto: string; barra: string }> = {
    navy: { texto: 'text-navy-700', barra: 'bg-navy-500' },
    orange: { texto: 'text-brand-orangeDark', barra: 'bg-brand-orange' },
    green: { texto: 'text-emerald-700', barra: 'bg-emerald-500' },
    red: { texto: 'text-red-700', barra: 'bg-red-500' },
  };
  const t = tonos[tono];
  return (
    <div className="card card-hover relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1 ${t.barra}`} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${t.texto}`}>{valor}</p>
      {subtitulo && <p className="mt-2 text-xs text-slate-500">{subtitulo}</p>}
    </div>
  );
}
