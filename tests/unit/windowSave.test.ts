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
