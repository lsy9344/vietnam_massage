const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function shouldBlockWrite(method: string, maintenanceMode = process.env.MAINTENANCE_MODE) {
  return maintenanceMode === "read-only" && !SAFE_METHODS.has(method.toUpperCase());
}
