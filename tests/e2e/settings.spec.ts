import { test, expect } from "./fixtures";
import { openSettings, row, seedLibrary, storedSettings, tabList } from "./helpers";

const surface = (popup: import("@playwright/test").Page) =>
    popup.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim());

test.describe("Settings", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Q3 Roadmap", url: "https://notion.so/q3", category: "Work" },
            { title: "Old article", url: "https://medium.com/old", category: "Reading", daysAgo: 20 },
        ]);
    });

    test("TC-194: choosing Dark or Light applies at once and is remembered; System follows the computer", async ({ popup }) => {
        await popup.emulateMedia({ colorScheme: "light" });
        await openSettings(popup);
        await popup.getByRole("button", { name: "Dark", exact: true }).click();
        await expect(popup.locator("html")).toHaveAttribute("data-theme", "dark");
        expect(await surface(popup)).toBe("#1A1724");
        await expect.poll(async () => (await storedSettings(popup)).theme).toBe("dark");

        await popup.reload();
        await expect(popup.locator("html")).toHaveAttribute("data-theme", "dark");

        await openSettings(popup);
        await popup.getByRole("button", { name: "System", exact: true }).click();
        await expect(popup.locator("html")).not.toHaveAttribute("data-theme");
        expect(await surface(popup)).toBe("#FFFFFF");
    });

    test("TC-062: turning outdated tabs off hides the badges and the Outdated filter", async ({ popup }) => {
        await expect(popup.getByRole("button", { name: "Outdated (1)" })).toBeVisible();
        await openSettings(popup);
        await popup.getByRole("switch", { name: "Outdated tabs" }).uncheck({ force: true });
        await expect(popup.getByLabel("Mark as outdated after")).toBeDisabled();
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        await expect(popup.getByRole("button", { name: "Outdated (1)" })).toHaveCount(0);
        await expect(tabList(popup).getByTitle(/Saved \d+ days ago/)).toHaveCount(0);
    });

    test("TC-064: a new day threshold is kept within 1–365 and updates the badges", async ({ popup }) => {
        await openSettings(popup);
        const days = popup.getByLabel("Mark as outdated after");
        await days.fill("500");
        await days.press("Enter");
        await expect(days).toHaveValue("365");
        await expect.poll(async () => (await storedSettings(popup)).outdatedDays).toBe(365);
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        await expect(popup.getByRole("button", { name: /^Outdated/ })).toHaveCount(0);
    });

    test("TC-080: General shows how much is saved and how much storage it uses", async ({ popup }) => {
        await openSettings(popup);
        await expect(popup.getByRole("progressbar", { name: "Storage used" })).toBeVisible();
        await expect(popup.getByText("2 saved · less than 1% of the space Chrome gives extensions")).toBeVisible();
    });

    test("TC-037: picking a category color recolors its rows; opening the picker moves nothing", async ({ popup }) => {
        await openSettings(popup, "Categories");
        const list = popup.getByRole("list", { name: "Configured categories" });
        const tops = () => list.getByRole("listitem").evaluateAll((items) => items.map((li) => li.getBoundingClientRect().top));
        const before = await tops();
        await popup.getByRole("button", { name: "Color for Work" }).click();
        await expect(popup.getByRole("group", { name: "Color for Work" })).toBeVisible();
        expect(await tops()).toEqual(before);

        await popup.getByRole("button", { name: "Teal", exact: true }).click();
        await expect(popup.getByRole("group", { name: "Color for Work" })).toHaveCount(0);
        await expect.poll(async () => (await storedSettings(popup)).categoryColors.Work).toBe("teal");
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        expect(await row(popup, "Q3 Roadmap").evaluate((li) => getComputedStyle(li).getPropertyValue("--rc").trim())).toBe("#2DBEA6");
    });

    test("TC-195: the color picker closes with Escape and gives focus back", async ({ popup }) => {
        await openSettings(popup, "Categories");
        const dot = popup.getByRole("button", { name: "Color for Work" });
        await dot.click();
        await popup.keyboard.press("Escape");
        await expect(popup.getByRole("group", { name: "Color for Work" })).toHaveCount(0);
        await expect(dot).toBeFocused();
    });

    test("TC-073: Settings and Back move focus sensibly and swap the views", async ({ popup }) => {
        await openSettings(popup);
        const back = popup.getByRole("button", { name: "Back", exact: true });
        await expect(back).toBeFocused();
        await expect(popup.getByRole("button", { name: "Open settings" })).toBeHidden();
        await back.click();
        await expect(row(popup, "Q3 Roadmap")).toBeVisible();
        await expect(popup.getByRole("button", { name: "Open settings" })).toBeFocused();
        await expect(popup.getByRole("main", { name: "Settings" })).toHaveCount(0);
    });

    test("TC-196: About shows the version and the privacy policy link", async ({ popup }) => {
        await openSettings(popup, "About");
        const version = await popup.evaluate(() => chrome.runtime.getManifest().version);
        await expect(popup.getByText(`Version ${version}`)).toBeVisible();
        await expect(popup.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", /PRIVACY\.md$/);
    });

    test("TC-197: arrow keys move between the Settings tabs", async ({ popup }) => {
        await openSettings(popup);
        await popup.getByRole("tab", { name: "General" }).focus();
        await popup.keyboard.press("ArrowRight");
        await expect(popup.getByRole("tab", { name: "Categories" })).toBeFocused();
        await expect(popup.getByRole("tab", { name: "Categories" })).toHaveAttribute("aria-selected", "true");
        await expect(popup.getByRole("list", { name: "Configured categories" })).toBeVisible();
    });
});

