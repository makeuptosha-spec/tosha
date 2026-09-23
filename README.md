# Mis Finanzas

App personal de control financiero — React + Vite + Firebase.

## Funcionalidades

- **Movimientos** — registro de ingresos y gastos por categoría, con filtros por fecha, tipo y categoría
- **Cuentas** — efectivo, banco, tarjetas de crédito, ahorros. Saldo calculado en tiempo real, transferencias entre cuentas
- **Facturas recurrentes** — pagos fijos mensuales (arriendo, servicios, suscripciones) con estado pagada/pendiente/vencida
- **Presupuestos** — límite mensual por categoría con barra de progreso
- **Escaneo de recibos con IA** — sube una foto o PDF de un recibo/factura y Groq Vision extrae comercio, monto, fecha y categoría sugerida automáticamente

## Stack

- React 19 + Vite
- Firebase (Auth + Firestore + Hosting)
- Groq para lectura de recibos y dictado por voz — los modelos vigentes viven en `GROQ_MODELO_VISION` / `GROQ_MODELO_TEXTO` (`src/utils.jsx`), porque Groq retira modelos viejos sin aviso

## Versión

La versión corre desde `version` en `package.json`, `vite.config.js` la inyecta al bundle y la pantalla de carga la muestra abajo del texto de "Cargando tus finanzas...". Cada PR la sube antes de mergear (`fix:` sube el patch, `feat:` el minor) y deja su entrada en [`CHANGELOG.md`](CHANGELOG.md).

## Desarrollo local

```bash
npm install
npm run dev
```

Requiere un archivo `.env` con las variables de Firebase y `VITE_GROQ_API_KEY` (ver `.env.example`).

## Modelo de datos (Firestore)

- `cuentas` — billeteras/cuentas del usuario
- `movimientos` — ingresos, gastos y transferencias
- `facturasRecurrentes` — plantillas de pagos fijos mensuales
- `pagosFactura` — registro de pago por mes de cada factura recurrente
- `presupuestos` — límite mensual por categoría
- `borradores` — recibos escaneados por IA pendientes de confirmar
- `notas` — notas libres

Reglas de seguridad en `firestore.rules` — solo usuarios autenticados pueden leer/escribir.

## Deploy

Push a `master` dispara el deploy automático a Firebase Hosting vía GitHub Actions (`.github/workflows/firebase-hosting-merge.yml`).
