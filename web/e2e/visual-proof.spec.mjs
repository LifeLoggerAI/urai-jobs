import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const routes = ['/', '/career-mirror', '/career-marketplace', '/career-automation', '/career-decision', '/career-passport'];
const viewports = [
  { id: 'desktop-1440', width: 1440, height: 1000 },
  { id: 'mobile-390', width: 390, height: 844 },
];
const output = process.env.URAI_JOBS_VISUAL_DIR || 'artifacts/jobs-visual';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

test.beforeAll(async () => { await fs.mkdir(output, { recursive: true }); });

for (const viewport of viewports) {
  for (const route of routes) {
    test(`retain ${viewport.id} pixels ${route}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        hasTouch: viewport.id.startsWith('mobile'),
        isMobile: viewport.id.startsWith('mobile'),
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
      expect(response && response.ok()).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(overflow).toBeFalsy();
      const slug = route === '/' ? 'home' : route.slice(1);
      await page.screenshot({ path: path.join(output, `${viewport.id}-${slug}.png`), fullPage: true });
      expect(pageErrors).toEqual([]);
      await context.close();
    });
  }
}
