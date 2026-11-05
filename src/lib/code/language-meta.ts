// Single source of truth for editor languages.
//
// Kept free of CodeMirror imports so the server runner and tests can use it
// without pulling editor bundles. The lazy CodeMirror loaders live in
// ./languages.ts.

export const LANGUAGE_IDS = [
  "python",
  "javascript",
  "typescript",
  "java",
  "c",
  "cpp",
  "go",
  "rust",
  "ruby",
  "php",
  "sql",
  "swift",
  "bash",
  "lua",
  "csharp",
  "kotlin",
  "dart",
  "r",
] as const

export type EditorLanguageId = (typeof LANGUAGE_IDS)[number]

export type LanguageMeta = {
  id: EditorLanguageId
  label: string
  /** Extension without the dot. */
  extension: string
  /** Default file name for a new project. */
  fileName: string
  /** Pinned Wandbox compiler, or null when the language is editor-only. */
  compiler: string | null
  template: string
}

const TEMPLATES: Record<EditorLanguageId, string> = {
  python: 'print("Hello from HiPath AI!")\n\nname = "learner"\nfor i in range(3):\n    print(f"{i + 1}. Keep the streak alive, {name}!")',
  javascript: 'console.log("Hello from HiPath AI!");\n\nconst name = "learner";\nfor (let i = 0; i < 3; i++) {\n  console.log(`${i + 1}. Keep the streak alive, ${name}!`);\n}',
  typescript: 'const message: string = "Hello from HiPath AI!";\nconsole.log(message);\n\nconst streak: number[] = [1, 2, 3];\nfor (const day of streak) {\n  console.log(`Day ${day}: keep going!`);\n}',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from HiPath AI!");\n    }\n}',
  c: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from HiPath AI!\\n");\n    return 0;\n}',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from HiPath AI!" << std::endl;\n    return 0;\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from HiPath AI!")\n}',
  rust: 'fn main() {\n    println!("Hello from HiPath AI!");\n}',
  ruby: 'puts "Hello from HiPath AI!"\n\n3.times do |i|\n  puts "#{i + 1}. Keep the streak alive!"\nend',
  php: '<?php\necho "Hello from HiPath AI!\\n";',
  sql: "CREATE TABLE streaks (day TEXT, minutes INTEGER);\nINSERT INTO streaks VALUES ('Mon', 45), ('Tue', 30);\nSELECT day, minutes FROM streaks;",
  swift: 'print("Hello from HiPath AI!")',
  bash: 'echo "Hello from HiPath AI!"\nfor i in 1 2 3; do\n  echo "$i. Keep the streak alive!"\ndone',
  lua: 'print("Hello from HiPath AI!")\nfor i = 1, 3 do\n  print(i .. ". Keep the streak alive!")\nend',
  csharp: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from HiPath AI!");\n    }\n}',
  kotlin: 'fun main() {\n    println("Hello from HiPath AI!")\n}',
  dart: "void main() {\n  print('Hello from HiPath AI!');\n}",
  r: 'print("Hello from HiPath AI!")\n\nfor (i in 1:3) {\n  cat(i, ". Keep the streak alive!\\n", sep = "")\n}',
}

const META: Record<EditorLanguageId, Omit<LanguageMeta, "id" | "template">> = {
  python: { label: "Python", extension: "py", fileName: "main.py", compiler: "cpython-3.12.7" },
  javascript: { label: "JavaScript", extension: "js", fileName: "index.js", compiler: "nodejs-20.17.0" },
  typescript: { label: "TypeScript", extension: "ts", fileName: "index.ts", compiler: "typescript-5.6.2" },
  java: { label: "Java", extension: "java", fileName: "Main.java", compiler: "openjdk-jdk-21+35" },
  c: { label: "C", extension: "c", fileName: "main.c", compiler: "gcc-13.2.0-c" },
  cpp: { label: "C++", extension: "cpp", fileName: "main.cpp", compiler: "gcc-13.2.0" },
  go: { label: "Go", extension: "go", fileName: "main.go", compiler: "go-1.23.2" },
  rust: { label: "Rust", extension: "rs", fileName: "main.rs", compiler: "rust-1.82.0" },
  ruby: { label: "Ruby", extension: "rb", fileName: "main.rb", compiler: "ruby-4.0.2" },
  php: { label: "PHP", extension: "php", fileName: "main.php", compiler: "php-8.3.12" },
  sql: { label: "SQL", extension: "sql", fileName: "main.sql", compiler: "sqlite-3.46.1" },
  swift: { label: "Swift", extension: "swift", fileName: "main.swift", compiler: "swift-6.0.1" },
  bash: { label: "Bash", extension: "sh", fileName: "main.sh", compiler: "bash" },
  lua: { label: "Lua", extension: "lua", fileName: "main.lua", compiler: "lua-5.4.7" },
  csharp: { label: "C#", extension: "cs", fileName: "Program.cs", compiler: "dotnetcore-8.0.402" },
  // Wandbox has no Kotlin or Dart compiler. Keep them editable/exportable and
  // surface a clear "editor only" state instead of hiding the languages.
  kotlin: { label: "Kotlin", extension: "kt", fileName: "Main.kt", compiler: null },
  dart: { label: "Dart", extension: "dart", fileName: "main.dart", compiler: null },
  r: { label: "R", extension: "R", fileName: "main.R", compiler: "r-4.4.1" },
}

