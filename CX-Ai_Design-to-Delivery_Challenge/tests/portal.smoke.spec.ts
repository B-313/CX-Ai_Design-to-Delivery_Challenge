import { expect, test } from "@playwright/test";

test("portal loads registration screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome to the Accelerator")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to Workspace" })).toBeVisible();
});
