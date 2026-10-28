import { generateNKeysBetween } from 'fractional-indexing'

export const compareZ = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

function extreme(zs: Iterable<string>, dir: 1 | -1): string | null {
  let best: string | null = null
  for (const z of zs) if (best === null || compareZ(z, best) * dir > 0) best = z
  return best
}

/** `n` ascending keys that sort after every key in `zs`. */
export const keysAfter = (zs: Iterable<string>, n: number): string[] => generateNKeysBetween(extreme(zs, 1), null, n)

/** `n` ascending keys that sort before every key in `zs`. */
export const keysBefore = (zs: Iterable<string>, n: number): string[] => generateNKeysBetween(null, extreme(zs, -1), n)
