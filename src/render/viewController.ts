import { refreshCategorySection } from "./SettingsRenderer";
import { notifyLibraryChanged } from "../ui/libraryEvents";

/**
 * What Settings calls after it changes something: the main screen (Preact) reloads its data,
 * and Settings' own category list re-renders. This module exists only while Settings is still
 * the pre-v3.0 screen; it goes away when Settings is rebuilt.
 */
export async function refreshView(): Promise<void> {
    notifyLibraryChanged();
    await refreshCategorySection(refreshView);
}
