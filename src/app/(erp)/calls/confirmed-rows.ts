/** Server refreshes may have started before a save committed. Keep its confirmed row until caught up. */
export function mergeConfirmedRows<Row extends { id: string; updatedAt: string; startTime: string }>(
  server: readonly Row[], confirmed: readonly Row[], order: (time: string) => number | undefined
): Row[] {
  const rows = new Map(server.map((row) => [row.id, row]));
  for (const row of confirmed) {
    const current = rows.get(row.id);
    if (!current || current.updatedAt < row.updatedAt) rows.set(row.id, row);
  }
  return [...rows.values()].sort((a, b) => (order(a.startTime) ?? Infinity) - (order(b.startTime) ?? Infinity));
}
