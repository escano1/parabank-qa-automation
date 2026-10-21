import { test, expect } from '../../src/fixtures';

/**
 * Escenarios específicos de dispositivos móviles (Pixel 7 / iPhone 14 emulados).
 * Los flujos funcionales marcados con @mobile en las demás suites también se ejecutan en estos proyectos.
 */
test.describe('Experiencia mobile web', { tag: '@mobile' }, () => {
  test.beforeEach(({ isMobile }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- skip condicional por dispositivo, no un test deshabilitado
    test.skip(!isMobile, 'Sólo aplica a proyectos con emulación de dispositivo móvil');
  });

  test('[TC-MOB-001] el menú de servicios permite navegar en el dispositivo', async ({ overviewPage, page }) => {
    await overviewPage.goto();
    await overviewPage.waitForLoaded();

    await overviewPage.navigateTo('Transfer Funds');

    await expect(page).toHaveURL(/transfer\.htm/);
    await expect(overviewPage.title).toHaveText('Transfer Funds');
  });

  test(
    '[TC-MOB-002] la página declara un viewport responsive',
    {
      tag: '@known-bug',
      annotation: {
        type: 'issue',
        description:
          'BUG-007: no existe <meta name="viewport">; en móvil se renderiza el layout de escritorio (~980px) reducido.',
      },
    },
    async ({ overviewPage, page }) => {
      test.fail();
      await overviewPage.goto();

      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
      const layoutWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(layoutWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
    },
  );
});
