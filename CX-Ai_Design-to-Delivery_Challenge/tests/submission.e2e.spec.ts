import { expect, test } from "@playwright/test";

test.setTimeout(120000);

test("submit panel completes submission", async ({ page }) => {
  await page.addInitScript(() => {
    const bootstrap = {
      step: 5,
      maxStep: 5,
      user: {
        firstName: "Test",
        lastName: "Judge",
        email: "test.judge@example.com",
        phone: "+44 7700 000000",
        empNumber: "EMP-12345",
        department: "Digital",
        country: "United Kingdom",
      },
      prelim: {
        buildType: "Webpage",
        audience: "Patients",
      },
      currentBrief: {
        projectTitle: "Submission Test Project",
        goal: "Validate that submit action succeeds and records submission.",
        audience: "Patients in UK",
        keyMessages: ["Safety first", "Clear next steps"],
        contentSections: ["Overview", "Safety", "Support"],
        toneAndStyle: "Clear and compliant",
        informationFromSources: "Local bootstrap data",
      },
      layout: "hero",
      reviewData: {
        overallScore: 82,
        complianceIssues: [],
        grammarIssues: [],
        scores: {
          compliance: 82,
          grammar: 80,
          brandVoice: 84,
          accessibility: 82,
        },
      },
      reviewDecisions: {},
      submitted: false,
      loading: false,
      activeAgent: null,
      notes: "",
      materials: [],
      briefs: [],
      pieResult: null,
      pieApproved: true,
    };

    window.localStorage.setItem("workspace_bootstrap_state_v1", JSON.stringify(bootstrap));
  });

  await page.goto("/");
  await expect(page.getByText("Export and Submit")).toBeVisible({ timeout: 30000 });

  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /Submit for Review/i }).click();

  await expect(page.getByText("Project submitted for review!")).toBeVisible({ timeout: 30000 });
});
