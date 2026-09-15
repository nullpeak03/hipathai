export type SettingsTab = { id: string; label: string; enabled: boolean; soon?: boolean }

export const SETTINGS_TABS: SettingsTab[] = [
  { id: "profile", label: "Profile", enabled: true },
  { id: "account", label: "Account", enabled: true },
  { id: "notifications", label: "Notifications", enabled: true },
  { id: "privacy", label: "Privacy", enabled: true },
  { id: "appearance", label: "Appearance", enabled: true },
  { id: "billing", label: "Billing", enabled: false, soon: true },
]

export function getEnabledTabs() { return SETTINGS_TABS.filter(t=> t.enabled) }
