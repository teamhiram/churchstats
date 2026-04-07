import { expect, test, type Page } from "@playwright/test";

async function readJsonState<T>(page: Page, testId: string): Promise<T> {
  const raw = await page.getByTestId(testId).innerText();
  return JSON.parse(raw) as T;
}

test.describe("/test harness", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("表示設定トグルが永続化される", async ({ page }) => {
    await expect(page.getByTestId("display-online")).toHaveText("false");
    await expect(page.getByTestId("display-away")).toHaveText("false");

    await page.getByTestId("display-toggle-online").click();
    await page.getByTestId("display-toggle-away").click();

    await expect(page.getByTestId("display-online")).toHaveText("true");
    await expect(page.getByTestId("display-away")).toHaveText("true");

    await page.reload();

    await expect(page.getByTestId("display-online")).toHaveText("true");
    await expect(page.getByTestId("display-away")).toHaveText("true");
  });

  test("主日アクションの主要フローが動作する", async ({ page }) => {
    await page.getByTestId("sunday-add-from-search").click();
    let state = await readJsonState<{
      attendanceExists: boolean;
      attended: boolean | null;
      online: boolean | null;
      away: boolean | null;
      searchQuery: string;
      searchResultsCount: number;
    }>(page, "sunday-state");

    expect(state.attendanceExists).toBe(true);
    expect(state.attended).toBe(true);
    expect(state.searchQuery).toBe("");
    expect(state.searchResultsCount).toBe(0);

    await page.getByTestId("sunday-toggle-online").click();
    await page.getByTestId("sunday-toggle-away").click();

    state = await readJsonState(page, "sunday-state");
    expect(state.online).toBe(true);
    expect(state.away).toBe(true);

    await page.getByTestId("sunday-mark-absent").click();
    state = await readJsonState(page, "sunday-state");

    expect(state.attended).toBe(false);
    expect(state.online).toBe(false);
    expect(state.away).toBe(false);

    await page.getByTestId("sunday-mark-unrecorded").click();
    state = await readJsonState(page, "sunday-state");
    expect(state.attendanceExists).toBe(false);
  });

  test("祈りアクションの主要フローが動作する", async ({ page }) => {
    await page.getByTestId("prayer-add-from-search").click();
    let state = await readJsonState<{
      attendanceExists: boolean;
      attended: boolean | null;
      online: boolean | null;
      searchQuery: string;
      searchResultsCount: number;
    }>(page, "prayer-state");

    expect(state.attendanceExists).toBe(true);
    expect(state.attended).toBe(true);
    expect(state.searchQuery).toBe("");
    expect(state.searchResultsCount).toBe(0);

    await page.getByTestId("prayer-toggle-online").click();
    state = await readJsonState(page, "prayer-state");
    expect(state.online).toBe(true);

    await page.getByTestId("prayer-mark-absent").click();
    state = await readJsonState(page, "prayer-state");
    expect(state.attended).toBe(false);
    expect(state.online).toBe(false);

    await page.getByTestId("prayer-mark-unrecorded").click();
    state = await readJsonState(page, "prayer-state");
    expect(state.attendanceExists).toBe(false);
  });
});
