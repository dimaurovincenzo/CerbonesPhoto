export const SIDEBAR_WIDTH = { min: 210, max: 380, default: 248 } as const
export const INSPECTOR_WIDTH = { min: 240, max: 420, default: 288 } as const
export const LABELS_HEIGHT = { min: 150, max: 420, default: 260 } as const

export function clampLayoutSize(value: number, range: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return range.min
  return Math.min(range.max, Math.max(range.min, Math.round(value)))
}
