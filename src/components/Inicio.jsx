import { useState, useMemo, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { fmt, esHoy, esEsteMes, hoyObj, StatCard, ProgressBar, fetchPropio, TIPOS_CUENTA } from "../utils.jsx";
import { calcularSaldo } from "./Cuentas.jsx";

const HORA = new Date().getHours();
const SALUDO = HORA < 12 ? "¡Buenos días! ☀️" : HORA < 18 ? "¡Buenas tardes! 💚" : "¡Buenas noches! 🌙";

// ── GRÁFICA CON TOOLTIP TÁCTIL ──
const CustomLineChart = ({ data, color = "var(--primary-deep)" }) => {
  const [activePt, setActivePt] = useState(null);
  if (!data || data.length === 0) return (
    <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mid)", fontSize: 13 }}>
      No hay datos en este periodo
    </div>
  );
  const chartData = data.length === 1
    ? [{ label: "", value: data[0].value }, data[0], { label: "", value: data[0].value }]
    : data;
  const maxVal = Math.max(...chartData.map(d => d.value), 100);
  const H = 140, PAD = 14;
  const points = chartData.map((d, i) => {
    const x = chartData.length > 1 ? (i / (chartData.length - 1)) * 100 : 50;
    const y = H - PAD - ((d.value / maxVal) * (H - PAD * 2));
    return `${x}%,${y}`;
  }).join(" ");

  return (
    <div style={{ position: "relative", height: 185, width: "100%", marginTop: 16, userSelect: "none" }}>
      <svg width="100%" height={H} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={[`0%,${H}`, ...chartData.map((d, i) => {
            const x = chartData.length > 1 ? `${(i / (chartData.length - 1)) * 100}%` : "50%";
            const y = H - PAD - ((d.value / maxVal) * (H - PAD * 2));
            return `${x},${y}`;
          }), `100%,${H}`].join(" ")}
          fill="url(#lineGrad)" stroke="none"
        />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {chartData.map((d, i) => {
          const xPct = chartData.length > 1 ? (i / (chartData.length - 1)) * 100 : 50;
          const y = H - PAD - ((d.value / maxVal) * (H - PAD * 2));
          const isActive = activePt?.i === i;
          return (
            <g key={i} style={{ cursor: "pointer" }}
              onMouseEnter={() => setActivePt({ i, label: d.label, value: d.value, xPct })}
              onMouseLeave={() => setActivePt(null)}
              onTouchStart={e => { e.preventDefault(); setActivePt({ i, label: d.label, value: d.value, xPct }); }}
              onTouchEnd={() => setTimeout(() => setActivePt(null), 2200)}
            >
              <circle cx={`${xPct}%`} cy={y} r={isActive ? 7 : 5} fill={isActive ? color : "var(--white)"} stroke={color} strokeWidth="2.5" />
            </g>
          );
        })}
      </svg>
      {activePt && (
        <div style={{ position: "absolute", bottom: 52, left: `clamp(60px, ${activePt.xPct}%, calc(100% - 60px))`, transform: "translateX(-50%)", background: "var(--dark)", color: "#fff", padding: "5px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {activePt.label && `${activePt.label}: `}{fmt(activePt.value)}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", position: "absolute", bottom: 0, left: 0, right: 0 }}>
        {chartData.map((d, i) => {
          const show = chartData.length <= 7 || i % Math.ceil(chartData.length / 5) === 0 || i === chartData.length - 1;
          return <span key={i} style={{ fontSize: 10, color: "var(--mid)", fontWeight: 600, opacity: show ? 1 : 0, textAlign: "center", width: "30px", marginLeft: "-15px" }}>{show ? d.label : ""}</span>;
        })}
      </div>
    </div>
  );
};

export default function Inicio({ cuentas, movimientos, facturasRecurrentes, pagosFactura, presupuestos, deudas = [], metas = [] }) {
  const [filtroGrafica, setFiltroGrafica] = useState("mes");
  const [metricaGrafica, setMetricaGrafica] = useState("gasto");
  const [notas, setNotas] = useState([]);
  const [notaTexto, setNotaTexto] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);

  useEffect(() => {
    fetchPropio("notas", auth.currentUser.uid)
      .then(docs => setNotas(docs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))))
      .catch(() => {});
  }, []);

  const guardarNota = async () => {
    const texto = notaTexto.trim();
    if (!texto) return;
    setGuardandoNota(true);
    try {
      const nueva = { texto, fecha: new Date().toISOString(), uid: auth.currentUser.uid };
      const ref = await addDoc(collection(db, "notas"), nueva);
      setNotas(n => [{ id: ref.id, ...nueva }, ...n]);
      setNotaTexto("");
    } catch {} finally { setGuardandoNota(false); }
  };

  const eliminarNota = async (id) => {
    await deleteDoc(doc(db, "notas", id));
    setNotas(n => n.filter(x => x.id !== id));
  };

  const movimientosVisibles = useMemo(() => movimientos.filter(m => m.tipo !== "transferencia"), [movimientos]);

  const balanceTotal = useMemo(() => cuentas.reduce((s, c) => s + calcularSaldo(c, movimientos), 0), [cuentas, movimientos]);

  const balancePorTipo = useMemo(() => {
    const mapa = {};
    cuentas.forEach(c => { mapa[c.tipo] = (mapa[c.tipo] || 0) + calcularSaldo(c, movimientos); });
    return TIPOS_CUENTA.map(t => ({ ...t, monto: mapa[t.id] || 0 })).filter(t => t.monto !== 0 || cuentas.some(c => c.tipo === t.id));
  }, [cuentas, movimientos]);

  const movHoy = movimientosVisibles.filter(m => esHoy(m.fecha));
  const movMes = movimientosVisibles.filter(m => esEsteMes(m.fecha));
  const ingresosMes = movMes.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const gastosMes = movMes.filter(m => m.tipo === "gasto").reduce((s, m) => s + Number(m.monto), 0);
  const netoMes = ingresosMes - gastosMes;
  const gastosHoy = movHoy.filter(m => m.tipo === "gasto").reduce((s, m) => s + Number(m.monto), 0);

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

  // ── PRESUPUESTOS EN RIESGO ──
  const presupuestosEnRiesgo = useMemo(() => {
    const gastoPorCat = {};
    movMes.filter(m => m.tipo === "gasto").forEach(m => { gastoPorCat[m.categoria] = (gastoPorCat[m.categoria] || 0) + Number(m.monto); });
    return presupuestos
      .map(p => ({ ...p, gastado: gastoPorCat[p.categoria] || 0, pct: p.limiteMensual > 0 ? Math.round(((gastoPorCat[p.categoria] || 0) / p.limiteMensual) * 100) : 0 }))
      .filter(p => p.pct >= 70)
      .sort((a, b) => b.pct - a.pct);
  }, [presupuestos, movMes]);

  // ── DEUDAS Y PRÉSTAMOS ──
  const deudasActivas = useMemo(() => deudas.filter(d => d.activa !== false && Number(d.saldoRestante) > 0), [deudas]);
  const totalDebo = deudasActivas.filter(d => d.tipo === "debo").reduce((s, d) => s + Number(d.saldoRestante), 0);
  const totalMeDeben = deudasActivas.filter(d => d.tipo === "me_deben").reduce((s, d) => s + Number(d.saldoRestante), 0);

  // ── METAS DE AHORRO ──
  const metasActivas = useMemo(() => metas.filter(m => m.activa !== false), [metas]);
  const totalAhorrado = metasActivas.reduce((s, m) => s + Number(m.montoActual), 0);
  const metaMasCercaCumplir = useMemo(() =>
    metasActivas
      .map(m => ({ ...m, pct: m.montoObjetivo > 0 ? Math.round((Number(m.montoActual) / Number(m.montoObjetivo)) * 100) : 0 }))
      .filter(m => m.pct < 100)
      .sort((a, b) => b.pct - a.pct)[0],
    [metasActivas]
  );

  // ── GRÁFICA ──
  const datosGrafica = useMemo(() => {
    const hoy = new Date();
    const hace7Dias = new Date(); hace7Dias.setDate(hoy.getDate() - 7);
    const agrupado = {};
    const vFiltro = movimientosVisibles.filter(m => {
      if (m.tipo !== metricaGrafica || !m.fecha) return false;
      const d = new Date(m.fecha);
      if (filtroGrafica === "semana") return d >= hace7Dias;
      if (filtroGrafica === "mes") return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
      return true;
    });
    vFiltro.forEach(m => {
      const d = new Date(m.fecha);
      let key = "";
      if (filtroGrafica === "semana") key = d.toLocaleDateString("es-CO", { weekday: "short" });
      else if (filtroGrafica === "mes") key = `${d.getDate()}`;
      else key = d.toLocaleDateString("es-CO", { month: "short" });
      if (!agrupado[key]) agrupado[key] = { label: key, value: 0, dateObj: d };
      agrupado[key].value += Number(m.monto);
    });
    return Object.values(agrupado).sort((a, b) => a.dateObj - b.dateObj);
  }, [movimientosVisibles, filtroGrafica, metricaGrafica]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* BANNER */}
      <div style={{ background: "linear-gradient(135deg, var(--primary-deep) 0%, var(--primary) 100%)", borderRadius: 24, padding: "24px 24px 20px", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 13, opacity: 0.88, marginBottom: 2 }}>{SALUDO}</p>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Balance total: {fmt(balanceTotal)}</h2>
        <p style={{ fontSize: 12, opacity: 0.75, marginBottom: balancePorTipo.length > 0 ? 16 : 0 }}>{hoyObj.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>

        {balancePorTipo.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "relative" }}>
            {balancePorTipo.map(t => (
              <div key={t.id} style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", borderRadius: 12, padding: "8px 12px", flex: "1 1 auto", minWidth: 90 }}>
                <p style={{ fontSize: 10, opacity: 0.8, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.label}</p>
                <p style={{ fontSize: 14, fontWeight: 800, margin: "2px 0 0" }}>{fmt(t.monto)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STATS DEL MES */}
      <div className="stats-grid">
        <StatCard icon="trending" label="Ingresos del mes" value={fmt(ingresosMes)} color="var(--success)" />
        <StatCard icon="trendingDown" label="Gastos del mes" value={fmt(gastosMes)} color="var(--danger)" />
        <StatCard icon="dashboard" label="Neto del mes" value={fmt(netoMes)} sub={netoMes >= 0 ? "Ahorrando 🎉" : "Gastando de más"} color={netoMes >= 0 ? "var(--success)" : "var(--danger)"} />
        <StatCard icon="money" label="Gastado hoy" value={fmt(gastosHoy)} color="var(--primary)" />
      </div>

      {/* GRÁFICA */}
      <div style={{ background: "var(--white)", borderRadius: 20, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setMetricaGrafica("gasto")} style={{ background: metricaGrafica === "gasto" ? "var(--danger)" : "var(--bg)", color: metricaGrafica === "gasto" ? "#fff" : "var(--mid)", border: "none", padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 700 }}>Gastos</button>
            <button onClick={() => setMetricaGrafica("ingreso")} style={{ background: metricaGrafica === "ingreso" ? "var(--success)" : "var(--bg)", color: metricaGrafica === "ingreso" ? "#fff" : "var(--mid)", border: "none", padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 700 }}>Ingresos</button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ id: "semana", label: "7 Días" }, { id: "mes", label: "Mes" }, { id: "todo", label: "Historial" }].map(f => (
              <button key={f.id} onClick={() => setFiltroGrafica(f.id)} style={{ background: filtroGrafica === f.id ? "var(--dark)" : "var(--bg)", color: filtroGrafica === f.id ? "white" : "var(--dark)", border: "none", padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600 }}>{f.label}</button>
            ))}
          </div>
        </div>
        <CustomLineChart data={datosGrafica} color={metricaGrafica === "gasto" ? "var(--danger)" : "var(--success)"} />
      </div>

      {/* FACTURAS PRÓXIMAS */}
      {facturasProximas.length > 0 && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid var(--accent-soft)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", marginBottom: 12 }}>🧾 Facturas próximas a vencer</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {facturasProximas.map(f => (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: f.diasRestantes < 0 ? "#FFEBEE" : f.diasRestantes <= 3 ? "#FFF3E0" : "var(--bg)" }}>
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

      {/* PRESUPUESTOS EN RIESGO */}
      {presupuestosEnRiesgo.length > 0 && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid #FFB74D", boxShadow: "var(--shadow)" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--warn)", marginBottom: 12 }}>⚠️ Presupuestos cerca del límite</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {presupuestosEnRiesgo.map(p => (
              <div key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dark)" }}>{p.categoria}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: p.pct >= 100 ? "var(--danger)" : "var(--warn)" }}>{p.pct}%</span>
                </div>
                <ProgressBar pct={p.pct} color={p.pct >= 100 ? "var(--danger)" : "var(--warn)"} bg="var(--bg)" height={8} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEUDAS Y AHORRO */}
      {(deudasActivas.length > 0 || metasActivas.length > 0) && (
        <div className="desktop-flex">
          {deudasActivas.length > 0 && (
            <div style={{ flex: 1, background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid #FFCDD2", boxShadow: "var(--shadow)" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--danger)", marginBottom: 12 }}>🤝 Deudas y préstamos</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--mid)" }}>Yo debo</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--danger)" }}>{fmt(totalDebo)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--mid)" }}>Me deben</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--primary-deep)" }}>{fmt(totalMeDeben)}</span>
              </div>
            </div>
          )}

          {metasActivas.length > 0 && (
            <div style={{ flex: 1, background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--primary-deep)", marginBottom: 12 }}>🎯 Ahorro total</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--primary-deep)", marginBottom: metaMasCercaCumplir ? 10 : 0 }}>{fmt(totalAhorrado)}</p>
              {metaMasCercaCumplir && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--mid)" }}>{metaMasCercaCumplir.nombre}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-deep)" }}>{metaMasCercaCumplir.pct}%</span>
                  </div>
                  <ProgressBar pct={metaMasCercaCumplir.pct} color="var(--primary)" bg="var(--bg)" height={8} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* NOTAS */}
      <div style={{ background: "var(--white)", borderRadius: 20, padding: "20px", border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>📝</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 700, color: "var(--primary-deep)" }}>Mis notas</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <textarea
            placeholder="Escribe algo para no olvidar…"
            value={notaTexto}
            onChange={e => setNotaTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) guardarNota(); }}
            rows={3}
            style={{ flex: 1, resize: "vertical", fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border)", outline: "none", color: "var(--dark)", background: "var(--bg)", lineHeight: 1.5 }}
          />
          <button onClick={guardarNota} disabled={guardandoNota || !notaTexto.trim()}
            style={{ background: notaTexto.trim() ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "var(--border)", color: notaTexto.trim() ? "white" : "var(--mid)", border: "none", borderRadius: 12, padding: "0 18px", fontWeight: 700, fontSize: 13, alignSelf: "stretch", minWidth: 72 }}>
            {guardandoNota ? "..." : "Guardar"}
          </button>
        </div>
        {notas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {notas.map(n => (
              <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--primary-pale)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--primary-soft)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: "var(--dark)", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0 }}>{n.texto}</p>
                  <p style={{ fontSize: 10, color: "var(--mid)", marginTop: 6 }}>{new Date(n.fecha).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}</p>
                </div>
                <button onClick={() => eliminarNota(n.id)} style={{ background: "transparent", border: "none", color: "var(--mid)", fontSize: 16, padding: "0 4px", lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