test("TC-198: opening Settings, switching its tabs and going back never shrinks the popup", async ({ popup }) => {
    for (const library of [
        [{ title: "Only one", url: "https://one.example.com/" }],
        Array.from({ length: 12 }, (_, i) => ({ title: `Page ${i + 1}`, url: `https://p${i + 1}.example.com/`, category: "Work" })),
    ]) {
        await seedLibrary(popup, library);
        const heights: number[] = [];
        const record = async () => heights.push(await popup.evaluate(() => document.documentElement.scrollHeight));
        await record();
        await openSettings(popup);
        await record();
        for (const tab of ["About", "Backup", "Categories", "General", "About"]) {
            await popup.getByRole("tab", { name: tab }).click();
            await record();
        }
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        await record();
        // Each step is at least as tall as the one before: the window may grow, never shrink back.
        for (let i = 1; i < heights.length; i++) expect(heights[i], `step ${i}: ${heights.join(", ")}`).toBeGreaterThanOrEqual(heights[i - 1]);
    }
});

test("TC-199: a settings change that fails to save puts the controls back to what's stored", async ({ popup }) => {
    await seedLibrary(popup, [{ title: "Q3 Roadmap", url: "https://notion.so/q3", daysAgo: 20 }]);
    await popup.emulateMedia({ colorScheme: "light" });
    await openSettings(popup);
    // Make every write fail, the way a full or broken storage would.
    await popup.evaluate(() => {
        chrome.storage.local.set = () => Promise.reject(new Error("disk unavailable"));
    });

    const days = popup.getByLabel("Mark as outdated after");
    await days.fill("30");
    await days.press("Enter");
    await expect(popup.getByRole("status").filter({ hasText: "Couldn't save your changes. Try again." })).toBeVisible();
    await expect(days).toHaveValue("7");

    await popup.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(popup.locator("html")).not.toHaveAttribute("data-theme");
    await expect(popup.getByRole("button", { name: "System", exact: true })).toHaveAttribute("aria-pressed", "true");

    await popup.getByRole("switch", { name: "Outdated tabs" }).click({ force: true });
    await expect(popup.getByRole("switch", { name: "Outdated tabs" })).toBeChecked();
});
