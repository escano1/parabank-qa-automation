export type AccountType = 'CHECKING' | 'SAVINGS' | 'LOAN';

/** Códigos que espera la API de ParaBank en `newAccountType`. */
export const ACCOUNT_TYPE_CODE: Record<Exclude<AccountType, 'LOAN'>, number> = {
  CHECKING: 0,
  SAVINGS: 1,
};

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  address: Address;
  phoneNumber: string;
  ssn: string;
}

export interface Account {
  id: number;
  customerId: number;
  type: AccountType;
  balance: number;
}

export interface Transaction {
  id: number;
  accountId: number;
  type: 'Debit' | 'Credit';
  date: number;
  amount: number;
  description: string;
}

export interface LoanResponse {
  responseDate: number;
  loanProviderName: string;
  approved: boolean;
  message?: string;
  accountId?: number;
}
