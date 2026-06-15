import { useState, useMemo, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { fmt, fmtNum, StatCard, Icon } from "../utils.jsx";

// ── GRÁFICA CON TOOLTIP TÁCTIL ─────────────────────────────────────────────
const CustomLineChart = ({ data }) => {
  const [activePt, setActivePt] = useState(null);
  if (!data || data.length === 0) return (
    <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mid)", fontSize: 13 }}>
      No hay datos en este periodo
    </div>
  );
  const chartData = data.length === 1
    ? [{ label: "", value: data[0].value }, data[0], { label: "", value: data[0].value }]
    : data;
  const maxVal   = Math.max(...chartData.map(d => d.value), 100);
  const H        = 140;
  const PAD      = 14;
  const points   = chartData.map((d, i) => {
    const x = chartData.length > 1 ? (i / (chartData.length - 1)) * 100 : 50;
    const y = H - PAD - ((d.value / maxVal) * (H - PAD * 2));
    return `${x}%,${y}`;
  }).join(" ");

  return (
    <div style={{ position: "relative", height: 185, width: "100%", marginTop: 16, userSelect: "none" }}>
      <svg width="100%" height={H} style={{ overflow: "visible" }}>
        {/* Área rellena */}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--rosa-deep)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--rosa-deep)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={[`0%,${H}`, ...chartData.map((d,i)=>{
            const x = chartData.length > 1 ? `${(i/(chartData.length-1))*100}%` : "50%";
            const y = H - PAD - ((d.value/maxVal)*(H-PAD*2));
            return `${x},${y}`;
          }), `100%,${H}`].join(" ")}
          fill="url(#lineGrad)" stroke="none"
        />
        <polyline points={points} fill="none" stroke="var(--rosa-deep)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {chartData.map((d, i) => {
          const xPct = chartData.length > 1 ? (i / (chartData.length - 1)) * 100 : 50;
          const y    = H - PAD - ((d.value / maxVal) * (H - PAD * 2));
          const isActive = activePt?.i === i;
          return (
            <g key={i} style={{ cursor: "pointer" }}
              onMouseEnter={() => setActivePt({ i, label: d.label, value: d.value, xPct, y })}
              onMouseLeave={() => setActivePt(null)}
              onTouchStart={e => { e.preventDefault(); setActivePt({ i, label: d.label, value: d.value, xPct, y }); }}
              onTouchEnd={() => setTimeout(() => setActivePt(null), 2200)}
            >
              <circle cx={`${xPct}%`} cy={y} r={isActive ? 7 : 5}
                fill={isActive ? "var(--rosa-deep)" : "var(--white)"}
                stroke="var(--rosa-deep)" strokeWidth="2.5" />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {activePt && (
        <div style={{
          position: "absolute", bottom: 52,
          left: `clamp(60px, ${activePt.xPct}%, calc(100% - 60px))`,
          transform: "translateX(-50%)",
          background: "var(--dark)", color: "#fff",
          padding: "5px 12px", borderRadius: 10,
          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
          pointerEvents: "none", zIndex: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
        }}>
          {activePt.label && `${activePt.label}: `}{fmt(activePt.value)}
        </div>
      )}

      {/* Labels eje X */}
      <div style={{ display: "flex", justifyContent: "space-between", position: "absolute", bottom: 0, left: 0, right: 0 }}>
        {chartData.map((d, i) => {
          const show = chartData.length <= 7 || i % Math.ceil(chartData.length / 5) === 0 || i === chartData.length - 1;
          return (
            <span key={i} style={{ fontSize: 10, color: "var(--mid)", fontWeight: 600, opacity: show ? 1 : 0, textAlign: "center", width: "30px", marginLeft: "-15px" }}>
              {show ? d.label : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ── MINI BAR ────────────────────────────────────────────────────────────────
const MiniBar = ({ label, value, max, color = "var(--rosa)", subLabel }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, color: "var(--mid)", minWidth: 64, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%`, height: "100%", background: color, borderRadius: 8, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--dark)", minWidth: 56, textAlign: "right" }}>{fmt(value)}</span>
    </div>
    {subLabel && <p style={{ fontSize: 10, color: "var(--mid)", margin: "2px 0 0", paddingLeft: 74 }}>{subLabel}</p>}
  </div>
);

// ── BARRA HORARIA ───────────────────────────────────────────────────────────
const HoraBar = ({ hora, valor, max }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
    <span style={{ fontSize: 10, color: "var(--mid)", fontWeight: 600, minWidth: 38 }}>{hora}</span>
    <div style={{ flex: 1, height: 7, background: "var(--border)", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ width: `${max > 0 ? (valor / max) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg, var(--rosa-deep), var(--rosa))", borderRadius: 6 }} />
    </div>
    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dark)", minWidth: 70, textAlign: "right" }}>{fmt(valor)}</span>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ prendas, ventas, facturas = [] }) {
  const [filtroTiempo, setFiltroTiempo] = useState("semana");
  const [notas, setNotas]               = useState([]);
  const [notaTexto, setNotaTexto]       = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [notaError, setNotaError]       = useState("");

  useEffect(() => {
    getDocs(collection(db, "notas"))
      .then(snap => setNotas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))))
      .catch(err => setNotaError("Error cargando notas: " + err.message));
  }, []);

  const guardarNota = async () => {
    const texto = notaTexto.trim();
    if (!texto) return;
    setGuardandoNota(true); setNotaError("");
    try {
      const nueva = { texto, fecha: new Date().toISOString() };
      const ref = await addDoc(collection(db, "notas"), nueva);
      setNotas(n => [{ id: ref.id, ...nueva }, ...n]);
      setNotaTexto("");
    } catch (err) { setNotaError("Error al guardar: " + err.message); }
    finally { setGuardandoNota(false); }
  };

  const eliminarNota = async (id) => {
    await deleteDoc(doc(db, "notas", id));
    setNotas(n => n.filter(x => x.id !== id));
  };

  // ── FECHAS ────────────────────────────────────────────────────────────────
  const hoy         = new Date();
  const hace7Dias   = new Date(); hace7Dias.setDate(hoy.getDate() - 7);
  const mesAnterior = new Date(); mesAnterior.setMonth(hoy.getMonth() - 1);
  const diasMes     = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diasTranscurridos = hoy.getDate() || 1;

  // ── CRÉDITOS ABIERTOS ─────────────────────────────────────────────────────
  const creditosAbiertos = facturas.filter(f => f.formaPago === "Crédito" && f.estadoCredito === "abierto");
  const ticketsCredito   = new Set(creditosAbiertos.map(f => f.ticketId));
  const ventasSinCredito = ventas.filter(v => !ticketsCredito.has(v.ticketId));

  // ── VENTAS MES ACTUAL / ANTERIOR ─────────────────────────────────────────
  const ventasMesActual = ventasSinCredito.filter(v => {
    if (!v.fecha) return false;
    const d = new Date(v.fecha);
    return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  });
  const ventasMesAnterior = ventasSinCredito.filter(v => {
    if (!v.fecha) return false;
    const d = new Date(v.fecha);
    return d.getMonth() === mesAnterior.getMonth() && d.getFullYear() === mesAnterior.getFullYear();
  });

  // ── KPIs MENSUALES ────────────────────────────────────────────────────────
  const ingresosMes      = ventasMesActual.reduce((s, v)  => s + Number(v.precioVenta) * Number(v.cantidad), 0);
  const costosMes        = ventasMesActual.reduce((s, v)  => s + Number(v.costoCompra)  * Number(v.cantidad), 0);
  const gananciasMes     = ingresosMes - costosMes;
  const rentabilidad     = ingresosMes > 0 ? Math.round((gananciasMes / ingresosMes) * 100) : 0;
  const ingresosMesAnt   = ventasMesAnterior.reduce((s, v) => s + Number(v.precioVenta) * Number(v.cantidad), 0);
  const costosMesAnt     = ventasMesAnterior.reduce((s, v) => s + Number(v.costoCompra)  * Number(v.cantidad), 0);
  const crecimiento      = ingresosMesAnt > 0 ? Math.round(((ingresosMes - ingresosMesAnt) / ingresosMesAnt) * 100) : (ingresosMes > 0 ? 100 : 0);
  const proyeccion       = Math.round((ingresosMes / diasTranscurridos) * diasMes);
  const diasActivos      = new Set(ventasMesActual.map(v => new Date(v.fecha).toDateString())).size;

  // Ticket promedio + comparativo
  const ticketsUnicos    = new Set(ventasMesActual.map(v => v.ticketId)).size;
  const ticketPromedio   = ticketsUnicos > 0 ? Math.round(ingresosMes / ticketsUnicos) : 0;
  const ticketsUnicosAnt = new Set(ventasMesAnterior.map(v => v.ticketId)).size;
  const ticketPromedioAnt = ticketsUnicosAnt > 0 ? Math.round(ingresosMesAnt / ticketsUnicosAnt) : 0;
  const pctTicket        = ticketPromedioAnt > 0 ? Math.round(((ticketPromedio - ticketPromedioAnt) / ticketPromedioAnt) * 100) : null;
  const ticketSub        = pctTicket !== null
    ? (pctTicket >= 0 ? `▲ +${pctTicket}% vs mes pasado` : `▼ ${pctTicket}% vs mes pasado`)
    : `${ticketsUnicos} ventas cerradas`;

  // ── CAPITAL INVENTARIO ────────────────────────────────────────────────────
  const capitalInventario = prendas.reduce((s, p) => s + Number(p.costoCompra || 0) * Number(p.stock || 0), 0);
  const totalPrendas      = prendas.reduce((s, p) => s + Number(p.stock || 0), 0);
  const cogsDiario        = costosMes > 0 ? costosMes / diasTranscurridos : null;
  const diasInventario    = cogsDiario ? Math.round(capitalInventario / cogsDiario) : null;
  const diasInventarioStatus = diasInventario === null ? null : diasInventario <= 45 ? "ok" : diasInventario <= 75 ? "warn" : "danger";

  // ── CRÉDITOS ESTADÍSTICAS ─────────────────────────────────────────────────
  const creditosPendientes    = creditosAbiertos.reduce((s, f) => s + Number(f.total), 0);
  const numCreditosPendientes = creditosAbiertos.length;
  const creditosMes = facturas.filter(f => {
    if (f.formaPago !== "Crédito") return false;
    const d = new Date(f.fecha);
    return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  });
  const creditosCobradosMes = creditosMes.filter(f => f.estadoCredito === "cerrado").length;
  const tasaCobro = creditosMes.length > 0 ? Math.round((creditosCobradosMes / creditosMes.length) * 100) : null;

  // ── PRENDAS SIN MOVIMIENTO ────────────────────────────────────────────────
  const codigosVendidosMes = new Set(ventasMesActual.map(v => v.codigo));
  const sinMovimiento = prendas.filter(p => Number(p.stock) > 0 && !codigosVendidosMes.has(p.codigo)).length;

  // ── TALLA ESTRELLA ────────────────────────────────────────────────────────
  const tallasCount = ventasMesActual.reduce((acc, v) => {
    if (v.talla) acc[v.talla] = (acc[v.talla] || 0) + Number(v.cantidad);
    return acc;
  }, {});
  const tallasOrdenadas = Object.entries(tallasCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxTalla        = tallasOrdenadas[0]?.[1] || 1;

  // ── GANANCIA POR CATEGORÍA (reemplaza "unidades por categoría") ────────────
  const catData = ventasMesActual.reduce((acc, v) => {
    const p   = prendas.find(pr => pr.codigo === v.codigo);
    const cat = p?.categoria || "Sin categoría";
    const ing = Number(v.precioVenta) * Number(v.cantidad);
    const cos = Number(v.costoCompra)  * Number(v.cantidad);
    if (!acc[cat]) acc[cat] = { ingreso: 0, ganancia: 0, unidades: 0 };
    acc[cat].ingreso   += ing;
    acc[cat].ganancia  += ing - cos;
    acc[cat].unidades  += Number(v.cantidad);
    return acc;
  }, {});
  const catsOrdenadas = Object.entries(catData).sort((a, b) => b[1].ganancia - a[1].ganancia).slice(0, 5);
  const maxCatGanancia = catsOrdenadas[0]?.[1].ganancia || 1;

  // ── MÉTODOS DE PAGO ───────────────────────────────────────────────────────
  const facMes = facturas.filter(f => {
    if (!f.fecha) return false;
    const d = new Date(f.fecha);
    return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  });
  const pagoCount  = facMes.reduce((acc, f) => { acc[f.formaPago] = (acc[f.formaPago] || 0) + 1; return acc; }, {});
  const pagoTop    = Object.entries(pagoCount).sort((a, b) => b[1] - a[1]);
  const maxPago    = pagoTop[0]?.[1] || 1;

  // ── TOP PRODUCTOS ─────────────────────────────────────────────────────────
  const topSales = ventasMesActual.reduce((acc, v) => {
    acc[v.codigo] = (acc[v.codigo] || 0) + Number(v.cantidad);
    return acc;
  }, {});
  const topList = Object.entries(topSales).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cod, cant]) => {
    const pr = prendas.find(p => p.codigo === cod);
    return { codigo: cod, nombre: pr?.descripcion || cod, cantidad: cant };
  });

  // ── PRENDAS DORMIDAS (rotación real por días sin venta) ──────────────────
  const ultimaVentaMap = {};
  ventas.forEach(v => {
    if (!v.fecha || !v.codigo) return;
    if (!ultimaVentaMap[v.codigo] || new Date(v.fecha) > new Date(ultimaVentaMap[v.codigo])) {
      ultimaVentaMap[v.codigo] = v.fecha;
    }
  });
  const prendasDormidas = prendas
    .filter(p => Number(p.stock) > 0)
    .map(p => {
      const ultima = ultimaVentaMap[p.codigo];
      const dias   = ultima ? Math.floor((Date.now() - new Date(ultima)) / 86400000) : 999;
      return { ...p, diasSinVenta: dias, sinHistorial: !ultima };
    })
    .filter(p => p.diasSinVenta >= 20)
    .sort((a, b) => b.diasSinVenta - a.diasSinVenta)
    .slice(0, 5);

  // ── FRANJA HORARIA ────────────────────────────────────────────────────────
  const franjaMap = ventasSinCredito.reduce((acc, v) => {
    if (!v.fecha) return acc;
    const h   = new Date(v.fecha).getHours();
    const key = `${String(h).padStart(2, "0")}:00`;
    acc[key]  = (acc[key] || 0) + Number(v.precioVenta) * Number(v.cantidad);
    return acc;
  }, {});
  const franjaOrdenada = Object.entries(franjaMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxFranja      = franjaOrdenada[0]?.[1] || 1;

  // ── CLIENTES VIP ──────────────────────────────────────────────────────────
  const clienteMap = facturas
    .filter(f => f.clienteNombre || f.clienteCredito)
    .reduce((acc, f) => {
      const nombre = (f.clienteNombre || f.clienteCredito).trim();
      if (!acc[nombre]) acc[nombre] = { total: 0, compras: 0 };
      acc[nombre].total   += Number(f.total);
      acc[nombre].compras += 1;
      return acc;
    }, {});
  const clientesTop = Object.entries(clienteMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5);

  // ── GRÁFICA ───────────────────────────────────────────────────────────────
  const datosGrafica = useMemo(() => {
    const agrupado = {};
    const vFiltro  = ventasSinCredito.filter(v => {
      if (!v.fecha) return false;
      const d = new Date(v.fecha);
      if (filtroTiempo === "hoy")    return d.toDateString() === hoy.toDateString();
      if (filtroTiempo === "semana") return d >= hace7Dias;
      if (filtroTiempo === "mes")    return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
      return true;
    });
    vFiltro.forEach(v => {
      const d = new Date(v.fecha);
      let key = "";
      if      (filtroTiempo === "hoy")    key = `${d.getHours()}:00`;
      else if (filtroTiempo === "semana") key = d.toLocaleDateString("es-CO", { weekday: "short" });
      else if (filtroTiempo === "mes")    key = `${d.getDate()}`;
      else                                key = d.toLocaleDateString("es-CO", { month: "short" });
      if (!agrupado[key]) agrupado[key] = { label: key, value: 0, dateObj: d };
      agrupado[key].value += Number(v.precioVenta) * Number(v.cantidad);
    });
    return Object.values(agrupado).sort((a, b) => a.dateObj - b.dateObj);
  }, [ventasSinCredito, filtroTiempo]);

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── BANNER (sin tocar) ── */}
      <div style={{ background: "linear-gradient(135deg, var(--rosa-deep) 0%, var(--rosa) 100%)", borderRadius: 24, padding: "28px 24px", color: "var(--white)", position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Los números no mienten, Linda 🔥</h2>
        <p style={{ fontSize: 13, opacity: 0.8 }}>Métricas actualizadas en tiempo real</p>
      </div>

      {/* ── CAPITAL INVENTARIO — nueva sección destacada ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "linear-gradient(135deg, #1A237E, #283593)", borderRadius: 20, padding: "18px 16px", color: "#fff", gridColumn: "1 / -1" }}>
          <p style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>💰 Capital inmovilizado en inventario</p>
          <p style={{ fontSize: 28, fontWeight: 900, marginBottom: 2 }}>{fmt(capitalInventario)}</p>
          <p style={{ fontSize: 12, opacity: 0.8 }}>{fmtNum(totalPrendas)} productos en stock · costo de lo que tienes guardado</p>
        </div>

        <div style={{ background: "var(--white)", borderRadius: 16, padding: "16px", border: `1.5px solid ${diasInventarioStatus === "ok" ? "#A5D6A7" : diasInventarioStatus === "warn" ? "#FFB74D" : "#EF9A9A"}`, boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--mid)", marginBottom: 6 }}>📅 Días de inventario</p>
          {diasInventario !== null ? (
            <>
              <p style={{ fontSize: 24, fontWeight: 900, color: diasInventarioStatus === "ok" ? "var(--success)" : diasInventarioStatus === "warn" ? "var(--warn)" : "var(--danger)", marginBottom: 2 }}>{diasInventario}d</p>
              <p style={{ fontSize: 11, color: "var(--mid)" }}>
                {diasInventario <= 45 ? "✅ Rotación saludable" : diasInventario <= 75 ? "⚠️ Rotación lenta" : "🔴 Inventario estancado"}
              </p>
              <p style={{ fontSize: 10, color: "var(--mid)", marginTop: 4 }}>Meta: 30-45 días</p>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 8 }}>Sin ventas para calcular</p>
          )}
        </div>

        <div style={{ background: "var(--white)", borderRadius: 16, padding: "16px", border: "1.5px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--mid)", marginBottom: 6 }}>📊 Margen del mes</p>
          <p style={{ fontSize: 24, fontWeight: 900, color: rentabilidad >= 40 ? "var(--success)" : rentabilidad >= 25 ? "var(--warn)" : "var(--danger)", marginBottom: 2 }}>{rentabilidad}%</p>
          <p style={{ fontSize: 11, color: "var(--mid)" }}>Utilidad: {fmt(gananciasMes)}</p>
          <p style={{ fontSize: 10, color: "var(--mid)", marginTop: 4 }}>Saludable en belleza: 40%+</p>
        </div>
      </div>

      {/* ── MÉTRICAS MENSUALES ── */}
      <h3 style={{ fontSize: 12, color: "var(--mid)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 -8px" }}>Este mes</h3>
      <div className="stats-grid">
        <StatCard icon="money"    label="Ingresos del mes"   value={fmt(ingresosMes)}    sub={crecimiento >= 0 ? `▲ +${crecimiento}% vs mes pasado` : `▼ ${crecimiento}% vs mes pasado`} color="var(--rosa)" />
        <StatCard icon="trending" label="Ticket promedio"    value={fmt(ticketPromedio)} sub={ticketSub} color="#7B1FA2" />
        <StatCard icon="dashboard" label="Proyección del mes" value={fmt(proyeccion)}    sub={`${diasActivos} días activos de ${diasTranscurridos}`} color="var(--warn)" />
        <StatCard icon="tag"      label="Ventas cerradas"    value={`${ticketsUnicos}`}  sub={`${fmtNum(ventasMesActual.reduce((s,v)=>s+Number(v.cantidad),0))} productos`} color="var(--success)" />
      </div>

      {/* ── MÉTRICAS SECUNDARIAS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>

        <div style={{ background: numCreditosPendientes > 0 ? "#F3E5F5" : "var(--white)", borderRadius: 16, padding: "14px", border: `1.5px solid ${numCreditosPendientes > 0 ? "#CE93D8" : "var(--border)"}`, boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 10, color: "#7B1FA2", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>💳 En la calle</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: numCreditosPendientes > 0 ? "#7B1FA2" : "var(--mid)" }}>{fmt(creditosPendientes)}</p>
          <p style={{ fontSize: 11, color: "var(--mid)", marginTop: 4 }}>{numCreditosPendientes} cliente{numCreditosPendientes !== 1 ? "s" : ""} debe{numCreditosPendientes !== 1 ? "n" : ""}</p>
        </div>

        {tasaCobro !== null && (
          <div style={{ background: tasaCobro >= 70 ? "#E8F5E9" : "#FFF3E0", borderRadius: 16, padding: "14px", border: `1.5px solid ${tasaCobro >= 70 ? "#A5D6A7" : "#FFB74D"}`, boxShadow: "var(--shadow)" }}>
            <p style={{ fontSize: 10, color: tasaCobro >= 70 ? "var(--success)" : "var(--warn)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>✅ Tasa de cobro</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: tasaCobro >= 70 ? "var(--success)" : "var(--warn)" }}>{tasaCobro}%</p>
            <p style={{ fontSize: 11, color: "var(--mid)", marginTop: 4 }}>{creditosCobradosMes}/{creditosMes.length} créditos cobrados</p>
          </div>
        )}

        <div style={{ background: sinMovimiento > 0 ? "#FFF3E0" : "var(--white)", borderRadius: 16, padding: "14px", border: `1.5px solid ${sinMovimiento > 0 ? "#FFB74D" : "var(--border)"}`, boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 10, color: "var(--warn)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>🧊 Sin movimiento</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: sinMovimiento > 0 ? "var(--warn)" : "var(--success)" }}>{sinMovimiento}</p>
          <p style={{ fontSize: 11, color: "var(--mid)", marginTop: 4 }}>{sinMovimiento === 0 ? "¡Todo rotando!" : "productos sin venta este mes"}</p>
        </div>

        <div style={{ background: "var(--white)", borderRadius: 16, padding: "14px", border: "1.5px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 10, color: "var(--rosa-deep)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>👑 Más vendida</p>
          {tallasOrdenadas.length > 0 ? (
            <>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--rosa-deep)" }}>{tallasOrdenadas[0][0]}</p>
              <p style={{ fontSize: 11, color: "var(--mid)", marginTop: 4 }}>{tallasOrdenadas[0][1]} uds. vendidas</p>
            </>
          ) : <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 8 }}>Sin datos</p>}
        </div>
      </div>

      {/* ── GRÁFICA ── */}
      <div style={{ background: "var(--white)", borderRadius: 20, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)" }}>Ingresos en el tiempo</p>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
            {[{ id: "hoy", label: "Hoy" }, { id: "semana", label: "7 Días" }, { id: "mes", label: "Mes" }, { id: "todo", label: "Historial" }].map(f => (
              <button key={f.id} onClick={() => setFiltroTiempo(f.id)}
                style={{ background: filtroTiempo === f.id ? "var(--dark)" : "var(--creme)", color: filtroTiempo === f.id ? "white" : "var(--dark)", border: "none", padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--mid)", marginBottom: 0 }}>Toca un punto para ver el valor exacto</p>
        <CustomLineChart data={datosGrafica} />
      </div>

      {/* ── ANÁLISIS: TALLAS + GANANCIA POR CATEGORÍA + MÉTODOS ── */}
      <div className="desktop-flex">
        <div style={{ flex: 1, background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)", marginBottom: 16 }}>📐 Por presentación (mes)</p>
          {tallasOrdenadas.length === 0
            ? <p style={{ fontSize: 12, color: "var(--mid)" }}>Sin datos este mes.</p>
            : tallasOrdenadas.map(([t, v]) => <MiniBar key={t} label={t} value={v} max={maxTalla} color="var(--rosa-deep)" />)
          }
        </div>

        <div style={{ flex: 1, background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)", marginBottom: 4 }}>💰 Ganancia por categoría</p>
          <p style={{ fontSize: 11, color: "var(--mid)", marginBottom: 14 }}>En dinero ganado, no unidades</p>
          {catsOrdenadas.length === 0
            ? <p style={{ fontSize: 12, color: "var(--mid)" }}>Sin datos este mes.</p>
            : catsOrdenadas.map(([c, d]) => (
              <MiniBar key={c}
                label={c.length > 10 ? c.slice(0, 9) + "…" : c}
                value={d.ganancia}
                max={maxCatGanancia}
                color="#7B1FA2"
                subLabel={`Margen: ${d.ingreso > 0 ? Math.round((d.ganancia/d.ingreso)*100) : 0}% · ${d.unidades} uds`}
              />
            ))
          }
        </div>

        <div style={{ flex: 1, background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)", marginBottom: 16 }}>💳 Métodos de pago (mes)</p>
          {pagoTop.length === 0
            ? <p style={{ fontSize: 12, color: "var(--mid)" }}>Sin datos este mes.</p>
            : pagoTop.map(([m, v]) => <MiniBar key={m} label={m.length > 10 ? m.slice(0, 9) + "…" : m} value={v} max={maxPago} color="var(--success)" />)
          }
        </div>
      </div>

      {/* ── FRANJA HORARIA ── */}
      {franjaOrdenada.length > 0 && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)", marginBottom: 4 }}>🕐 Franja horaria de ventas</p>
          <p style={{ fontSize: 11, color: "var(--mid)", marginBottom: 14 }}>Las horas que más genera tu tienda — usa esto para tus stories de Instagram</p>
          {franjaOrdenada.map(([hora, val]) => <HoraBar key={hora} hora={hora} valor={val} max={maxFranja} />)}
        </div>
      )}

      {/* ── TOP PRODUCTOS + PRENDAS DORMIDAS ── */}
      <div className="desktop-flex">
        <div style={{ flex: 1, background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)", marginBottom: 14 }}>🏆 Top productos del mes</p>
          {topList.length === 0
            ? <p style={{ fontSize: 12, color: "var(--mid)" }}>No hay ventas este mes.</p>
            : topList.map((t, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "var(--rosa-pale)", padding: "8px 12px", borderRadius: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--dark)" }}>{t.nombre}</span>
                <span style={{ fontSize: 12, color: "var(--rosa-deep)", fontWeight: 700 }}>×{t.cantidad}</span>
              </div>
            ))
          }
        </div>

        <div style={{ flex: 1, background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)", marginBottom: 4 }}>😴 Productos dormidos</p>
          <p style={{ fontSize: 11, color: "var(--mid)", marginBottom: 14 }}>Sin venderse hace 20+ días — candidatas a descuento o liquidación</p>
          {prendasDormidas.length === 0
            ? <p style={{ fontSize: 12, color: "var(--success)" }}>¡Todo el inventario ha rotado recientemente!</p>
            : prendasDormidas.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: p.diasSinVenta >= 60 ? "#FFEBEE" : "#FFF3E0", padding: "8px 12px", borderRadius: 10, marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--dark)", margin: 0 }}>{p.descripcion}</p>
                  <p style={{ fontSize: 10, color: "var(--mid)", margin: "2px 0 0" }}>{p.stock} uds. · {p.codigo}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: p.diasSinVenta >= 60 ? "var(--danger)" : "var(--warn)", margin: 0 }}>
                    {p.sinHistorial ? "Sin historial" : `${p.diasSinVenta}d`}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--mid)", margin: "2px 0 0" }}>sin venta</p>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── CLIENTES VIP ── */}
      {clientesTop.length > 0 && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)", marginBottom: 4 }}>👑 Tus mejores clientas</p>
          <p style={{ fontSize: 11, color: "var(--mid)", marginBottom: 14 }}>Basado en facturas con nombre registrado</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientesTop.map(([nombre, data], i) => (
              <div key={nombre} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: i === 0 ? "linear-gradient(135deg, #FFF8E1, #FFF3E0)" : "var(--creme)", border: i === 0 ? "1px solid #FFE082" : "1px solid var(--border)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: i === 0 ? "linear-gradient(135deg, var(--rosa-deep), var(--rosa))" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? "#fff" : "var(--mid)", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                  {i === 0 ? "👑" : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre}</p>
                  <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>{data.compras} compra{data.compras !== 1 ? "s" : ""}</p>
                </div>
                <p style={{ fontSize: 15, fontWeight: 900, color: i === 0 ? "var(--rosa-deep)" : "var(--dark)", margin: 0, flexShrink: 0 }}>{fmt(data.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BLOQUE DE NOTAS ── */}
      <div style={{ background: "var(--white)", borderRadius: 20, padding: "20px", border: "1.5px solid var(--rosa-soft)", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>📝</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 700, color: "var(--rosa-deep)" }}>Mis notas del día</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <textarea
            placeholder="Escribe algo para no olvidar… pedir productos, llamar proveedor, nota de caja..."
            value={notaTexto}
            onChange={e => setNotaTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) guardarNota(); }}
            rows={3}
            style={{ flex: 1, resize: "vertical", fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border)", outline: "none", color: "var(--dark)", background: "var(--creme)", lineHeight: 1.5 }}
          />
          <button onClick={guardarNota} disabled={guardandoNota || !notaTexto.trim()}
            style={{ background: notaTexto.trim() ? "linear-gradient(135deg, var(--rosa-deep), var(--rosa))" : "var(--border)", color: notaTexto.trim() ? "white" : "var(--mid)", border: "none", borderRadius: 12, padding: "0 18px", fontWeight: 700, fontSize: 13, alignSelf: "stretch", minWidth: 72, cursor: "pointer" }}>
            {guardandoNota ? "..." : "Guardar"}
          </button>
        </div>
        <p style={{ fontSize: 10, color: "var(--mid)", marginTop: 6 }}>Ctrl + Enter para guardar rápido</p>
        {notaError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8, background: "#FFEBEE", padding: "8px 12px", borderRadius: 8 }}>⚠️ {notaError}</p>}
        {notas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {notas.map(n => (
              <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--rosa-pale)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--rosa-soft)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: "var(--dark)", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0 }}>{n.texto}</p>
                  <p style={{ fontSize: 10, color: "var(--mid)", marginTop: 6 }}>
                    {new Date(n.fecha).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })} · {new Date(n.fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button onClick={() => eliminarNota(n.id)} style={{ background: "transparent", border: "none", color: "var(--mid)", fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        {notas.length === 0 && <p style={{ fontSize: 12, color: "var(--mid)", textAlign: "center", padding: "16px 0 4px", fontStyle: "italic" }}>Aún no hay notas. ¡Escribe la primera!</p>}
      </div>

    </div>
  );
}
