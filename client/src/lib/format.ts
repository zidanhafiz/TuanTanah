/**
 * Compact Rupiah for tight board labels. Full amounts elsewhere use
 * `Rp ${n.toLocaleString('id-ID')}`; on a ~80px tile we abbreviate:
 *   600_000 → "Rp 600rb", 1_000_000 → "Rp 1jt", 1_500_000 → "Rp 1,5jt".
 */
export function compactRupiah(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    const s = v % 1 === 0 ? String(v) : v.toFixed(1).replace('.', ',')
    return `Rp ${s}jt`
  }
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}rb`
  return `Rp ${n}`
}
