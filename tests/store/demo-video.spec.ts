import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { FrameLocator, Locator, Page } from "@playwright/test";
import { test, expect, EXTENSION_ID, LIBRARY_URL, POPUP_URL, SIDE_PANEL_URL, STAGE_URL } from "../e2e/fixtures";
import { answerPermissionPrompt, seedLibrary } from "../e2e/helpers";
import { dictionaries } from "../../src/ui/strings";
import { suggestionsFor } from "../../src/worker/omnibox";
import type { SavedTab, TabGroup } from "../../src/types";
import { SAMPLES } from "./samples";
import { BACKGROUNDS, CHROME, chromeIcon, FONT, ICON, ICON_SMALL, MARK, SHADOW } from "./drawing";

/**
 * Not a test: films the Chrome Web Store's demo video (`pnpm store:video`), some 36 seconds of the
 * real extension at work, into store-assets/video/demo-<language>.webm (1920×1080, no sound), for
 * uploading to YouTube by hand.
 *
 * It's filmed on one page of the extension's own (the fixture's stage.html), which holds the
 * real popup, side panel and library side by side in frames, in a Chrome window drawn around
 * them, as on the Store screenshots: a script can't film Chrome's own toolbar or menus. So the
 * cursor, the window, its right-click menu, its address bar and the toolbar icon's ✓ are drawn,
 * and the right-click save is played: the drawn menu's pick writes the link into the library, as
 * the real one would. What the drawn address bar suggests is the extension's own (suggestionsFor).
 * Every other click is a real one, on the real screens. Chrome's own frames of the page are
 * caught as they're painted, then laid out at an even 30 a second and encoded with the ffmpeg
 * Playwright installs for its own videos (`pnpm exec playwright install ffmpeg` if it's missing).
 */

const LANGUAGE = process.env.TS_VIDEO_LANGUAGE ?? "en";
const sample = SAMPLES[LANGUAGE]!;
const d = dictionaries[LANGUAGE]!;
const c = sample.categories;
const SETTINGS = {
    categories: [c.work, c.reading, c.travel, c.recipes],
    categoryColors: { [c.work]: "blue", [c.reading]: "purple", [c.travel]: "teal", [c.recipes]: "coral" },
    waitingCategories: [c.reading, "Uncategorized"],
};

/** What the captions say, scene by scene. English for now: every language's Store page shows this one. */
const WORDS = {
    title: "Save tabs. Find them again.",
    save: "Save the page you're on",
    window: "Forty tabs open? Save them all",
    panel: "Keep it open beside the page",
    rightClick: "Right-click a link to save it",
    find: "Find that link again",
    addressBar: "Or type ts in the address bar",
    end: "Free · In 8 languages · Stored only in your browser",
};
/** The link the right-click scene saves, by its words on the page (else the first likely one in view). */
const RIGHT_CLICK_LINK = "Toasted bread";
/** What's typed after "ts" in the address bar: the saved tab it finds is the one it opens. */
const ADDRESS_BAR_SEARCH = "lisbon";

const STAGE = { width: 1280, height: 720 };
const SCALE = 1.5;
const FPS = 30;
const WINDOW = { left: 80, top: 112, width: 1120 };
const TAB_STRIP = 38;
const TOOLBAR = 42;
const CONTENT = { top: WINDOW.top + TAB_STRIP + TOOLBAR, height: STAGE.height - WINDOW.top - TAB_STRIP - TOOLBAR };
const PANEL_WIDTH = 360;
const PANEL_HEADER = 38;
const PAGE_WIDE = { width: WINDOW.width, height: CONTENT.height };
const PAGE_NARROW = { width: WINDOW.width - PANEL_WIDTH - 1, height: CONTENT.height };

test.use({ chromeLanguage: LANGUAGE });

