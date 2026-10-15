import { expect, type Page, test } from "@playwright/test";

const password = process.env.E2E_PASSWORD;
test.skip(!password, "Set E2E_PASSWORD (and E2E_BASE_URL) to run the smoke tests.");

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="password"]', password!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/kontakty/);
}

test("login is required and a wrong password is refused", async ({ page }) => {
  await page.goto("/kontakty");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="password"]', "definitely-not-the-password");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/login/);
});

const SCREENS: [string, RegExp][] = [
  ["/kontakty", /Kontakty/],
  ["/kontakty/firmy", /Kontakty/],
  ["/kontakty/odkrywanie", /Wyszukiwanie kontaktów/],
  ["/wiadomosci", /Wiadomości/],
  ["/wiadomosci/nowa", /Nowa wiadomość/],
  ["/materialy", /Moja oferta/],
  ["/oferty", /Oferty pracy/],
  ["/aktywnosc", /Statystyki/],
  ["/ustawienia", /Ustawienia/],
];

test("every screen renders without errors or horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await login(page);
  for (const [path, heading] of SCREENS) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("h1").first(), path).toHaveText(heading);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("the contact panel opens with evidence and the send guard", async ({ page }) => {
  await login(page);
  await page.goto("/kontakty?view=all", { waitUntil: "networkidle" });
  const rows = page.locator("tbody tr[data-index]");
  test.skip((await rows.count()) === 0, "No contacts in this database yet.");
  await rows.first().click();
  await expect(page.getByText("Dowody i źródła")).toBeVisible();
  await expect(page.locator(".section-title", { hasText: "Uprawnienie do kontaktu" })).toBeVisible();
  // Without a documented basis, sending is blocked (Art. 398 PKE; docs/research/LEGAL-PL.md).
  await expect(page.getByText("Wysyłka zablokowana")).toBeVisible();
});
