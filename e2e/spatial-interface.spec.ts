import { expect, test, type Page } from '@playwright/test';

const calibration = {
  version: 1,
  dominantHand: 'auto',
  onboardingComplete: true,
};

let runtimeErrors: string[];

test.beforeEach(async ({ page }) => {
  runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.addInitScript((profile) => {
    localStorage.setItem('spatial-hmi.calibration.v1', JSON.stringify(profile));
  }, calibration);
});

test.afterEach(() => {
  expect(runtimeErrors ?? []).toEqual([]);
});

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Camera', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Camera & interaction' })).toBeVisible();
}

test('boots without a camera and persists fallback settings', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Spatial Digital Twin Interface');
  await expect(page.locator('#scene-root canvas')).toBeVisible();
  await expect(page.locator('#model-title')).toHaveText('Articulated inspection cell');
  await openSettings(page);
  await expect(page.getByText('Camera access starts only when requested.')).toBeVisible();
  await expect(page.getByText('Digital twin model', { exact: true })).toBeVisible();
  const mirror = page.locator('#mirror-checkbox');
  await mirror.uncheck();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.reload();
  await openSettings(page);
  await expect(mirror).not.toBeChecked();
});

test('reports camera permission denial and keeps demo available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: () => Promise.resolve([]),
        getUserMedia: () =>
          Promise.reject(new DOMException('Permission denied by test', 'NotAllowedError')),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
  await page.goto('/');
  await openSettings(page);
  await page.getByRole('button', { name: 'Start selected camera' }).click();
  await expect(page.locator('#camera-message')).toContainText('Camera access was denied');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: /Try demo/ }).click();
  await expect(page.locator('#camera-resolution')).toHaveText('SYNTHETIC');
});

test('supports component actions, visual modes, explode, and reset', async ({ page }) => {
  await page.goto('/');
  await page.locator('#component-select').selectOption('J02');
  await expect(page.locator('#component-name')).toHaveText('Elbow joint');
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(page.locator('#component-visibility')).toHaveText('Hidden');
  await page.getByRole('button', { name: 'Show', exact: true }).click();
  await expect(page.locator('#component-visibility')).toHaveText('100%');
  await page.getByRole('button', { name: 'Isolate' }).click();
  await page.getByRole('button', { name: 'Restore all' }).click();
  for (const [name, code] of [
    ['Blueprint', 'BLU'],
    ['Solid', 'SLD'],
    ['Diagnostic', 'DIA'],
    ['Holo', 'HLO'],
  ] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('#mode-code')).toHaveText(code);
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('e');
  await expect(page.locator('#axis-explode')).toHaveText('100%');
  await page.locator('body').press('r');
  await expect(page.locator('#axis-explode')).toHaveText('0%');
  await expect(page.locator('#component-select')).toHaveValue('');
  await page.keyboard.press('Shift+/');
  await expect(page.getByRole('dialog', { name: 'Interaction map' })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('replays synthetic landmarks and records labelled benchmark observations', async ({
  page,
}) => {
  await page.goto('/?demo=1');
  await expect(page.locator('#demo-transport')).toBeVisible();
  await expect(page.locator('#camera-resolution')).toHaveText('SYNTHETIC');
  await expect
    .poll(() =>
      page.locator('#hand-overlay').evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d');
        if (!context || canvas.width < 2 || canvas.height < 2) return 0;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonTransparent = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index]) nonTransparent += 1;
        }
        return nonTransparent;
      }),
    )
    .toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Pause demo' }).click();
  const pausedTime = await page.locator('#demo-time').textContent();
  await page.waitForTimeout(400);
  await expect(page.locator('#demo-time')).toHaveText(pausedTime ?? '');
  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(page.locator('#demo-time')).toContainText('0.0 / 12.0 s');
  await page.locator('#demo-speed').selectOption('2');
  await page.getByRole('button', { name: 'Resume demo' }).click();

  await page.getByRole('button', { name: 'Open measured diagnostics' }).click();
  await page.locator('#benchmark-device').fill('Browser test rig');
  await page.locator('#benchmark-lighting').selectOption('normal');
  await page.locator('#benchmark-distance').fill('0.8');
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.locator('#benchmark-device')).toBeDisabled();
  await expect
    .poll(async () => Number(await page.locator('#benchmark-count').textContent()))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.locator('#benchmark-device')).toBeEnabled();
  await expect(page.locator('#benchmark-status')).toContainText('Recorder stopped');
  await expect(page.locator('.benchmark-metadata p')).toContainText(
    'never camera frames or landmark coordinates',
  );
});

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'standard', width: 1440, height: 900 },
  { name: 'desktop', width: 1920, height: 1080 },
]) {
  test(`fits the ${viewport.name} viewport and captures a review image`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?demo=1');
    await expect(page.locator('#scene-root canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Camera', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const path = testInfo.outputPath(`${viewport.name}-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(`${viewport.name} viewport`, { path, contentType: 'image/png' });
  });
}
