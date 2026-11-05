# HiPath AI — Code Editor Upgrade Plan

**Status:** Draft for approval. No editor implementation has started.
**Date:** 2026-11-04
**Scope:** `/code-e` and the runnable code blocks inside lessons.
**Goal:** Turn the current single-file scratchpad into a focused, IDE-lite learning workspace without making lessons heavy or slow.

---

## 1. Summary

The current editor is a solid single-file CodeMirror scratchpad. It has line numbers, search, autocomplete, stdin helpers, run history, and error-line jumps. It is not a workspace: there are no tabs, no file tree, no cloud projects, no visible test runner, no share/export flow, and no AI help tied to a failing run.

This plan upgrades it to:

- **IDE-lite structure** — projects, tabs, a collapsible file tree, a real output panel, and persistent editor settings.
- **Learning-first tools** — visible test cases with pass/fail diffs, explain-selection, fix-this-error, and generate-tests.
- **Local-first persistence** — instant local saves, optional cloud sync for Pro, and safe migration of existing drafts.
- **18 languages** — the current 14 plus C#, R, Kotlin, and Dart (runner support differs; see §6).
- **A pluggable runner** — Wandbox stays primary, with a fallback adapter ready for a second backend.
- **Sharing and export** — unlisted read-only snapshots; free single-file and ZIP export.

Multi-file projects are **organizational**. Run executes only the active file. This is a deliberate constraint, not a temporary bug: Wandbox compiles one source file.

---

## 2. What exists today

| File | Current behavior | Limitation |
|---|---|---|
| `src/app/code-e/page.tsx` | Standalone page with 14 language pills and one `RunnableCodeBlock` | Single file, no project model, no settings, 566 kB First Load JS |
| `src/components/pro/code-panels.tsx` | 730-line monolith: CodeMirror setup, toolbar, stdin, output, errors, history, `ProCodePanel`, `RunnableCodeBlock` | Hard-coded `oneDark`, all state local to one component, impossible to add tabs cleanly |
| `src/lib/code-runner.ts` | Wandbox mapping, 4 000-char cap, 20 s timeout, stdin detection, prompt extraction, error-line parsing | Single provider, single file, 14 languages |
| `src/lib/code-templates.ts` | `EDITOR_LANGUAGES` + starter templates | Must stay in sync with runner by hand |
| `src/lib/code-completions.ts` | Curated keywords/builtins/identifiers | Reusable as-is |
| `src/lib/code-drafts.ts` | `localStorage` drafts under `hipath_code_draft:<lesson>:<index>` | One string per language/lesson block; no project identity |
| `src/app/api/code/run/route.ts` | Auth → Pro/admin check → 30 runs/hour → validate → Wandbox | Single file; no batch test endpoint |
| `src/lib/rate-limit.ts` | `RATE_LIMITS.code = 30/hour`, fail-closed option | No bucket for tests, AI assist, or share creation |
| `src/lib/ai-router.ts` | NIM routes for roadmap/lesson/quiz/tutor/weakness/vision | No `code` feature route |
| `src/app/api/me/preferences/route.ts` | Reads/writes global user preferences | No editor-specific settings (`font_size` is a global accessibility setting and must not be reused) |
| `supabase/migrations/024_tutor_memory.sql` | Latest migration; RLS select-own, service-role writes | Next migration is `025` |
| `src/middleware.ts` | Public routes + default-deny API + CSP | Share page/API must be added; no new CSP origins are expected |

Lesson integrations:

- `src/components/lesson/lesson-body.tsx` uses `ProCodePanel` for lesson blocks and `RunnableCodeBlock` for the scratchpad.
- `src/components/quiz/quiz-rich-text.tsx` uses `ProCodePanel` for code snippets.

These exported component names are part of the lesson contract and will be preserved as thin wrappers.

### Test environment constraint

`vitest.config.mts` runs **Node only**, includes `src/**/*.test.ts`, and there are no component tests today. The plan therefore puts all testable logic in pure `src/lib/code/*` modules and verifies UI through typecheck, production build, and a manual QA matrix. Adding jsdom/testing-library or Playwright is a separate decision, not assumed here.

---

## 3. Goals and non-goals

### Goals

1. A learner can keep several files in one project, switch tabs, and run the active file.
2. Work is never lost: local save is immediate, cloud sync is optional, and legacy drafts are imported.
3. Tests are visible, editable, and show a per-case pass/fail diff.
4. AI help is contextual: explain selection, fix the last error, generate test cases.
5. A share link opens a read-only snapshot; anonymous visitors cannot execute code.
6. The standalone page stays under **450 kB First Load JS** (current: 566 kB) by lazy-loading languages and heavy panels.
7. The lesson editor stays compact and does not gain a file tree or cloud sync by default.
8. Runner failures produce a clear, actionable message instead of a raw network error.
9. Every mutation is ownership-checked and rate-limited; source code is never logged.

### Non-goals

- Full language servers / LSP (pyright, tsserver, etc.).
- True multi-file compilation or package installation.
- An interactive shell or terminal.
- Real-time collaboration.
- Anonymous code execution.
- Replacing the tutor chat.
- A pricing/billing implementation. Pro gating uses the existing entitlement model.

---

## 4. Locked decisions

| Area | Decision |
|---|---|
| Coverage | Upgrade `/code-e` **and** in-lesson runnable blocks; lessons stay compact |
| Priority | IDE-lite + learning, not a full IDE |
| Project structure | Tabs + collapsible file tree |
| Persistence | Local-first; cloud sync for Pro |
| AI | Explain selection, fix error, generate tests (no persistent chat panel in v1) |
| Runner | Keep Wandbox; add a pluggable fallback adapter now |
| Entitlements | Free core + Pro extras: cloud projects, AI assist, unlimited runs are Pro; tests, export, sharing are free |
| Languages | Current 14 + C#, Kotlin, Dart, R |
| Extras | Shareable snapshots, visible test runner, export/download |
| Editor tech | CodeMirror, lazy-loaded; no Monaco |
| Theme/settings | Follow app theme; persist font size, wrap, tab size, layout |
| Devices | Desktop + mobile |
| Multi-file run | Active file only |
| Share behavior | Unlisted, read-only, no anonymous execution |
| Test cases | Manual + AI, batch up to 5 per rate-limit unit |
| Pro boundary | Cloud + AI + unlimited runs |

---

## 5. Target UX

### 5.1 Standalone `/code-e` — desktop

