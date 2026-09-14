export function getLevel(xp: number) {
  if (xp < 100) return 1
  if (xp < 300) return 2
  if (xp < 600) return 3
  if (xp < 1000) return 4
  if (xp < 1500) return 5
  return Math.floor((xp - 1500) / 800) + 6
}
export function xpForNextLevel(level: number) {
  const thresholds = [0, 100, 300, 600, 1000, 1500]
  if (level < thresholds.length) return thresholds[level]
  return 1500 + (level - 5) * 800
}
export function progressToNextLevel(xp: number) {
  const level = getLevel(xp)
  const currentThreshold = level === 1 ? 0 : xpForNextLevel(level - 1)
  const nextThreshold = xpForNextLevel(level)
  const progress = ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100
  return { level, nextThreshold, progress: Math.min(100, Math.max(0, progress)) }
}
