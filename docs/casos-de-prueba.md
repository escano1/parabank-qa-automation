# Casos y escenarios de prueba

Cada caso tiene un **ID trazable** que aparece en el título del test automatizado (`[TC-XXX-000]`).
Para ejecutar uno puntual: `npx playwright test --grep "TC-TRF-001"`.

**Prioridad**: P1 = crítico para el negocio · P2 = alto · P3 = medio.
**Estado**: ✅ automatizado y pasando · 🐞 automatizado, documenta un defecto conocido (`test.fail`).

## Escenarios clave (Gherkin)

```gherkin
Característica: Transferencias entre cuentas propias

  Antecedentes:
    Dado un cliente autenticado con una cuenta corriente con saldo de $500.00
    Y una cuenta de ahorros con saldo de $100.00

  @critical @smoke
  Escenario: Transferencia exitosa actualiza ambos saldos           # TC-TRF-001 / TC-API-020
    Cuando transfiere $25.50 de la cuenta corriente a la de ahorros
    Entonces ve la confirmación "Transfer Complete!" con monto y cuentas
    Y el saldo de la cuenta corriente es $474.50
    Y el saldo de la cuenta de ahorros es $125.50
    Y existe un débito "Funds Transfer Sent" y un crédito "Funds Transfer Received"

  Esquema del escenario: Montos inválidos son rechazados sin mover fondos   # TC-API-023
    Cuando intenta transferir <monto>
    Entonces la operación es rechazada
    Y los saldos no cambian
    Ejemplos:
      | monto        | defecto  |
      | -50.00       | BUG-001  |
      | 0.00         | BUG-002  |
      | 5000.00      | BUG-004  |
```

```gherkin
Característica: Seguridad de la API

  @critical
  Escenario: Un usuario anónimo no puede consultar cuentas ajenas     # TC-API-025 (BUG-005)
    Dado que no envío credenciales ni sesión
    Cuando consulto GET /accounts/{id} de otro cliente
    Entonces recibo 401 o 403
    Y no se expone el saldo
```

```gherkin
Característica: Registro de clientes

  Escenario: Nombres con caracteres del español                       # TC-AUTH-008 (BUG-008)
    Cuando me registro con nombre "José Núñez" y dirección "Vía Pública 123", "Bogotá"
    Entonces mi cuenta se crea correctamente
```

## Matriz de casos

### Autenticación y registro — UI (`tests/e2e/auth.spec.ts`)

| ID          | Caso                                                                         | Prioridad | Tipo                   | Estado     |
| ----------- | ---------------------------------------------------------------------------- | --------- | ---------------------- | ---------- |
| TC-AUTH-001 | Registro exitoso de cliente nuevo (desktop + Android + iOS)                  | P1        | Positivo               | ✅         |
| TC-AUTH-002 | Formulario vacío muestra los 10 campos obligatorios                          | P3        | Validación             | ✅         |
| TC-AUTH-003 | Username duplicado es rechazado                                              | P2        | Negativo               | ✅         |
| TC-AUTH-004 | Confirmación de contraseña distinta                                          | P3        | Validación             | ✅         |
| TC-AUTH-005 | Login exitoso (desktop + Android + iOS)                                      | P1        | Positivo               | ✅         |
| TC-AUTH-006 | Login rechazado: contraseña incorrecta / usuario inexistente / campos vacíos | P1        | Negativo (data-driven) | ✅         |
| TC-AUTH-007 | Logout cierra la sesión                                                      | P2        | Positivo               | ✅         |
| TC-AUTH-008 | Registro con tildes y eñes                                                   | P2        | i18n                   | 🐞 BUG-008 |
| TC-AUTH-009 | Campo que excede su longitud no se reporta como username duplicado           | P3        | Valores límite         | 🐞 BUG-012 |

### Cuentas — UI (`tests/e2e/accounts.spec.ts`)

| ID         | Caso                                                                | Prioridad | Tipo                   | Estado |
| ---------- | ------------------------------------------------------------------- | --------- | ---------------------- | ------ |
| TC-ACC-001 | Resumen de cuentas: el total coincide con la suma de saldos         | P1        | Positivo               | ✅     |
| TC-ACC-002 | Apertura de cuenta CHECKING / SAVINGS por UI, verificada en backend | P1        | Positivo (data-driven) | ✅     |

### Transferencias y pagos — UI

| ID          | Caso                                                                | Prioridad | Tipo       | Estado     |
| ----------- | ------------------------------------------------------------------- | --------- | ---------- | ---------- |
| TC-TRF-001  | Transferencia exitosa actualiza origen y destino (desktop + mobile) | P1        | Positivo   | ✅         |
| TC-TRF-002  | Monto vacío / no numérico muestra validación                        | P2        | Validación | 🐞 BUG-006 |
| TC-BILL-001 | Pago de servicio debita el monto exacto                             | P1        | Positivo   | ✅         |
| TC-BILL-002 | Formulario de pago vacío muestra campos obligatorios                | P3        | Validación | ✅         |
| TC-BILL-003 | Verificación de cuenta del beneficiario no coincide                 | P2        | Negativo   | ✅         |

### Préstamos — UI