```
┌──────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Header                                                      │
│         ├──────────────────────────────────────────────────────────────┤
│         │ Project title · language · saved state     Run  Test  Share  │
│         ├──────────────┬───────────────────────────────────────────────┤
│         │ FILES        │ Tab: main.py × │ utils.py × │ +              │
│         │ ▾ src        ├───────────────────────────────────────────────┤
│         │   main.py    │                                               │
│         │   utils.py   │              CodeMirror editor                │
│         │ ▾ tests      │                                               │
│         │   test_1.py  │                                               │
│         │ + New file   ├───────────────────────────────────────────────┤
│         │              │ Output │ Tests │ History        stdin (when)  │
│         │              │                                               │
│         │              │  > program output…                            │
│         └──────────────┴───────────────────────────────────────────────┘
```

- File tree: 240 px, collapsible and resizable; hidden under a drawer on mobile.
- Editor tabs: overflow with horizontal scroll; dirty dot; close button; middle-click close on desktop.
- Tab context menu: rename, duplicate, delete, set as entry (entry is informational only).
- Output panel: bottom by default, optional right split; drag handle; remembers height.
- Header actions: Run (primary), Test, Share, Export, settings popover.
- Status strip: language, cursor line/column, indentation, run time, save state.

### 5.2 Mobile

- Single pane: header → file switcher sheet → editor → output bottom sheet.
- Sticky, thumb-reachable Run/Test bar above the keyboard safe area.
- File tree and AI panel open as full-height sheets, not sidebars.
- All targets ≥ 40 px; no hover-only affordances.
- Output sheet has three tabs and remembers its open/closed state per session.
- CodeMirror stays editable; no attempt to fake a native code keyboard.

### 5.3 In-lesson mode

- Reuses the same editor engine with a `variant="lesson"` shell.
- No file tree unless the lesson explicitly provides `files`.
- Output collapsed by default; expands on Run or error.
- Tests seeded from the existing `testCases` prop, marked as provided by the lesson (read-only examples, still runnable).
- AI actions live in an overflow menu to keep the block compact.
- Local draft key remains the existing `draftKey`; no cloud sync and no project creation.
- `ProCodePanel` keeps its current signature and delegates internally. `RunnableCodeBlock` keeps its signature and accepts optional new props.

### 5.4 First-run and empty states

- New project starts from the selected language's starter template.
- Empty tree: “No files yet — create one or start from a template.”
- Runner unsupported: Run disabled with “Running Kotlin isn’t available yet; you can still edit and export.”
- Runner down: inline error with “Try again” and “Copy code” actions.
- Signed-out cloud CTA: “Sign in to sync this project across devices.”
- Free user cloud CTA: Pro dialog, with local project preserved.

### 5.5 Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + Enter` | Run active file |
| `Ctrl/Cmd + Shift + Enter` | Run visible tests |
| `Ctrl/Cmd + S` | Save now (local + cloud if enabled) |
| `Ctrl/Cmd + P` | Quick file switcher |
| `Ctrl/Cmd + B` | Toggle file tree |
| `Ctrl/Cmd + \`` | Toggle output panel |
| `Ctrl/Cmd + Shift + E` | Explain selection (Pro) |
| `F2` | Rename active file |
| `Alt + ↑/↓` | Previous/next tab |

Shortcuts must not fire while focus is in an input outside the editor.

### 5.6 Accessibility

- Tabs implement `role="tablist"` with arrow-key navigation.
- Tree implements `role="tree"` / `treeitem` with `aria-expanded`.
- Run status is announced with `aria-live="polite"` (already the pattern in the current component).
- Focus is returned to the trigger after closing dialogs/sheets.
- Contrast checked in both themes; `prefers-reduced-motion` respected.
- Editor keeps an `aria-label` and does not trap focus.

---

## 6. Language support

Single registry in `src/lib/code/languages.ts` becomes the source of truth: display label, file extensions, CodeMirror loader, Wandbox compiler, template, comment tokens, runnable flag.

| Language | CodeMirror source | Wandbox compiler | Run today |
|---|---|---|---|
| Python | `@codemirror/lang-python` | `cpython-3.12.7` | Yes |
| JavaScript | `@codemirror/lang-javascript` | `nodejs-20.17.0` | Yes |
| TypeScript | `@codemirror/lang-javascript` | `typescript-5.6.2` | Yes |
| Java | `@codemirror/lang-java` | `openjdk-jdk-21+35` | Yes |
| C | `@codemirror/lang-cpp` | `gcc-13.2.0-c` | Yes |
| C++ | `@codemirror/lang-cpp` | `gcc-13.2.0` | Yes |
| Go | `@codemirror/lang-go` | `go-1.23.2` | Yes |
| Rust | `@codemirror/lang-rust` | `rust-1.82.0` | Yes |
| Ruby | `@codemirror/legacy-modes/mode/ruby` | `ruby-4.0.2` | Yes |
| PHP | `@codemirror/lang-php` | `php-8.3.12` | Yes |
| SQL | `@codemirror/lang-sql` | `sqlite-3.46.1` | Yes |
| Swift | `@codemirror/legacy-modes/mode/swift` | `swift-6.0.1` | Yes |
| Bash | `@codemirror/legacy-modes/mode/shell` | `bash` | Yes |
| Lua | `@codemirror/legacy-modes/mode/lua` | `lua-5.4.7` | Yes |
| **C#** | `@codemirror/legacy-modes/mode/clike` (`csharp`) | `dotnetcore-8.0.402` | **Yes (new)** |
| **R** | `@codemirror/legacy-modes/mode/r` | `r-4.4.1` | **Yes (new)** |
| **Kotlin** | `@codemirror/legacy-modes/mode/clike` (`kotlin`) | — | **Editor only** |
| **Dart** | `@codemirror/legacy-modes/mode/clike` (`dart`) | — | **Editor only** |

Verified against `@codemirror/legacy-modes@6.5.5` and the live Wandbox compiler list. Kotlin and Dart are not available on Wandbox.

**Recommendation for Kotlin/Dart:** ship them in the language picker with syntax highlighting, completion keywords, templates, and export, but disable Run with a clear message. Add execution later through a Judge0-compatible fallback if one is configured. This avoids silently dropping the languages and avoids a second runner dependency now. See open decision §25.1.

### Lazy loading

```ts
// src/lib/code/languages.ts (shape)
export const LANGUAGES = {
  python: {
    label: "Python",
    extensions: [".py"],
    compiler: "cpython-3.12.7",
    load: () => import("@codemirror/lang-python").then((m) => m.python()),
    template: STARTER_TEMPLATES.python,
  },
  csharp: {
    label: "C#",
    extensions: [".cs"],
    compiler: "dotnetcore-8.0.402",
    load: () => import("@codemirror/legacy-modes/mode/clike").then((m) => StreamLanguage.define(m.csharp)),
  },
  // …
} satisfies Record<LanguageId, LanguageSpec>
```

Rules:

- Only the active language is imported.
- Language modules are cached in a module-level `Map`.
- Loading shows a non-blocking skeleton in the editor pane; Run waits for the module.
- No language mode is imported at module scope in a component file.
- The starter templates and completions remain static (small) so the picker works before a mode loads.

