"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { useTheme } from "next-themes"
import {
  Annotation,
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state"
import {
  Decoration,
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
  type DecorationSet,
  type KeyBinding,
  type ViewUpdate,
} from "@codemirror/view"
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
} from "@codemirror/language"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import { lintGutter, lintKeymap, linter, type Diagnostic } from "@codemirror/lint"
import { suggestCompletions } from "@/lib/code-completions"
import { getLoadedLanguage, loadLanguage } from "@/lib/code/languages"
import type { EditorSettings } from "@/lib/code/editor-settings"
import { editorTheme, fontSizeTheme } from "./editor-theme"

/* ------------------------------ run diagnostics ----------------------------- */

/** Marks programmatic value syncs so they don't count as learner edits. */
const externalSync = Annotation.define<boolean>()

const setErrorLine = StateEffect.define<number | null>()
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue
      next = Decoration.none
      const lineNo = effect.value
      if (lineNo == null) continue
      const line = tr.state.doc.line(Math.min(lineNo, tr.state.doc.lines))
      next = Decoration.set([Decoration.line({ class: "cm-error-line" }).range(line.from)])
    }
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

const setRunDiagnostics = StateEffect.define<Diagnostic[]>()
const runDiagnostics = StateField.define<Diagnostic[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setRunDiagnostics)) return effect.value
    return value
  },
})
const runLinter = linter((view) => view.state.field(runDiagnostics, false) ?? [], { delay: 0 })

/* -------------------------------- completions ------------------------------- */

function completionSource(language: () => string) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w.]+/)
    if (!context.explicit && (!word || word.from === word.to)) return null
    const raw = word?.text ?? ""
    const dot = raw.lastIndexOf(".")
    const prefix = dot >= 0 ? raw.slice(dot + 1) : raw
    const from = word ? (dot >= 0 ? word.from + dot + 1 : word.from) : context.pos
    const options = suggestCompletions(language(), context.state.doc.toString(), prefix).map((completion) => ({
      label: completion.label,
      type: completion.kind,
      detail: completion.detail,
      boost: completion.kind === "local" ? 40 : completion.kind === "keyword" ? 20 : 10,
    }))
    if (options.length === 0) return null
    return { from, options, validFor: /^[\w.]*$/ }
  }
}

/* ---------------------------------- editor ---------------------------------- */

export type CodeMirrorEditorHandle = {
  focus: () => void
  jumpToLine: (line: number) => void
  getSelection: () => { from: number; to: number; text: string } | null
  replaceSelection: (text: string) => void
  scrollToTop: () => void
}

