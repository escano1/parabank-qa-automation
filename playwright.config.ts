import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const isCI = !!process.env.CI;
const baseURL = process.env.BASE_URL ?? 'http://localhost:8080/parabank/';
const isPublicDemo = baseURL.includes('parabank.parasoft.com');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  // Un reintento en CI absorbe inestabilidad de red; el trace del reintento queda guardado para analizar flaky tests.
  retries: isCI ? 1 : 0,
  // Un worker por instancia de ParaBank: su generador de ids no es atómico (BUG-011) y las escrituras
  // concurrentes fallan aleatoriamente. El paralelismo se obtiene en CI con un job + contenedor por proyecto.
  // Además el demo público tiene rate limiting (Cloudflare).
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 1,
  // Contra el demo público los clientes API pueden esperar el Retry-After de un 429.
  timeout: isPublicDemo ? 180_000 : 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'api',
      testDir: './tests/api',
      grepInvert: /@concurrency/,
      dependencies: ['setup'],
    },
    {
      name: 'e2e-chromium',
      testDir: './tests/e2e',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-android',
      testDir: './tests/e2e',
      grep: /@mobile/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-ios',
      testDir: './tests/e2e',
      grep: /@mobile/,
      dependencies: ['setup'],
      use: { ...devices['iPhone 14'] },
    },
    {
      // Las pruebas de concurrencia saturan a propósito la generación de ids de ParaBank (BUG-011).
      // Proyecto aparte para poder ejecutarlas/excluirlas explícitamente; con 1 worker nunca se solapan con otros tests.
      name: 'concurrency',
      testDir: './tests/api',
      grep: /@concurrency/,
      dependencies: ['setup'],
    },
  ],
});
