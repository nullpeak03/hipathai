import { runnerLanguage } from "./code-runner"

// Standalone editor (/code-e): runnable hello-world per language so Run
// works on first click. Every key must stay runnable (tested below).

export const EDITOR_LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "ruby", label: "Ruby" },
  { id: "php", label: "PHP" },
  { id: "sql", label: "SQL" },
  { id: "swift", label: "Swift" },
  { id: "bash", label: "Bash" },
  { id: "lua", label: "Lua" },
] as const

export type EditorLanguageId = (typeof EDITOR_LANGUAGES)[number]["id"]

export const STARTER_TEMPLATES: Record<EditorLanguageId, string> = {
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
}

export function isRunnableEditorLanguage(id: string): boolean {
  return runnerLanguage(id) !== null
}