---

## 7. Architecture

### 7.1 Component tree

```
src/components/code/
  CodeWorkspace.tsx          // standalone orchestrator (header, tree, tabs, panes)
  LessonCodeWorkspace.tsx    // compact shell for lesson blocks
  ProjectTree.tsx
  EditorTabs.tsx
  CodeMirrorEditor.tsx       // imperative handle, one EditorView, per-file EditorState map
  EditorToolbar.tsx          // font, wrap, tab size, layout
  OutputPanel.tsx            // Output | Tests | History tabs + status strip
  StdinPanel.tsx
  TestRunnerPanel.tsx
  AiAssistPanel.tsx          // lazy-mounted on first open
  ShareDialog.tsx
  ExportMenu.tsx             // single file now; ZIP lazy-loaded
  ProjectSettingsDialog.tsx
  UnsavedDialog.tsx
```

Keep `src/components/pro/code-panels.tsx` as the compatibility entry point:

```tsx
export function ProCodePanel(props) {
  return <LessonCodeWorkspace {...props} /> // or static panel for non-runnable languages
}
export function RunnableCodeBlock(props) {
  return <LessonCodeWorkspace {...props} />
}
```

This keeps `lesson-body.tsx` and `quiz-rich-text.tsx` untouched in Phase 1 and prevents a lesson regression from a large import rewrite.

### 7.2 Logic modules (pure and unit-testable)

```
src/lib/code/
  languages.ts          // registry + runner mapping + template access
  editor-settings.ts    // defaults, validation, clamp, serialization
  project-model.ts      // create/rename/delete file, path validation, limits
  project-storage.ts    // localStorage read/write, legacy import
  tests.ts              // case limits, output normalization, pass/fail
  share.ts              // slug validation, snapshot shape, secret heuristic
  run-client.ts         // typed fetch wrapper, error taxonomy mapping
  capabilities.ts       // server-driven feature flags shared by API + client
```

### 7.3 Editor state model

`CodeWorkspace` owns:

```ts
type WorkspaceState = {
  project: CodeProject          // metadata + files
  activeFileId: string
  openFileIds: string[]         // tab order
  dirtyFileIds: Set<string>
  settings: CodeEditorSettings
  run: RunState
  tests: TestCase[]
  sync: "local" | "saving" | "synced" | "offline" | "error"
}
```

- One `EditorView` per workspace, not one per tab.
- A `Map<fileId, EditorState>` preserves undo history, selection, and scroll per file.
- Switching tabs: save the current `EditorState`, then `view.setState(cachedState ?? createState(file))`.
- The editor component exposes `focus()`, `jumpToLine()`, `getSelection()`, `replaceSelection()`, `setDiagnostics()`, `requestMeasure()`.
- Doc changes update the file in the reducer and schedule persistence. They do not re-create the editor.

### 7.4 Persistence

**Local (always):**

- Index: `hipath_code_workspace_v2` → `{ projectIds, activeProjectId, version }`.
- Project: `hipath_code_project_v2:<id>` → project + files + tests + settings snapshot.
- Debounce 500 ms; flush on tab switch, blur, and `visibilitychange`.
- Quota handling: if `setItem` throws, mark “Local storage full” and offer export; never lose the in-memory copy.
- Limits: 25 projects, 20 files/project, 100 000 chars/file, 2 MB/project locally (same as proposed cloud quotas).

**Legacy import (one-time):**

- On first load, read `code-e:<lang>` and `hipath_code_draft:*` entries.
- Create one project per language that has a non-template draft; create lesson drafts as read-only “Lesson drafts” projects.
- Write marker `hipath_code_legacy_imported_v1 = "1"`.
- Never delete old keys; they remain as a fallback for 30 days, then a cleanup task can remove them.

**Cloud (Pro, opt-in per project):**

- Local save always happens first.
- If the project has a `cloudId` and sync is enabled, debounce 2 s, then `PUT /api/code/projects/[id]`.
- Offline/failed sync queues one pending payload in localStorage and retries on reconnect.
- Conflict policy v1: compare `updatedAt`; last write wins, but keep a local “conflict copy” file so nothing is silently destroyed.
- Sync state is visible in the status strip: “Saved locally”, “Syncing…”, “Synced”, “Sync failed — retrying”.

### 7.5 Theme

- App theme comes from `next-themes` (already installed).
- Build `lightTheme` and `darkTheme` with `EditorView.theme` using CSS variables (`--background`, `--foreground`, `--muted`, `--border`, `--primary`).
- Replace the hard-coded `oneDark` import. If a syntax palette is needed, use one `HighlightStyle` per theme; do not keep per-component theme imports.
- Reconfigure the theme through a `Compartment` when the app theme changes; do not recreate the editor.
- Editor surfaces use the same card/muted tokens as the rest of the app so it no longer looks like a dark island in light mode.

### 7.6 Performance strategy

- `/code-e` page is a small client shell; `CodeWorkspace` is loaded with `next/dynamic` (`ssr: false`) and a skeleton.
- Language modes load on demand.
- `AiAssistPanel`, `ShareDialog`, and ZIP export are dynamically imported only when opened.
- No Monaco, no Prettier, no language servers.
- Target: **First Load JS ≤ 450 kB** for `/code-e` (from 566 kB), editor shell chunk ≤ 60 kB gzip, each language mode ≤ 45 kB, AI/share/zip chunks ≤ 40 kB each.
- Measure with `npm run build` and record the route table in the PR description.

---

## 8. Data model — migration `025_code_projects.sql`

Additive only. No existing columns or rows are changed.

```sql
-- 025_code_projects.sql — cloud code projects, files, tests, share snapshots.

create table if not exists code_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  title text not null default 'Untitled project',
  language text not null,
  settings jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now()
);

create index if not exists code_projects_user_updated_idx
  on code_projects (user_id, updated_at desc);

create table if not exists code_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references code_projects(id) on delete cascade,
  path text not null,
  content text not null default '',
  language text not null,
  is_entry boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, path),
  constraint code_project_files_path_len check (char_length(path) between 1 and 200),
  constraint code_project_files_content_len check (char_length(content) <= 100000)
);

create index if not exists code_project_files_project_idx
  on code_project_files (project_id, sort_order);

create table if not exists code_test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references code_projects(id) on delete cascade,
  name text not null default 'Case',
  stdin text not null default '',
  expected text not null default '',
  source text not null default 'user' check (source in ('user', 'ai', 'lesson')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists code_test_cases_project_idx
  on code_test_cases (project_id, sort_order);

-- Immutable snapshot. Survives project deletion.
create table if not exists code_shares (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_id text references users(clerk_id) on delete set null,
  project_id uuid references code_projects(id) on delete set null,
  title text not null,
  language text not null,
  files jsonb not null,
  test_cases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0
);

create index if not exists code_shares_owner_idx
  on code_shares (owner_id, created_at desc);

alter table users
  add column if not exists code_editor_settings jsonb not null default '{}'::jsonb;
```

