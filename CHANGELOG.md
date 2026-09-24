# Changelog

La versión que corre en producción se muestra en la pantalla de carga (`v1.0.0`) y sale de `version` en `package.json`, inyectada al bundle por `vite.config.js`.

## Cómo se numera

Cada PR que se mergea sube la versión antes de mergear:

- `fix:` → sube el patch (1.0.0 → 1.0.1)
- `feat:` → sube el minor (1.0.1 → 1.1.0)
- Cambio que rompe datos o exige migración manual → sube el major (1.1.0 → 2.0.0)

Se toca `package.json` y se agrega la entrada acá, en el mismo commit del PR.

## 1.1.1 — 2026-09-23

- **El panel de préstamos viejos ya no insiste.** Antes no había forma de decirle "este está bien así": un préstamo que no querías corregir volvía a aparecer cada vez que abrías la app. Ahora hay botón **"Están bien, no preguntar más"**, y los que dejes desmarcados al corregir se dan por buenos (campo `sinDesembolso` en la deuda).
- Registrar un préstamo con el toggle de desembolso apagado ya no lo deja como pendiente del panel: apagarlo significa que el movimiento ya existe, y así queda guardado.

## 1.1.0 — 2026-09-23

- **Tarjetas de crédito, modelo completo.** Cada tarjeta muestra sus tres números separados: cupo total, deuda total (lo que debés hoy) y disponible (cupo − deuda). Cada gasto con la tarjeta sube la deuda total, como siempre.
- **Deuda del mes y pago del ciclo.** Nueva "deuda de este mes" declarada por vos (campo `deudaMesActual`). Al pagarla, el monto sale de la cuenta que elijas, la deuda del mes baja a cero y la app te pregunta cuánto te cobran el mes siguiente. Si pagás de menos, queda el resto pendiente en vez de saltar de ciclo.
- El campo viejo `cuotaMensualManual` queda migrado a `deudaMesActual` al guardar la tarjeta; mientras no declares el valor, se sigue estimando por las cuotas de tus compras y se muestra marcado como "(estimado)".

## 1.0.0 — 2026-09-23

Línea base. Numera todo lo que ya estaba en producción (PR #1 al #58), que hasta acá se desplegó sin versión visible.

Qué hay en esta versión:

- **Inicio** — balance total y desglose por tipo de cuenta, gráfica, facturas próximas, presupuestos en riesgo, deudas y ahorro, notas
- **Movimientos** — ingresos/gastos con filtros, escaneo de recibos con IA, dictado por voz, export CSV
- **Cuentas** — CRUD, saldo calculado, transferencias, conciliación de saldo, 4x1000 automático
- **Facturas** — pagos fijos recurrentes con histórico y estimado autoactualizable, más préstamos y deudas
- **Conf** — moneda (COP/USD) y categorías editables
- Perfiles privados por usuario (cada documento con su `uid`) y panel de usuarios autorizados
- Versión visible en la pantalla de carga (este cambio)
