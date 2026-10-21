# Reporte de defectos

Hallazgos de las sesiones exploratorias y la automatización sobre ParaBank (imagen Docker `parasoft/parabank:latest`, 6.0.0-SNAPSHOT, y demo público).
Todos están **reproducidos por un test automatizado** marcado con `test.fail()`, que falla el build si el defecto se corrige sin actualizar la suite.

## Resumen

| ID      | Título                                                                  | Severidad  | Componente               | Test                   |
| ------- | ----------------------------------------------------------------------- | ---------- | ------------------------ | ---------------------- |
| BUG-005 | La API REST no requiere autenticación (BOLA/IDOR)                       | 🔴 Crítica | Seguridad / API          | TC-API-025             |
| BUG-004 | Se permiten transferencias sin fondos (sobregiro ilimitado)             | 🔴 Crítica | Transferencias           | TC-API-023             |
| BUG-001 | Montos negativos aceptados en transferencias y retiros                  | 🔴 Crítica | Transferencias / Retiros | TC-API-023, TC-API-024 |
| BUG-011 | Generación de ids no atómica: fallas con requests concurrentes          | 🔴 Crítica | Persistencia             | TC-API-015             |
| BUG-008 | Registro falla (HTTP 400) con tildes y eñes                             | 🟠 Alta    | Registro / i18n          | TC-AUTH-008            |
| BUG-009 | Préstamo aprobado aunque la cuenta origen no cubre el pago inicial      | 🟠 Alta    | Préstamos                | TC-API-032             |
| BUG-003 | Transferencia a la misma cuenta origen/destino aceptada                 | 🟡 Media   | Transferencias           | TC-API-023             |
| BUG-006 | Monto vacío/no numérico muestra "internal error" en lugar de validación | 🟡 Media   | UI Transferencias        | TC-TRF-002             |
| BUG-007 | Sin viewport responsive en mobile                                       | 🟡 Media   | UI Mobile                | TC-MOB-002             |
| BUG-002 | Transferencia de $0 aceptada y registrada                               | 🟢 Baja    | Transferencias           | TC-API-023             |
| BUG-010 | `createAccount` responde `balance: 0` aunque la cuenta queda con $100   | 🟢 Baja    | API                      | TC-API-014             |
| BUG-012 | Campo más largo que su columna se reporta como "username ya existe"     | 🟡 Media   | Registro                 | TC-AUTH-009            |

---

### BUG-005 — La API REST no requiere autenticación (BOLA/IDOR)

- **Severidad**: Crítica · **Tipo**: Seguridad (OWASP API1:2023 Broken Object Level Authorization)
- **Pasos**:
  1. Sin sesión ni credenciales: `GET /parabank/services/bank/accounts/{id}` con el id de una cuenta de otro cliente.
- **Resultado actual**: `200 OK` con número de cuenta, titular y saldo. Lo mismo ocurre con `/customers/{id}` (incluye SSN) y con las operaciones de escritura (`/transfer`, `/withdraw`).
- **Resultado esperado**: `401 Unauthorized` sin sesión, y `403 Forbidden` si la cuenta no pertenece al usuario autenticado.
- **Impacto**: cualquier persona puede enumerar ids secuenciales, leer saldos y datos personales y **mover dinero de cuentas ajenas**.

### BUG-004 — Transferencias sin fondos (sobregiro ilimitado)

- **Severidad**: Crítica
- **Pasos**: cuenta con saldo $100 → `POST /transfer?fromAccountId=A&toAccountId=B&amount=5000`.
- **Actual**: `200 Successfully transferred $5000`; el saldo de A queda en **-$4,900**.
- **Esperado**: rechazo por fondos insuficientes, sin movimientos.
- **Evidencia**: en exploración, una transferencia de $99,999 dejó una cuenta en -$99,533.50.

### BUG-001 — Montos negativos aceptados

- **Severidad**: Crítica
- **Pasos**: `POST /transfer?...&amount=-50` o `POST /withdraw?accountId=A&amount=-25`.
- **Actual**: `200`. La transferencia negativa **mueve dinero del destino al origen**, y el retiro negativo **aumenta** el saldo.
- **Esperado**: `400`; el monto debe ser estrictamente positivo.
- **Impacto**: un usuario puede "retirar" saldo de una cuenta ajena (combinado con BUG-005) o generarse saldo propio.

### BUG-011 — Generación de ids no atómica (condición de carrera)

