export function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const dt = new Date(iso + 'T00:00:00')
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TODAY = new Date('2026-06-25T00:00:00')

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const dt = new Date(iso + 'T00:00:00')
  return Math.round((dt.getTime() - TODAY.getTime()) / 86400000)
}

export function isExpiring(iso: string | null): boolean {
  const d = daysUntil(iso)
  return d !== null && d >= 0 && d <= 7
}
