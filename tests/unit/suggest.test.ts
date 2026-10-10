import { describe, expect, it } from "vitest";
import { suggestCategory } from "../../src/domain/suggest";
import { makeTab } from "./helpers";

const CATEGORIES = ["Work", "ProjX", "Perspicax", "Reading"];
const day = (n: number) => Date.UTC(2026, 9, n);

describe("suggestCategory", () => {
    it("suggests where pages from the same site went", () => {
        const tabs = [makeTab({ url: "https://medium.com/a", category: "Reading", savedAt: day(1) })];
        expect(suggestCategory("https://www.medium.com/b/c", tabs, CATEGORIES)).toBe("Reading");
    });

    it("prefers the pages sharing most of the path: a repo's page goes where that repo went", () => {
        const tabs = [
            makeTab({ url: "https://github.com/eamoe/lingua-mentor", category: "Perspicax", savedAt: day(1) }),
            makeTab({ url: "https://github.com/eamoe/micro-task-tracker", category: "ProjX", savedAt: day(5) }),
            makeTab({ url: "https://github.com/eamoe/micro-task-tracker/pulls", category: "ProjX", savedAt: day(6) }),
        ];
        expect(suggestCategory("https://github.com/eamoe/lingua-mentor/issues/4", tabs, CATEGORIES)).toBe("Perspicax");
        expect(suggestCategory("https://github.com/eamoe/micro-task-tracker/actions", tabs, CATEGORIES)).toBe("ProjX");
    });

    it("learns from corrections: once isn't enough against a habit, twice is", () => {
        const habit = [1, 2, 3].map((n) => makeTab({ url: `https://docs.example.com/p${n}`, category: "Work", savedAt: day(n) }));
        const once = [...habit, makeTab({ url: "https://docs.example.com/p4", category: "ProjX", savedAt: day(4) })];
        expect(suggestCategory("https://docs.example.com/new", once, CATEGORIES)).toBe("Work");
        const twice = [...once, makeTab({ url: "https://docs.example.com/p5", category: "ProjX", savedAt: day(5) })];
        expect(suggestCategory("https://docs.example.com/new", twice, CATEGORIES)).toBe("ProjX");
    });

    it("breaks a tie toward the most recent", () => {
        const tabs = [
            makeTab({ url: "https://x.example.com/1", category: "Work", savedAt: day(1) }),
            makeTab({ url: "https://x.example.com/2", category: "Reading", savedAt: day(2) }),
        ];
        expect(suggestCategory("https://x.example.com/3", tabs, CATEGORIES)).toBe("Reading");
    });

    it("ignores tabs without a category and categories that no longer exist; no history, no suggestion", () => {
        const tabs = [
            makeTab({ url: "https://y.example.com/1", savedAt: day(3) }),
            makeTab({ url: "https://y.example.com/2", category: "Gone", savedAt: day(2) }),
        ];
        expect(suggestCategory("https://y.example.com/3", tabs, CATEGORIES)).toBeUndefined();
        expect(suggestCategory("https://never.example.com/", tabs, CATEGORIES)).toBeUndefined();
        expect(suggestCategory("not a url", tabs, CATEGORIES)).toBeUndefined();
    });

    it("treats a tab stored with the word Uncategorized (edited before 3.3.1) as having no category", () => {
        const tabs = [
            makeTab({ url: "https://chatgpt.com/c/1", category: "Uncategorized", savedAt: day(3) }),
            makeTab({ url: "https://chatgpt.com/c/2", category: "Uncategorized", savedAt: day(2) }),
            makeTab({ url: "https://chatgpt.com/c/3", category: "Work", savedAt: day(1) }),
        ];
        const withUncategorized = [...CATEGORIES, "Uncategorized"];
        expect(suggestCategory("https://chatgpt.com/c/4", tabs, withUncategorized)).toBe("Work");
        expect(suggestCategory("https://chatgpt.com/c/4", tabs.slice(0, 2), withUncategorized)).toBeUndefined();
    });
});
