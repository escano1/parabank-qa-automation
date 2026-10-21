/**
 * Las validaciones de saldos se hacen en centavos (enteros) para no depender
 * de la aritmética de punto flotante: 0.1 + 0.2 !== 0.3.
 */
export function toCents(amount: number | string): number {
  const value = typeof amount === 'number' ? amount : Number(amount.replace(/[$,\s]/g, ''));
  if (Number.isNaN(value)) throw new Error(`Monto inválido: "${amount}"`);
  return Math.round(value * 100);
}

/** "$1,234.50" | "-$20.00" -> centavos */
export function parseMoney(text: string): number {
  const negative = text.trim().startsWith('-');
  const cents = toCents(text.replace('-', ''));
  return negative ? -cents : cents;
}
