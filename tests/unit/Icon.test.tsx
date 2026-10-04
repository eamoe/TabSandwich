// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/preact";
import { Icon } from "../../src/ui/Icon";

// The first Preact component: proves JSX compiles and renders under the test runner, and pins
// the one rule every icon must keep — it is decoration, named by the control that holds it.
describe("Icon", () => {
    afterEach(cleanup);

    it("renders a decorative svg at the requested size", () => {
        const { container } = render(<Icon name="search" size={14} />);
        const svg = container.querySelector("svg")!;
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        expect(svg.getAttribute("width")).toBe("14");
        expect(svg.querySelector("circle")).not.toBeNull();
    });
});
