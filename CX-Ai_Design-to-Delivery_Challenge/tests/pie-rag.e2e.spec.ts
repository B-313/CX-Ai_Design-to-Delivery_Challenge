import { expect, test } from "@playwright/test";

test.setTimeout(180000);

test("PIE and RAG live flow generates a brief", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("Jane", { exact: true }).fill("Demo");
  await page.getByPlaceholder("Smith", { exact: true }).fill("User");
  await page.getByPlaceholder("jane.smith@company.com", { exact: true }).fill("demo.user@example.com");
  await page.getByPlaceholder("EMP-00000", { exact: true }).fill("EMP-777");
  await page.getByPlaceholder("Digital Marketing", { exact: true }).fill("Marketing");
  // API key is now optional - skip filling it to test demo mode
  await page.getByRole("combobox").selectOption("United Kingdom");
  await page.getByRole("button", { name: /Continue to Workspace/i }).click();

  await page
    .getByPlaceholder("Describe your project context\nList any known constraints\nInclude desired outcomes")
    .fill("Build a patient support webpage with safety and compliance language plus practical next steps.");

  await page.getByRole("button", { name: /Generate Brief/i }).click();

  await expect(page.getByText("Generated Brief")).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/Prompt Intelligence Generated Content/i)).toBeVisible();
});
