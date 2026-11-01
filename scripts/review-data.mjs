// Writes review-data/: backups to import and small pages to right-click, for the manual review.
// Dates count back from today, so run it again (`node scripts/review-data.mjs`) to freshen them.
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../review-data/", import.meta.url);
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const ago = (days) => now - days * DAY;
/** 9:00 local, `days` from today, as a reminder set in the app would be. */
const morning = (days) => {
    const day = new Date(now);
    day.setDate(day.getDate() + days);
    return day.setHours(9, 0, 0, 0);
};

const SETTINGS = {
    outdatedDays: 7,
    waitingCategories: ["Reading", "Uncategorized"],
    categories: ["Work", "Reading", "Travel", "Recipes"],
    categoryColors: { Work: "blue", Reading: "purple", Travel: "teal", Recipes: "coral" },
    theme: "system",
    sort: "custom",
    toolbarOpens: "popup",
    toolbarBadge: false,
};
const GROUPS = [
    { id: "rye", name: "Toasted Rye", createdAt: ago(3), collapsed: true },
    { id: "bagel", name: "Sunday Bagel", createdAt: ago(1), collapsed: false },
];
const LONG_TITLE = `A very long title that keeps going ${"and going ".repeat(40)}until the end`;

const TABS = [
    // Pinned, and kept.
    { title: "Chrome extensions documentation", url: "https://developer.chrome.com/docs/extensions", category: "Work", savedAt: ago(40), pinned: true, lastOpenedAt: ago(2), openCount: 9, note: "Start here for anything MV3" },
    { title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/", category: "Work", savedAt: ago(90), pinned: true, lastOpenedAt: ago(1), openCount: 21 },
    // Work: kept, some opened.
    { title: "GitHub: Your pull requests", url: "https://github.com/pulls", category: "Work", savedAt: ago(2), lastOpenedAt: ago(1), openCount: 4 },
    { title: "Playwright documentation", url: "https://playwright.dev/docs/intro", category: "Work", savedAt: ago(5), note: "Compare with what we do now" },
    { title: "Vite guide", url: "https://vite.dev/guide/", category: "Work", savedAt: ago(8), lastOpenedAt: ago(6), openCount: 2 },
    { title: "Preact documentation", url: "https://preactjs.com/guide/v10/getting-started/", category: "Work", savedAt: ago(12) },
    // Work: kept, old and never opened, for the cleanup tip.
    { title: "Old conference schedule", url: "https://www.w3.org/events/", category: "Work", savedAt: ago(240) },
    { title: "Old team handbook", url: "https://basecamp.com/handbook", category: "Work", savedAt: ago(230) },
    { title: "Old design notes", url: "https://www.nngroup.com/articles/", category: "Work", savedAt: ago(210) },
    // Reading: ages after 7 days.
    { title: "Principles of calm technology", url: "https://calmtech.com/", category: "Reading", savedAt: ago(30), note: "For the review on Friday" },
    { title: "Local-first software", url: "https://www.inkandswitch.com/essay/local-first/", category: "Reading", savedAt: ago(15) },
    { title: "History of the sandwich", url: "https://en.wikipedia.org/wiki/Sandwich", category: "Reading", savedAt: ago(9) },
    { title: "The Unix philosophy", url: "https://en.wikipedia.org/wiki/Unix_philosophy", category: "Reading", savedAt: ago(3) },
    // Travel and Recipes: kept.
    { title: "Lisbon travel guide", url: "https://en.wikivoyage.org/wiki/Lisbon", category: "Travel", savedAt: ago(20) },
    { title: "Kyoto travel guide", url: "https://en.wikivoyage.org/wiki/Kyoto", category: "Travel", savedAt: ago(4), note: "Spring, if flights allow" },
    { title: "Sourdough bread", url: "https://en.wikipedia.org/wiki/Sourdough", category: "Recipes", savedAt: ago(6) },
    { title: "Pastel de nata", url: "https://en.wikipedia.org/wiki/Pastel_de_nata", category: "Recipes", savedAt: ago(1) },
    // Uncategorized: ages too.
    { title: "Hacker News", url: "https://news.ycombinator.com/", savedAt: ago(11) },
    { title: "Wikipedia main page", url: "https://en.wikipedia.org/wiki/Main_Page", savedAt: ago(2) },
    // Awkward titles.
    { title: LONG_TITLE, url: "https://example.com/long-title", savedAt: ago(1) },
    { title: "Q&A: <script> tags & \"quotes\" in titles", url: "https://example.com/odd-characters", savedAt: ago(1) },
    { title: "Тест кириллицы 🥪 emoji and 日本語", url: "https://example.com/unicode", savedAt: ago(1) },
    // Reminders. None is left unsent, so importing this file sets off no notification.
    { title: "Reminder due: tax return", url: "https://en.wikipedia.org/wiki/Tax_return", category: "Work", savedAt: ago(4), remindAt: morning(-1), reminded: true },
    { title: "Reminder tomorrow: book flights", url: "https://en.wikipedia.org/wiki/Airline_ticket", category: "Travel", savedAt: ago(2), remindAt: morning(1) },
    { title: "Reminder next week: renew passport", url: "https://en.wikipedia.org/wiki/Passport", category: "Travel", savedAt: ago(2), remindAt: morning(7), note: "Check the photo rules" },
    // Saved windows.
    { title: "Rye bread", url: "https://en.wikipedia.org/wiki/Rye_bread", category: "Recipes", savedAt: ago(3), groupId: "rye" },
    { title: "Caraway", url: "https://en.wikipedia.org/wiki/Caraway", category: "Recipes", savedAt: ago(3), groupId: "rye" },
    { title: "Reuben sandwich", url: "https://en.wikipedia.org/wiki/Reuben_sandwich", category: "Recipes", savedAt: ago(3), groupId: "rye" },
    { title: "Pastrami", url: "https://en.wikipedia.org/wiki/Pastrami", category: "Recipes", savedAt: ago(3), groupId: "rye" },
    { title: "Bagel", url: "https://en.wikipedia.org/wiki/Bagel", savedAt: ago(1), groupId: "bagel" },
    { title: "Cream cheese", url: "https://en.wikipedia.org/wiki/Cream_cheese", savedAt: ago(1), groupId: "bagel" },
    { title: "Lox", url: "https://en.wikipedia.org/wiki/Lox", savedAt: ago(1), groupId: "bagel" },
    // Archived.
    { title: "Archived: old invoice portal", url: "https://en.wikipedia.org/wiki/Invoice", category: "Work", savedAt: ago(60), archivedAt: ago(10) },
    { title: "Archived: summer trip ideas", url: "https://en.wikivoyage.org/wiki/Porto", category: "Travel", savedAt: ago(50), archivedAt: ago(5) },
    { title: "Archived: a finished article", url: "https://en.wikipedia.org/wiki/Essay", category: "Reading", savedAt: ago(45), archivedAt: ago(4), note: "Done with this one" },
].map((tab, i) => ({ id: `review-${i + 1}`, ...tab }));

const WORDS = ["Quarterly", "Roadmap", "Notes", "Recipe", "Guide", "Budget", "Trip", "Article", "Report", "Tutorial", "Meeting", "Review"];
const THOUSAND = Array.from({ length: 1000 }, (_, i) => ({
    id: `big-${i + 1}`,
    title: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7 + 3) % WORDS.length]} number ${i + 1}`,
    url: `https://example.com/${WORDS[i % WORDS.length].toLowerCase()}/${i + 1}`,
    ...(i % 5 === 4 ? {} : { category: SETTINGS.categories[i % 4] }),
    savedAt: ago(i % 400),
    ...(i % 9 === 0 ? { note: `Note on page ${i + 1}` } : {}),
    ...(i % 13 === 0 ? { lastOpenedAt: ago(i % 30), openCount: 1 + (i % 6) } : {}),
    ...(i % 37 === 0 ? { archivedAt: ago(i % 20) } : {}),
}));

