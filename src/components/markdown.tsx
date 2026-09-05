"use client"

import React from "react"

interface MarkdownProps {
  content: string
  className?: string
}

const escapeHtml = (text: string) => {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "&#039;")
}

const parseMarkdown = (content: string): React.ReactNode[] => {
  const lines = content.split("\n")
  const nodes: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBlockContent = ""
  let codeBlockLanguage = ""
  let inList = false
  let listItems: string[] = []
  let listType: "ul" | "ol" = "ul"

  const flushCodeBlock = () => {
    if (codeBlockContent) {
      nodes.push(
        <pre key={nodes.length} className="bg-muted p-4 rounded-lg overflow-x-auto my-3">
          <code className={`language-${codeBlockLanguage} text-sm font-mono`}>
            {codeBlockContent.trimEnd()}
          </code>
        </pre>
      )
      codeBlockContent = ""
      codeBlockLanguage = ""
    }
  }

  const flushList = () => {
    if (listItems.length > 0) {
      const ListComponent = listType === "ul" ? "ul" : "ol"
      nodes.push(
        <ListComponent key={nodes.length} className={`my-3 pl-6 ${listType === "ol" ? "list-decimal" : "list-disc"}`}>
          {listItems.map((item, i) => (
            <li key={i} className="mb-1">{parseInline(item)}</li>
          ))}
        </ListComponent>
      )
      listItems = []
    }
  }

  const parseInline = (text: string): React.ReactNode => {
    // Handle inline code, bold, italic, links
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/)
    return parts.map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i}>{part.slice(1, -1)}</em>
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">{linkMatch[1]}</a>
      }
      return <span key={i}>{escapeHtml(part)}</span>
    })
  }

  lines.forEach((line, lineIndex) => {
    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
        codeBlockLanguage = line.slice(3).trim() || "text"
      }
      return
    }

    if (inCodeBlock) {
      codeBlockContent += line + "\n"
      return
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      flushList()
      const level = headerMatch[1].length
      const HeaderTag = `h${level}` as keyof React.JSX.IntrinsicElements
      nodes.push(
        <HeaderTag key={nodes.length} className={`mt-4 mb-2 font-semibold ${level === 1 ? "text-2xl" : level === 2 ? "text-xl" : "text-lg"}`}>
          {parseInline(headerMatch[2])}
        </HeaderTag>
      )
      return
    }

    // Lists
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/)
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/)
    
    if (ulMatch || olMatch) {
      if (!inList || (ulMatch && listType === "ol") || (olMatch && listType === "ul")) {
        flushList()
        inList = true
        listType = ulMatch ? "ul" : "ol"
      }
      listItems.push(ulMatch ? ulMatch[1] : olMatch![1])
      return
    }

    if (inList && !ulMatch && !olMatch && line.trim() !== "") {
      flushList()
      inList = false
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      flushList()
      nodes.push(
        <blockquote key={nodes.length} className="border-l-4 border-primary/20 pl-4 italic text-muted-foreground my-3">
          {parseInline(line.slice(2))}
        </blockquote>
      )
      return
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      flushList()
      nodes.push(<hr key={nodes.length} className="my-4 border-muted" />)
      return
    }

    // Paragraphs
    if (line.trim()) {
      flushList()
      nodes.push(
        <p key={nodes.length} className="my-3 leading-relaxed">
          {parseInline(line)}
        </p>
      )
    } else if (inList) {
      // Empty line in list - continue list
    } else {
      flushList()
    }
  })

  flushCodeBlock()
  flushList()

  return nodes
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={`prose max-w-none ${className || ""}`}>
      {parseMarkdown(content)}
    </div>
  )
}