type Props = {
  fileId: string
  /** Used for the initial state and external resets; typing is owned by CodeMirror. */
  value: string
  language: string
  settings: EditorSettings
  onChange: (value: string) => void
  onCursor?: (line: number, column: number) => void
  onRun?: () => void
  onSave?: () => void
  readOnly?: boolean
  fill?: boolean
  errorLine?: number | null
  errorMessage?: string
  ariaLabel?: string
  className?: string
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, Props>(function CodeMirrorEditor(
  {
    fileId,
    value,
    language,
    settings,
    onChange,
    onCursor,
    onRun,
    onSave,
    readOnly = false,
    fill = false,
    errorLine = null,
    errorMessage,
    ariaLabel = "Code editor",
    className,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const statesRef = useRef<Map<string, EditorState>>(new Map())
  const prevKeyRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme !== "light"

  // Refs keep the single update listener/keymap stable while props change.
  const onChangeRef = useRef(onChange)
  const onCursorRef = useRef(onCursor)
  const onRunRef = useRef(onRun)
  const onSaveRef = useRef(onSave)
  const languageRef = useRef(language)
  onChangeRef.current = onChange
  onCursorRef.current = onCursor
  onRunRef.current = onRun
  onSaveRef.current = onSave
  languageRef.current = language

  const settingsRef = useRef(settings)
  const darkRef = useRef(dark)
  const fillRef = useRef(fill)
  const readOnlyRef = useRef(readOnly)
  settingsRef.current = settings
  darkRef.current = dark
  fillRef.current = fill
  readOnlyRef.current = readOnly

  const themeCompartment = useRef(new Compartment()).current
  const fontCompartment = useRef(new Compartment()).current
  const wrapCompartment = useRef(new Compartment()).current
  const tabCompartment = useRef(new Compartment()).current
  const languageCompartment = useRef(new Compartment()).current
  const readOnlyCompartment = useRef(new Compartment()).current

  const handleUpdate = useRef((update: ViewUpdate) => {
    const external = update.transactions.some((tr) => tr.annotation(externalSync))
    if (update.docChanged && !external) onChangeRef.current(update.state.doc.toString())
    if (update.docChanged || update.selectionSet) {
      const head = update.state.selection.main.head
      const line = update.state.doc.lineAt(head)
      onCursorRef.current?.(line.number, head - line.from + 1)
    }
  }).current

  const makeState = useCallback(
    (doc: string): EditorState => {
      const current = settingsRef.current
      const mode = getLoadedLanguage(languageRef.current)
      return EditorState.create({
        doc,
        extensions: [
          themeCompartment.of(editorTheme(darkRef.current, fillRef.current)),
          fontCompartment.of(fontSizeTheme(current.fontSize)),
          wrapCompartment.of(current.wrap ? EditorView.lineWrapping : []),
          tabCompartment.of([
            EditorState.tabSize.of(current.tabSize),
            indentUnit.of(" ".repeat(current.tabSize)),
          ]),
          languageCompartment.of(mode ?? []),
          readOnlyCompartment.of([
            EditorState.readOnly.of(readOnlyRef.current),
            EditorView.editable.of(!readOnlyRef.current),
          ]),
          lintGutter(),
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          crosshairCursor(),
          EditorState.allowMultipleSelections.of(true),
          highlightActiveLine(),
          highlightSelectionMatches(),
          EditorView.contentAttributes.of({
            "aria-label": ariaLabel,
            autocapitalize: "off",
            autocomplete: "off",
            spellcheck: "false",
          }),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          runLinter,
          errorLineField,
          autocompletion({ override: [completionSource(() => languageRef.current)] }),
          keymap.of([
            { key: "Mod-Enter", preventDefault: true, run: () => (onRunRef.current?.(), true) },
            { key: "Mod-s", preventDefault: true, run: () => (onSaveRef.current?.(), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            ...lintKeymap,
            indentWithTab,
          ] as KeyBinding[]),
          EditorView.updateListener.of((update) => handleUpdate(update)),
        ],
      })
    },
    [
      ariaLabel,
      fontCompartment,
      handleUpdate,
      languageCompartment,
      readOnlyCompartment,
      tabCompartment,
      themeCompartment,
      wrapCompartment,
    ]
  )

  const applyCompartments = useCallback(
    (view: EditorView) => {
      const current = settingsRef.current
      view.dispatch({
        effects: [
          themeCompartment.reconfigure(editorTheme(darkRef.current, fillRef.current)),
          fontCompartment.reconfigure(fontSizeTheme(current.fontSize)),
          wrapCompartment.reconfigure(current.wrap ? EditorView.lineWrapping : []),
          tabCompartment.reconfigure([
            EditorState.tabSize.of(current.tabSize),
            indentUnit.of(" ".repeat(current.tabSize)),
          ]),
          readOnlyCompartment.reconfigure([
            EditorState.readOnly.of(readOnlyRef.current),
            EditorView.editable.of(!readOnlyRef.current),
          ]),
        ],
      })
    },
    [fontCompartment, readOnlyCompartment, tabCompartment, themeCompartment, wrapCompartment]
  )

  // One CodeMirror view for the whole workspace; tabs swap EditorStates.
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return
    const states = statesRef.current
    const view = new EditorView({
      state: EditorState.create({ doc: "" }),
      parent: containerRef.current,
    })
    viewRef.current = view
    setReady(true)
    return () => {
      if (prevKeyRef.current) states.set(prevKeyRef.current, view.state)
      view.destroy()
      viewRef.current = null
      prevKeyRef.current = null
      states.clear()
    }
  }, [])

  // File/language switch: save the outgoing state, restore or create the next.
  useEffect(() => {
    if (!ready) return
    const view = viewRef.current
    if (!view) return
    const key = `${fileId}:${language}`
    if (prevKeyRef.current && prevKeyRef.current !== key) {
      statesRef.current.set(prevKeyRef.current, view.state)
    }
    const cached = statesRef.current.get(key)
    view.setState(cached ?? makeState(value))
    prevKeyRef.current = key
    applyCompartments(view)

    const head = view.state.selection.main.head
    const line = view.state.doc.lineAt(head)
    onCursorRef.current?.(line.number, head - line.from + 1)

    const mode = getLoadedLanguage(language)
    if (mode) {
      view.dispatch({ effects: languageCompartment.reconfigure(mode) })
      return
    }
    let cancelled = false
    void loadLanguage(language)
      .then((next) => {
        if (cancelled || !next || !viewRef.current || prevKeyRef.current !== key) return
        viewRef.current.dispatch({ effects: languageCompartment.reconfigure(next) })
      })
      .catch(() => {
        // Unknown/unsupported language: plain-text editing still works.
      })
    return () => {
      cancelled = true
    }
    // `value` is intentionally read at switch time; external edits sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fileId, language, makeState, applyCompartments, languageCompartment])

  // External reset / file content replacement.
  useEffect(() => {
    if (!ready) return
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: [externalSync.of(true), Transaction.addToHistory.of(false)],
    })
  }, [ready, value, fileId])

  useEffect(() => {
    if (!ready || !viewRef.current) return
    viewRef.current.dispatch({
      effects: wrapCompartment.reconfigure(settings.wrap ? EditorView.lineWrapping : []),
    })
  }, [ready, settings.wrap, wrapCompartment])

  useEffect(() => {
    if (!ready || !viewRef.current) return
    viewRef.current.dispatch({
      effects: fontCompartment.reconfigure(fontSizeTheme(settings.fontSize)),
    })
  }, [ready, settings.fontSize, fontCompartment])

  useEffect(() => {
    if (!ready || !viewRef.current) return
    viewRef.current.dispatch({
      effects: tabCompartment.reconfigure([
        EditorState.tabSize.of(settings.tabSize),
        indentUnit.of(" ".repeat(settings.tabSize)),
      ]),
    })
  }, [ready, settings.tabSize, tabCompartment])

  useEffect(() => {
    if (!ready || !viewRef.current) return
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(editorTheme(dark, fill)),
    })
  }, [ready, dark, fill, themeCompartment])

  useEffect(() => {
    if (!ready || !viewRef.current) return
    viewRef.current.dispatch({
      effects: readOnlyCompartment.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    })
  }, [ready, readOnly, readOnlyCompartment])

  // Surface the last run's failing line + gutter diagnostic.
  useEffect(() => {
    if (!ready) return
    const view = viewRef.current
    if (!view) return
    let diagnostics: Diagnostic[] = []
    if (errorLine != null) {
      const docLine = view.state.doc.line(Math.min(Math.max(1, errorLine), view.state.doc.lines))
      diagnostics = [
        {
          from: docLine.from,
          to: Math.min(view.state.doc.length, Math.max(docLine.to, docLine.from + 1)),
          severity: "error",
          message: errorMessage?.trim() || "Runtime error",
        },
      ]
    }
    view.dispatch({ effects: [setRunDiagnostics.of(diagnostics), setErrorLine.of(errorLine)] })
  }, [ready, errorLine, errorMessage, fileId])

  useImperativeHandle(
    ref,
    (): CodeMirrorEditorHandle => ({
      focus: () => viewRef.current?.focus(),
      jumpToLine: (line) => {
        const view = viewRef.current
        if (!view) return
        const target = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines))
        view.dispatch({
          selection: { anchor: target.from },
          effects: [
            EditorView.scrollIntoView(target.from, { y: "center" }),
            setErrorLine.of(target.number),
          ],
        })
        view.focus()
      },
      getSelection: () => {
        const view = viewRef.current
        if (!view) return null
        const { from, to } = view.state.selection.main
        if (from === to) return null
        return { from, to, text: view.state.sliceDoc(from, to) }
      },
      replaceSelection: (text) => {
        const view = viewRef.current
        if (!view) return
        const { from, to } = view.state.selection.main
        view.dispatch({ changes: { from, to, insert: text } })
        view.focus()
      },
      scrollToTop: () => {
        viewRef.current?.dispatch({ effects: EditorView.scrollIntoView(0, { y: "start" }) })
      },
    }),
    []
  )

  return <div ref={containerRef} className={className} />
})
