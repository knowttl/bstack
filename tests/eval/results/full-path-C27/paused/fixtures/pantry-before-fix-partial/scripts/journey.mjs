import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { preview } from "./preview.mjs";

const server = await preview();
let browser;
const observations = [];
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const remote = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(server.url)) remote.push(request.url());
  });
  await page.goto(server.url);
  const add = async (name) => {
    await page.getByLabel("Item name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Add item", exact: true }).click();
  };
  await add("Rice");
  await page.getByRole("checkbox", { name: "Need Rice", exact: true }).check();
  await page
    .getByRole("button", { name: "Shopping list", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Need Rice", exact: true })
      .isChecked(),
    true,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Shopping list", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Need Rice", exact: true })
      .isChecked(),
    true,
  );
  observations.push(
    "Observed add Rice, mark needed, shopping-list Rice and retained needed Rice after reload.",
  );
  await page.getByRole("button", { name: "Pantry", exact: true }).click();
  await add(" rice ");
  assert.equal(await page.getByRole("checkbox").count(), 1);
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Need Rice", exact: true })
      .isChecked(),
    true,
  );
  await add("Brown Rice");
  await add("White Rice");
  assert.equal(await page.getByRole("checkbox").count(), 3);
  observations.push(
    "Observed trimmed case-insensitive reuse and distinct full-name variants.",
  );
  await page.evaluate(() => {
    window.__restoreSave = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "QuotaExceededError");
    };
  });
  await add("Beans");
  await page.getByRole("checkbox", { name: "Need Beans", exact: true }).check();
  assert.match(await page.locator("#save-status").innerText(), /unsaved/);
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
  assert.match(await page.locator("#save-status").innerText(), /unsaved/);
  await add("Lentils");
  await page
    .getByRole("button", { name: "Shopping list", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Need Beans", exact: true })
      .isChecked(),
    true,
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__restoreSave;
  });
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
  assert.equal(
    await page.locator("#save-status").innerText(),
    "Saved locally.",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Retry saving", exact: true })
      .isVisible(),
    false,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Shopping list", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Need Beans", exact: true })
      .isChecked(),
    true,
  );
  await page.getByRole("button", { name: "Pantry", exact: true }).click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Need Lentils", exact: true })
      .count(),
    1,
  );
  observations.push(
    "Observed save failure, failed retry, continued edits, visible unsaved state and successful retry retaining the latest session on reload.",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    JSON.stringify({
      status: "passed",
      browser: browser.version(),
      observations,
      pageErrors: errors,
      remoteRequests: remote,
    }),
  );
} finally {
  if (browser) await browser.close();
  await server.close();
}
