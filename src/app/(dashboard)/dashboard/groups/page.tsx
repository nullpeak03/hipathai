"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, 
  Users, 
  UserPlus, 
  Lock, 
  Share2, 
  Settings,
  ChevronRight,
  Search,
  Filter,
  MessageSquare,
  Trophy,
  Calendar,
  Clock,
  BookOpen
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

interface StudyGroup {
  id: string
  name: string
  description: string
  owner_id: string
  invite_code: string
  is_private: boolean
  created_at: string
  owner: {
    username: string
    avatar_url: string | null
  }
  member_count: number
  user_role: "owner" | "admin" | "member"
  shared_roadmaps: Array<{
    id: string
    roadmap: {
      id: string
      title: string
      topic: string
    }
  }>
}

export default function GroupsPage() {
  const supabase = createClient()
  const [groups, setGroups] = useState<StudyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("my-groups")
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_id", user.id)
        .single()

      if (!profile) return

      // Get groups where user is a member
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          id,
          role,
          joined_at,
          study_groups (
            id,
            name,
            description,
            owner_id,
            invite_code,
            is_private,
            created_at,
            owner:profiles!owner_id (
              username,
              avatar_url
            ),
            group_members (count),
            shared_roadmaps (
              id,
              roadmap:roadmaps (
                id,
                title,
                topic
              )
            )
          )
        `)
        .eq("user_id", profile.id)

      if (error) throw error

      const formatted = (data || []).map(item => {
        const sg = item.study_groups as unknown as {
          id: string
          name: string
          description: string
          owner_id: string
          invite_code: string
          is_private: boolean
          created_at: string
          owner: { username: string; avatar_url: string | null }
          group_members: { count: number }[]
          shared_roadmaps: { id: string; roadmap: { id: string; title: string; topic: string } }[]
        }
        return {
          ...sg,
          member_count: sg.group_members?.[0]?.count || 0,
          user_role: item.role,
        } as StudyGroup
      })

      setGroups(formatted)
    } catch (error) {
      console.error("Failed to fetch groups:", error)
    } finally {
      setLoading(false)
    }
  }

  const createGroup = async (name: string, description: string, isPrivate: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_id", user.id)
        .single()

      if (!profile) return

      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      const { error } = await supabase
        .from("study_groups")
        .insert({
          name,
          description,
          owner_id: profile.id,
          invite_code: inviteCode,
          is_private: isPrivate,
        })

      if (error) throw error

      // Add owner as member
      const { data: group } = await supabase
        .from("study_groups")
        .select("id")
        .eq("invite_code", inviteCode)
        .single()

      if (group) {
        await supabase
          .from("group_members")
          .insert({
            group_id: group.id,
            user_id: profile.id,
            role: "owner",
          })
      }

      setShowCreateModal(false)
      fetchGroups()
    } catch (error) {
      console.error("Failed to create group:", error)
    }
  }

  const joinGroup = async (inviteCode: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_id", user.id)
        .single()

      if (!profile) return

      const { data: group } = await supabase
        .from("study_groups")
        .select("id")
        .eq("invite_code", inviteCode.toUpperCase())
        .single()

      if (!group) {
        alert("Invalid invite code")
        return
      }

      const { error } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: profile.id,
          role: "member",
        })

      if (error) throw error

      setShowJoinModal(false)
      fetchGroups()
    } catch (error) {
      console.error("Failed to join group:", error)
    }
  }

  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const tabs = [
    { value: "my-groups", label: "My Groups", count: groups.length },
    { value: "discover", label: "Discover", count: 0 },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Study Groups</h1>
            <p className="text-muted-foreground">Learn together, grow together</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}><Plus className="mr-2 h-4 w-4" /> Create Group</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Card key={i}><CardContent className="py-8"><div className="h-8 bg-muted animate-pulse rounded w-3/4"></div><div className="h-4 bg-muted animate-pulse rounded mt-2 w-1/2"></div></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Study Groups</h1>
          <p className="text-muted-foreground">Collaborate with peers, share roadmaps, and learn together</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowJoinModal(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Join Group
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Group
          </Button>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-1 sm:flex-none">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label} <Badge variant="secondary" className="ml-2">{tab.count}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            {groups.length === 0 ? (
              <>
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No groups yet</h3>
                <p className="text-muted-foreground mb-4">Create or join a study group to start learning together</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setShowCreateModal(true)}><Plus className="mr-2 h-4 w-4" /> Create Group</Button>
                  <Button variant="outline" onClick={() => setShowJoinModal(true)}><UserPlus className="mr-2 h-4 w-4" /> Join Group</Button>
                </div>
              </>
            ) : (
              <>
                <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No matching groups</h3>
                <p className="text-muted-foreground">Try adjusting your search</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map(group => (
            <Card key={group.id} className="overflow-hidden transition-shadow hover:shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{group.name}</h3>
                      <Badge variant={group.is_private ? "default" : "secondary"}>
                        {group.is_private ? "Private" : "Public"}
                      </Badge>
                    </div>
                    {(() => {
                        switch (group.user_role) {
                          case "owner":
                            return (
                              <Badge variant="outline" className="text-xs">
                                <Trophy className="h-3 w-3 mr-1" /> Owner
                              </Badge>
                            )
                          case "admin":
                            return (
                              <Badge variant="outline" className="text-xs">
                                <Settings className="h-3 w-3 mr-1" /> Admin
                              </Badge>
                            )
                          default:
                            return (
                              <Badge variant="outline" className="text-xs">
                                <UserPlus className="h-3 w-3 mr-1" /> Member
                              </Badge>
                            )
                        }
                      })()}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {group.member_count} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="h-3 w-3" />
                    {group.shared_roadmaps.length} shared roadmaps
                  </span>
                </div>

                {/* Shared Roadmaps */}
                {group.shared_roadmaps.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Shared Roadmaps</h4>
                    <div className="flex flex-wrap gap-2">
                      {group.shared_roadmaps.slice(0, 3).map(sr => (
                        <Link key={sr.id} href={`/dashboard/roadmaps/${sr.roadmap.id}`}>
                          <Badge variant="outline" className="gap-1">
                            <BookOpen className="h-3 w-3" />
                            {sr.roadmap.title}
                          </Badge>
                        </Link>
                      ))}
                      {group.shared_roadmaps.length > 3 && (
                        <Badge variant="secondary">+{group.shared_roadmaps.length - 3} more</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1 justify-start gap-1" asChild>
                    <Link href={`/dashboard/groups/${group.id}`}>
                      <MessageSquare className="h-3.5 w-3.5" />
                      Open Group
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <Card className="w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Create Study Group</CardTitle>
              <p className="text-sm text-muted-foreground">Invite others to learn together</p>
            </CardHeader>
            <CreateGroupForm onSubmit={createGroup} onClose={() => setShowCreateModal(false)} />
          </Card>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowJoinModal(false)}>
          <Card className="w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Join Study Group</CardTitle>
              <p className="text-sm text-muted-foreground">Enter the invite code from a group member</p>
            </CardHeader>
            <JoinGroupForm onSubmit={joinGroup} onClose={() => setShowJoinModal(false)} />
          </Card>
        </div>
      )}
    </div>
  )
}

function CreateGroupForm({ onSubmit, onClose }: { onSubmit: (name: string, description: string, isPrivate: boolean) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    onSubmit(name.trim(), description.trim(), isPrivate)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Group Name</label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., React Learners, Python Study Group"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description (optional)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this group about? What will you learn together?"
          className="w-full p-2 border rounded-md bg-background"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={e => setIsPrivate(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm">Private group (requires invite code to join)</span>
        </label>
        <p className="text-xs text-muted-foreground">Private groups are hidden from discovery. Members need an invite code to join.</p>
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={loading || !name.trim()} className="flex-1">
          {loading ? "Creating..." : "Create Group"}
        </Button>
      </div>
    </form>
  )
}

function JoinGroupForm({ onSubmit, onClose }: { onSubmit: (code: string) => void; onClose: () => void }) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    onSubmit(code.trim().toUpperCase())
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Invite Code</label>
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          required
          className="text-center text-lg tracking-widest"
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">Invite codes are 6 characters (letters and numbers)</p>
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={loading || code.length !== 6} className="flex-1">
          {loading ? "Joining..." : "Join Group"}
        </Button>
      </div>
    </form>
  )
}