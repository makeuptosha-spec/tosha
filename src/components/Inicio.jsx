import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, esEsteMes, hoyObj, StatCard, useTema, colorTema, parseFecha, iconoCuenta } from "../utils.jsx";
import { calcularSaldo, calcularCuotaMensual, diasHasta } from "./Cuentas.jsx";
import { estadoFactura } from "./Facturas.jsx";

const HORA = new Date().getHours();
const SALUDO = HORA < 12 ? "¡Buenos días! ☀️" : HORA < 18 ? "¡Buenas tardes! 💚" : "¡Buenas noches! 🌙";

const fmtCorto = (n) => {
  const num = Number(n);
  if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `${Math.round(num / 1000)}k`;
  return String(num);
};

const HeartDot = ({ cx, cy, color, index }) => {
  if (cx == null || cy == null) return null;
  return (
    <g key={index} transform={`translate(${cx - 6}, ${cy - 6})`}>
      <path d="M6 11s-5-2.9-5-6.2A2.8 2.8 0 0 1 6 3 2.8 2.8 0 0 1 11 4.8C11 8.1 6 11 6 11z" fill={color} stroke="#fff" strokeWidth="1" />
    </g>
  );
};

const COLOR_INGRESO = "#16A34A";
const COLOR_GASTO = "#DC2626";

const TooltipGrafica = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--ink)", color: "#fff", padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
      {label && <div style={{ opacity: 0.75, fontWeight: 500, marginBottom: 4 }}>{label}</div>}
      {payload.map(p => <div key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</div>)}
    </div>
  );
};

