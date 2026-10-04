import { test, expect } from "./fixtures";
import { seedLibrary } from "./helpers";

test("data saved by v2.2 is stamped with a data version on first open, unchanged", async ({ popup }) => {
    await seedLibrary(popup, [{ title: "From v2.2", url: "https://old.example.com/" }]);
    await expect.poll(() => popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.schemaVersion"))["tabSandwich.schemaVersion"])).toBe(1);
    const tabs = await popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.tabs"))["tabSandwich.tabs"]);
    expect(tabs).toEqual([expect.objectContaining({ title: "From v2.2", url: "https://old.example.com/" })]);
});
