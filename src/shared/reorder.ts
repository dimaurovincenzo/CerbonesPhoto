export function reorderIds(ids: readonly number[], draggedId: number, targetId: number): number[] {
  if (draggedId === targetId) return [...ids]
  const from = ids.indexOf(draggedId)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0) return [...ids]
  const reordered = [...ids]
  const [dragged] = reordered.splice(from, 1)
  reordered.splice(to, 0, dragged)
  return reordered
}
