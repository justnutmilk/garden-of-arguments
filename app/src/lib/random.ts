// Small deterministic random helpers so a tree always grows the same way.

export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const PALETTE = [
  '#3fa34d', '#e8574a', '#3b82c4', '#f2b632', '#9b5de5', '#f472b6',
  '#14b8a6', '#f97316', '#84cc16', '#6366f1', '#a16207', '#0ea5e9',
]

export function nextColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()))
  return PALETTE.find((c) => !taken.has(c)) ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]
}
