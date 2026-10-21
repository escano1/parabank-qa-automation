import Ajv, { type JSONSchemaType } from 'ajv';
import { expect } from '@playwright/test';
import type { Account, Customer, LoanResponse, Transaction } from './types';

/**
 * Contratos JSON de la API REST. Un cambio de tipo o un campo faltante rompe el test
 * aunque el status code siga siendo 200.
 */
const ajv = new Ajv({ allErrors: true });

const addressSchema = {
  type: 'object',
  required: ['street', 'city', 'state', 'zipCode'],
  properties: {
    street: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zipCode: { type: 'string' },
  },
} as const;

export const customerSchema: JSONSchemaType<Customer> = {
  type: 'object',
  required: ['id', 'firstName', 'lastName', 'address', 'phoneNumber', 'ssn'],
  properties: {
    id: { type: 'integer' },
    firstName: { type: 'string', minLength: 1 },
    lastName: { type: 'string', minLength: 1 },
    address: addressSchema,
    phoneNumber: { type: 'string' },
    ssn: { type: 'string' },
  },
};

export const accountSchema: JSONSchemaType<Account> = {
  type: 'object',
  required: ['id', 'customerId', 'type', 'balance'],
  properties: {
    id: { type: 'integer' },
    customerId: { type: 'integer' },
    type: { type: 'string', enum: ['CHECKING', 'SAVINGS', 'LOAN'] },
    balance: { type: 'number' },
  },
};

export const accountListSchema: JSONSchemaType<Account[]> = { type: 'array', items: accountSchema };

export const transactionSchema: JSONSchemaType<Transaction> = {
  type: 'object',
  required: ['id', 'accountId', 'type', 'date', 'amount', 'description'],
  properties: {
    id: { type: 'integer' },
    accountId: { type: 'integer' },
    type: { type: 'string', enum: ['Debit', 'Credit'] },
    date: { type: 'integer' },
    amount: { type: 'number' },
    description: { type: 'string' },
  },
};

export const transactionListSchema: JSONSchemaType<Transaction[]> = { type: 'array', items: transactionSchema };

export const loanResponseSchema: JSONSchemaType<LoanResponse> = {
  type: 'object',
  required: ['responseDate', 'loanProviderName', 'approved'],
  properties: {
    responseDate: { type: 'integer' },
    loanProviderName: { type: 'string' },
    approved: { type: 'boolean' },
    message: { type: 'string', nullable: true },
    accountId: { type: 'integer', nullable: true },
  },
};

/** Valida `data` contra el schema y, si falla, muestra en el reporte qué campos rompieron el contrato. */
export function expectSchema<T>(data: unknown, schema: JSONSchemaType<T>): asserts data is T {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  expect(valid, `Contrato inválido:\n${ajv.errorsText(validate.errors, { separator: '\n' })}`).toBe(true);
}
