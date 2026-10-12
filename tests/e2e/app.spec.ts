/**
 * End-to-end tests: the real app in a real browser (MapLibre runs on SwiftShader WebGL).
 * Uses the bundled demo scene so results are deterministic and work offline.
 */
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import * as shapefile from "shapefile";
import { readFile } from "node:fs/promises";

const num = (s: string | null) => Number((s ?? "").replace(/[^0-9.-]/g, ""));

async function runDemoToResults(page: Page) {
  await page.goto("/app");
  await page.getByTestId("load-demo").click();
  await expect(page.getByTestId("field-area")).toContainText("192.6");
  await page.getByTestId("to-imagery").click();
  await page.getByTestId("analyze").click();
  await expect(page.getByTestId("generate")).toBeVisible({ timeout: 60_000 });
}

test.describe("landing", () => {
  test("renders hero, sourced stats and footer; CTA opens the demo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("The right fertilizer");
    await expect(page.getByText("Source: USGS")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await page.getByTestId("hero-demo").click();
    await expect(page).toHaveURL(/\/app\?demo=1/);
    await expect(page.getByTestId("field-area")).toContainText("192.6");
  });

  test("science page lists formulas and limitations", async ({ page }) => {
    await page.goto("/science");
    await expect(page.locator("#formulas")).toBeVisible();
    await expect(page.locator("#limitations")).toBeVisible();
    await expect(page.getByText("NDRE = (B8 − B5) / (B8 + B5)")).toBeVisible();
  });
});

