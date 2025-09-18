export const STEP = 1024
export const MIN_GAP = 8

export function computePosition(prev?: number | null, next?: number | null) {
  if (prev == null && next == null) return STEP
  if (prev == null) return Math.floor((next as number) - STEP)
  if (next == null) return Math.floor(prev + STEP)
  const gap = next - prev
  if (gap <= MIN_GAP) return Math.floor(prev + gap / 2)
  return Math.floor(prev + Math.floor(gap / 2))
}

export function needsReindex(sortedPositions: number[]) {
  for (let i = 1; i < sortedPositions.length; i++) {
    if (sortedPositions[i] - sortedPositions[i - 1] <= MIN_GAP) return true
  }
  return false
}

export function reindex(idsInOrder: string[]) {
  const updates: Record<string, number> = {}
  let p = STEP
  for (const id of idsInOrder) { updates[id] = p; p += STEP }
  return updates
}