| ID          | Caso                                           | Prioridad | Tipo     | Estado |
| ----------- | ---------------------------------------------- | --------- | -------- | ------ |
| TC-LOAN-001 | Préstamo aprobado crea cuenta LOAN del cliente | P2        | Positivo | ✅     |
| TC-LOAN-002 | Préstamo rechazado por fondos insuficientes    | P2        | Negativo | ✅     |

### Mobile web (`tests/e2e/mobile.spec.ts`, proyectos `mobile-android` / `mobile-ios`)

| ID         | Caso                                               | Prioridad | Tipo       | Estado     |
| ---------- | -------------------------------------------------- | --------- | ---------- | ---------- |
| TC-MOB-001 | Navegación por el menú de servicios en dispositivo | P2        | Positivo   | ✅         |
| TC-MOB-002 | La página declara un viewport responsive           | P2        | Usabilidad | 🐞 BUG-007 |

### API REST (`tests/api/rest`)

| ID         | Caso                                                                | Prioridad | Tipo                   | Estado          |
| ---------- | ------------------------------------------------------------------- | --------- | ---------------------- | --------------- |
| TC-API-001 | Login válido devuelve el cliente (schema)                           | P1        | Contrato               | ✅              |
| TC-API-002 | Login inválido → 400                                                | P2        | Negativo               | ✅              |
| TC-API-003 | El cliente persiste exactamente los datos del registro              | P2        | Integridad             | ✅              |
| TC-API-004 | Cliente inexistente → 400                                           | P3        | Negativo               | ✅              |
| TC-API-010 | Listado de cuentas cumple el contrato y pertenece al cliente        | P1        | Contrato               | ✅              |
| TC-API-011 | Crear cuenta CHECKING / SAVINGS debita $100 del origen              | P2        | Integridad             | ✅              |
| TC-API-012 | Cuenta inexistente → 400                                            | P3        | Negativo               | ✅              |
| TC-API-013 | Historial de transacciones cumple el contrato                       | P2        | Contrato               | ✅              |
| TC-API-014 | La respuesta de createAccount refleja el saldo real                 | P3        | Contrato               | 🐞 BUG-010      |
| TC-API-015 | 30 aperturas concurrentes no fallan                                 | P1        | Concurrencia           | 🐞 BUG-011      |
| TC-API-020 | Transferencia mueve el monto exacto y deja débito/crédito           | P1        | Integridad             | ✅              |
| TC-API-021 | Depósito y retiro ajustan el saldo                                  | P2        | Integridad             | ✅              |
| TC-API-022 | Transferencia a cuenta inexistente → 400 sin mover fondos           | P2        | Negativo               | ✅              |
| TC-API-023 | Rechazar transferencias: negativo / cero / sobregiro / misma cuenta | P1        | Negativo (data-driven) | 🐞 BUG-001..004 |
| TC-API-024 | Rechazar retiro negativo                                            | P1        | Negativo               | 🐞 BUG-001      |
| TC-API-025 | La API exige autenticación                                          | P1        | Seguridad              | 🐞 BUG-005      |
| TC-API-030 | Préstamo aprobado crea cuenta LOAN con el monto solicitado          | P2        | Positivo               | ✅              |
| TC-API-031 | Préstamo rechazado por fondos insuficientes                         | P2        | Negativo               | ✅              |
| TC-API-032 | Pago inicial mayor al saldo de la cuenta origen                     | P2        | Negativo               | 🐞 BUG-009      |

### API SOAP (`tests/api/soap`)

| ID          | Caso                                               | Prioridad | Tipo         | Estado |
| ----------- | -------------------------------------------------- | --------- | ------------ | ------ |
| TC-SOAP-001 | El WSDL publica las operaciones críticas           | P2        | Contrato     | ✅     |
| TC-SOAP-002 | Login válido                                       | P1        | Positivo     | ✅     |
| TC-SOAP-003 | Login inválido → SOAP Fault                        | P2        | Negativo     | ✅     |
| TC-SOAP-004 | getAccount SOAP = REST                             | P2        | Consistencia | ✅     |
| TC-SOAP-005 | getAccounts devuelve colección aun con un elemento | P3        | Contrato     | ✅     |
| TC-SOAP-006 | Depósito por SOAP se refleja en REST               | P1        | Consistencia | ✅     |
| TC-SOAP-007 | Cuenta inexistente → SOAP Fault                    | P3        | Negativo     | ✅     |

### Performance (`performance/k6`)

| ID       | Escenario                                                                 | Carga      | SLO / thresholds                                                             |
| -------- | ------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| PERF-001 | Smoke: login, cuentas, SOAP getAccount                                    | 1 VU · 30s | p95 < 1s · errores < 1% · checks > 99%                                       |
| PERF-002 | Carga mixta: 80% consultas (rampa a 16 VUs) + 20% transferencias (4 tx/s) | ~2 min     | p95 consultas < 800ms · p95 transferencia < 1.5s · p99 < 2.5s · errores < 1% |

## Fuera del alcance de la automatización (pruebas manuales / exploratorias)

- Accesibilidad completa (lectores de pantalla, contraste). Se recomienda sumar `@axe-core/playwright` como siguiente paso.
- Compatibilidad en dispositivos reales. La emulación no reemplaza el hardware real.
- Acceso a páginas protegidas sin sesión: hoy muestra "internal error" en lugar de redirigir al login (observación de usabilidad, sin test).
