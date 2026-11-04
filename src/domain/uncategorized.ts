/**
 * The name of "no category": a reserved sentinel, never stored in Settings.categories and
 * impossible to rename or remove (FR-007). Always this English word in storage and backups,
 * whatever the language; screens show it translated (categoryLabel in ui/strings.ts). On its
 * own, with no imports, so the text modules can use it without pulling in storage.
 */
export const UNCATEGORIZED = "Uncategorized";
