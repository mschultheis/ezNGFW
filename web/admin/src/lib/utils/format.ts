/**
 * Human-friendly formatting helpers for the dashboard and status cards.
 *
 * - `formatBytes()` — e.g. 1536 → "1.5 KB"
 * - `formatUptime()` — seconds → "2d 5h 12m"
 * - `formatNumber()` — locale-aware thousand separators
 */
/** Convert raw byte count to human-readable string (e.g. 1536 → "1.5 KB"). */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Convert seconds to compact uptime string (e.g. 90061 → "1d 1h 1m"). */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

/** Format a number with locale-aware thousand separators. */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}
