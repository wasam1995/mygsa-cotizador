export default function StatCard({
  titulo, valor, subtitulo, tono = 'navy',
}: { titulo: string; valor: string; subtitulo?: string; tono?: 'navy' | 'orange' | 'green' | 'red' }) {
  // El color solo marca una barra de 3px a la izquierda (indicador, no decoración) — el
  // valor numérico siempre se lee en texto ink normal, no en el color del tono.
  const barras: Record<string, string> = {
    navy: 'bg-navy-500',
    orange: 'bg-brand-orange',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
  };
  return (
    <div className="card relative overflow-hidden py-4">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${barras[tono]}`} />
      <p className="text-xs font-medium text-ink-secondary">{titulo}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{valor}</p>
      {subtitulo && <p className="mt-1.5 text-xs text-ink-muted">{subtitulo}</p>}
    </div>
  );
}