const backup = (tabs, groups) => JSON.stringify({ version: 2, exportedAt: new Date(now).toISOString(), tabs, settings: SETTINGS, groups }, null, 2);

const LINKS_PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Tab Sandwich right-click page</title>
<style>body { font: 16px/1.6 system-ui; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; } li { margin: 1rem 0; } img { vertical-align: middle; }</style>
<h1>Right-click page</h1>
<p>Plain words away from any link: right-click here to save the page itself.</p>
<ol>
    <li><a href="https://en.wikipedia.org/wiki/Club_sandwich">A link with    its own   words</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Sandwich_loaf" aria-label="A link with a spoken name" style="display: inline-block; width: 120px; height: 24px; vertical-align: middle; background: #9fc5e8"></a> (a colored box that's a link with no words, only a spoken name)</li>
    <li><a href="https://en.wikipedia.org/wiki/Toast_sandwich"><img alt="A photo of a toast sandwich" width="120" height="60" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' fill='%23e8c98f'/%3E%3C/svg%3E"></a> (a picture that's a link)</li>
    <li><a href="https://en.wikipedia.org/wiki/Bocadillo"><img alt="" width="120" height="60" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' fill='%23c9a0dc'/%3E%3C/svg%3E"></a> (a picture with no description: try it with this word selected, then with nothing selected)</li>
    <li><a href="mailto:someone@example.com">Write to someone</a> (a mail link)</li>
    <li><a href="https://en.wikipedia.org/wiki/Sandwich">History of the sandwich</a> (already in the review data)</li>
</ol>
</html>
`;
const LONG_PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${"A page whose title goes on and on ".repeat(12)}</title>
<h1>This page's title is longer than 300 characters</h1>
<p>Save it with the popup and look at the title it gets.</p>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("review-library.json", OUT), backup(TABS, GROUPS));
writeFileSync(new URL("review-1000-tabs.json", OUT), backup(THOUSAND, []));
writeFileSync(new URL("right-click-page.html", OUT), LINKS_PAGE);
writeFileSync(new URL("long-title-page.html", OUT), LONG_PAGE);
writeFileSync(new URL("400-character-title.txt", OUT), `${"Four hundred characters of title ".repeat(13)}end`.slice(0, 400));