### RLS

- Enable RLS on all four tables.
- Add select-own policies for `code_projects`, `code_project_files`, `code_test_cases` (file/test policies check project ownership through `exists`).
- Do **not** grant anon/authenticated access to `code_shares`. The public share route reads with the service-role client and increments `view_count`; this avoids exposing `owner_id` and keeps revoked/expired checks in one place.
- All writes go through authenticated API routes using `createServerClient()` (service role). RLS is defense-in-depth, matching migration `024`.

### `code_editor_settings` shape

```ts
type CodeEditorSettings = {
  fontSize: number      // 12–20, default 14
  wrap: boolean         // default true
  tabSize: 2 | 4        // default 2
  layout: "bottom" | "right"  // default "bottom"
  treeOpen: boolean     // default true on desktop, false on mobile
  cloudSync: boolean    // default true for Pro projects
}
```

Validation lives in `src/lib/code/editor-settings.ts` and is reused by the preferences API. Do **not** reuse `users.font_size`, which controls the global UI text size.

---

## 9. API surface

All routes are server-side, authenticated, ownership-checked, and use the service-role Supabase client. Public routes are explicitly listed in `src/middleware.ts`.

| Method | Path | Auth | Gate | Purpose |
|---|---|---|---|---|
| `GET` | `/api/code/capabilities` | Signed-in | — | `{ cloud, ai, share, tests, pro, maxFiles, maxFileChars, maxTestCases }` for UI feature flags |
| `GET` | `/api/code/projects` | Signed-in | Pro | List cloud projects (metadata only) |
| `POST` | `/api/code/projects` | Signed-in | Pro | Create project + initial file; quota-checked |
| `GET` | `/api/code/projects/[id]` | Signed-in | Pro + owner | Project with files and test cases |
| `PATCH` | `/api/code/projects/[id]` | Signed-in | Pro + owner | Rename, change language, archive, update settings |
| `PUT` | `/api/code/projects/[id]` | Signed-in | Pro + owner | Batch save: upsert files/tests, delete removed IDs, `updatedAt` guard |
| `DELETE` | `/api/code/projects/[id]` | Signed-in | Pro + owner | Delete project (shares survive) |
| `POST` | `/api/code/run` | Signed-in | Free limit / Pro unlimited | Existing route; extend language map, response includes `runner` and `remaining` |
| `POST` | `/api/code/tests/run` | Signed-in | Free limit / Pro | Batch ≤5 cases, one rate-limit unit |
| `POST` | `/api/code/assist` | Signed-in | Pro + AI flag | `mode: explain \| fix \| tests` |
| `GET` | `/api/code/shares` | Signed-in | Free | List caller's shares |
| `POST` | `/api/code/shares` | Signed-in | Free + share flag | Create snapshot; returns `{ slug, url }` |
| `DELETE` | `/api/code/shares/[id]` | Signed-in | Free + owner | Revoke |
| `GET` | `/api/share/code/[slug]` | Public | — | Read snapshot, increment view count; **GET only** |
| `PATCH` | `/api/me/preferences` | Signed-in | — | Add `codeEditorSettings` (validated) |

Notes:

- **Public matcher safety:** put the public read at `/api/share/code/[slug]` so the middleware public rule cannot accidentally expose the authenticated `/api/code/shares` collection.
- **Share page:** `/share/code/[slug]`, public, `robots: { index: false }`, read-only editor loaded on demand.
- **Middleware additions:** `/share/code(.*)` and `/api/share/code(.*)` in `isPublicRoute`.
- **CSP:** no new origins. Wandbox is server-side; AI is server-side; Supabase is already allowed.
- **Caching:** all `/api/code/*` responses `Cache-Control: no-store`. The public share read may use `s-maxage=60, stale-while-revalidate=300` only if view counting is decoupled; v1 keeps `no-store` for correctness.

### `POST /api/code/tests/run` contract

```ts
// request
{ language: string, code: string, cases: { stdin: string, expected: string }[] }

// response 200
{
  results: {
    index: number
    passed: boolean
    status: "passed" | "failed" | "error" | "skipped"
    expected: string
    actual: string
    stderr: string
    exitCode: number | null
    durationMs: number
    message?: string
  }[]
  summary: { total: number; passed: number; failed: number; skipped: number }
  runner: "wandbox" | "fallback"
}

// errors
400 invalid body / >5 cases / unsupported language / code too long
401 unauthenticated
402 upgradeRequired (Pro-only path, not used for tests)
429 { error, retryAfterMs }
```

Server rules:

- Max 5 cases, code ≤ `MAX_RUN_CODE_CHARS`, per-case stdin ≤ 4 000 chars.
- Execute sequentially to avoid hammering Wandbox.
- Per-case timeout 10 s; total batch budget 45 s. Remaining cases return `status: "skipped"` with a message.
- Comparison: normalize CRLF to LF, trim trailing whitespace on each line, trim trailing blank lines. Do not trim leading whitespace (indentation matters).
- One rate-limit hit per batch, not per case.
- Never log source, stdin, or expected output.

### `POST /api/code/assist` contract

```ts
// request
{
  mode: "explain" | "fix" | "tests",
  language: string,
  code: string,                 // ≤ 4000 chars
  selection?: string,           // ≤ 2000 chars, explain only
  stderr?: string,              // ≤ 2000 chars, fix only
  failingLine?: number | null
}

// response 200
{ mode: "explain" | "fix", content: string }
| { mode: "tests", cases: { name: string, stdin: string, expected: string }[] }
```

- Add `code` to `AiFeature` and `AI_ROUTES` in `src/lib/ai-router.ts`.
- Recommended model: `nvidia/nemotron-3-super-120b-a12b` primary, lightning fallback, 30 s timeout, `thinkingDisabled: true`. The route defaults to prose (`jsonKeys: []`, `lenientJson: true`); the test-generation call overrides with `jsonMode: true` and `jsonKeys: ["cases"]`.
- Prompt includes language, code, and the specific context. It must never ask the model to execute code.
- Validate output: tests max 5, each field length-capped; reject and retry once if the JSON shape is wrong.
- AI output is rendered as text/Markdown through the existing sanitized renderer. Never inject HTML.
- Rate limit: `RATE_LIMITS.codeAi = 30/hour`; Pro only; fail closed on limiter errors (consistent with AI routes).
- “Replace selection” requires an explicit confirmation and only applies fenced code the user chooses.

---

## 10. Entitlements, limits, and rollout

