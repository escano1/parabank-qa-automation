import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';
import type { AccountType } from '../api/types';

export class OpenAccountPage extends BasePage {
  protected readonly path = 'openaccount.htm';

  readonly accountType: Locator;
  readonly fromAccount: Locator;
  readonly openButton: Locator;
  readonly newAccountId: Locator;

  constructor(page: Page) {
    super(page);
    this.accountType = page.locator('#type');
    this.fromAccount = page.locator('#fromAccountId');
    this.openButton = page.getByRole('button', { name: 'Open New Account' });
    this.newAccountId = page.locator('#newAccountId');
  }

  /** Abre la cuenta y devuelve el número asignado. */
  async open(type: Exclude<AccountType, 'LOAN'>, fromAccountId: number): Promise<number> {
    await this.accountType.selectOption({ label: type });
    // Las opciones del select se cargan por AJAX.
    await expect(this.fromAccount.locator(`option[value="${fromAccountId}"]`)).toBeAttached();
    await this.fromAccount.selectOption(String(fromAccountId));
    await this.openButton.click();
    await expect(this.newAccountId).toHaveText(/^\d+$/);
    return Number(await this.newAccountId.innerText());
  }
}
