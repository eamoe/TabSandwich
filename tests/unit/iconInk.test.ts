import { describe, expect, it } from "vitest";
import { iconInk } from "../../src/util/iconInk";

/** A 16×16 icon: `share` of its pixels painted [r, g, b], the rest transparent. */
function icon(share: number, ...colors: [number, number, number][]): Uint8ClampedArray {
    const data = new Uint8ClampedArray(16 * 16 * 4);
    const painted = Math.round(256 * share);
    for (let p = 0; p < painted; p++) {
        const [r, g, b] = colors[p % colors.length];
        data.set([r, g, b, 255], p * 4);
    }
    return data;
}

describe("iconInk", () => {
    it("finds a one-color dark shape on transparency (GitHub's octocat)", () => {
        expect(iconInk(icon(0.46, [31, 35, 40]))).toBe("dark");
    });

    it("finds a one-color white shape on transparency", () => {
        expect(iconInk(icon(0.4, [255, 255, 255]))).toBe("light");
    });

    it("counts Chrome's mid-gray default globe as dark ink: it sinks into a dark tile too", () => {
        expect(iconInk(icon(0.44, [100, 100, 104]))).toBe("dark");
    });

    it("leaves a light-gray one-color shape alone: it reads on both themes", () => {
        expect(iconInk(icon(0.44, [170, 170, 170]))).toBeNull();
    });

    it("leaves an icon with its own background alone, however dark (MDN) or light (Wikipedia)", () => {
        expect(iconInk(icon(1, [27, 27, 27]))).toBeNull();
        expect(iconInk(icon(0.98, [214, 214, 214]))).toBeNull();
    });

    it("leaves a colorful icon alone, even a dark one", () => {
        expect(iconInk(icon(0.41, [242, 78, 30], [10, 207, 131], [162, 89, 255]))).toBeNull();
        expect(iconInk(icon(0.4, [20, 40, 110]))).toBeNull();
    });

    it("leaves a fully transparent (or empty) image alone", () => {
        expect(iconInk(icon(0, [0, 0, 0]))).toBeNull();
        expect(iconInk(new Uint8ClampedArray())).toBeNull();
    });
});
