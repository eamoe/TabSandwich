import { test, expect } from "./fixtures";
import { seedLibrary } from "./helpers";

test("data saved before v3.2 is upgraded on first open: tabs unchanged, an empty list of saved windows, a backup kept", async ({ popup }) => {
    await seedLibrary(popup, [{ title: "From v2.2", url: "https://old.example.com/" }]);
    const stored = () => popup.evaluate(async () => chrome.storage.local.get(null));
    await expect.poll(async () => (await stored())["tabSandwich.schemaVersion"]).toBe(3);
    const data = await stored();
    expect(data["tabSandwich.tabs"]).toEqual([expect.objectContaining({ title: "From v2.2", url: "https://old.example.com/" })]);
    expect(data["tabSandwich.groups"]).toEqual([]);
    expect(data["tabSandwich.upgradeBackup"]).toEqual(
        expect.objectContaining({ fromVersion: 1, data: expect.objectContaining({ "tabSandwich.tabs": data["tabSandwich.tabs"] }) })
    );
});

test("TC-259: settings from before v3.3 keep every category from aging except Uncategorized", async ({ popup }) => {
    // Stored the way 3.2 stored it: one on/off switch, no list of categories that age.
    await popup.evaluate(async (day) => {
        await chrome.storage.local.clear();
        await chrome.storage.local.set({
            "tabSandwich.schemaVersion": 2,
            "tabSandwich.lastSeenVersion": chrome.runtime.getManifest().version,
            "tabSandwich.groups": [],
            "tabSandwich.tabs": [
                { id: "a", title: "Old article", url: "https://medium.com/old", category: "Reading", savedAt: Date.now() - 20 * day },
                { id: "b", title: "Loose link", url: "https://loose.example.com/", savedAt: Date.now() - 20 * day },
            ],
            "tabSandwich.settings": { outdatedEnabled: true, outdatedDays: 7, categories: ["Work", "Reading"], categoryColors: { Work: "blue", Reading: "teal" } },
        });
    }, 24 * 60 * 60 * 1000);
    await popup.reload();
    await expect(popup.getByRole("button", { name: "Waiting (1)" })).toBeVisible();
    const settings = await popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.settings"))["tabSandwich.settings"]);
    expect(settings).toEqual({ outdatedDays: 7, categories: ["Work", "Reading"], categoryColors: { Work: "blue", Reading: "teal" }, waitingCategories: ["Uncategorized"] });
});
