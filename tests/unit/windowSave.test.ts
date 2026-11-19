import { describe, expect, it } from "vitest";
import { closableTabIds, planWindowSave } from "../../src/domain/windowSave";
import { makeTab } from "./helpers";

describe("planWindowSave", () => {
    it("saves each new web page once, in window order, and counts what it skips and why", () => {
        const saved = [makeTab({ url: "https://saved.example.com/" })];
        const plan = planWindowSave(
            [
                { title: "New tab", url: "chrome://newtab/" },
                { title: " One ", url: "https://one.example.com/" },
                { title: "Saved", url: "https://saved.example.com" },
                { title: "", url: "https://two.example.com/" },
                { title: "One again", url: "https://one.example.com/#more" },
                { title: "Extensions", url: "chrome://extensions/" },
                { title: "No address" },
            ],
            saved
        );
        expect(plan.toSave).toEqual([
            { title: "One", url: "https://one.example.com/" },
            { title: "https://two.example.com/", url: "https://two.example.com/" },
        ]);
        expect(plan.alreadySaved).toBe(2);
        expect(plan.browserPages).toBe(3);
    });
});

describe("planWindowSave and the archive", () => {
    it("counts pages whose only saved copy is archived apart, each once, and a copy in the list wins", () => {
        const archivedA = makeTab({ url: "https://a.example.com/", archivedAt: 1 });
        const archivedB = makeTab({ url: "https://b.example.com/", archivedAt: 1 });
        const liveC = makeTab({ url: "https://c.example.com/" });
        const archivedC = makeTab({ url: "https://c.example.com/", archivedAt: 1 });
        const plan = planWindowSave(
            [
                { url: "https://a.example.com/" },
                { url: "https://b.example.com/" },
                { url: "https://a.example.com/#again" },
                { url: "https://c.example.com/" },
                { url: "https://new.example.com/" },
            ],
            [archivedA, archivedB, liveC, archivedC]
        );
        expect(plan.inArchive).toEqual([archivedA.id, archivedB.id]);
        // a.example.com open twice: the second is a repeat; c has a copy in the list.
        expect(plan.alreadySaved).toBe(2);
        expect(plan.toSave).toEqual([{ title: "https://new.example.com/", url: "https://new.example.com/" }]);
    });
});

describe("closableTabIds", () => {
    it("closes saved web pages only, never the tab you're on", () => {
        const saved = [makeTab({ url: "https://a.example.com/" }), makeTab({ url: "https://b.example.com/" })];
        const ids = closableTabIds(
            [
                { id: 1, url: "https://a.example.com/" },
                { id: 2, url: "https://b.example.com/", active: true },
                { id: 3, url: "https://not-saved.example.com/" },
                { id: 4, url: "chrome://settings/" },
                { url: "https://a.example.com/" },
            ],
            saved
        );
        expect(ids).toEqual([1]);
    });
});
