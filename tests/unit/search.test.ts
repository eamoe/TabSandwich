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
});