// ── GRÁFICA ──
const CustomLineChart = ({ data }) => {
  const [tema] = useTema();
  const c = colorTema(tema);
  if (!data || data.length === 0) return (
    <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mid)", fontSize: 13 }}>
      No hay datos en este periodo
    </div>
  );
  return (
    <div style={{ width: "100%", height: 210, marginTop: 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ingresoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_INGRESO} stopOpacity="0.25" />
              <stop offset="100%" stopColor={COLOR_INGRESO} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gastoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_GASTO} stopOpacity="0.25" />
              <stop offset="100%" stopColor={COLOR_GASTO} stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.texto }} axisLine={{ stroke: c.grid }} tickLine={false} />
          <YAxis domain={[0, "dataMax"]} allowDecimals={false} tickCount={5} tick={{ fontSize: 11, fill: c.texto }} axisLine={false} tickLine={false} tickFormatter={fmtCorto} width={46} />
          <Tooltip content={<TooltipGrafica />} cursor={{ stroke: c.texto, strokeWidth: 1, strokeDasharray: "4 4" }} />
          <Area type="monotone" dataKey="ingreso" name="Ingresos" stroke={COLOR_INGRESO} strokeWidth={2.5} fill="url(#ingresoGrad)" dot={<HeartDot color={COLOR_INGRESO} />} activeDot={{ r: 6 }} />
          <Area type="monotone" dataKey="gasto" name="Gastos" stroke={COLOR_GASTO} strokeWidth={2.5} fill="url(#gastoGrad)" dot={<HeartDot color={COLOR_GASTO} />} activeDot={{ r: 6 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function Inicio({ cuentas, movimientos, facturasRecurrentes, pagosFactura, deudas = [] }) {
  const [filtroGrafica, setFiltroGrafica] = useState("mes");

  const movimientosVisibles = useMemo(() => movimientos.filter(m => m.tipo !== "transferencia"), [movimientos]);

  const cuentasConSaldo = useMemo(() =>
    cuentas.filter(c => c.activa !== false).map(c => ({ ...c, saldo: calcularSaldo(c, movimientos) })),
    [cuentas, movimientos]
  );

  const balanceTotal = useMemo(() =>
    cuentasConSaldo.filter(c => c.tipo !== "tarjeta_credito").reduce((s, c) => s + c.saldo, 0),
    [cuentasConSaldo]
  );

  // ── TARJETAS DE CRÉDITO ──
  const tarjetas = useMemo(() =>
    cuentasConSaldo
      .filter(c => c.tipo === "tarjeta_credito")
      .map(c => ({
        ...c,
        deuda: Math.max(0, -c.saldo),
        cuotaMensual: calcularCuotaMensual(c, movimientos),
        diasCorte: diasHasta(c.fechaCorte),
        diasPago: diasHasta(c.fechaPago),
      })),
    [cuentasConSaldo, movimientos]
  );

  const movMes = movimientosVisibles.filter(m => esEsteMes(m.fecha));
  const ingresosMes = movMes.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const gastosMes = movMes.filter(m => m.tipo === "gasto").reduce((s, m) => s + Number(m.monto), 0);

  // ── FACTURAS PRÓXIMAS ──
  const mes = `${hoyObj.getFullYear()}-${String(hoyObj.getMonth() + 1).padStart(2, "0")}`;
  const facturasProximas = useMemo(() => {
    const diaActual = hoyObj.getDate();
    return facturasRecurrentes
      .filter(f => f.activa !== false)
      .filter(f => !pagosFactura.some(p => p.facturaRecurrenteId === f.id && p.mes === mes && p.pagado))
      .map(f => ({ ...f, diasRestantes: Number(f.diaVencimiento) - diaActual }))
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 5);
  }, [facturasRecurrentes, pagosFactura, mes]);

  // ── RESUMEN FACTURAS RECURRENTES ──
  const resumenFacturas = useMemo(() => {
    const activas = facturasRecurrentes.filter(f => f.activa !== false);
    const conEstado = activas.map(f => ({ ...f, ...estadoFactura(f, pagosFactura) }));
    const pagadas = conEstado.filter(f => f.estado === "pagada").length;
    const totalMes = conEstado.reduce((s, f) => s + Number(f.montoEstimado), 0);
    const totalPendiente = conEstado.filter(f => f.estado !== "pagada").reduce((s, f) => s + Number(f.montoEstimado), 0);
    return { total: activas.length, pagadas, pendientes: activas.length - pagadas, totalMes, totalPendiente };
  }, [facturasRecurrentes, pagosFactura]);

  // ── DEUDAS Y PRÉSTAMOS ──
  const deudasActivas = useMemo(() => deudas.filter(d => d.activa !== false && Number(d.saldoRestante) > 0), [deudas]);
  const totalDebo = deudasActivas.filter(d => d.tipo === "debo").reduce((s, d) => s + Number(d.saldoRestante), 0);
  const totalMeDeben = deudasActivas.filter(d => d.tipo === "me_deben").reduce((s, d) => s + Number(d.saldoRestante), 0);

  // ── GRÁFICA ──
  const datosGrafica = useMemo(() => {
    const hoy = new Date();
    const hace7Dias = new Date(); hace7Dias.setDate(hoy.getDate() - 7);
    const agrupado = {};
    const vFiltro = movimientosVisibles.filter(m => {
      if ((m.tipo !== "ingreso" && m.tipo !== "gasto") || !m.fecha) return false;
      const d = parseFecha(m.fecha);
      if (filtroGrafica === "semana") return d >= hace7Dias;
      if (filtroGrafica === "mes") return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
      return true;
    });
    vFiltro.forEach(m => {
      const d = parseFecha(m.fecha);
      let key = "";
      if (filtroGrafica === "semana") key = d.toLocaleDateString("es-CO", { weekday: "short" });
      else if (filtroGrafica === "mes") key = `${d.getDate()}`;
      else key = d.toLocaleDateString("es-CO", { month: "short" });
      if (!agrupado[key]) agrupado[key] = { label: key, ingreso: 0, gasto: 0, dateObj: d };
      agrupado[key][m.tipo] += Number(m.monto);
    });
    return Object.values(agrupado).sort((a, b) => a.dateObj - b.dateObj);
  }, [movimientosVisibles, filtroGrafica]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* BANNER */}
      <div style={{ background: "linear-gradient(135deg, #374151 0%, #1F2937 100%)", borderRadius: 24, padding: "24px 24px 20px", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 13, opacity: 0.88, marginBottom: 2 }}>{SALUDO}</p>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Balance total: {fmt(balanceTotal)}</h2>
        <p style={{ fontSize: 12, opacity: 0.75, marginBottom: cuentasConSaldo.length > 0 ? 16 : 0 }}>{hoyObj.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>

        {cuentasConSaldo.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
            {cuentasConSaldo.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", borderRadius: 12, padding: "8px 12px" }}>
                <span style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span>{iconoCuenta(c)}</span> {c.nombre}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, flexShrink: 0, marginLeft: 8 }}>{fmt(c.saldo)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STATS DEL MES */}
      <div className="stats-grid">
        <StatCard icon="trending" label="Ingresos del mes" value={fmt(ingresosMes)} color="var(--success)" />
        <StatCard icon="trendingDown" label="Gastos del mes" value={fmt(gastosMes)} color="var(--danger)" />
        <StatCard icon="wallet" label="Me deben" value={fmt(totalMeDeben)} color="var(--primary)" />
        <StatCard icon="alert" label="Debo" value={fmt(totalDebo)} color="var(--danger)" />
      </div>

      {/* TARJETAS DE CRÉDITO */}
      {tarjetas.length > 0 && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid var(--accent-soft)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", marginBottom: 12 }}>💳 Tarjetas de crédito</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tarjetas.map(c => (
              <div key={c.id} style={{ padding: "10px 14px", borderRadius: 12, background: "var(--bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0 }}>{c.nombre}</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "var(--danger)", margin: 0 }}>{fmt(c.deuda)}</p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--mid)" }}>
                    {c.diasCorte != null && <>Corte {c.diasCorte < 0 ? `hace ${Math.abs(c.diasCorte)}d` : c.diasCorte === 0 ? "hoy" : `en ${c.diasCorte}d`}</>}
                    {c.diasCorte != null && c.diasPago != null && " · "}
                    {c.diasPago != null && <>Pago {c.diasPago < 0 ? `hace ${Math.abs(c.diasPago)}d` : c.diasPago === 0 ? "hoy" : `en ${c.diasPago}d`}</>}
                  </span>
                  {c.cuotaMensual > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--dark)" }}>Cuota: {fmt(c.cuotaMensual)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESUMEN FACTURAS RECURRENTES */}
      {resumenFacturas.total > 0 && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid var(--accent-soft)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", marginBottom: 12 }}>🧾 Facturas recurrentes del mes</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "var(--mid)" }}>✅ Pagadas</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--success)" }}>{resumenFacturas.pagadas} de {resumenFacturas.total}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "var(--mid)" }}>⏳ Por pagar</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: resumenFacturas.pendientes > 0 ? "var(--accent)" : "var(--dark)" }}>{resumenFacturas.pendientes}</span>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--mid)" }}>Total facturas recurrentes</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--dark)" }}>{fmt(resumenFacturas.totalMes)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--mid)" }}>Pendiente por pagar</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: resumenFacturas.totalPendiente > 0 ? "var(--accent)" : "var(--dark)" }}>{fmt(resumenFacturas.totalPendiente)}</span>
          </div>
        </div>
      )}

      {/* FACTURAS PRÓXIMAS */}
      {facturasProximas.length > 0 && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid var(--accent-soft)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", marginBottom: 12 }}>🧾 Facturas próximas a vencer</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {facturasProximas.map(f => (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: f.diasRestantes < 0 ? "var(--danger-bg)" : f.diasRestantes <= 3 ? "var(--warn-bg)" : "var(--bg)" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0 }}>{f.nombre}</p>
                  <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>
                    {f.diasRestantes < 0 ? `Vencida hace ${Math.abs(f.diasRestantes)}d` : f.diasRestantes === 0 ? "Vence hoy" : `Vence en ${f.diasRestantes}d`}
                  </p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 800, color: f.diasRestantes < 0 ? "var(--danger)" : "var(--dark)", margin: 0 }}>{fmt(f.montoEstimado)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRÁFICA */}
      <div style={{ background: "var(--white)", borderRadius: 20, padding: "20px", border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: COLOR_INGRESO }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: COLOR_INGRESO }} /> Ingresos</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: COLOR_GASTO }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: COLOR_GASTO }} /> Gastos</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ id: "semana", label: "7 Días" }, { id: "mes", label: "Mes" }, { id: "todo", label: "Historial" }].map(f => (
              <button key={f.id} onClick={() => setFiltroGrafica(f.id)} style={{ background: filtroGrafica === f.id ? "var(--ink)" : "var(--bg)", color: filtroGrafica === f.id ? "white" : "var(--dark)", border: "none", padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600 }}>{f.label}</button>
            ))}
          </div>
        </div>
        <CustomLineChart data={datosGrafica} />
      </div>

    </div>
  );
}
