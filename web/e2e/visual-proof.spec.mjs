import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const routes = ['/', '/career-mirror', '/career-marketplace', '/career-automation', '/career-decision', '/career-passport'];
const output = process.env.URAI_JOBS_VISUAL_DIR || 'artifacts/jobs-visual';

test.beforeAll(async () => { await fs.mkdir(output, { recursive: true }); });

for (const route of routes) {
  test(`retain public pixels ${route}`, async ({ page }, testInfo) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response && response.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
    const width = testInfo.project.use.viewport?.width || 2000;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBeFalsy();
    const slug = route === '/' ? 'home' : route.slice(1);
    await page.screenshot({ path: path.join(output, `${testInfo.project.name}-${slug}.png`), fullPage: true });
    expect(pageErrors).toEqual([]);
  });
}
