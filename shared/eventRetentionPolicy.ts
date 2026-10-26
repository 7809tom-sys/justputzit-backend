/** Returns only expired event IDs that have no member or connection references. */
export function getArchivableEventIds(expiredEventIds: number[], referencedEventIds: number[]) {
  const referenced = new Set(referencedEventIds);
  return expiredEventIds.filter((id) => !referenced.has(id));
}
