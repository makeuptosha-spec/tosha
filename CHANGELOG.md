# Changelog

La versión que corre en producción se muestra en la pantalla de carga (`v1.0.0`) y sale de `version` en `package.json`, inyectada al bundle por `vite.config.js`.

## Cómo se numera

Cada PR que se mergea sube la versión antes de mergear:

- `fix:` → sube el patch (1.0.0 → 1.0.1)
- `feat:` → sube el minor (1.0.1 → 1.1.0)
- Cambio que rompe datos o exige migración manual → sube el major (1.1.0 → 2.0.0)

Se toca `package.json` y se agrega la entrada acá, en el mismo commit del PR.

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
