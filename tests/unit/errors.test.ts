import { describe, expect, it } from "vitest";
import { StorageWriteError } from "../../src/storage/chromeStorage";
import { removeRefusalMessage, renameRefusalMessage, writeErrorMessage } from "../../src/ui/errors";
import { strings } from "../../src/ui/strings";

describe("what the user is told", () => {
    it("names a full storage, and asks to retry for anything else", () => {
        expect(writeErrorMessage(new StorageWriteError("full", null))).toBe("Storage is full. Export your tabs, remove some, then try again.");
        expect(writeErrorMessage(new StorageWriteError("other", null))).toBe("Couldn't save your changes. Try again.");
        expect(writeErrorMessage(new Error("boom"))).toBe("Couldn't save your changes. Try again.");
    });

    it("explains a refused rename or removal", () => {
        expect(renameRefusalMessage("taken")).toBe("That name is already used by another category.");
        expect(renameRefusalMessage("empty")).toBe("Name can't be empty.");
        expect(removeRefusalMessage("reserved")).toBe('"Uncategorized" can\'t be removed.');
    });

    it("says what removing a category does to its tabs, archived ones included", () => {
        expect(strings.removeConfirmDetail(1, 0)).toBe("Its tab becomes Uncategorized");
        expect(strings.removeConfirmDetail(3, 0)).toBe("Its 3 tabs become Uncategorized");
        expect(strings.removeConfirmDetail(3, 1)).toBe("3 tabs (1 archived) become Uncategorized");
        expect(strings.removeConfirmDetail(1, 1)).toBe("Its archived tab becomes Uncategorized");
        expect(strings.removeConfirmDetail(2, 2)).toBe("Its 2 archived tabs become Uncategorized");
    });
});
