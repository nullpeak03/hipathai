"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, FileCode2, FilePlus2, Folder, FolderOpen, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CodeFile } from "@/lib/code/project-model"

type FolderNode = {
  type: "folder"
  name: string
  path: string
  children: TreeNode[]
}

type FileNode = {
  type: "file"
  name: string
  file: CodeFile
}

type TreeNode = FolderNode | FileNode

function buildTree(files: CodeFile[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean)
    let level = root
    let prefix = ""
    segments.forEach((segment, index) => {
      const isFile = index === segments.length - 1
      prefix = prefix ? `${prefix}/${segment}` : segment
      if (isFile) {
        level.push({ type: "file", name: segment, file })
        return
      }
      let folder = level.find((node): node is FolderNode => node.type === "folder" && node.name === segment)
      if (!folder) {
        folder = { type: "folder", name: segment, path: prefix, children: [] }
        level.push(folder)
      }
      level = folder.children
    })
  }
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .map((node) => (node.type === "folder" ? { ...node, children: sort(node.children) } : node))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  return sort(root)
}

export function ProjectTree({
  files,
  activeFileId,
  onSelect,
  onNewFile,
  onRename,
  onDelete,
  readOnly = false,
  className,
}: {
  files: CodeFile[]
  activeFileId: string
  onSelect: (fileId: string) => void
  onNewFile: () => void
  onRename: (file: CodeFile) => void
  onDelete: (file: CodeFile) => void
  readOnly?: boolean
  className?: string
}) {
  const tree = useMemo(() => buildTree(files), [files])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const toggle = (path: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.type === "folder") {
        const isCollapsed = collapsed.has(node.path)
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => toggle(node.path)}
              aria-expanded={!isCollapsed}
              className="w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              style={{ paddingLeft: `${8 + depth * 14}px` }}
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
              {isCollapsed ? <Folder className="w-3.5 h-3.5 shrink-0" /> : <FolderOpen className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{node.name}</span>
            </button>
            {isCollapsed ? null : renderNodes(node.children, depth + 1)}
          </div>
        )
      }
      const active = node.file.id === activeFileId
      return (
        <div key={node.file.id} className="group relative">
          <button
            type="button"
            onClick={() => onSelect(node.file.id)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "w-full flex items-center gap-1.5 rounded-md py-1 pr-14 text-xs text-left",
              active ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            <FileCode2 className={cn("w-3.5 h-3.5 shrink-0", active ? "text-primary" : "")} />
            <span className="truncate">{node.name}</span>
          </button>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
            {readOnly ? null : (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRename(node.file)
                  }}
                  aria-label={`Rename ${node.name}`}
                  title="Rename"
                  className="p-1 rounded hover:bg-card hover:text-foreground text-muted-foreground"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(node.file)
                  }}
                  aria-label={`Delete ${node.name}`}
                  title="Delete"
                  className="p-1 rounded hover:bg-card hover:text-danger-fg text-muted-foreground"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
      )
    })

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border">
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">FILES</span>
        {readOnly ? null : (
          <button
            type="button"
            onClick={onNewFile}
            aria-label="New file"
            title="New file"
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div role="tree" aria-label="Project files" className="flex-1 overflow-auto p-1.5">
        {renderNodes(tree, 0)}
      </div>
      <div className="px-2.5 py-1.5 border-t border-border text-[10px] text-muted-foreground">
        {files.length} file{files.length === 1 ? "" : "s"} · {readOnly ? "read-only import" : "runs the active file"}
      </div>
    </div>
  )
}
