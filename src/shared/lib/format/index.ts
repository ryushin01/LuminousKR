const numberFormat = new Intl.NumberFormat('ko-KR')

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** 1,234 → "1.2KB", 3,818,484 → "3.6MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function formatSeconds(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}초`
}
