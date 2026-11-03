import { describe, expect, it } from "vitest";
import { getLastSeenVersion } from "../../src/storage/chromeStorage";
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSION_KEY } from "../../src/storage/upgrade";
import { WELCOME_PAGE, handleInstalled } from "../../src/worker/install";
import { storage } from "./setup";
import { SETTINGS_KEY, seed } from "./helpers";

const welcome = `chrome-extension://test-extension-id/${WELCOME_PAGE}`;

describe("handleInstalled", () => {
    it("on a fresh install, settles What's new first, brings storage up to date and opens the welcome page", async () => {
        const writes: string[][] = [];
        storage.rejectSet = (items) => {
            writes.push(Object.keys(items));
            return null;
        };
        await handleInstalled("install");
        expect(writes[0]).toEqual(["tabSandwich.lastSeenVersion"]);
        expect(await getLastSeenVersion()).toBe("9.9.9");
        expect(storage.data[SCHEMA_VERSION_KEY]).toBe(CURRENT_SCHEMA_VERSION);
        expect(storage.openedTabs).toEqual([welcome]);
    });

    it("sets what the toolbar icon opens, on an update too", async () => {
        seed([], { toolbarOpens: "panel" });
        await handleInstalled("update");
        expect(storage.toolbarPopup).toBe("");
        expect(storage.panelOnClick).toBe(true);
    });

    it("still welcomes a new user if the first write fails", async () => {
        storage.failNextSetWith = new Error("something odd");
        await handleInstalled("install");
        expect(storage.openedTabs).toEqual([welcome]);
    });

    it("on an update, upgrades stored data, keeps What's new due and opens nothing", async () => {
        storage.data["tabSandwich.lastSeenVersion"] = "3.3.0";
        storage.data[SCHEMA_VERSION_KEY] = 2;
        storage.data[SETTINGS_KEY] = { outdatedEnabled: true };
        await handleInstalled("update");
        expect(storage.data[SCHEMA_VERSION_KEY]).toBe(CURRENT_SCHEMA_VERSION);
        expect(await getLastSeenVersion()).toBe("3.3.0");
        expect(storage.openedTabs).toEqual([]);
    });

    it("does nothing new when Chrome itself updated", async () => {
        await handleInstalled("chrome_update");
        expect(storage.openedTabs).toEqual([]);
        expect(await getLastSeenVersion()).toBeUndefined();
    });
});