const ALIASES: Record<string, EditorLanguageId> = {
  py: "python",
  python3: "python",
  js: "javascript",
  node: "javascript",
  nodejs: "javascript",
  ts: "typescript",
  "c++": "cpp",
  cxx: "cpp",
  cc: "c",
  golang: "go",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  sqlite: "sql",
  "c#": "csharp",
  cs: "csharp",
  dotnet: "csharp",
  kt: "kotlin",
  rscript: "r",
}

const EXTENSION_ALIASES: Record<string, EditorLanguageId> = {
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  tsx: "typescript",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  sql: "sql",
  swift: "swift",
  sh: "bash",
  bash: "bash",
  lua: "lua",
  cs: "csharp",
  kt: "kotlin",
  kts: "kotlin",
  dart: "dart",
  r: "r",
}

export const LANGUAGE_META: Record<EditorLanguageId, LanguageMeta> = Object.fromEntries(
  LANGUAGE_IDS.map((id) => [id, { id, ...META[id], template: TEMPLATES[id] }])
) as Record<EditorLanguageId, LanguageMeta>

export const EDITOR_LANGUAGES = LANGUAGE_IDS.map((id) => ({ id, label: META[id].label })) as ReadonlyArray<{
  id: EditorLanguageId
  label: string
}>

export const STARTER_TEMPLATES = TEMPLATES

/** Normalize learner/lesson labels ("py", "C++", "node") to a registry id. */
export function resolveLanguageId(language: string | null | undefined): EditorLanguageId | null {
  const key = (language ?? "").trim().toLowerCase()
  if (!key) return null
  if ((LANGUAGE_IDS as readonly string[]).includes(key)) return key as EditorLanguageId
  return ALIASES[key] ?? null
}

export function languageMeta(language: string | null | undefined): LanguageMeta | null {
  const id = resolveLanguageId(language)
  return id ? LANGUAGE_META[id] : null
}

export function isRunnableEditorLanguage(language: string | null | undefined): boolean {
  return languageMeta(language)?.compiler != null
}

export function languageForPath(path: string, fallback: EditorLanguageId = "python"): EditorLanguageId {
  const name = path.split("/").pop() ?? path
  const dot = name.lastIndexOf(".")
  if (dot < 0 || dot === name.length - 1) return fallback
  return EXTENSION_ALIASES[name.slice(dot + 1).toLowerCase()] ?? fallback
}

/**
 * Best-effort language detection for imported lesson drafts, which were saved
 * before the editor had language metadata. Only used for read-only imports and
 * syntax highlighting, so an imperfect guess is harmless.
 */
export function guessLanguageFromCode(code: string): EditorLanguageId {
  const text = code.trim()
  if (!text) return "python"
  if (/<\?php\b/i.test(text)) return "php"
  if (/\busing\s+System\s*;|\bConsole\.(?:WriteLine|ReadLine|Write)\b/.test(text)) return "csharp"
  if (/\bSystem\.out\.|\bpublic\s+static\s+void\s+main\s*\(/.test(text)) return "java"
  if (/\bfun\s+main\s*\(/.test(text)) return "kotlin"
  if (/\bvoid\s+main\s*\(/i.test(text) && /\bpackage:|import\s+'package:/.test(text)) return "dart"
  if (/#include\s*<iostream>|\bstd::/.test(text)) return "cpp"
  if (/#include\s*<stdio\.h>/.test(text)) return "c"
  if (/\bpackage\s+main\b|\bfmt\./.test(text)) return "go"
  if (/\bfn\s+main\s*\(|\bprintln!/.test(text)) return "rust"
  if (/^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\b/im.test(text) && /\bFROM\b|\bINTO\b|\bSET\b/i.test(text)) {
    return "sql"
  }
  if (/^#!.*\b(?:bash|sh)\b/m.test(text) || /\becho\s+["'$]/.test(text)) return "bash"
  if (/\bfunction\b[\s\S]*\bthen\b|\blocal\s+\w+\s*=/.test(text)) return "lua"
  if (/<-|(?:\bcat|\blibrary|\bsapply)\s*\(/.test(text)) return "r"
  if (/\bimport\s+Foundation\b|\bfunc\s+\w+\s*\(/.test(text)) return "swift"
  if (
    /\binterface\s+\w+|\b(?:const|let|var)\s+\w+\s*:\s*(?:string|number|boolean)\b|\bimport\s+type\b/.test(text)
  ) {
    return "typescript"
  }
  if (/\bconsole\.log\b|\b(?:const|let|var)\s+\w+\s*=|=>/.test(text)) return "javascript"
  if (/\bputs\s+|\bdef\s+\w+[\s\S]*\bend\b/.test(text)) return "ruby"
  return "python"
}

/** Download file name (basename) for the language's default file. */
export function defaultFileName(language: string | null | undefined): string {
  return languageMeta(language)?.fileName ?? "main.txt"
}
