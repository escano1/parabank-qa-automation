import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';
import { parseMoney } from '../utils/money';

export class AccountsOverviewPage extends BasePage {
  protected readonly path = 'overview.htm';

  readonly table: Locator;
  readonly accountRows: Locator;
  readonly totalRow: Locator;

  constructor(page: Page) {
    super(page);
    this.table = page.locator('#accountTable');
    // Las filas de cuentas tienen link; la fila "Total" no.
    this.accountRows = this.table.locator('tbody tr').filter({ has: page.getByRole('link') });
    this.totalRow = this.table.locator('tbody tr').filter({ hasText: 'Total' });
  }

  /** La tabla se llena por AJAX: la fila Total es la última en llegar. */
  async waitForLoaded(): Promise<void> {
    await expect(this.totalRow).toBeVisible();
  }

  rowFor(accountId: number): Locator {
    return this.accountRows.filter({ has: this.page.getByRole('link', { name: String(accountId), exact: true }) });
  }

  async accountIds(): Promise<number[]> {
    await this.waitForLoaded();
    const ids = await this.accountRows.getByRole('link').allInnerTexts();
    return ids.map(Number);
  }

  /** Saldo en centavos. */
  async balanceOf(accountId: number): Promise<number> {
    await this.waitForLoaded();
    return parseMoney(await this.rowFor(accountId).locator('td').nth(1).innerText());
  }

  /** Total en centavos. */
  async total(): Promise<number> {
    await this.waitForLoaded();
    return parseMoney(await this.totalRow.locator('td').nth(1).innerText());
  }

  async openActivity(accountId: number): Promise<void> {
    await this.rowFor(accountId).getByRole('link').click();
  }
}
