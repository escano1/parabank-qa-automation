import { fakerES as faker } from '@faker-js/faker';

export interface NewCustomer {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  ssn: string;
  username: string;
  password: string;
}

/** Usuario único por ejecución: evita colisiones en un ambiente compartido y entre workers paralelos. */
export function uniqueUsername(prefix = 'qa'): string {
  return `${prefix}${Date.now().toString(36)}${faker.string.alphanumeric(4).toLowerCase()}`;
}

/**
 * Quita tildes, eñes y cualquier otro carácter no ASCII (ej. "5º"): ParaBank responde HTTP 400
 * con caracteres no ASCII en el registro (BUG-008). Los datos del camino feliz se mantienen ASCII;
 * el defecto se cubre en un test dedicado.
 */
export function toAscii(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\x20-\x7E]/g, '');
}

/**
 * Límites de las columnas de la tabla Customer. El formulario no los valida y un valor más largo
 * termina en el mensaje engañoso "This username already exists." (BUG-012).
 */
export const FIELD_LIMITS = { name: 30, street: 45, city: 20, state: 20 } as const;

function field(value: string, maxLength: number): string {
  return toAscii(value).slice(0, maxLength).trim();
}

export function buildCustomer(overrides: Partial<NewCustomer> = {}): NewCustomer {
  return {
    firstName: field(faker.person.firstName(), FIELD_LIMITS.name),
    lastName: field(faker.person.lastName(), FIELD_LIMITS.name),
    street: field(faker.location.streetAddress(), FIELD_LIMITS.street),
    city: field(faker.location.city(), FIELD_LIMITS.city),
    state: field(faker.location.state({ abbreviated: true }), FIELD_LIMITS.state),
    zipCode: faker.location.zipCode('#####'),
    phoneNumber: faker.string.numeric(10),
    ssn: faker.string.numeric({ length: 9 }).replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3'),
    username: uniqueUsername(),
    password: `Qa!${faker.internet.password({ length: 10 })}`,
    ...overrides,
  };
}

/** Mapea el cliente a los nombres de campo del formulario de registro de ParaBank. */
export function toRegistrationForm(c: NewCustomer): Record<string, string> {
  return {
    'customer.firstName': c.firstName,
    'customer.lastName': c.lastName,
    'customer.address.street': c.street,
    'customer.address.city': c.city,
    'customer.address.state': c.state,
    'customer.address.zipCode': c.zipCode,
    'customer.phoneNumber': c.phoneNumber,
    'customer.ssn': c.ssn,
    'customer.username': c.username,
    'customer.password': c.password,
    repeatedPassword: c.password,
  };
}
