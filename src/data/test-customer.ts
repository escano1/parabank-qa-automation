import fs from 'node:fs';
import path from 'node:path';
import type { NewCustomer } from './customer-factory';

export interface RegisteredCustomer extends NewCustomer {
  id: number;
  /** Cuenta CHECKING que ParaBank crea automáticamente al registrarse. */
  primaryAccountId: number;
}

export const AUTH_DIR = '.auth';
export const CUSTOMER_FILE = path.join(AUTH_DIR, 'customer.json');
export const SESSION_FILE = path.join(AUTH_DIR, 'session.json');

export function saveCustomer(customer: RegisteredCustomer): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(CUSTOMER_FILE, JSON.stringify(customer, null, 2));
}

export function loadCustomer(): RegisteredCustomer {
  if (!fs.existsSync(CUSTOMER_FILE)) {
    throw new Error(`No existe ${CUSTOMER_FILE}. Ejecuta los tests a través de un proyecto que dependa de "setup".`);
  }
  return JSON.parse(fs.readFileSync(CUSTOMER_FILE, 'utf-8')) as RegisteredCustomer;
}