| Capability | Free | Pro / admin / unlimited | Enforcement |
|---|---|---|---|
| Local projects, tabs, tree | Unlimited (local quotas) | Same | Client only |
| Cloud projects + sync | No | Yes | `is_pro` / `isUnlimitedUser` on every cloud route |
| Run code | 30/hour | Unlimited (abuse guard) | Existing `/api/code/run` |
| Visible tests | Yes, 10 batches/hour | Unlimited (abuse guard) | `/api/code/tests/run` |
| AI explain/fix/tests | No | 30 requests/hour | `/api/code/assist` |
| Share snapshot | Yes, 20/hour | Yes | `/api/code/shares` |
| Export file/ZIP | Yes | Yes | Client-side |
| Lesson blocks | Same as current | Same as current | No change |

- Preserve the existing `402 { upgradeRequired: true }` pattern and `ProUpgradeDialog`.
- Add `RATE_LIMITS.codeTests = { limit: 10, windowMs: HOUR_MS }`, `codeAi = 30/hour`, `codeShare = 20/hour`.
- Cloud quotas (proposed): 25 active projects, 20 files/project, 100 000 chars/file, 2 MB/project. Return quota errors with a clear message.
- **Billing caution:** pricing is currently a waitlist and a live purchase flow is not confirmed. Gate cloud/AI behind `CODE_CLOUD_ENABLED` / `CODE_AI_ENABLED` / `CODE_SHARE_ENABLED` server flags exposed through `/api/code/capabilities`. If billing is not live, use an explicit beta allowlist (`CODE_PRO_BETA_EMAILS`, comma-separated) so the feature can be tested without pretending checkout exists. See §25.3.
- Share and tests are free by decision; they remain behind flags until their routes are verified.

---

## 11. Runner architecture

### 11.1 Adapter interface

```ts
// src/lib/code/runner/types.ts
export type RunRequest = {
  language: string
  code: string
  stdin?: string
  timeoutMs?: number
}

export type RunnerResult =
  | { ok: true; stdout: string; stderr: string; exitCode: number; runMs: number; runner: string }
  | { ok: false; kind: RunnerErrorKind; error: string; runner?: string }

export type RunnerErrorKind =
  | "unsupported"
  | "too_large"
  | "needs_stdin"
  | "runner_unavailable"
  | "timeout"
  | "invalid_response"

export interface RunnerProvider {
  id: string
  supports(language: string): boolean
  run(req: RunRequest): Promise<RunnerResult>
}
```

- `wandbox.ts`: current `runCode` logic, response parsing, stdin preflight, output truncation.
- `fallback.ts`: generic HTTP adapter driven by:
  - `CODE_RUNNER_FALLBACK_PROVIDER` (`judge0` | `generic`)
  - `CODE_RUNNER_FALLBACK_URL`
  - `CODE_RUNNER_FALLBACK_KEY`
- If env vars are absent, the provider reports `enabled: false`; nothing changes at runtime.
- `runWithFallback()`:
  1. If language unsupported by primary and fallback supports it, use fallback.
  2. Try primary once on network/5xx/timeout.
  3. Retry primary once after 400 ms.
  4. Try fallback if configured.
  5. Return a normalized error; never fall back on compile/runtime errors or user-input errors (those are valid results).
- Batch tests use `runWithFallback` per case with the shorter batch timeout.
- Log `{ requestId, runner, language, ok, errorKind, ms }`. Never log code or stdin.

### 11.2 Multi-file semantics

- Run executes the active tab only, regardless of entry flags.
- UI copy: “Run active file” tooltip: “Multi-file projects are for organization. This runs the file in the active tab.”
- Imports in other files are not resolved. If the active file imports a sibling, the runner returns a normal compile/runtime error; the AI “fix this error” action can explain it.
- If the active file is not runnable (Kotlin/Dart), Run is disabled with a language-specific message.

### 11.3 Language support changes

- Add C# and R to `LANGUAGE_MAP`.
- Keep Kotlin/Dart out of the runner map; `runnerLanguage` returns `null` and the UI shows editor-only.
- Update `code-runner.test.ts` expectations and add cases for the new mappings.
- Update `code-templates.test.ts` so every `EDITOR_LANGUAGES` key has a template and the runnable subset is explicit.

---

## 12. Test runner UI

- Panel tabs: `Output`, `Tests`, `History` (stdin stays a separate inline card).
- `Tests` list shows name, input, expected, status pill (`Pass`, `Fail`, `Error`, `Skipped`), duration.
- Row expands to show actual output, stderr, and a line diff for expected vs actual.
- Actions: `Run all` (≤5), `Add case`, `Edit`, `Delete`, `Generate with AI` (Pro).
- Limit: 5 cases per batch. More than 5 saved cases → “Run first 5”, allow reordering.
- Lesson-provided cases are seeded with `source: "lesson"`; learners can run them but not edit them in lesson mode.
- Running tests uses `/api/code/tests/run`; one batch = one rate-limit unit.
- Empty state: “No test cases yet. Add one or generate a starter set.”
- Normalization is displayed in the UI: “Trailing spaces and final newlines are ignored.”
- Test runner progress is sequential and announced; cancel stops after the in-flight case.

---

## 13. AI assist

Panel with three actions, shown only when `capabilities.ai` and the user is Pro:

1. **Explain selection**
   - Requires a non-empty selection; otherwise offers “Explain the whole file”.
   - Sends selection + surrounding language context.
   - Response is prose with optional fenced examples.
2. **Fix this error**
   - Enabled after a run with non-empty stderr.
   - Sends code + stderr tail + failing line.
   - Response explains the cause and suggests a change. “Copy” and “Replace selection” (confirmation required).
3. **Generate tests**
   - Sends code + language.
   - Returns 1–5 cases; they land in the test panel as editable drafts, not automatically run.

UX rules:

- The panel is a right-side drawer on desktop and a sheet on mobile.
- It is lazy-mounted; no AI code in the initial `/code-e` bundle.
- A small privacy note: “Your code and error text are sent to the AI provider. Don’t include secrets.”
- No automatic run after an AI suggestion.
- Loading state with cancel; errors show a retry and never block the editor.
- Rate-limit errors show the reset time.

---

## 14. Sharing and export

### 14.1 Share flow

1. User clicks Share.
2. Dialog chooses: active file or whole project (all files + test cases).
3. Optional title. A warning appears if a secret heuristic matches:
   - AWS access key pattern, `sk-…`, `-----BEGIN … PRIVATE KEY-----`, `password = "…"`, `API_KEY=…`.
   - Confirmation checkbox: “I checked this code for secrets.”
4. `POST /api/code/shares` creates an immutable snapshot and returns `https://hipathai.me/share/code/<slug>`.
5. Dialog offers Copy link, Open, and Revoke.
6. Snapshot includes files, language, title, and test cases (view-only); it never includes a live project reference for display.