test.describe("workspace", () => {
  test("demo flow: analyze, live rate math, generate, charts, insights", async ({ page }) => {
    await runDemoToResults(page);
    await expect(page.getByTestId("source-badge")).toContainText("Satellite photo");

    // rate math: zone rate = base x (1 + adjustment). Default 4 zones: Z4 adjustment -20%.
    const base = page.getByLabel("Your usual rate", { exact: true }).first();
    await base.fill("150");
    await expect(page.getByTestId("zone-rate-4")).toHaveText("120");
    await expect(page.getByTestId("zone-rate-1")).toHaveText("173"); // 150 x 1.15 = 172.5
    await base.fill("120");
    await expect(page.getByTestId("zone-rate-4")).toHaveText("96");

    await page.getByTestId("generate").click();
    await expect(page.getByTestId("results")).toBeVisible();
    await expect(page.getByTestId("health-score")).toBeVisible();
    for (const id of ["chart-histogram", "chart-nitrogen", "chart-waterfall", "chart-profile"]) {
      await page.getByTestId(id).scrollIntoViewIfNeeded();
      await expect(page.getByTestId(id).locator("svg").first()).toBeVisible();
    }
    // savings KPI = (flat - plan) x $0.75
    await page.waitForTimeout(1800); // let number tickers settle
    const savings = num(await page.getByTestId("kpi-savings").locator(".font-display").innerText());
    expect(savings).toBeGreaterThan(1000);

    // insights: either AI or rule-based, never empty
    await expect(page.getByTestId("insights").locator("li").first()).toBeVisible();
    await page.getByTestId("explain-zone-1").click();
    await expect(page.getByTestId("insights")).toContainText(/Zone 1|zone 1/);

    // map layers switch without errors
    for (const l of ["rate", "primary", "truecolor", "zones"]) await page.getByTestId(`layer-${l}`).click();

    // zone filter chip
    await page.getByTestId("zone-chip-1").click();
    await expect(page.getByTestId("zone-chip-1")).toHaveAttribute("aria-pressed", "true");
  });

  test("zone editing via cell inspector is undoable", async ({ page }) => {
    await runDemoToResults(page);
    await page.getByTestId("generate").click();
    await page.waitForTimeout(2200); // reveal animation
    const map = page.locator(".maplibregl-canvas");
    const box = (await map.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
    const inspector = page.getByTestId("cell-inspector");
    await expect(inspector).toBeVisible();
    // move the cell to a zone it isn't in
    const enabled = inspector.locator("button[aria-label^='Move cell to zone']:not([disabled])").first();
    await enabled.click();
    await expect(inspector).toContainText("edited");
    await page.getByTestId("undo").click();
    await expect(inspector).not.toContainText("edited");
    // keyboard navigation between cells
    await page.keyboard.press("ArrowRight");
    await expect(inspector).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();
  });

  test("every download works and round-trips", async ({ page }) => {
    await runDemoToResults(page);
    await page.getByTestId("generate").click();

    const [bundle] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-all").first().click()]);
    const zip = await JSZip.loadAsync(await readFile((await bundle.path())!));
    const names = Object.keys(zip.files).map((n) => n.split("/").slice(1).join("/"));
    for (const f of ["field_report.pdf", "prescription.geojson", "prescription.kml", "prescription_cells.csv", "zone_summary.csv", "README.txt", "shapefile/nitrozone_rx.shp", "shapefile/nitrozone_rx.dbf", "shapefile/nitrozone_rx.prj", "shapefile/nitrozone_rx.shx"])
      expect(names).toContain(f);
    const pdf = await zip.file(/field_report\.pdf$/)[0].async("uint8array");
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe("%PDF-");

    // shapefile on its own
    await page.getByTestId("download-menu").first().click();
    const [shp] = await Promise.all([page.waitForEvent("download"), page.getByTestId("dl-shp").click()]);
    const shpZip = await JSZip.loadAsync(await readFile((await shp.path())!));
    const fc = await shapefile.read(await shpZip.file(/\.shp$/)[0].async("arraybuffer"), await shpZip.file(/\.dbf$/)[0].async("arraybuffer"));
    const props = fc.features[0].properties as Record<string, number>;
    expect(Object.keys(props).sort()).toEqual(["AREA_AC", "RATE_LBAC", "ZONE"]);
    const area = fc.features.reduce((s, f) => s + (f.properties as Record<string, number>).AREA_AC, 0);
    expect(area).toBeGreaterThan(190);
    expect(area).toBeLessThan(195);

    for (const id of ["dl-geojson", "dl-kml", "dl-csv", "dl-zones", "dl-pdf"]) {
      await page.waitForTimeout(600); // let the previous menu finish closing
      await page.getByTestId("download-menu").first().click();
      await expect(page.getByTestId(id)).toBeVisible();
      const [d] = await Promise.all([page.waitForEvent("download"), page.getByTestId(id).click()]);
      const buf = await readFile((await d.path())!);
      expect(buf.byteLength).toBeGreaterThan(200);
    }
  });

  test("save and share a prescription, then open the read-only report", async ({ page }) => {
    await runDemoToResults(page);
    await page.getByTestId("generate").click();
    await page.getByTestId("save-rx").scrollIntoViewIfNeeded();
    await page.getByTestId("save-rx").click();
    await expect(page.getByText("Prescription saved")).toBeVisible();
    await page.getByTestId("share-rx").click();
    const link = page.getByTestId("share-link");
    await expect(link).toBeVisible();
    const href = (await link.getAttribute("href"))!;
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Audrain County demo field");
    await expect(page.getByText("Zones and rates")).toBeVisible();
  });

  test("draw a field by clicking corners", async ({ page }) => {
    await page.goto("/app");
    await page.waitForTimeout(1500);
    // zoom the map to a farm area first (same county as the demo)
    await page.getByTestId("load-demo").click();
    await page.waitForTimeout(2200); // let the camera finish flying to the field
    await page.getByRole("button", { name: "Redraw" }).click();
    const map = page.locator(".maplibregl-canvas");
    const b = (await map.boundingBox())!;
    const pts: [number, number][] = [
      [0.55, 0.3],
      [0.8, 0.3],
      [0.8, 0.65],
      [0.55, 0.65],
    ];
    for (const [x, y] of pts) {
      await page.mouse.click(b.x + b.width * x, b.y + b.height * y);
      await page.waitForTimeout(300);
    }
    await page.mouse.click(b.x + b.width * pts[0][0], b.y + b.height * pts[0][1]); // close on first point
    await expect(page.getByTestId("field-area")).toBeVisible();
    expect(num(await page.getByTestId("field-area").innerText())).toBeGreaterThan(5);
    await expect(page.getByTestId("to-imagery")).toBeEnabled();
  });

  test("presentation mode loads the demo and enlarges type", async ({ page }) => {
    await page.goto("/app?present=1");
    await expect(page.locator("html")).toHaveClass(/present/);
    await expect(page.getByTestId("analyze")).toBeVisible();
    await page.keyboard.press("p");
    await expect(page.locator("html")).not.toHaveClass(/present/);
  });
});

test.describe("tablet", () => {
  test("@ipad results layout stacks map above analytics", async ({ page }) => {
    await runDemoToResults(page);
    await page.getByTestId("generate").click();
    const mapBox = (await page.locator(".maplibregl-canvas").boundingBox())!;
    const resultsBox = (await page.getByTestId("results").boundingBox())!;
    expect(resultsBox.y).toBeGreaterThan(mapBox.y + mapBox.height - 5);
    await expect(page.getByTestId("health-score")).toBeVisible();
  });
});
