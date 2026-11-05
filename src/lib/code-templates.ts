// Backwards-compatible facade over the language registry. Existing lesson and
// page imports keep working while the editor moves to src/lib/code/*.

export {
  EDITOR_LANGUAGES,
  STARTER_TEMPLATES,
  isRunnableEditorLanguage,
  languageMeta,
  resolveLanguageId,
  type EditorLanguageId,
  type LanguageMeta,
} from "./code/language-meta"
