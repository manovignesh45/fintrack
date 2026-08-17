export function fmt(n: number) {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

export function addMonths(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shortMonthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function rangeLabel(from: string, to: string) {
  return from === to ? shortMonthLabel(from) : `${shortMonthLabel(from)} – ${shortMonthLabel(to)}`;
}

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
