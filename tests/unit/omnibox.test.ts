import { describe, expect, it } from "vitest";
import { suggestionsFor } from "../../src/worker/omnibox";
import { makeGroup, makeTab } from "./helpers";

describe("address-bar suggestions", () => {
    const docs = makeTab({ title: "Rust docs", url: "https://www.rust-lang.org/learn", category: "Reading" });

    it("lists matches with what matched marked and the site beside it, and hands back the address", () => {
        expect(suggestionsFor([docs], [], "rust")).toEqual([{ content: docs.url, description: "<match>Rust</match> docs <dim>· rust-lang.org</dim>" }]);
    });

    it("escapes everything that came from a page, so a title can't break the list", () => {
        const odd = makeTab({ title: `Q&A: <script> "quoted" 'single'\u0007`, url: "https://odd.example.com/?a=1&b=2" });
        const [{ content, description }] = suggestionsFor([odd], [], "script");
        expect(description).toContain("Q&amp;A: &lt;<match>script</match>&gt; &quot;quoted&quot; &apos;single&apos; <dim>");
        expect(description).not.toContain("\u0007");
        expect(content).toBe(odd.url);
    });

    it("finds by note, category and saved window too, like the app's own search", () => {
        const group = makeGroup({ name: "Crispy Bagel" });
        const tabs = [makeTab({ title: "One", note: "for the board meeting" }), makeTab({ title: "Two", category: "Recipes" }), makeTab({ title: "Three", groupId: group.id }), makeTab({ title: "Four", groupId: group.id })];
        expect(suggestionsFor(tabs, [group], "board")).toHaveLength(1);
        expect(suggestionsFor(tabs, [group], "recipes")).toHaveLength(1);
        expect(suggestionsFor(tabs, [group], "bagel")).toHaveLength(2);
    });

    it("leaves out the archive, stops at six, and says nothing until something's typed", () => {
        const many = Array.from({ length: 10 }, (_, i) => makeTab({ title: `Page ${i}`, url: `https://p${i}.example.com/` }));
        expect(suggestionsFor(many, [], "page")).toHaveLength(6);
        expect(suggestionsFor([makeTab({ title: "Gone", archivedAt: 1 })], [], "gone")).toEqual([]);
        expect(suggestionsFor([docs], [], "   ")).toEqual([]);
    });
});