test(`Chrome Web Store demo video, ${LANGUAGE}`, async ({ context, popup: control }) => {
    test.skip(!process.env.TS_STORE_VIDEO, "Run through `pnpm store:video`.");
    test.setTimeout(300_000);
    const ffmpeg = findFfmpeg();

    // The library to start from, and the window's other tabs, open in the background.
    await seedLibrary(control, [...sample.tabs, ...sample.extras].map(({ category, remindSoon: _soon, remindDue, ...tab }) => ({
        ...tab,
        ...(category ? { category: c[category] } : {}),
        ...(remindDue ? { remindInDays: -1, reminded: true } : {}),
    })), SETTINGS);
    await answerPermissionPrompt(context, control, "grant");
    const visitor = await context.newPage();
    for (const url of [...sample.tabs, ...sample.extras].map((t) => t.url).concat(sample.windowPages)) {
        await visitor.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => undefined);
        await visitor.waitForTimeout(500);
    }
    await visitor.close();
    // The blank tab Chrome starts with isn't one of the window's: it would only add to what Save all skips.
    for (const blank of context.pages().filter((p) => p.url() === "about:blank")) await blank.close();
    for (const url of sample.windowPages) await control.evaluate((u) => chrome.tabs.create({ url: u, active: false }), url);

    // The page you're on: the real article, open as the window's active tab, pictured at the
    // window's width and beside the panel, and the link to right-click in the narrower one.
    const article = await openActive(control, sample.panelPage);
    await article.addStyleTag({ content: "#siteNotice, #centralNotice, .frb, .cn-fundraising { display: none !important; }" });
    await article.setViewportSize(PAGE_WIDE);
    await article.waitForTimeout(1200);
    const pageWide = await article.screenshot();
    await article.setViewportSize(PAGE_NARROW);
    await article.waitForTimeout(800);
    const link = await article.evaluate(async (wanted) => {
        // In the article's own words (not a note above it), near the top, and named like a page:
        // its words become the saved tab's title. Brought up to mid-page if it's lower down.
        const words = (a: HTMLAnchorElement) => a.innerText.trim();
        const links = [...document.querySelectorAll<HTMLAnchorElement>("#mw-content-text p a[href*='/wiki/'], #mw-content-text .infobox a[href*='/wiki/']")]
            .filter((a) => a.getBoundingClientRect().width > 0 && !a.href.includes(":", 6) && a.getBoundingClientRect().top < innerHeight * 2.5);
        const a = links.find((x) => words(x) === wanted) ?? links.find((x) => /^\p{Lu}\S*\s\p{Lu}/u.test(words(x))) ?? links.find((x) => /^\p{Lu}\S*\s\S/u.test(words(x)));
        if (!a) return null;
        if (a.getBoundingClientRect().bottom > innerHeight * 0.75) {
            a.scrollIntoView({ block: "center" });
            await new Promise(requestAnimationFrame);
        }
        const r = a.getBoundingClientRect();
        return { text: words(a), url: a.href, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, RIGHT_CLICK_LINK);
    expect(link, "a link to right-click near the top of the article").not.toBeNull();
    await article.waitForTimeout(500);
    const pageNarrow = await article.screenshot();
    // The page the address bar's search opens, as it looks once it has.
    const found = sample.tabs.find((t) => t.remindDue)!;
    const foundPage = await control.context().newPage();
    await foundPage.setViewportSize(PAGE_WIDE);
    await foundPage.goto(found.url, { waitUntil: "load" });
    await foundPage.addStyleTag({ content: "#siteNotice, #centralNotice, .frb, .cn-fundraising { display: none !important; }" });
    await foundPage.waitForTimeout(1200);
    const foundShot = await foundPage.screenshot();
    const foundTitle = await foundPage.title();
    await foundPage.close();
    await openActive(control, sample.panelPage, article);
    console.log(`Right-clicking "${link!.text}"`);
    const tabs = await control.evaluate(async () => (await chrome.tabs.query({ currentWindow: true })).filter((t) => /^https?:/.test(t.url ?? "")).map((t) => ({ title: t.title ?? "", url: t.url ?? "", active: t.active })));
    const articleTitle = await article.title();

    // The stage: a background tab of the same window, so the article stays the page you're on.
    const stage = await context.newPage();
    await stage.setViewportSize({ width: STAGE.width * SCALE, height: STAGE.height * SCALE });
    await stage.goto(STAGE_URL);
    await stage.evaluate((html) => (document.body.innerHTML = html), stageHtml(tabs, articleTitle, png(pageWide)));
    await openActive(control, sample.panelPage, article);
    const popupFrame = stage.frameLocator("#popup");
    const panelFrame = stage.frameLocator("#panel-frame");
    const libraryFrame = stage.frameLocator("#library-frame");
    await ready(panelFrame);

    const director = new Director(stage);
    const film = new Film(stage);
    await film.start();

    // Title card.
    await director.hold(1100);
    await director.show("#title", false);
    await director.hold(200);

    // Save the page you're on: the toolbar icon opens the popup, with its suggested category.
    await director.caption(WORDS.save);
    await director.cursorAt(WINDOW.left + 520, CONTENT.top + 260);
    await director.hold(200);
    await director.clickDrawn("#ts-action");
    await openPopup(stage, popupFrame);
    await director.hold(800);
    await director.click(popupFrame.getByRole("region", { name: d.currentTab }).getByRole("button", { name: d.saveTab, exact: true }));
    await director.hold(800);

    // Save the whole window.
    await director.caption(WORDS.window);
    await director.hold(300);
    await director.click(popupFrame.getByRole("button", { name: new RegExp(`^${escape(d.saveWindowAll(tabs.length)).replace(/\d+/, "\\d+")}$`) }));
    await director.hold(800);
    await director.click(popupFrame.locator("button[data-group-name]").first());
    await director.hold(1100);

    // The side panel, from the popup's Open in menu; then right-click a link: it shows up there.
    await director.caption(WORDS.panel);
    await director.click(popupFrame.getByRole("button", { name: d.openIn, exact: true }), 600);
    await director.hold(250);
    await director.click(popupFrame.getByRole("menuitem", { name: d.openSidePanel }), 400);
    await director.show("#popup-box", false);
    await stage.evaluate((src) => {
        (document.getElementById("page") as HTMLImageElement).src = src;
        document.getElementById("panel")!.style.width = "361px";
    }, png(pageNarrow));
    await director.hold(700);
    await director.caption(WORDS.rightClick);
    const at = { x: WINDOW.left + link!.x, y: CONTENT.top + link!.y };
    await director.glide(at.x, at.y, 800);
    await director.ripple();
    await stage.evaluate(({ x, y }) => {
        const menu = document.getElementById("menu")!;
        menu.style.left = `${x + 2}px`;
        menu.style.top = `${Math.min(y + 2, 720 - 330)}px`;
        menu.style.display = "block";
    }, at);
    await director.hold(600);
    await director.glideTo("#menu-save", 500);
    await stage.evaluate(() => {
        document.getElementById("menu-save")!.toggleAttribute("data-hot", true);
        document.getElementById("submenu")!.style.display = "block";
    });
    await director.hold(350);
    const pick = await director.centerOf("#menu-pick");
    await director.glide(pick.x, (await director.centerOf("#menu-save")).y, 250);
    await director.glide(pick.x, pick.y, 350);
    await stage.evaluate(() => document.getElementById("menu-pick")!.toggleAttribute("data-hot", true));
    await director.hold(150);
    await director.ripple();
    await stage.evaluate(() => (document.getElementById("menu")!.style.display = "none"));
    // What the real menu's pick does: the link saved into that category, the toolbar icon's ✓.
    await control.evaluate(async ({ title, url, category }) => {
        const key = "tabSandwich.tabs";
        const tabs = ((await chrome.storage.local.get(key))[key] ?? []) as unknown[];
        await chrome.storage.local.set({ [key]: [{ id: crypto.randomUUID(), title, url, category, savedAt: Date.now() }, ...tabs] });
    }, { title: link!.text, url: link!.url, category: c.reading });
    await stage.evaluate(() => {
        const badge = document.getElementById("badge")!;
        badge.style.opacity = "1";
        setTimeout(() => (badge.style.opacity = "0"), 2000);
    });
    await director.hold(1600);

    // The library, from the popup's Open in menu (the panel closed first, with Chrome's own ✕), and a search.
    await director.caption(WORDS.find);
    await stage.evaluate((src) => ((document.getElementById("library-frame") as HTMLIFrameElement).src = src), LIBRARY_URL);
    await ready(libraryFrame);
    await director.clickDrawn("#panel-close", 600);
    await stage.evaluate((src) => {
        document.getElementById("panel")!.style.width = "0";
        (document.getElementById("page") as HTMLImageElement).src = src;
    }, png(pageWide));
    await director.hold(150);
    await director.clickDrawn("#ts-action", 600);
    await openPopup(stage, popupFrame);
    await director.hold(250);
    await director.click(popupFrame.getByRole("button", { name: d.openIn, exact: true }), 500);
    await director.hold(250);
    await director.click(popupFrame.getByRole("menuitem", { name: d.openLibrary }), 400);
    await director.show("#popup-box", false);
    await stage.evaluate(() => {
        document.getElementById("library-tab")!.toggleAttribute("data-on", true);
        document.querySelectorAll<HTMLElement>("[data-tab]").forEach((tab) => tab.removeAttribute("data-active"));
        document.getElementById("library-tab")!.setAttribute("data-active", "");
        document.getElementById("address")!.innerHTML = document.getElementById("library-address")!.innerHTML;
    });
    await director.show("#library", true);
    await director.hold(300);
    const search = libraryFrame.getByLabel(d.searchLabel, { exact: true });
    await director.click(search);
    await search.pressSequentially("sandwich", { delay: 90 });
    await director.hold(1000);

    // From anywhere: "ts" and a space in a new tab's address bar, then the words. The address bar
    // is drawn; what it suggests is the extension's own (suggestionsFor, from the worker), for the
    // library as it is by now, letter by letter.
    await director.caption(WORDS.addressBar);
    await director.clickDrawn("#new-tab-button", 550);
    await stage.evaluate(() => {
        document.querySelectorAll<HTMLElement>("[data-tab]").forEach((tab) => tab.removeAttribute("data-active"));
        const tab = document.getElementById("new-tab")!;
        tab.toggleAttribute("data-on", true);
        tab.setAttribute("data-active", "");
        document.getElementById("library")!.removeAttribute("data-on");
        document.getElementById("blank")!.toggleAttribute("data-on", true);
        document.getElementById("address")!.innerHTML = `<span class="caret"></span>`;
    });
    await director.glide(WINDOW.left + 640, CONTENT.top + 300, 300);
    const library = await control.evaluate(async () => {
        const got = await chrome.storage.local.get(["tabSandwich.tabs", "tabSandwich.groups"]);
        return { tabs: got["tabSandwich.tabs"] ?? [], groups: got["tabSandwich.groups"] ?? [] };
    }) as { tabs: SavedTab[]; groups: TabGroup[] };
    const typed = (text: string) => stage.evaluate((html) => (document.getElementById("address")!.innerHTML = html), text);
    for (const sofar of ["t", "ts"]) {
        await typed(`${sofar}<span class="caret"></span>`);
        await director.hold(120);
    }
    await typed(`${keywordChip()}<span class="caret"></span>`);
    await director.hold(350);
    for (let i = 1; i <= ADDRESS_BAR_SEARCH.length; i++) {
        const text = ADDRESS_BAR_SEARCH.slice(0, i);
        await typed(`${keywordChip()}${text}<span class="caret"></span>`);
        await stage.evaluate((rows) => {
            const list = document.getElementById("suggestions")!;
            list.innerHTML = rows;
            list.toggleAttribute("data-on", true);
        }, suggestionRows(d.omniboxHint, text, suggestionsFor(library.tabs, library.groups, text)));
        await director.hold(100);
    }
    await director.hold(600);
    // Down to the saved tab, and Enter: it opens in this tab.
    await stage.evaluate(() => {
        const rows = document.querySelectorAll("#suggestions [data-row]");
        rows[0]?.removeAttribute("data-picked");
        rows[1]?.setAttribute("data-picked", "");
    });
    await director.hold(500);
    await stage.evaluate(({ shot, title, address, icon }) => {
        document.getElementById("suggestions")!.removeAttribute("data-on");
        document.getElementById("blank")!.removeAttribute("data-on");
        (document.getElementById("page") as HTMLImageElement).src = shot;
        const tab = document.getElementById("new-tab")!;
        tab.querySelector("[data-title]")!.textContent = title;
        tab.querySelector("[data-icon]")!.innerHTML = icon;
        document.getElementById("address")!.innerHTML = address;
    }, {
        shot: png(foundShot),
        title: foundTitle,
        address: `${new URL(found.url).host}<span style="color:${CHROME.muted}">${decodeURIComponent(new URL(found.url).pathname)}</span>`,
        icon: `<img src="${favicon(found.url)}" width="16" height="16">`,
    });
    await director.hold(1300);

    // End card.
    await director.cursorOff();
    await director.show("#end", true);
    await director.hold(2500);

    const { frames, end } = await film.stop();
    const out = `store-assets/video/demo-${LANGUAGE}.webm`;
    mkdirSync("store-assets/video", { recursive: true });
    await encode(ffmpeg, frames, end, out);
    console.log(`${out}: ${(end - frames[0]!.time).toFixed(1)} s`);
});

/** Opens `url` as the window's active tab (or brings `page` forward again), and waits for it. */
async function openActive(control: Page, url: string, page?: Page): Promise<Page> {
    if (page) {
        await control.evaluate(async (u) => {
            const [tab] = await chrome.tabs.query({ url: u });
            await chrome.tabs.update(tab!.id!, { active: true });
        }, url);
        return page;
    }
    await control.evaluate((u) => chrome.tabs.create({ url: u, active: true }), url);
    // By its address: the window's other tabs, opened just before, may still be announcing themselves.
    await expect.poll(() => control.context().pages().some((p) => p.url() === url)).toBe(true);
    const article = control.context().pages().find((p) => p.url() === url)!;
    await article.waitForLoadState("load");
    return article;
}

/**
 * Opens the popup afresh, as Chrome does on each click of the toolbar icon. Its side panel is the
 * drawn one, so Chrome's own call to open the real one is stood in for: answered at once.
 */
async function openPopup(stage: Page, popup: FrameLocator): Promise<void> {
    await stage.evaluate(() => ((document.getElementById("popup") as HTMLIFrameElement).src = "about:blank"));
    await stage.evaluate((src) => ((document.getElementById("popup") as HTMLIFrameElement).src = src), POPUP_URL);
    await ready(popup);
    await stage.frames().find((f) => f.url() === POPUP_URL)!.evaluate(() => Object.defineProperty(chrome.sidePanel, "open", { value: async () => undefined, configurable: true }));
    await stage.evaluate(() => document.getElementById("popup-box")!.toggleAttribute("data-on", true));
    await stage.waitForTimeout(300);
}

async function ready(frame: FrameLocator): Promise<void> {
    await frame.locator("body[data-ready='true']").waitFor({ state: "attached" });
}

/**
 * The icon, once more on the stage: each copy with a name of its own for its tile's gradient. With
 * one name for all, every copy takes the first's, and where that one isn't shown (a hidden tab),
 * no copy's tile is painted.
 */
let copies = 0;
const own = (svg: string) => svg.replace(/id="tile"/g, `id="tile-${++copies}"`).replace(/url\(#tile\)/g, `url(#tile-${copies})`);
const icon = (size: number) => own(ICON_SMALL.replace('width="18" height="18"', `width="${size}" height="${size}"`));
const png = (shot: Buffer) => `data:image/png;base64,${shot.toString("base64")}`;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s/g, "\\s");
const favicon = (url: string) => `chrome-extension://${EXTENSION_ID}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;

/** The cursor, the captions and the drawn parts, moved on cue; every real click lands where the cursor goes. */
class Director {
    constructor(private stage: Page) {}

    hold(ms: number) {
        return this.stage.waitForTimeout(ms);
    }

    async caption(text: string) {
        await this.stage.evaluate((text) => {
            const el = document.getElementById("caption")!;
            el.style.opacity = "0";
            setTimeout(() => {
                el.textContent = text;
                el.style.opacity = "1";
            }, 200);
        }, text);
        await this.hold(400);
    }

    async show(selector: string, on: boolean) {
        await this.stage.evaluate(({ selector, on }) => document.querySelector<HTMLElement>(selector)!.toggleAttribute("data-on", on), { selector, on });
        await this.hold(300);
    }

    async cursorAt(x: number, y: number) {
        await this.stage.evaluate(({ x, y }) => {
            const cursor = document.getElementById("cursor")!;
            cursor.style.transition = "none";
            cursor.style.transform = `translate(${x}px, ${y}px)`;
            cursor.style.opacity = "1";
        }, { x, y });
        await this.stage.mouse.move(x * SCALE, y * SCALE);
    }

    async cursorOff() {
        await this.stage.evaluate(() => (document.getElementById("cursor")!.style.opacity = "0"));
    }

    /** Moves the drawn cursor (and the real mouse with it) to a point on the stage. */
    async glide(x: number, y: number, ms = 700) {
        await this.stage.evaluate(({ x, y, ms }) => {
            const cursor = document.getElementById("cursor")!;
            cursor.style.transition = `transform ${ms}ms cubic-bezier(.45,.05,.25,1)`;
            cursor.style.transform = `translate(${x}px, ${y}px)`;
        }, { x, y, ms });
        await this.stage.mouse.move(x * SCALE, y * SCALE, { steps: Math.max(1, Math.round(ms / 40)) });
        await this.hold(Math.max(0, ms - 150));
    }

    /** Where something is, on the stage (before it's scaled up). */
    async centerOf(selector: string) {
        return this.stage.evaluate(({ selector, scale }) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return { x: (r.left + r.width / 2) / scale, y: (r.top + r.height / 2) / scale };
        }, { selector, scale: SCALE });
    }

    async glideTo(selector: string, ms = 700) {
        const { x, y } = await this.centerOf(selector);
        await this.glide(x, y, ms);
    }

    async ripple() {
        await this.stage.evaluate(() => {
            // Placed where the cursor is, then grown there: its growing mustn't move it.
            const at = new DOMMatrix(document.getElementById("cursor")!.style.transform);
            const ring = document.getElementById("ring")!;
            ring.style.translate = `${at.m41}px ${at.m42}px`;
            ring.animate([{ opacity: 0.55, scale: "0.3" }, { opacity: 0, scale: "1.4" }], { duration: 450, easing: "ease-out" });
        });
        await this.hold(120);
    }

    /** A real click on a real screen, after the cursor gets there. */
    async click(target: Locator, ms = 700) {
        const box = (await target.boundingBox())!;
        await this.glide((box.x + box.width / 2) / SCALE, (box.y + box.height / 2) / SCALE, ms);
        await this.ripple();
        await target.click();
    }

    /** A click on something drawn: the cursor goes there, and `then` plays what it does. */
    async clickAt(x: number, y: number, then: () => Promise<void>, ms = 700) {
        await this.glide(x, y, ms);
        await this.ripple();
        await then();
    }

    async clickDrawn(selector: string, ms = 800) {
        await this.glideTo(selector, ms);
        await this.ripple();
    }
}

type Frame = { time: number; data: Buffer };

/** Chrome's own frames of the stage, as they're painted (only when something changes), with their times. */
class Film {
    private frames: Frame[] = [];
    private session?: Awaited<ReturnType<ReturnType<Page["context"]>["newCDPSession"]>>;

    constructor(private stage: Page) {}

    async start() {
        this.session = await this.stage.context().newCDPSession(this.stage);
        this.session.on("Page.screencastFrame", (frame) => {
            this.frames.push({ time: frame.metadata.timestamp ?? Date.now() / 1000, data: Buffer.from(frame.data, "base64") });
            void this.session!.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
        });
        await this.session.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: STAGE.width * SCALE, maxHeight: STAGE.height * SCALE, everyNthFrame: 1 });
    }

    /** The frames, and when filming stopped: a still end shows no frames, but lasts until then. */
    async stop(): Promise<{ frames: Frame[]; end: number }> {
        const end = Date.now() / 1000;
        await this.session!.send("Page.stopScreencast");
        return { frames: this.frames, end };
    }
}

/** The frames at an even FPS (each the newest painted by then), encoded as WebM (VP8) at a high bitrate. */
async function encode(ffmpeg: string, frames: Frame[], end: number, out: string): Promise<void> {
    const start = frames[0]!.time;
    const proc = spawn(ffmpeg, ["-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "pipe:0",
        "-y", "-an", "-c:v", "vp8", "-b:v", "12M", "-crf", "4", "-qmin", "0", "-qmax", "24", "-deadline", "good", "-cpu-used", "1", "-threads", "4", out], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise<void>((resolve, reject) => proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))));
    let next = 0;
    for (let i = 0; start + i / FPS <= end; i++) {
        while (next + 1 < frames.length && frames[next + 1]!.time <= start + i / FPS) next++;
        if (!proc.stdin.write(frames[next]!.data)) await new Promise((resolve) => proc.stdin.once("drain", resolve));
    }
    proc.stdin.end();
    await done;
}

/** The ffmpeg Playwright installs for recording its own videos. */
function findFfmpeg(): string {
    const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? (process.platform === "darwin" ? join(homedir(), "Library/Caches/ms-playwright") : join(homedir(), ".cache/ms-playwright"));
    const name = { darwin: "ffmpeg-mac", linux: "ffmpeg-linux", win32: "ffmpeg-win64.exe" }[process.platform as string] ?? "ffmpeg";
    const found = (existsSync(root) ? readdirSync(root) : []).filter((dir) => dir.startsWith("ffmpeg-")).map((dir) => join(root, dir, name)).find(existsSync);
    if (!found) throw new Error("No ffmpeg: run `pnpm exec playwright install ffmpeg`.");
    return found;
}

/** The address bar's keyword chip, once "ts" and a space are typed: the extension's name, as Chrome shows it. */
function keywordChip(): string {
    return `<span class="chip">${icon(14)}Tab Sandwich</span>`;
}

/**
 * The address bar's list, as Chrome draws an extension's suggestions: its own line first (the
 * hint, with what's typed), then each saved tab found, matches bold and the site dimmed.
 */
function suggestionRows(hint: string, text: string, results: chrome.omnibox.SuggestResult[]): string {
    const markup = (xml: string) => xml.replace(/<match>/g, "<b>").replace(/<\/match>/g, "</b>").replace(/<dim>/g, '<span class="dim">').replace(/<\/dim>/g, "</span>");
    const row = (html: string, picked: boolean) => `<div data-row ${picked ? "data-picked" : ""}>${icon(16)}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis">${html}</span></div>`;
    const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return [row(markup(hint.replace("%s", `<match>${safe}</match>`)), true), ...results.map((r) => row(markup(r.description), false))].join("");
}

/** The whole stage: title card, captions, the drawn Chrome window with the real screens in it, end card, cursor. */
function stageHtml(tabs: Array<{ title: string; url: string; active: boolean }>, activeTitle: string, page: string): string {
    const button = (name: Parameters<typeof chromeIcon>[0], id = "") => `<span ${id ? `id="${id}"` : ""} style="width:32px;height:32px;display:grid;place-items:center;position:relative">${chromeIcon(name)}</span>`;
    const dot = (color: string) => `<span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0"></span>`;
    const tab = (title: string, icon: string, active: boolean, id = "") =>
        `<div data-tab ${id ? `id="${id}"` : ""} ${active ? "data-active" : ""} style="flex:0 1 180px;min-width:0;height:30px;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:8px;padding:0 10px 0 12px">
           <span data-icon style="display:flex;flex-shrink:0">${icon}</span><span data-title style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span>${chromeIcon("close", 13, CHROME.muted)}</div>`;
    const site = (url: string) => `<img src="${favicon(url)}" width="16" height="16" style="flex-shrink:0">`;
    const { host, pathname } = new URL(sample.panelPage);
    const item = (text: string, extra = "", id = "") => `<div ${id ? `id="${id}"` : ""} class="mi" style="${extra}">${text}</div>`;
    const sep = `<div style="height:1px;background:#E3E3E3;margin:4px 0"></div>`;
    const card = (body: string, id: string, on: boolean) =>
        `<div id="${id}" class="card" ${on ? "data-on" : ""}>${body}</div>`;
    const tile = () => `<div style="width:112px;height:112px;border-radius:28px;box-shadow:0 0 0 5px rgba(255,255,255,.18),0 20px 44px rgba(20,16,50,.35)">${own(ICON)}</div>`;
    const lockup = (line: string) => `
        <div style="display:flex;align-items:center;gap:28px">${tile()}<div style="font-size:68px;font-weight:800;letter-spacing:-.03em">Tab Sandwich</div></div>
        <div style="margin-top:36px;font-size:30px;font-weight:600;opacity:.95">${line}</div>`;

    return `
<style>
  body { width:${STAGE.width * SCALE}px; height:${STAGE.height * SCALE}px; overflow:hidden; }
  #stage { width:${STAGE.width}px; height:${STAGE.height}px; overflow:hidden; position:relative; transform:scale(${SCALE}); transform-origin:0 0; font-family:${FONT}; color:#fff; background:${BACKGROUNDS.light}; }
  [data-tab] { color:${CHROME.text}; font-size:12px; }
  [data-tab][data-active] { background:${CHROME.toolbar}; }
  #library-tab:not([data-on]), #new-tab:not([data-on]) { display:none !important; }
  #blank { opacity:0; } #blank[data-on] { opacity:1; }
  .caret { display:inline-block; width:1.5px; height:16px; margin-left:1px; vertical-align:-3px; background:${CHROME.text}; animation:blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity:0; } }
  .chip { display:inline-flex; align-items:center; gap:6px; padding:2px 9px 2px 5px; margin-right:8px; border-radius:6px; background:#D3E3FD; color:#0B57D0; font-weight:500; vertical-align:middle; }
  #suggestions { display:none; position:absolute; z-index:4; left:-2px; right:-2px; top:36px; padding:6px 0; border-radius:14px; background:#fff; box-shadow:0 8px 28px rgba(20,16,50,.22),0 0 0 1px rgba(0,0,0,.05); }
  #suggestions[data-on] { display:block; }
  #suggestions [data-row] { height:36px; display:flex; align-items:center; gap:14px; padding:0 18px; font-size:14px; color:${CHROME.text}; white-space:nowrap; overflow:hidden; }
  #suggestions [data-row][data-picked] { background:#E9EEF6; }
  #suggestions b { font-weight:700; } #suggestions .dim { color:${CHROME.muted}; }
  .card { position:absolute; inset:0; z-index:20; display:flex; flex-direction:column; align-items:center; justify-content:center; background:${BACKGROUNDS.light}; opacity:0; transition:opacity .5s ease; pointer-events:none; }
  .card[data-on] { opacity:1; }
  #popup-box { opacity:0; transform:translateY(-6px) scale(.98); transform-origin:top right; transition:opacity .16s ease, transform .16s ease; pointer-events:none; }
  #popup-box[data-on] { opacity:1; transform:none; pointer-events:auto; }
  #library { opacity:0; transition:opacity .35s ease; pointer-events:none; }
  #library[data-on] { opacity:1; pointer-events:auto; }
  #panel { transition:width .35s cubic-bezier(.3,.1,.2,1); }
  .mi { height:28px; display:flex; align-items:center; gap:10px; padding:0 14px 0 34px; white-space:nowrap; }
  .mi[data-hot] { background:#EEF0F7; }
  #caption { transition:opacity .2s ease; }
</style>
<div id="stage">
<div style="position:absolute;left:${WINDOW.left}px;top:24px;display:flex;flex-direction:column;gap:10px">
  <div style="display:flex;align-items:center;gap:10px;font-size:17px;font-weight:700;opacity:.95">${MARK.replace('width="36" height="30"', 'width="26" height="22"')}Tab Sandwich</div>
  <div id="caption" style="font-size:34px;font-weight:800;letter-spacing:-.02em"></div>
</div>

<div style="position:absolute;left:${WINDOW.left}px;top:${WINDOW.top}px;width:${WINDOW.width}px;height:${STAGE.height - WINDOW.top + 20}px;border-radius:14px 14px 0 0;overflow:hidden;box-shadow:${SHADOW};background:${CHROME.frame};color:${CHROME.text};font-size:13px">
  <div style="height:${TAB_STRIP}px;display:flex;align-items:flex-end;gap:4px;padding:0 12px 0 16px">
    <div style="display:flex;gap:8px;align-self:center;margin-right:14px">${dot("#FF5F57")}${dot("#FEBC2E")}${dot("#28C840")}</div>
    ${tabs.map((t) => tab(t.active ? activeTitle : t.title, site(t.url), t.active)).join("")}
    ${tab("Tab Sandwich", icon(16), false, "library-tab")}
    ${tab("New Tab", "", false, "new-tab")}
    <span id="new-tab-button" style="align-self:center;font-size:20px;line-height:1;color:${CHROME.muted};padding:0 6px">+</span>
  </div>
  <div style="height:${TOOLBAR}px;display:flex;align-items:center;gap:2px;padding:0 8px;background:${CHROME.toolbar};border-bottom:1px solid ${CHROME.line}">
    ${button("back")}${button("forward")}${button("reload")}
    <div id="omnibox" style="position:relative;flex:1;height:32px;margin:0 8px;border-radius:16px;background:${CHROME.omnibox};display:flex;align-items:center;gap:10px;padding:0 12px 0 10px">
      <div id="suggestions"></div>
      ${chromeIcon("tune", 16)}<span id="address" style="flex:1;font-size:14px">${host}<span style="color:${CHROME.muted}">${decodeURIComponent(pathname)}</span></span>${chromeIcon("star", 16)}
    </div>
    <template id="library-address"><span style="display:inline-flex;align-items:center;gap:6px;padding:2px 8px 2px 4px;margin-right:6px;border-radius:10px;background:#fff">${icon(14)}Tab Sandwich</span><span style="color:${CHROME.muted}">chrome-extension://${EXTENSION_ID.slice(0, 12)}…/library/library.html</span></template>
    ${button("panel")}${button("puzzle")}
    <span id="ts-action" style="width:32px;height:32px;display:grid;place-items:center;position:relative">
      ${icon(18)}
      <span id="badge" style="position:absolute;right:-1px;bottom:1px;min-width:16px;height:14px;padding:0 3px;border-radius:7px;background:#1E7F4F;color:#fff;font:700 10px/14px ${FONT};text-align:center;opacity:0;transition:opacity .2s">✓</span>
    </span>
    <span style="width:24px;height:24px;margin:0 6px;border-radius:50%;background:#B9A6E8"></span>${button("more")}
  </div>
  <div style="position:relative;display:flex;height:${CONTENT.height}px;background:${CHROME.toolbar}">
    <div style="flex:1;min-width:0;overflow:hidden"><img id="page" src="${page}" style="display:block;width:auto;height:${CONTENT.height}px"></div>
    <div id="panel" style="width:0;overflow:hidden;flex-shrink:0;border-left:1px solid ${CHROME.line}">
      <div style="width:${PANEL_WIDTH}px">
        <div style="height:${PANEL_HEADER - 1}px;display:flex;align-items:center;gap:8px;padding:0 8px 0 12px;border-bottom:1px solid ${CHROME.line}">
          ${icon(18)}<span style="font-weight:600">Tab Sandwich</span><span style="flex:1"></span>${chromeIcon("pin", 16, CHROME.muted)}<span style="width:6px"></span><span id="panel-close">${chromeIcon("close", 16, CHROME.muted)}</span>
        </div>
        <iframe id="panel-frame" src="${SIDE_PANEL_URL}" style="display:block;border:0;width:${PANEL_WIDTH}px;height:${CONTENT.height - PANEL_HEADER}px"></iframe>
      </div>
    </div>
    <div id="library" style="position:absolute;inset:0;background:${CHROME.toolbar}"><iframe id="library-frame" style="display:block;border:0;width:100%;height:100%"></iframe></div>
    <div id="blank" style="position:absolute;inset:0;background:#F8F9FB"></div>
  </div>
</div>

<div id="popup-box" style="position:absolute;z-index:5;top:${WINDOW.top + TAB_STRIP + TOOLBAR - 4}px;left:${WINDOW.left + WINDOW.width - 380 - 64}px;width:380px;height:600px;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(20,16,50,.28),0 2px 8px rgba(20,16,50,.18)">
  <iframe id="popup" style="display:block;border:0;width:380px;height:600px"></iframe>
</div>

<div id="menu" style="display:none;position:absolute;z-index:10;width:250px;padding:4px 0;border-radius:8px;background:#fff;color:#1F1F1F;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.06)">
  ${item("Open link in new tab")}${item("Open link in new window")}${item("Open link in Incognito window")}${sep}
  ${item("Save link as…")}${item("Copy link address")}${sep}
  ${item(`<span style="margin-left:-24px;display:flex">${icon(16)}</span>${d.menuSave}<span style="flex:1"></span>›`, "", "menu-save")}
  ${sep}${item("Inspect")}
  <div id="submenu" style="display:none;position:absolute;left:246px;top:${4 + 28 * 5 + 9 * 2 - 4}px;width:170px;padding:4px 0;border-radius:8px;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.06)">
    ${item(c.work, "padding-left:16px")}${item(c.reading, "padding-left:16px", "menu-pick")}${item(c.travel, "padding-left:16px")}${item(c.recipes, "padding-left:16px")}${item(d.uncategorized, "padding-left:16px")}
  </div>
</div>

${card(lockup(WORDS.title), "title", true)}
${card(lockup(WORDS.end), "end", false)}

<div id="ring" style="position:absolute;z-index:30;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;background:rgba(122,113,224,.55);opacity:0;pointer-events:none"></div>
<svg id="cursor" width="26" height="26" viewBox="0 0 26 26" style="position:absolute;z-index:31;left:-3px;top:-2px;opacity:0;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))">
  <path d="M4 2 L4 21 L9 16.5 L12.5 24 L15.8 22.6 L12.4 15.2 L19 15.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
</svg>
</div>`;
}
