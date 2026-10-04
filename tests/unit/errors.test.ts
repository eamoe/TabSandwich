import { describe, expect, it } from "vitest";
import { StorageWriteError } from "../../src/storage/chromeStorage";
import { removeRefusalMessage, renameRefusalMessage, writeErrorMessage } from "../../src/ui/errors";

describe("what the user is told", () => {
    it("names a full storage, and asks to retry for anything else", () => {
        expect(writeErrorMessage(new StorageWriteError("full", null))).toBe("Storage is full. Export your tabs, remove some, then try again.");
        expect(writeErrorMessage(new StorageWriteError("other", null))).toBe("Couldn't save your changes. Try again.");
        expect(writeErrorMessage(new Error("boom"))).toBe("Couldn't save your changes. Try again.");
    });

    it("explains a refused rename or removal", () => {
        expect(renameRefusalMessage("taken")).toBe("That name is already used by another category.");
        expect(renameRefusalMessage("empty")).toBe("Name can't be empty.");
        expect(removeRefusalMessage("in-use")).toBe("In use — reassign its tabs first.");
    });
});
