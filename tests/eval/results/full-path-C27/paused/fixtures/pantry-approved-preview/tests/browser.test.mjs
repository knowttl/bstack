import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const captures = await fs.mkdtemp(path.join(os.tmpdir(), "pantry-browser-"));
const executablePath =
  process.env.CHROME_PATH ||
  execFileSync("which", ["google-chrome"], { encoding: "utf8" }).trim();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const observations = [];
const url = pathToFileURL(path.resolve("index.html")).href;
async function add(page, name) {
  await page.getByLabel("Item name").fill(name);
  await page.getByRole("button", { name: "Add item", exact: true }).click();
}
try {
  await test("actual browser: Rice add, needed, shopping list, reload", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await add(page, "Rice");
    await page
      .getByRole("checkbox", { name: "Need to buy Rice", exact: true })
      .check();
    await page
      .getByRole("button", { name: "View shopping list", exact: true })
      .click();
    assert.equal(await page.locator("#items li").count(), 1);
    assert.equal(await page.locator("#items li span").textContent(), "Rice");
    assert.equal(await page.getByRole("status").textContent(), "Saved locally");
    await page.screenshot({ path: path.join(captures, "rice-shopping.png") });
    await page.reload();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Need to buy Rice", exact: true })
        .isChecked(),
      true,
    );
    await page
      .getByRole("button", { name: "View shopping list", exact: true })
      .click();
    assert.equal(await page.locator("#items li span").textContent(), "Rice");
    await add(page, " rice ");
    assert.equal(await page.locator("#items li").count(), 1);
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Need to buy Rice", exact: true })
        .isChecked(),
      true,
    );
    await page
      .getByRole("button", { name: "View pantry", exact: true })
      .click();
    await add(page, "Brown Rice");
    await add(page, "White Rice");
    assert.equal(await page.locator("#items li").count(), 3);
    await add(page, "  ");
    assert.match(
      await page.getByRole("alert").textContent(),
      /Enter an item name/,
    );
    await page.screenshot({ path: path.join(captures, "rice-reloaded.png") });
    observations.push({
      case: "Rice journey and duplicate-state preservation",
      passed: true,
      url,
    });
    await context.close();
  });
  await test("actual browser: storage failure, usable session, visible warning, recovery", async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) {
        if (!globalThis.allowPantrySaving)
          throw new DOMException("Full", "QuotaExceededError");
        return original.apply(this, args);
      };
    });
    const page = await context.newPage();
    await page.goto(url);
    await add(page, "Rice");
    await page
      .getByRole("checkbox", { name: "Need to buy Rice", exact: true })
      .check();
    await page
      .getByRole("button", { name: "View shopping list", exact: true })
      .click();
    assert.equal(await page.locator("#items li span").textContent(), "Rice");
    assert.match(
      await page.getByRole("status").textContent(),
      /Unsaved changes/,
    );
    await page.screenshot({ path: path.join(captures, "unsaved-session.png") });
    await page.evaluate(() => {
      globalThis.allowPantrySaving = true;
    });
    await page
      .getByRole("button", { name: "Retry saving", exact: true })
      .click();
    assert.equal(await page.getByRole("status").textContent(), "Saved locally");
    await page.reload();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Need to buy Rice", exact: true })
        .isChecked(),
      true,
    );
    observations.push({
      case: "Storage failure and successful retry before reload retention",
      passed: true,
      url,
    });
    await context.close();
  });
} finally {
  await fs.writeFile(
    path.join(captures, "observations.json"),
    JSON.stringify({ browser: browser.version(), url, observations }, null, 2),
  );
  console.log(`Browser evidence: ${captures}`);
  await browser.close();
}