### 14.2 Public share page

- Server-rendered title/metadata; `robots: noindex`.
- Read-only CodeMirror with file tabs (no tree), syntax highlighting, font size, wrap.
- Copy file / download file / “Open in my editor” (requires sign-in; copies snapshot into a local project).
- Tests are visible but not runnable while signed out.
- “Sign in to run this code” CTA; after sign-in, the user can open the snapshot and run it under their own quota.
- No anonymous execution endpoint, no anonymous AI, no share editing.
- Revoked or expired link → friendly 404, no data leak.

### 14.3 Export

- Active file: Blob download with the correct extension (`main.py`, `Program.cs`, `script.R`).
- Project: ZIP built **client-side** with a lazy dynamic import of `fflate` (≈8 kB gzip). Includes files, `README.md` with project title/language/run notes, and `tests.json` when cases exist.
- No server round-trip, no storage cost, no new API.
- `fflate` is the recommended dependency; it must be approved and imported only inside the export handler.

---

## 15. Lessons integration

- `ProCodePanel` and `RunnableCodeBlock` remain exported with their current props.
- `LessonCodeWorkspace` adds optional props without breaking existing callers:
  ```ts
  {
    variant?: "lesson"
    files?: CodeFile[]          // if provided, tabs appear
    tests?: TestCase[]          // seeds from existing testCases
    readOnly?: boolean
    onRun?: (result) => void
  }
  ```
- Existing lesson/quiz call sites do not change in Phase 1.
- Lesson drafts keep `draftKey` and the same localStorage prefix.
- No cloud sync, no project tree, no share UI in lesson mode.
- Output stays collapsed by default; errors expand it.
- AI actions are in a compact overflow menu (Pro only).
- Perf option (Phase 7): mount the editor only when the block is near the viewport with `IntersectionObserver`, showing a static highlighted `<pre>` until then. This avoids several CodeMirror instances on long lessons.

---

## 16. Security and privacy

- Execution remains server-side only; the client never calls Wandbox or a fallback directly.
- Every cloud/test/share/assist route checks `auth()`, ownership, and limits before reading or writing.
- Validate and cap all inputs: path length, file count, content length, stdin, code, selection, stderr.
- Share slugs use `crypto.randomUUID()`-derived or 16-byte base64url tokens; no sequential IDs.
- Public share reads are GET-only and rate-limited by IP (e.g. 120/hour) to prevent scraping; use the existing limiter with an `ip:` key.
- No source code, stdin, expected output, AI prompt, or secret in logs. Log only metadata.
- Secret heuristic in the share dialog is a warning, not a guarantee; the privacy note remains.
- The AI panel explicitly states that code is sent to the AI provider.
- CSP remains unchanged; no new third-party origins for the editor.
- Export is client-side; no uploaded archives.
- Revoking a share sets `revoked_at`; the public lookup filters it out.

---

## 17. Observability and analytics

Events (PostHog, no code content):

- `code_workspace_opened`, `code_project_created`, `code_file_created`
- `code_run_started`, `code_run_finished` (`language`, `ok`, `runner`, `duration_bucket`)
- `code_tests_run` (`case_count`, `passed`, `failed`, `skipped`)
- `code_ai_assist` (`mode`, `ok`, `latency_bucket`)
- `code_share_created`, `code_share_opened`, `code_exported`
- `code_sync_failed`

Server logs:

- Rate-limit hits (existing `logWarn`).
- Runner failures by `errorKind` and provider.
- Cloud project quota rejections.
- No raw payload logging.

---

## 18. Performance budget

| Item | Budget |
|---|---|
| `/code-e` First Load JS | ≤ 450 kB (baseline 566 kB) |
| Workspace shell chunk | ≤ 60 kB gzip |
| Base editor (CodeMirror core + view) | ≤ 200 kB gzip |
| Each language mode | ≤ 45 kB gzip |
| AI panel chunk | ≤ 40 kB gzip, lazy |
| ZIP export chunk | ≤ 15 kB gzip, lazy |
| Initial editor interactive | ≤ 2.5 s on a mid-range phone / Fast 3G |

Verification:

- `npm run build` route table comparison in the PR.
- Network panel: confirm no language mode loads until selected.
- Lighthouse mobile pass on the share page and `/code-e` (manual until a CI budget check exists).

---

## 19. Testing and verification

### 19.1 Unit tests (Vitest, Node)

Add `src/lib/code/*.test.ts` for:

- **languages.test.ts** — every language has a label, extension, template, and loader; runnable flags match the runner map; C#/R are runnable; Kotlin/Dart are not.
- **editor-settings.test.ts** — defaults, clamping, unknown values, serialization round-trip.
- **project-model.test.ts** — create/rename/delete, duplicate paths, path limits, file/content quotas, active-file fallback after delete.
- **project-storage.test.ts** — save/load, quota failure, legacy import from `code-e:<lang>` and `hipath_code_draft:*`, idempotent marker.
- **tests.test.ts** — normalization (CRLF, trailing spaces, trailing newlines), pass/fail, 5-case cap, skipped budget.
- **share.test.ts** — slug shape, snapshot shape, secret heuristic true/false cases, revoked/expired logic.
- **run-client.test.ts** — maps 402/429/500 to the right UI state; never swallows errors.
- **runner adapter tests** — primary success, retry on 5xx, no fallback on compile error, fallback when primary times out, disabled fallback, error taxonomy.
- **api route tests** — extend the existing mocking patterns for auth/supabase/fetch: ownership 404, Pro 402, quota 400, batch 429.

Update:

- `src/lib/code-runner.test.ts` — new mappings; Kotlin/Dart remain null.
- `src/lib/code-templates.test.ts` — 18 languages; runnable subset explicit.
- `src/lib/rate-limit.test.ts` — new buckets if the test enumerates them.

### 19.2 Static checks

- `npm run typecheck`
- `npm run lint`
- `npm test` (baseline: 40 files / 317 tests; expect a higher count)
- `npm run build`

### 19.3 Manual QA matrix

| Scenario | Desktop | Mobile |
|---|---|---|
| Signed out `/code-e` | Local editing/running | Same |
| Signed in free | Local projects, limits, Pro CTAs | Same |
| Signed in Pro | Cloud sync, AI, unlimited | Same |
| Multiple files/tabs | Add, rename, delete, reorder, run active | Sheet switcher |
| Theme light/dark | Editor matches app, no flash | Same |
| Settings persistence | Reload, new tab, second device (cloud) | Reload |
| Runner failure | Clear error, retry, export still works | Same |
| Tests | Add/edit/run 5, diff, skipped case | Same |
| AI explain/fix/tests | Selection, stderr, generated cases | Sheet |
| Share | Create, open signed out, sign-in CTA, revoke | Same |
| Export | File + ZIP contents | File |
| Lesson block | Compact, draft persistence, tests, no tree | Same |
| Legacy drafts | Imported once, not duplicated | Same |
| Offline | Local save, queued sync, no data loss | Same |

