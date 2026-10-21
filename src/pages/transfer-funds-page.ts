import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

export class TransferFundsPage extends BasePage {
  protected readonly path = 'transfer.htm';

  readonly amount: Locator;
  readonly fromAccount: Locator;
  readonly toAccount: Locator;
  readonly transferButton: Locator;
  readonly result: Locator;
  readonly amountResult: Locator;
  readonly fromAccountResult: Locator;
  readonly toAccountResult: Locator;
  readonly amountError: Locator;

  constructor(page: Page) {
    super(page);
    this.amount = page.locator('#amount');
    this.fromAccount = page.locator('#fromAccountId');
    this.toAccount = page.locator('#toAccountId');
    this.transferButton = page.getByRole('button', { name: 'Transfer' });
    this.result = page.locator('#showResult');
    this.amountResult = page.locator('#amountResult');
    this.fromAccountResult = page.locator('#fromAccountIdResult');
    this.toAccountResult = page.locator('#toAccountIdResult');
    this.amountError = page.locator('#rightPanel .error').locator('visible=true');
  }

  async transfer(amount: string, fromAccountId: number, toAccountId: number): Promise<void> {
    await expect(this.toAccount.locator(`option[value="${toAccountId}"]`)).toBeAttached();
    await this.amount.fill(amount);
    await this.fromAccount.selectOption(String(fromAccountId));
    await this.toAccount.selectOption(String(toAccountId));
    await this.transferButton.click();
  }
}
