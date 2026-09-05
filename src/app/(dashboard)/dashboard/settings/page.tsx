"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { 
  Moon, 
  Sun, 
  Monitor, 
  Bell, 
  Mail, 
  Shield, 
  Download, 
  Trash2, 
  User,
  Palette,
  Clock,
  Globe,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Brain
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Profile {
  id: string
  clerk_id: string
  username: string | null
  avatar_url: string | null
  theme: string
  timezone: string
  learning_goals: string[]
  preferences: Record<string, any>
  created_at: string
  updated_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("appearance")

  const [formData, setFormData] = useState({
    username: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    learningGoals: "" as string,
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    weeklyDigest: true,
    streakReminders: true,
    difficulty: "adaptive" as "beginner" | "intermediate" | "advanced" | "adaptive",
    pace: "moderate" as "slow" | "moderate" | "fast",
    reminderTime: "19:00",
    language: "en",
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("clerk_id", user.id)
        .single()

      if (error) throw error

      if (data) {
        setProfile(data)
        setFormData({
          username: data.username || "",
          timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          learningGoals: data.learning_goals?.join(", ") || "",
          emailNotifications: data.preferences?.emailNotifications ?? true,
          pushNotifications: data.preferences?.pushNotifications ?? true,
          inAppNotifications: data.preferences?.inAppNotifications ?? true,
          weeklyDigest: data.preferences?.weeklyDigest ?? true,
          streakReminders: data.preferences?.streakReminders ?? true,
          difficulty: data.preferences?.difficulty || "adaptive",
          pace: data.preferences?.pace || "moderate",
          reminderTime: data.preferences?.reminderTime || "19:00",
          language: data.preferences?.language || "en",
        })
        
        if (data.theme) {
          setTheme(data.theme)
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (section: string) => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const updates: Partial<Profile> = {
        updated_at: new Date().toISOString(),
      }

      if (section === "profile") {
        updates.username = formData.username
        updates.timezone = formData.timezone
        updates.learning_goals = formData.learningGoals.split(",").map(g => g.trim()).filter(Boolean)
      }

      if (section === "appearance") {
        updates.theme = theme
      }

      if (section === "notifications" || section === "learning") {
        updates.preferences = {
          ...profile?.preferences,
          emailNotifications: formData.emailNotifications,
          pushNotifications: formData.pushNotifications,
          inAppNotifications: formData.inAppNotifications,
          weeklyDigest: formData.weeklyDigest,
          streakReminders: formData.streakReminders,
          difficulty: formData.difficulty,
          pace: formData.pace,
          reminderTime: formData.reminderTime,
          language: formData.language,
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("clerk_id", user.id)

      if (error) throw error

      setProfile(prev => prev ? { ...prev, ...updates } : null)
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved`)
    } catch (error) {
      console.error("Failed to save settings:", error)
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleExportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch all user data
      const [profileRes, roadmapsRes, sessionsRes, conceptsRes, attemptsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("clerk_id", user.id).single(),
        supabase.from("roadmaps").select("*").eq("user_id", profile?.id),
        supabase.from("study_sessions").select("*").eq("user_id", profile?.id),
        supabase.from("user_concepts").select("*").eq("user_id", profile?.id),
        supabase.from("quiz_attempts").select("*").eq("user_id", profile?.id),
      ])

      const exportData = {
        profile: profileRes.data,
        roadmaps: roadmapsRes.data,
        studySessions: sessionsRes.data,
        concepts: conceptsRes.data,
        quizAttempts: attemptsRes.data,
        exportedAt: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `hipath-export-${format(new Date(), "yyyy-MM-dd")}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast.success("Data exported successfully")
    } catch (error) {
      console.error("Export failed:", error)
      toast.error("Failed to export data")
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm("This will permanently delete your account and all data. This cannot be undone. Type 'DELETE' to confirm.")) {
      return
    }
    
    const confirmText = prompt("Type 'DELETE' to confirm account deletion:")
    if (confirmText !== "DELETE") {
      toast.error("Deletion cancelled")
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Delete all user data (cascades via RLS)
      await supabase.from("profiles").delete().eq("clerk_id", user.id)
      
      // Sign out from Clerk (handled by middleware)
      router.push("/")
      toast.success("Account deleted")
    } catch (error) {
      console.error("Deletion failed:", error)
      toast.error("Failed to delete account")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Settings</h1>
            <p className="text-muted-foreground">Manage your account, preferences, and data</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1,2,3].map(i => (
              <Card key={i}><CardContent className="py-8"><div className="h-8 bg-muted animate-pulse rounded w-3/4"></div><div className="h-4 bg-muted animate-pulse rounded mt-2 w-1/2"></div></CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const themeOptions = [
    { value: "light", label: "Light", icon: Sun, description: "Always use light mode" },
    { value: "dark", label: "Dark", icon: Moon, description: "Always use dark mode" },
    { value: "system", label: "System", icon: Monitor, description: "Match your system preference" },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Workspace controls</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Settings</h1>
        <p className="text-muted-foreground">Manage your account, preferences, and data</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="appearance"><Palette className="mr-2 h-4 w-4" /> Appearance</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="learning"><Brain className="mr-2 h-4 w-4" /> Learning</TabsTrigger>
          <TabsTrigger value="profile"><User className="mr-2 h-4 w-4" /> Profile</TabsTrigger>
          <TabsTrigger value="data"><Download className="mr-2 h-4 w-4" /> Data</TabsTrigger>
        </TabsList>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme
              </CardTitle>
              <CardDescription>Choose your preferred color scheme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {themeOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={theme === option.value ? "default" : "outline"}
                    className="h-24 flex-col gap-3 p-6"
                    onClick={() => setTheme(option.value)}
                  >
                    <option.icon className="h-8 w-8" />
                    <span className="font-medium">{option.label}</span>
                    <p className="text-xs text-muted-foreground text-center">{option.description}</p>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Language & Region
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={formData.language} onValueChange={v => setFormData(prev => ({ ...prev, language: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={formData.timezone} onValueChange={v => setFormData(prev => ({ ...prev, timezone: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[
                        "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
                        "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
                        "Asia/Kolkata", "Australia/Sydney", "Pacific/Auckland"
                      ].map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Email Notifications</h4>
                <div className="space-y-3 pl-4 border-l-2 border-muted">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="font-medium">Weekly Progress Digest</p>
                      <p className="text-sm text-muted-foreground">Summary of your weekly learning activity</p>
                    </div>
                    <Switch 
                      checked={formData.weeklyDigest} 
                      onCheckedChange={v => setFormData(prev => ({ ...prev, weeklyDigest: v }))} 
                    />
                  </label>
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="font-medium">Streak Reminders</p>
                      <p className="text-sm text-muted-foreground">Don't lose your learning streak</p>
                    </div>
                    <Switch 
                      checked={formData.streakReminders} 
                      onCheckedChange={v => setFormData(prev => ({ ...prev, streakReminders: v }))} 
                    />
                  </label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">In-App Notifications</h4>
                <div className="space-y-3 pl-4 border-l-2 border-muted">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="font-medium">Lesson Reminders</p>
                      <p className="text-sm text-muted-foreground">Daily reminders to continue learning</p>
                    </div>
                    <Switch 
                      checked={formData.inAppNotifications} 
                      onCheckedChange={v => setFormData(prev => ({ ...prev, inAppNotifications: v }))} 
                    />
                  </label>
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="font-medium">Achievement Alerts</p>
                      <p className="text-sm text-muted-foreground">Notify when you unlock achievements</p>
                    </div>
                    <Switch 
                      checked={formData.pushNotifications} 
                      onCheckedChange={v => setFormData(prev => ({ ...prev, pushNotifications: v }))} 
                    />
                  </label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Reminder Time</h4>
                <div className="space-y-2">
                  <Label htmlFor="reminderTime">Daily Reminder</Label>
                  <Input
                    id="reminderTime"
                    type="time"
                    value={formData.reminderTime}
                    onChange={e => setFormData(prev => ({ ...prev, reminderTime: e.target.value }))}
                    className="w-40"
                  />
                </div>
              </div>

              <Button onClick={() => handleSave("notifications")} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learning Tab */}
        <TabsContent value="learning" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Learning Preferences
              </CardTitle>
              <CardDescription>Customize how the AI adapts to your learning style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Difficulty Adaptation</Label>
                <Select value={formData.difficulty} onValueChange={v => setFormData(prev => ({ ...prev, difficulty: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adaptive">Adaptive (AI adjusts based on performance)</SelectItem>
                    <SelectItem value="beginner">Beginner (More guidance, simpler concepts)</SelectItem>
                    <SelectItem value="intermediate">Intermediate (Balanced challenge)</SelectItem>
                    <SelectItem value="advanced">Advanced (Minimal guidance, complex topics)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Adaptive mode uses your quiz performance to automatically adjust difficulty
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Learning Pace</Label>
                <Select value={formData.pace} onValueChange={v => setFormData(prev => ({ ...prev, pace: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow (More time per concept, extra practice)</SelectItem>
                    <SelectItem value="moderate">Moderate (Balanced pace)</SelectItem>
                    <SelectItem value="fast">Fast (Condensed content, fewer exercises)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Affects lesson length, exercise count, and review frequency
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label htmlFor="learningGoals">Learning Goals</Label>
                <Input
                  id="learningGoals"
                  value={formData.learningGoals}
                  onChange={e => setFormData(prev => ({ ...prev, learningGoals: e.target.value }))}
                  placeholder="e.g., Master React, Learn Python for Data Science, Prepare for AWS Certification"
                />
                <p className="text-sm text-muted-foreground">
                  Separate multiple goals with commas. These help the AI personalize your roadmaps.
                </p>
              </div>

              <Button onClick={() => handleSave("learning")} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Learning Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                  disabled={!profile}
                />
                {profile && (
                  <p className="text-sm text-muted-foreground">
                    Clerk ID: {profile.clerk_id.slice(0, 8)}...
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezoneProfile">Timezone</Label>
                <Select value={formData.timezone} onValueChange={v => setFormData(prev => ({ ...prev, timezone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
                      "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
                      "Asia/Kolkata", "Australia/Sydney", "Pacific/Auckland"
                    ].map(tz => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="learningGoalsProfile">Learning Goals</Label>
                <Input
                  id="learningGoalsProfile"
                  value={formData.learningGoals}
                  onChange={e => setFormData(prev => ({ ...prev, learningGoals: e.target.value }))}
                  placeholder="e.g., Master React, Learn Python for Data Science"
                />
              </div>

              <Button onClick={() => handleSave("profile")} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Profile
              </Button>
            </CardContent>
          </Card>

          {profile && (
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Account Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Member since:</strong> {format(new Date(profile.created_at), "MMMM d, yyyy")}</p>
                <p><strong>Last updated:</strong> {format(new Date(profile.updated_at), "MMMM d, yyyy")}</p>
                <p><strong>Theme:</strong> {profile.theme || "system"}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Your Data
              </CardTitle>
              <CardDescription>Download a copy of all your learning data (GDPR compliant)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                This will export your profile, roadmaps, study sessions, quiz attempts, 
                concept mastery data, and learning preferences as a JSON file.
              </p>
              <Button variant="outline" onClick={handleExportData}>
                <Download className="mr-2 h-4 w-4" />
                Export Data (JSON)
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">Delete Account</h4>
                <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                  This will permanently delete your account, all roadmaps, progress data, 
                  quiz history, and preferences. This action cannot be undone.
                </p>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteAccount}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}