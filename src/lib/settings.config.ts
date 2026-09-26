export type SettingsTab = { id: string; label: string; enabled: boolean; soon?: boolean }

export const SETTINGS_TABS: SettingsTab[] = [
  { id: "profile", label: "Profile", enabled: true },
  { id: "account", label: "Account", enabled: true },
  { id: "notifications", label: "Notifications", enabled: true },
  { id: "privacy", label: "Privacy", enabled: true },
  { id: "appearance", label: "Appearance", enabled: true },
  { id: "app", label: "App", enabled: true },
  // Billing stays out of free V1 entirely (no stub tab) — re-add when paid plans ship.
]

export function getEnabledTabs() { return SETTINGS_TABS.filter(t=> t.enabled) }
