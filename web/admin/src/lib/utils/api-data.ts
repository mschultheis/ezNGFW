/**
 * API response normalisation helpers.
 *
 * Backend endpoints may return arrays, objects wrapping arrays, or bare
 * objects.  These helpers (`asList`, `asObject`, `resolveId`, `asString`)
 * safely coerce responses into the shape each component expects, avoiding
 * runtime errors from unexpected payload structures.
 */
/** Normalise an API response to an array of records, handling wrapped payloads. */
export function asList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== 'object') return [];

  const data = payload as Record<string, unknown>;
  const firstArray = Object.values(data).find((v) => Array.isArray(v));
  return Array.isArray(firstArray) ? (firstArray as Record<string, unknown>[]) : [];
}

/** Safely cast an API response to a key-value record. */
export function asObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

/** Extract a string ID from a record, trying id, _id, uuid, name, and fallbackKey. */
export function resolveId(item: Record<string, unknown>, fallbackKey = 'id'): string | null {
  const id = item.id ?? item._id ?? item.uuid ?? item.name ?? item[fallbackKey];
  if (id === undefined || id === null) return null;
  return String(id);
}

/** Convert any value to a display string; null/undefined become "-". */
export function asString(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
