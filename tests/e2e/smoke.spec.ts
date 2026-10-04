import { test, expect } from "./fixtures";

test("the built extension loads and shows an empty library", async ({ popup }) => {
    await expect(popup.getByRole("heading", { name: "Tab Sandwich" })).toBeVisible();
    await expect(popup.getByRole("list", { name: "Saved tabs" })).toContainText("No saved tabs yet.");
});