UI verification requires a signed-in session. Local placeholder Clerk keys currently make runtime auth requests fail with 500, so the final QA must run on a Vercel preview with real keys.

---

## 20. Implementation phases

### Phase 0 — Approval (current)

- Approve this document and resolve §25 decisions.
- No code changes.

**Exit:** written approval.

### Phase 1 — Editor shell foundation (no new backend)

**Status (2026-11-05):** Implemented. `/code-e` First Load JS is 215 kB (target ≤ 450 kB). Lesson drafts are imported once into a read-only “Lesson drafts (imported)” project; their language is inferred from the saved code because the legacy key carries no metadata. Kotlin and Dart remain editor-only.

Deliver:

- `src/lib/code/languages.ts` with all 18 languages and lazy loaders.
- Extract `CodeMirrorEditor.tsx`; remove the hard-coded `oneDark`.
- `CodeWorkspace` with tabs, tree, active-file execution, status strip.
- Per-file `EditorState` map (undo/selection preserved).
- Local project persistence + legacy draft import.
- Editor settings (font size, wrap, tab size, layout, tree) persisted locally.
- Responsive desktop/mobile shells.
- Reuse existing `/api/code/run`; add C#/R mappings; mark Kotlin/Dart editor-only.
- `ProCodePanel` / `RunnableCodeBlock` wrappers delegate to `LessonCodeWorkspace`.
- Single-file export.

**Not in Phase 1:** cloud sync, tests API, AI, share links.

**Acceptance:**

- 18 languages selectable; C# and R run; Kotlin/Dart show the editor-only message.
- Tabs/tree work with 10 files; undo history survives tab switches.
- Reload restores the project, active tab, and settings.
- Legacy `code-e:<lang>` and lesson drafts import exactly once.
- `/code-e` First Load JS ≤ 450 kB.
- Existing lesson blocks behave as before.
- Typecheck, lint, tests, build pass.

### Phase 2 — Visible tests + batch runner

Deliver:

- `src/lib/code/tests.ts` (normalization, comparison, caps).
- `POST /api/code/tests/run` + rate-limit bucket.
- `TestRunnerPanel` (manual cases, run, diff, skipped).
- Seed lesson `testCases` into the panel as read-only lesson cases.
- Tests persisted locally per project.

**Acceptance:** 5 cases run as one rate unit; >5 rejected; timeout marks remaining skipped; diffs are correct; lesson cases run but cannot be edited in lesson mode.

### Phase 3 — Runner adapter

Deliver:

- `src/lib/code/runner/*` providers and `runWithFallback`.
- `runCode` compatibility wrapper (or update call sites).
- Error taxonomy surfaced in the UI.
- Fallback env plumbing; unconfigured = disabled.
- Runner metadata in responses.

**Acceptance:** primary-only behavior matches today; simulated 5xx/timeout uses fallback when configured; compile errors do not trigger fallback; no secrets logged.

### Phase 4 — Cloud projects (Pro)

Deliver:

- Migration `025_code_projects.sql`.
- All `/api/code/projects*` routes + ownership/quota checks.
- `PATCH /api/me/preferences` supports `codeEditorSettings`.
- Local-first sync, pending queue, conflict copy, sync status.
- Cloud project picker; “Save to cloud” / “Sync” actions.
- Capability flags for rollout.

**Acceptance:** create/edit/sync/delete a project; reload on a second browser restores it; offline edits sync later; free users get the Pro dialog and keep local data; delete leaves shares intact; RLS verified.

### Phase 5 — AI assist (Pro)

Deliver:

- `code` route in `ai-router.ts` + prompt builders.
- `POST /api/code/assist` with validation, limits, and JSON checks.
- Lazy `AiAssistPanel` with explain/fix/tests.
- Selection-aware explain, stderr-aware fix, editable generated cases.

**Acceptance:** each mode returns usable output; tests are capped at 5; rate limit and Pro gate work; no AI code in the initial bundle; failures are recoverable.

### Phase 6 — Sharing + export ZIP

Deliver:

- `code_shares` table (already in migration 025), create/list/revoke routes.
- Public `/api/share/code/[slug]` GET + `/share/code/[slug]` page.
- Middleware public routes, noindex metadata.
- Share dialog with secret heuristic and revoke.
- Lazy `fflate` ZIP export.
- Sign-in-to-run CTA and “Open in my editor”.

**Acceptance:** signed-out visitors can view/copy/download but cannot run; signed-in users can import and run; revoked links 404; share creation is rate-limited; ZIP contents are correct; no new CSP origins.

### Phase 7 — Polish and launch

Deliver:

- Accessibility pass (keyboard, ARIA, focus, contrast, reduced motion).
- Mobile QA fixes.
- Performance verification and bundle trims.
- Analytics events.
- Docs: user help, share page copy, privacy note, env var docs.
- Optional: IntersectionObserver mounting for lesson blocks.
- Final manual QA on a Vercel preview with real Clerk keys.

**Acceptance:** all §19.3 scenarios pass; budget met; no regressions in lessons; docs updated.

### Suggested sequencing rationale

- Phase 1 delivers the visible upgrade and can be reviewed before backend work.
- Tests (2) and runner reliability (3) are independent of cloud/AI and immediately useful.
- Cloud (4) must precede AI (5) only if AI should reference saved projects; it does not, so 3–5 can be reordered.
- Sharing (6) depends on the project model but not on AI.
- Phase 7 is a launch gate, not optional polish.

---

## 21. File-by-file change map

| Existing file | Change |
|---|---|
| `src/app/code-e/page.tsx` | Replace the single block with a lazy-loaded `CodeWorkspace`; keep the page shell |
| `src/components/pro/code-panels.tsx` | Reduce to compatibility wrappers; move editor logic to `src/components/code/*` |
| `src/components/lesson/lesson-body.tsx` | No change in Phase 1; update only if the wrapper contract changes |
| `src/components/quiz/quiz-rich-text.tsx` | No change |
| `src/lib/code-runner.ts` | Keep as a compatibility layer or move logic into `src/lib/code/runner/wandbox.ts`; add C#/R |
| `src/lib/code-templates.ts` | Re-export from the new language registry; add 4 templates |
| `src/lib/code-completions.ts` | Add C#/Kotlin/Dart/R keywords and builtins |
| `src/lib/code-drafts.ts` | Keep for lesson drafts; new project storage lives in `src/lib/code/project-storage.ts` |
| `src/app/api/code/run/route.ts` | Use the runner adapter; add `remaining`/`runner`; keep auth/limits |
| `src/app/api/me/preferences/route.ts` | Add `codeEditorSettings` get/patch with validation |
| `src/lib/rate-limit.ts` | Add `codeTests`, `codeAi`, `codeShare` buckets |
| `src/lib/ai-router.ts` | Add `code` feature + route |
| `src/middleware.ts` | Add `/share/code(.*)` and `/api/share/code(.*)` public routes |
| `supabase/migrations/` | New `025_code_projects.sql` |
| `docs/` | This plan; add user-facing editor help during Phase 7 |

