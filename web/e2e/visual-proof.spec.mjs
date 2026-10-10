import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const routes = [
  { path: '/', heading: 'See what URAI is doing, why it is doing it, and what happened.' },
  { path: '/login', heading: 'Admin sign in' },
  { path: '/privacy', heading: 'URAI Jobs Privacy Notice' },
  { path: '/trust', heading: 'Operational safeguards' },
  { path: '/terms', heading: 'URAI Jobs Terms of Use' },
  { path: '/admin', heading: 'URAI Jobs is an internal operator runtime.', denied: true },
  { path: '/create', heading: 'URAI Jobs is an internal operator runtime.', denied: true },
  ...['/career-mirror', '/career-marketplace', '/career-automation', '/career-decision', '/career-passport'].map((route) => ({
    path: route,
    heading: 'This career-facing route is not part of the canonical URAI Jobs runtime.',
    contained: true,
  })),
];
const viewports = [
  { id: 'desktop-1440', width: 1440, height: 1000 },
  { id: 'mobile-390', width: 390, height: 844, isMobile: true, hasTouch: true },
  { id: 'desktop-reduced-1440', width: 1440, height: 1000, reducedMotion: 'reduce' },
  { id: 'desktop-forced-colors-1440', width: 1440, height: 1000, forcedColors: 'active' },
];
const output = process.env.URAI_JOBS_VISUAL_DIR || 'artifacts/jobs-visual';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

test.beforeAll(async () => { await fs.mkdir(output, { recursive: true }); });

async function prepare(context) {
  const blockedExternalOrigins = [];
  await context.route('**/*', async (route) => {
    const origin = new URL(route.request().url()).origin;
    if (origin === new URL(baseURL).origin) await route.continue();
    else {
      blockedExternalOrigins.push(origin);
      await route.abort('blockedbyclient');
    }
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return { page, pageErrors, blockedExternalOrigins };
}

async function retain(page, name, evidence) {
  const screenshot = `${name}.png`;
  await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
  const bytes = await fs.readFile(path.join(output, screenshot));
  await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify({
    exactHead: process.env.EXACT_HEAD || null,
    observedAt: new Date().toISOString(),
    environment: 'non-production unsigned browser; all external requests blocked',
    browserVersion: page.context().browser().version(),
    providerData: 'none',
    cloudWrites: 0,
    independentApproval: false,
    url: page.url(),
    screenshot,
    screenshotSha256: createHash('sha256').update(bytes).digest('hex'),
    ...evidence,
  }, null, 2));
}

for (const viewport of viewports) {
  for (const route of routes) {
    test(`retain ${viewport.id} pixels ${route.path}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        hasTouch: viewport.hasTouch || false,
        isMobile: viewport.isMobile || false,
        reducedMotion: viewport.reducedMotion || 'no-preference',
        forcedColors: viewport.forcedColors || 'none',
      });
      try {
        const { page, pageErrors, blockedExternalOrigins } = await prepare(context);
        const response = await page.goto(`${baseURL}${route.path}`, { waitUntil: 'networkidle' });
        const metrics = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          forcedColors: matchMedia('(forced-colors: active)').matches,
          targets: [...document.querySelectorAll('a,button,input,textarea,select')]
            .filter((element) => element.getBoundingClientRect().width && element.getBoundingClientRect().height)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return { name: element.textContent?.trim() || element.tagName, width: rect.width, height: rect.height };
            }),
        }));
        const slug = route.path === '/' ? 'runtime' : route.path.slice(1);
        await retain(page, `${viewport.id}-${slug}`, { route: route.path, viewport, metrics, pageErrors, blockedExternalOrigins });
        expect(response && response.ok()).toBeTruthy();
        await expect(page.getByRole('navigation', { name: 'URAI Jobs navigation' })).toBeVisible();
        await expect(page.getByRole('main')).toHaveCount(1);
        await expect(page.getByRole('heading', { level: 1, name: route.heading, exact: true })).toBeVisible();
        expect(metrics.overflow).toBeFalsy();
        expect(metrics.targets.filter((target) => target.width < 48 || target.height < 48)).toEqual([]);
        expect(metrics.reducedMotion).toBe(viewport.reducedMotion === 'reduce');
        expect(metrics.forcedColors).toBe(viewport.forcedColors === 'active');
        expect(pageErrors).toEqual([]);
        if (route.denied) {
          await expect(page.getByRole('link', { name: 'Go to login', exact: true })).toBeVisible();
          await expect(page.locator('form')).toHaveCount(0);
          await expect(page.getByRole('button')).toHaveCount(0);
        }
        if (route.contained) {
          await expect(page.getByRole('link', { name: 'Return to runtime overview', exact: true })).toBeVisible();
          await expect(page.locator('form')).toHaveCount(0);
        }
      } finally { await context.close(); }
    });
  }

  test(`${viewport.id} actual boundary navigation and return`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.hasTouch || false,
      isMobile: viewport.isMobile || false,
      reducedMotion: viewport.reducedMotion || 'no-preference',
      forcedColors: viewport.forcedColors || 'none',
    });
    try {
      const { page, pageErrors, blockedExternalOrigins } = await prepare(context);
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      const target = page.getByRole('link', { name: 'Runtime boundaries', exact: true });
      if (viewport.hasTouch) {
        await Promise.all([page.waitForURL(`${baseURL}/trust`, { waitUntil: 'networkidle' }), target.tap()]);
      } else {
        let focused = false;
        for (let index = 0; index < 12 && !focused; index++) {
          await page.keyboard.press('Tab');
          focused = await target.evaluate((element) => document.activeElement === element);
        }
        expect(focused, 'Runtime boundaries must be reachable by actual Tab presses').toBeTruthy();
        const outline = await target.evaluate((element) => ({
          style: getComputedStyle(element).outlineStyle,
          width: Number.parseFloat(getComputedStyle(element).outlineWidth),
        }));
        expect(outline.style).not.toBe('none');
        expect(outline.width).toBeGreaterThanOrEqual(2);
        await Promise.all([page.waitForURL(`${baseURL}/trust`, { waitUntil: 'networkidle' }), page.keyboard.press('Enter')]);
      }
      await expect(page.getByRole('heading', { level: 1, name: 'Operational safeguards' })).toBeVisible();
      await retain(page, `${viewport.id}-boundary-navigation`, { action: viewport.hasTouch ? 'actual touch tap' : 'actual Tab and Enter', pageErrors, blockedExternalOrigins });
      await Promise.all([
        page.waitForURL(`${baseURL}/`, { waitUntil: 'networkidle' }),
        page.getByRole('link', { name: 'Runtime', exact: true }).click(),
      ]);
      await expect(page.getByRole('heading', { level: 1, name: routes[0].heading })).toBeVisible();
      await retain(page, `${viewport.id}-runtime-return`, { action: 'actual Runtime link return', pageErrors, blockedExternalOrigins });
      expect(pageErrors).toEqual([]);
    } finally { await context.close(); }
  });
}
