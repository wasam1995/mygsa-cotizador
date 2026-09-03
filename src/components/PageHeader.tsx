export default function PageHeader({
  titulo, subtitulo, acciones,
}: { titulo: string; subtitulo?: string; acciones?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="page-title">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
