import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

export class RequestLoanPage extends BasePage {
  protected readonly path = 'requestloan.htm';

  readonly amount: Locator;
  readonly downPayment: Locator;
  readonly fromAccount: Locator;
  readonly applyButton: Locator;
  readonly result: Locator;
  readonly loanStatus: Locator;
  readonly loanProvider: Locator;
  readonly newAccountId: Locator;
  readonly deniedMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.amount = page.locator('#amount');
    this.downPayment = page.locator('#downPayment');
    this.fromAccount = page.locator('#fromAccountId');
    this.applyButton = page.getByRole('button', { name: 'Apply Now' });
    this.result = page.locator('#requestLoanResult');
    this.loanStatus = page.locator('#loanStatus');
    this.loanProvider = page.locator('#loanProviderName');
    this.newAccountId = page.locator('#loanRequestApproved #newAccountId');
    this.deniedMessage = page.locator('#loanRequestDenied .error');
  }

  async apply(amount: string, downPayment: string, fromAccountId: number): Promise<void> {
    await this.amount.fill(amount);
    await this.downPayment.fill(downPayment);
    await expect(this.fromAccount.locator(`option[value="${fromAccountId}"]`)).toBeAttached();
    await this.fromAccount.selectOption(String(fromAccountId));
    await this.applyButton.click();
  }
}
