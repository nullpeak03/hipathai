// CodeMirror theme that follows the app's CSS variables instead of hard-coding
// oneDark. Base surfaces adapt to light/dark/matrix automatically; only the
// syntax palette needs a light/dark variant.

import type { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"

const lightSyntax = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: "#7c3aed" },
  { tag: [tags.string, tags.special(tags.string)], color: "#047857" },
  { tag: [tags.number, tags.integer, tags.float], color: "#b45309" },
  { tag: [tags.bool, tags.null, tags.atom], color: "#b91c1c" },
  { tag: tags.comment, color: "#71717a", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#2563eb" },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: "#0f766e" },
  { tag: [tags.typeName, tags.className], color: "#0e7490" },
  { tag: tags.propertyName, color: "#1d4ed8" },
  { tag: tags.operator, color: "#52525b" },
  { tag: tags.punctuation, color: "#52525b" },
  { tag: tags.variableName, color: "#171717" },
  { tag: tags.invalid, color: "#b91c1c", textDecoration: "underline wavy" },
])

const darkSyntax = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: "#c4b5fd" },
  { tag: [tags.string, tags.special(tags.string)], color: "#86efac" },
  { tag: [tags.number, tags.integer, tags.float], color: "#fbbf24" },
  { tag: [tags.bool, tags.null, tags.atom], color: "#fca5a5" },
  { tag: tags.comment, color: "#a1a1aa", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#93c5fd" },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: "#5eead4" },
  { tag: [tags.typeName, tags.className], color: "#67e8f9" },
  { tag: tags.propertyName, color: "#bfdbfe" },
  { tag: tags.operator, color: "#d4d4d8" },
  { tag: tags.punctuation, color: "#d4d4d8" },
  { tag: tags.variableName, color: "#fafafa" },
  { tag: tags.invalid, color: "#fca5a5", textDecoration: "underline wavy" },
])

const baseTheme = (fill: boolean): Extension =>
  EditorView.theme({
    "&": {
      backgroundColor: "var(--card)",
      color: "var(--foreground)",
      ...(fill ? { height: "100%" } : { maxHeight: "26rem" }),
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      lineHeight: "1.6",
    },
    ".cm-content": { padding: "10px 0", caretColor: "var(--foreground)" },
    ".cm-line": { padding: "0 10px" },
    ".cm-gutters": {
      border: "none",
      backgroundColor: "var(--card)",
      color: "var(--muted-foreground)",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 10px" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
    ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--foreground) 4%, transparent)" },
    ".cm-error-line": {
      backgroundColor: "var(--danger-bg)",
      boxShadow: "inset 2px 0 0 var(--danger-fg)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--primary) 30%, transparent) !important",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
    ".cm-matchingBracket": {
      backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
      outline: "1px solid color-mix(in srgb, var(--primary) 45%, transparent)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "10px",
      color: "var(--foreground)",
      overflow: "hidden",
      boxShadow: "0 12px 30px rgb(0 0 0 / 0.18)",
    },
    ".cm-tooltip-autocomplete": { overflow: "hidden" },
    ".cm-tooltip-autocomplete > ul": {
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      fontSize: "12px",
    },
    ".cm-tooltip-autocomplete > ul > li": { padding: "3px 10px" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--primary)",
      color: "var(--primary-foreground)",
    },
    ".cm-completionDetail": {
      marginLeft: "10px",
      fontStyle: "normal",
      color: "var(--muted-foreground)",
    },
    ".cm-completionLabel": { fontWeight: "500" },
    ".cm-panels": { backgroundColor: "var(--card)", color: "var(--foreground)" },
    ".cm-searchMatch": {
      backgroundColor: "color-mix(in srgb, var(--warning) 30%, transparent)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "color-mix(in srgb, var(--warning) 55%, transparent)",
    },
    ".cm-diagnostic-error": { borderLeftColor: "var(--danger-fg)" },
    ".cm-gutter-lint": { width: "1.1em" },
  })

export function editorTheme(dark: boolean, fill = false): Extension {
  return [baseTheme(fill), syntaxHighlighting(dark ? darkSyntax : lightSyntax)]
}

export function fontSizeTheme(px: number): Extension {
  return EditorView.theme({ ".cm-content, .cm-gutters": { fontSize: `${px}px` } })
}
