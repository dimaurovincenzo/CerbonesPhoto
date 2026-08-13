export function removeAssignedId(ids: readonly number[], idToRemove: number): number[] {
  return ids.filter((id) => id !== idToRemove)
}

export function clearAssignedIds(): number[] {
  return []
}
