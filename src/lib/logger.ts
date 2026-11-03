export function logInfo(event: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", event, ...data, ts: new Date().toISOString() }))
}
export function logWarn(event: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({ level: "warn", event, ...data, ts: new Date().toISOString() }))
}
export function logError(event: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", event, ...data, ts: new Date().toISOString() }))
}