import { describe, expect, it } from "vitest";
import { searchTabs } from "../../src/domain/search";
import { makeTab } from "./helpers";

const github = makeTab({ title: "Open Pull Requests", url: "https://github.com/eamoe/TabSandwich/pulls" });
const recipe = makeTab({ title: "Recipe: Weeknight Pasta", url: "https://bonappetit.com/recipe/pasta" });
const async = makeTab({ title: "How Async/Await Works", url: "https://medium.com/@dev/async-await" });
const tabs = [github, recipe, async];

describe("searchTabs", () => {
    it("returns everything, in the original order, for an empty query", () => {
        expect(searchTabs(tabs, "   ").map((m) => m.tab)).toEqual(tabs);
    });

    it("fuzzy-matches a domain from a few of its letters", () => {
        expect(searchTabs(tabs, "gthb").map((m) => m.tab.id)).toEqual([github.id]);
    });

    it("requires every whitespace-separated term to match", () => {
        expect(searchTabs(tabs, "pasta recipe").map((m) => m.tab.id)).toEqual([recipe.id]);
        expect(searchTabs(tabs, "pasta github")).toEqual([]);
    });

    it("is case-insensitive", () => {
        expect(searchTabs(tabs, "ASYNC").map((m) => m.tab.id)).toEqual([async.id]);
    });

    it("reports which title characters matched, for highlighting", () => {
        const [match] = searchTabs(tabs, "pull");
        expect(match.tab.id).toBe(github.id);
        expect(match.titleRanges).toEqual([{ start: 5, end: 9 }]);
        expect(github.title.slice(5, 9)).toBe("Pull");
    });

    it("ranks a title hit above a URL-only hit", () => {
        const titleHit = makeTab({ title: "Docs home", url: "https://example.com/" });
        const urlHit = makeTab({ title: "Something else", url: "https://example.com/docs" });
        expect(searchTabs([urlHit, titleHit], "docs").map((m) => m.tab.id)).toEqual([titleHit.id, urlHit.id]);
    });

    it("returns nothing when no tab matches", () => {
        expect(searchTabs(tabs, "zzzz")).toEqual([]);
    });

    describe("category and saved-window names", () => {
        const repo = makeTab({ title: "eamoe/projx", url: "https://github.com/eamoe/projx", category: "ProjX" });
        const docs = makeTab({ title: "API reference", url: "https://docs.example.com/api", category: "ProjX" });
        const article = makeTab({ title: "A long read", url: "https://medium.com/read", category: "Reading", groupId: "w" });
        const other = makeTab({ title: "Weather", url: "https://weather.example.com/", category: "Work", groupId: "w" });
        const library = [repo, docs, article, other];
        const labelsOf = (tab: typeof repo) => ({ category: tab.category ?? "Uncategorized", window: tab.groupId ? "Toasted Rye" : undefined });
        const found = (query: string) => searchTabs(library, query, labelsOf).map((m) => m.tab.id);

        it("typing a category's name finds every tab in it, highlighting the name", () => {
            expect(found("projx").sort()).toEqual([repo.id, docs.id].sort());
            const match = searchTabs(library, "proj", labelsOf).find((m) => m.tab.id === docs.id)!;
            expect(match.categoryRanges).toEqual([{ start: 0, end: 4 }]);
            expect(match.titleRanges).toEqual([]);
        });

        it("typing a saved window's name finds its tabs, by any word of it", () => {
            expect(found("toasted").sort()).toEqual([article.id, other.id].sort());
            const [match] = searchTabs([other], "rye", labelsOf);
            expect(match.windowRanges).toEqual([{ start: 8, end: 11 }]);
        });

        it("matches names only where a term starts a word, never by scattered letters", () => {
            // "rd" is in neither "Reading" nor "Work" as a word start, so neither category pulls its tabs in.
            expect(found("rd")).not.toContain(other.id);
            expect(found("ading")).toEqual([]);
            expect(found("rye")).toEqual(expect.arrayContaining([article.id, other.id]));
        });

        it("combines with other terms: the category plus a word from the title or address", () => {
            expect(found("projx api")).toEqual([docs.id]);
            expect(found("toasted weather")).toEqual([other.id]);
        });

        it("ranks a title hit above a category-only hit", () => {
            const titled = makeTab({ title: "Reading list", url: "https://example.com/list", category: "Work" });
            expect(searchTabs([article, titled], "reading", labelsOf).map((m) => m.tab.id)).toEqual([titled.id, article.id]);
        });

        it("searches only titles and addresses when no names are given", () => {
            expect(searchTabs(library, "toasted")).toEqual([]);
        });
    });
});

describe("notes in search", () => {
    const noted = makeTab({ title: "API reference", url: "https://docs.example.com/api", note: "auth endpoints for the mobile app" });
    const other = makeTab({ title: "Weather", url: "https://weather.example.com/" });

    it("finds a tab by a word of its note, highlighting it there", () => {
        const [match, ...rest] = searchTabs([other, noted], "mobile");
        expect(rest).toEqual([]);
        expect(match.tab.id).toBe(noted.id);
        expect(match.noteRanges).toEqual([{ start: 23, end: 29 }]);
        expect(noted.note!.slice(23, 29)).toBe("mobile");
    });

    it("ranks a title hit above a note-only hit", () => {
        const titled = makeTab({ title: "Mobile app store", url: "https://store.example.com/" });
        expect(searchTabs([noted, titled], "mobile").map((m) => m.tab.id)).toEqual([titled.id, noted.id]);
    });
});
