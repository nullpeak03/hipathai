import {
  Accessibility,
  Bell,
  CreditCard,
  Database,
  GraduationCap,
  Palette,
  ShieldCheck,
  Smartphone,
  UserRound,
  type LucideIcon,
} from "lucide-react"

export type SettingsSectionId =
  | "profile"
  | "account"
  | "learning"
  | "notifications"
  | "appearance"
  | "accessibility"
  | "app"
  | "privacy"
  | "billing"

export type SettingsGroupId = "account" | "learning" | "experience" | "data"

export type SettingsSection = {
  id: SettingsSectionId
  label: string
  /** Short label for the mobile picker and compact contexts. */
  shortLabel: string
  description: string
  group: SettingsGroupId
  icon: LucideIcon
}

export type SettingsGroup = {
  id: SettingsGroupId
  label: string
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  { id: "account", label: "Account" },
  { id: "learning", label: "Learning" },
  { id: "experience", label: "Experience" },
  { id: "data", label: "Data" },
]

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "profile",
    label: "Profile overview",
    shortLabel: "Profile",
    description: "Your identity and learning snapshot.",
    group: "account",
    icon: UserRound,
  },
  {
    id: "account",
    label: "Account & security",
    shortLabel: "Account",
    description: "Name, photo, email, password, and active sessions.",
    group: "account",
    icon: ShieldCheck,
  },
  {
    id: "learning",
    label: "Learning preferences",
    shortLabel: "Learning",
    description: "Daily goal, tutor style, and difficulty.",
    group: "learning",
    icon: GraduationCap,
  },
  {
    id: "notifications",
    label: "Notifications",
    shortLabel: "Notifications",
    description: "Streak reminder emails and delivery.",
    group: "learning",
    icon: Bell,
  },
  {
    id: "appearance",
    label: "Appearance",
    shortLabel: "Appearance",
    description: "Theme for this device.",
    group: "experience",
    icon: Palette,
  },
  {
    id: "accessibility",
    label: "Accessibility",
    shortLabel: "Accessibility",
    description: "Motion, contrast, and text size.",
    group: "experience",
    icon: Accessibility,
  },
  {
    id: "app",
    label: "App & install",
    shortLabel: "App",
    description: "Install HiPath and manage offline access.",
    group: "experience",
    icon: Smartphone,
  },
  {
    id: "privacy",
    label: "Privacy & data",
    shortLabel: "Privacy",
    description: "Export your data or delete your account.",
    group: "data",
    icon: Database,
  },
  {
    id: "billing",
    label: "Plan & billing",
    shortLabel: "Plan",
    description: "Your current plan and what comes next.",
    group: "data",
    icon: CreditCard,
  },
]

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "profile"

/** Legacy `?tab=` values kept working for old bookmarks and in-app links. */
const LEGACY_SECTION_ALIASES: Record<string, SettingsSectionId> = {
  security: "account",
  sessions: "account",
}

const SECTION_IDS = new Set<string>(SETTINGS_SECTIONS.map((section) => section.id))

export function normalizeSection(value: string | null | undefined): SettingsSectionId {
  const key = (value ?? "").trim().toLowerCase()
  if (SECTION_IDS.has(key)) return key as SettingsSectionId
  return LEGACY_SECTION_ALIASES[key] ?? DEFAULT_SETTINGS_SECTION
}

export function getSection(id: SettingsSectionId): SettingsSection {
  return SETTINGS_SECTIONS.find((section) => section.id === id) ?? SETTINGS_SECTIONS[0]
}

export function sectionsInGroup(group: SettingsGroupId): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => section.group === group)
}
