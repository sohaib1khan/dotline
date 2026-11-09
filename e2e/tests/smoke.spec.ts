import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Dotline smoke", () => {
  test("health endpoint is ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("landing/login gate is reachable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Dotline").first()).toBeVisible();
  });

  test("login page has no critical axe violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Log in").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });

  test("admin can open monitoring after login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or username").fill("ada_admin");
    await page.getByLabel("Password").fill("super-secure-pass");
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/\/admin/);
    await page.goto("/admin/monitoring");
    await expect(page.getByRole("heading", { name: /Monitoring/i })).toBeVisible();
  });
});
