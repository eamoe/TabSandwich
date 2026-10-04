import { describe, expect, it } from "vitest";
import { isSupportedTabUrl, normalizeUrl, urlsMatch } from "../../src/util/url";

describe("normalizeUrl", () => {
    it("adds https:// when the scheme is missing", () => {
        expect(normalizeUrl("example.com/path")).toBe("https://example.com/path");
    });

    it("keeps an explicit scheme as typed", () => {
        expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
    });

    it("trims surrounding whitespace", () => {
        expect(normalizeUrl("  example.com  ")).toBe("https://example.com/");
    });

    it.each(["", "   ", "weuirytuiwerytweury", "not a url"])("rejects %j", (raw) => {
        expect(normalizeUrl(raw)).toBeNull();
    });

    it("accepts localhost and IPv4 addresses without a scheme", () => {
        expect(normalizeUrl("localhost:3000")).toBe("https://localhost:3000/");
        expect(normalizeUrl("192.168.0.1")).toBe("https://192.168.0.1/");
    });

    it("trusts a single-label host when the user typed the scheme themselves", () => {
        expect(normalizeUrl("http://intranet")).toBe("http://intranet/");
    });
});

describe("isSupportedTabUrl", () => {
    it.each(["https://a.com", "http://a.com", "HTTPS://A.COM"])("accepts %s", (url) => {
        expect(isSupportedTabUrl(url)).toBe(true);
    });

    it.each([undefined, "", "chrome://extensions", "about:blank", "file:///tmp/x.html", "chrome-extension://abc/popup.html"])(
        "rejects %s",
        (url) => {
            expect(isSupportedTabUrl(url)).toBe(false);
        }
    );
});

describe("urlsMatch", () => {
    it("ignores a trailing slash and the #fragment", () => {
        expect(urlsMatch("https://a.com/docs/", "https://a.com/docs#intro")).toBe(true);
    });

    it("treats a different query string as a different page (e.g. two YouTube videos)", () => {
        expect(urlsMatch("https://youtube.com/watch?v=1", "https://youtube.com/watch?v=2")).toBe(false);
    });

    it("treats http and https as different", () => {
        expect(urlsMatch("http://a.com/", "https://a.com/")).toBe(false);
    });

    it("treats different hosts and paths as different", () => {
        expect(urlsMatch("https://a.com/x", "https://b.com/x")).toBe(false);
        expect(urlsMatch("https://a.com/x", "https://a.com/y")).toBe(false);
    });

    it("falls back to exact string comparison for unparsable input", () => {
        expect(urlsMatch("not a url", "not a url")).toBe(true);
        expect(urlsMatch("not a url", "also not")).toBe(false);
    });
});
