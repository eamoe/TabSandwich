import { test, expect } from "./fixtures";
import { seedLibrary } from "./helpers";

test("data saved before v3.2 is upgraded on first open: tabs unchanged, an empty list of saved windows, a backup kept", async ({ popup }) => {
    await seedLibrary(popup, [{ title: "From v2.2", url: "https://old.example.com/" }]);
    const stored = () => popup.evaluate(async () => chrome.storage.local.get(null));
    await expect.poll(async () => (await stored())["tabSandwich.schemaVersion"]).toBe(2);
    const data = await stored();
    expect(data["tabSandwich.tabs"]).toEqual([expect.objectContaining({ title: "From v2.2", url: "https://old.example.com/" })]);
    expect(data["tabSandwich.groups"]).toEqual([]);
    expect(data["tabSandwich.upgradeBackup"]).toEqual(
        expect.objectContaining({ fromVersion: 1, data: expect.objectContaining({ "tabSandwich.tabs": data["tabSandwich.tabs"] }) })
    );
});