---

## 22. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Bundle grows past budget | Slower lessons/pages | Dynamic workspace, per-language chunks, lazy AI/share/zip, build budget check |
| Wandbox outage | Runs fail | Fallback adapter, clear errors, retry, export as escape hatch |
| Kotlin/Dart cannot run | Feature gap | Editor-only labeling now; Judge0/fallback later |
| Pro billing not live | Cloud/AI unusable commercially | Capability flags + beta allowlist; do not fake checkout |
| Sync conflicts or data loss | Trust damage | Local-first, pending queue, conflict copies, `updatedAt` guard |
| AI cost/latency | Budget and UX | Pro gate, 30/hour, input caps, super/lightning route, single retry |
| Share abuse | Cost/abuse | Unlisted slugs, creation limit, IP rate limit, no anonymous run |
| Secret leakage in shares | Security incident | Heuristic warning + confirmation + privacy copy |
| Lesson regression | Core learning flow breaks | Preserve exports, wrapper approach, manual lesson QA |
| localStorage quota | Lost work | Caps, warning, export, in-memory fallback |
| Multiple editors on long lessons | Jank | Compact variant, optional IntersectionObserver mount |
| Migration issues | Data/API breakage | Additive SQL, RLS, no destructive changes, preview test |
| Auth mismatch on share page | 401s | Explicit public matcher + GET-only public route |
| Mobile keyboard occludes output | Poor UX | Bottom sheet, sticky run bar, safe-area padding |

---

## 23. Backout and migration safety

- Migration 025 is additive; leaving it applied is safe if the UI rolls back.
- `ProCodePanel`/`RunnableCodeBlock` wrappers mean lesson pages can revert to the old component without touching call sites.
- New API routes are unused by old UI; no behavior change until the client opts in.
- Feature flags allow disabling cloud/AI/share in production without a deploy of the UI.
- Legacy drafts are never deleted; import is idempotent via a marker.
- Cloud data remains readable even if sync is disabled; the UI falls back to local.

---

## 24. Acceptance criteria (overall)

1. `/code-e` supports 18 languages, tabs, a file tree, and active-file execution.
2. Work persists locally and survives reload; Pro users can sync across devices.
3. Existing lesson code blocks keep working with the same props and draft keys.
4. The test panel runs up to 5 cases as one rate unit and shows pass/fail diffs.
5. AI explain/fix/generate-tests work for Pro users and are absent from the free tier.
6. Share links are unlisted, read-only, non-indexed, and cannot execute anonymously.
7. Export downloads a single file and a valid ZIP project.
8. C# and R execute on Wandbox; Kotlin and Dart are clearly editor-only.
9. Runner failures are actionable and the fallback adapter is wired but inert until configured.
10. `/code-e` First Load JS ≤ 450 kB.
11. Typecheck, lint, all tests, and production build pass.
12. Desktop, mobile, light, and dark QA matrix passes on a signed-in preview deployment.

---

## 25. Open decisions (needed before the relevant phase)

1. **Kotlin and Dart** — confirm editor-only for now (recommended), or swap them for other runnable languages, or fund a Judge0/self-hosted runner for Phase 3.
2. **Cloud quotas** — confirm 25 projects / 20 files / 100 000 chars per file / 2 MB per project, or provide different numbers.
3. **Pro rollout** — is `users.is_pro` live for real customers, or should cloud/AI launch behind a beta email allowlist until billing ships? (Recommended: allowlist + flags.)
4. **AI model and budget** — approve super primary + lightning fallback, 30 s timeout, 30 requests/hour. Or specify a cheaper model/cap.
5. **ZIP dependency** — approve `fflate` as a lazy dependency (recommended, ≈8 kB) or require export without a ZIP until later.
6. **Run size** — keep the 4 000-character code cap, or raise it to 8 000/16 000 for project files? (Recommended: keep 4 000 until runner costs are measured.)
7. **Share retention and indexing** — keep links until revoked (recommended, with `noindex`), or add automatic 90-day expiry? Confirm `noindex`.
8. **Lesson cloud sync** — confirm lesson blocks stay local-only (recommended) even for Pro users.
9. **Test execution budget** — approve the 45 s batch budget and 10 s per case, with remaining cases marked skipped.
10. **Max files per project** — confirm 20 files (recommended) or a higher limit for capstones.
11. **Entry point semantics** — entry flags are informational only (recommended). Confirm no UI promises multi-file compilation.

---

## 26. Estimate

| Phase | Engineering estimate |
|---|---|
| 1 — Editor shell | 4–5 days |
| 2 — Tests + batch API | 2–3 days |
| 3 — Runner adapter | 1–2 days |
| 4 — Cloud projects | 4–5 days |
| 5 — AI assist | 2–3 days |
| 6 — Share + export | 3–4 days |
| 7 — Polish + launch | 2–3 days |
| **Total** | **18–25 engineering days** |

Estimates assume one engineer, existing CodeMirror stack, and no new design system work. They exclude DNS, billing, and runner hosting.

---

## 27. Approval checklist

- [x] Scope and UX approved (§5).
- [x] Language decision for Kotlin/Dart (§25.1).
- [x] Quotas confirmed (§25.2).
- [x] Pro rollout approach confirmed (§25.3).
- [x] AI model/budget confirmed (§25.4).
- [x] `fflate` approved (§25.5).
- [x] Run-size cap confirmed (§25.6).
- [x] Share retention/noindex confirmed (§25.7).
- [x] Lesson local-only confirmed (§25.8).
- [x] Test batch budget confirmed (§25.9).
- [x] File limit confirmed (§25.10).
- [x] Entry-point semantics confirmed (§25.11).
- [x] Approval to start Phase 1.

---

## 28. Operational follow-ups (outside this plan)

These were already outstanding before the editor work and must not be forgotten:

1. Re-sync Inngest to `https://www.hipathai.me/api/inngest` and verify function IDs.
2. Rotate exposed Clerk / Supabase / NVIDIA / Vercel keys; confirm no secrets in the repo.
3. Apply the SPF / DMARC / CAA records from `docs/DNS_EMAIL_POSTURE.md` and verify with `dig`.
4. After the next Vercel deploy, visually verify `/tutor` with a real signed-in session.
5. Confirm the production Supabase project has all migrations through `025` after it is applied.
