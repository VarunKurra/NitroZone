/**
 * Simulates a computer with graphics acceleration turned off (no WebGL at all):
 * the app must fall back to the simple map instead of crashing.
 */
import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-3d-apis", "--disable-gpu"] } });
test("app works with the simple map instead of crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/app?demo=1");
    await expect(page.getByRole("application")).toBeVisible(); // simple map renders instead of the WebGL map
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await page.getByTestId("to-imagery").click();
    await page.getByTestId("analyze").click();
    await page.getByTestId("generate").click({ timeout: 60_000 });
    await expect(page.getByTestId("results")).toBeVisible();
    await page.locator("[data-cell]").nth(500).click();
    await expect(page.getByTestId("cell-inspector")).toBeVisible();
    expect(errors).toEqual([]);
  });
