export function formatQ(n: number | null | undefined): string {
  const v = n ?? 0;
  return 'Q ' + v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

// Valida formato de teléfono Guatemala: +502 seguido de 8 dígitos.
export function esTelefonoGuatemalaValido(tel: string): boolean {
  return /^\+502\d{8}$/.test(tel);
}

export function normalizarTelefonoGuatemala(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^502/, '');
  const ultimos8 = digits.slice(-8);
  return ultimos8.length === 8 ? `+502${ultimos8}` : input;
}