- **Severidad**: Crítica · **Tipo**: Concurrencia
- **Pasos**: 30 `POST /createAccount` concurrentes para el mismo cliente (`TC-API-015`).
- **Actual**: parte de las solicitudes falla con `Could not create new account...`. En el log del servidor aparece `DuplicateKeyException ... INSERT INTO Account` y `CannotAcquireLockException`.
- **Causa raíz** (código fuente, `JdbcSequenceDao.getNextId`): el id se obtiene con un `SELECT next_id` seguido de un `UPDATE next_id = next_id + 1`, sin transacción ni bloqueo. Dos requests simultáneos leen el mismo valor.
- **Impacto**: con usuarios reales concurrentes fallan aperturas de cuenta, registros y movimientos, que comparten la misma tabla de secuencias.
- **Sugerencia**: usar secuencias nativas / `IDENTITY` de la base o un `UPDATE ... RETURNING` atómico.
- **Nota para la suite**: este defecto obliga a ejecutar con **1 worker por instancia**. Ver [estrategia-de-pruebas.md](estrategia-de-pruebas.md#6-ambientes).

### BUG-008 — Registro con tildes y eñes falla

- **Severidad**: Alta · **Tipo**: Internacionalización
- **Pasos**: en `register.htm` completar nombre "José Núñez", dirección "Vía Pública 123", ciudad "Bogotá" → Register.
- **Actual**: página de error de Tomcat **HTTP 400** — `Character decoding failed. Parameter [customer.address.street]`.
- **Esperado**: registro exitoso.
- **Impacto**: en un banco de la región **una gran parte de los clientes no podría registrarse**.

### BUG-009 — Préstamo aprobado sin fondos en la cuenta del pago inicial

- **Severidad**: Alta
- **Pasos**: cuenta con $100 → `POST /requestLoan?amount=2000&downPayment=500&fromAccountId=<esa cuenta>`.
- **Actual**: `approved: true`; la cuenta origen queda en negativo.
- **Esperado**: rechazo; el pago inicial debe estar cubierto por la cuenta seleccionada.
- **Nota**: con el procesador por defecto ("Available Funds") se evalúan los fondos totales del cliente, no los de la cuenta.

### BUG-003 — Transferencia a la misma cuenta

- **Severidad**: Media
- **Actual**: `200` y se registran un débito y un crédito por el mismo monto en la misma cuenta. Ensucia el historial y la conciliación.
- **Esperado**: `400` "La cuenta de origen y destino deben ser distintas". La UI tampoco lo impide.

### BUG-006 — Validación de monto en la UI de transferencias

- **Severidad**: Media
- **Pasos**: Transfer Funds → dejar el monto vacío (o escribir "abc") → Transfer.
- **Actual**: pantalla "Error! An internal error has occurred and has been logged."
- **Esperado**: los mensajes de campo que ya existen en el HTML ("The amount cannot be empty." / "Please enter a valid amount.").

### BUG-007 — Sin viewport responsive en mobile

- **Severidad**: Media · **Tipo**: Usabilidad mobile
- **Actual**: no existe `<meta name="viewport">`. En un iPhone 14 / Pixel 7 se renderiza el layout de escritorio (~980px) reducido, con textos y objetivos táctiles muy por debajo de 44×44 px.
- **Esperado**: layout adaptado al ancho del dispositivo.

### BUG-002 — Transferencia de $0

- **Severidad**: Baja
- **Actual**: `200` y se registran movimientos de $0.00.
- **Esperado**: `400`.

### BUG-010 — Saldo desactualizado en la respuesta de createAccount

- **Severidad**: Baja · **Tipo**: Contrato
- **Actual**: `POST /createAccount` responde `"balance": 0`, pero un `GET` inmediato muestra `100.00`.
- **Esperado**: la respuesta refleja el estado persistido.
- **Impacto**: un cliente de la API (por ejemplo la app móvil) mostraría un saldo incorrecto tras abrir la cuenta.

### BUG-012 — Error de longitud reportado como "username ya existe"

- **Severidad**: Media · **Tipo**: Validación / valores límite
- **Pasos**: registrar un cliente con ciudad "Las Palmas de Gran Canaria" (26 caracteres) y un username nuevo.
- **Actual**: el formulario muestra **"This username already exists."** junto al campo username, y el registro no se crea.
- **Causa raíz**: la columna `city` es `VARCHAR(20)` (también `address` 45 y nombres 30) y el formulario no valida longitudes. `RegisterCustomerController` atrapa **cualquier** `DataIntegrityViolationException` y la traduce siempre a "username ya existe".
- **Esperado**: validación de longitud máxima por campo con un mensaje claro, sin culpar al username.
- **Impacto**: el usuario no puede registrarse y recibe un diagnóstico falso, lo que genera tickets de soporte. Ciudades y direcciones reales de la región superan esos límites.
