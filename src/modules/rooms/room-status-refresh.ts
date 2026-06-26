export function latestRoomStatusUpdatedAt(values: Array<{ updatedAt: string }>, fallbackUpdatedAt: string) {
  if (values.length === 0) return fallbackUpdatedAt;
  return values.reduce((latest, value) => (value.updatedAt > latest ? value.updatedAt : latest), values[0].updatedAt);
}
