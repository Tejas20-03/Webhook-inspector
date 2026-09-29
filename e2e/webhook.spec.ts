import { test, expect } from "@playwright/test";

test("create an endpoint, capture a request live, and try a replay", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto("/");
  await page.getByTestId("create-endpoint").click();

  await page.waitForURL(/\/d\/.+/);
  const slug = page.url().split("/d/")[1];
  expect(slug).toMatch(/^[a-z0-9]{12}$/);

  // Simulate an external sender hitting the ingest URL directly, the way a
  // real webhook provider would — not through the browser.
  const res = await request.post(`${baseURL}/h/${slug}`, {
    headers: { "content-type": "application/json" },
    data: { event: "payment.succeeded", amount: 4999 },
  });
  expect(res.ok()).toBe(true);

  // It should show up live via the SSE feed, with no page reload.
  const item = page.getByTestId("request-item").first();
  await expect(item).toContainText("POST", { timeout: 10_000 });
  await item.click();

  await page.getByTestId("tab-pretty").click();
  await expect(page.locator("pre")).toContainText("payment.succeeded");

  // Replay to an address the SSRF guard must reject, and confirm the
  // dashboard surfaces a clear reason rather than silently failing.
  await page.getByTestId("tab-replay").click();
  await page.getByTestId("replay-target-url").fill("http://127.0.0.1:9/anything");
  await page.getByTestId("replay-submit").click();

  await expect(page.getByTestId("replay-result")).toContainText(/not a public address/i, {
    timeout: 10_000,
  });
});
