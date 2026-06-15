import { useState } from "react";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { esHoy, fmt, fmtNum, hoyObj, Icon } from "../utils.jsx";

const HORA = new Date().getHours();
const SALUDO = HORA < 12 ? "¡Buenos días, CEO! ☀️" : HORA < 18 ? "¡Buenas tardes, jefa! 💅🏻" : "¡Buenas noches, reina! 🌙";

const diasDesde   = (fecha) => Math.floor((Date.now() - new Date(fecha)) / (1000 * 60 * 60 * 24));
const urgBg       = (d) => d >= 14 ? "#FFEBEE" : d >= 7 ? "#FFF3E0" : "#F3E5F5";
const urgColor    = (d) => d >= 14 ? "var(--danger)" : d >= 7 ? "var(--warn)" : "#7B1FA2";
const urgLabel    = (d) => d >= 14 ? `🔴 ${d} días` : d >= 7 ? `⚠️ ${d} días` : d === 0 ? "Hoy" : `${d}d`;

function Pct({ val }) {
  if (val === null) return <span style={{ fontSize: 11, color: "var(--mid)" }}>sin datos ayer</span>;
  const up = val >= 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: up ? "var(--success)" : "var(--danger)" }}>
      {up ? "↑" : "↓"} {Math.abs(val)}% vs ayer
    </span>
  );
}

export default function Inicio({ prendas, ventas, facturas = [], setFacturas }) {
  const [metaDiaria, setMetaDiaria]   = useState(() => Number(localStorage.getItem("tosha_meta_diaria")) || 0);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput]     = useState("");
  const [marcando, setMarcando]       = useState(null);

  // ── FECHAS ──────────────────────────────────────────
  const esAyer = (fecha) => {
    const d = new Date(fecha), a = new Date();
    a.setDate(a.getDate() - 1);
    return d.toDateString() === a.toDateString();
  };

  // ── CRÉDITOS ────────────────────────────────────────
  const creditosAbiertos = facturas.filter(f => f.formaPago === "Crédito" && f.estadoCredito === "abierto");
  const ticketsCredito   = new Set(creditosAbiertos.map(f => f.ticketId));
  const totalEnCalle     = creditosAbiertos.reduce((s, f) => s + Number(f.total), 0);

  // ── VENTAS ──────────────────────────────────────────
  const efectivas   = ventas.filter(v => !ticketsCredito.has(v.ticketId));
  const ventasHoy   = efectivas.filter(v => esHoy(v.fecha));
  const ventasAyer  = efectivas.filter(v => esAyer(v.fecha));

  const ingresosHoy  = ventasHoy.reduce((s, v)  => s + Number(v.precioVenta) * Number(v.cantidad), 0);
  const ingresosAyer = ventasAyer.reduce((s, v) => s + Number(v.precioVenta) * Number(v.cantidad), 0);
  const gananciasHoy = ventasHoy.reduce((s, v)  => s + (Number(v.precioVenta) - Number(v.costoCompra)) * Number(v.cantidad), 0);
  const unidadesHoy  = ventasHoy.reduce((s, v)  => s + Number(v.cantidad), 0);
  const ticketsHoy   = new Set(ventasHoy.map(v => v.ticketId)).size;
  const pctVentas    = ingresosAyer > 0 ? Math.round(((ingresosHoy - ingresosAyer) / ingresosAyer) * 100) : null;

  // ── TOP PRENDA HOY ──────────────────────────────────
  const topMap = {};
  ventasHoy.forEach(v => {
    const k = v.descripcion || "Sin nombre";
    topMap[k] = (topMap[k] || 0) + Number(v.cantidad);
  });
  const topPrenda = Object.entries(topMap).sort((a, b) => b[1] - a[1])[0];

  // ── STOCK ────────────────────────────────────────────
  const alertas       = prendas.filter(p => Number(p.stock) > 0 && Number(p.stock) <= (Number(p.stockMinimo) || 3));
  const agotadas      = prendas.filter(p => Number(p.stock) === 0);
  const valorEnRiesgo = alertas.reduce((s, p) => s + Number(p.precioVenta || 0) * Number(p.stock), 0);

  // ── META DIARIA ──────────────────────────────────────
  const progreso = metaDiaria > 0 ? Math.min(100, Math.round((ingresosHoy / metaDiaria) * 100)) : 0;
  const guardarMeta = () => {
    const val = Number(String(metaInput).replace(/\./g, "").replace(",", "."));
    if (val > 0) { localStorage.setItem("tosha_meta_diaria", val); setMetaDiaria(val); }
    setEditandoMeta(false);
  };

  // ── MARCAR PAGADO ────────────────────────────────────
  const marcarPagado = async (factura) => {
    setMarcando(factura.id);
    try {
      await updateDoc(doc(db, "facturas", factura.id), { estadoCredito: "cerrado" });
      setFacturas(prev => prev.map(f => f.id === factura.id ? { ...f, estadoCredito: "cerrado" } : f));
    } catch (err) { alert("Error: " + err.message); }
    finally { setMarcando(null); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── BANNER ── */}
      <div style={{ background: "linear-gradient(135deg, var(--rosa-deep) 0%, var(--rosa) 100%)", borderRadius: 24, padding: "24px 24px 20px", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "absolute", bottom: -16, left: 60, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 13, opacity: 0.88, marginBottom: 2 }}>{SALUDO}</p>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Llegó la CEO de Tosha 💅🏻</h2>
        <p style={{ fontSize: 12, opacity: 0.75 }}>{hoyObj.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      {/* ── META DIARIA ── */}
      <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid var(--rosa-soft)", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
            Meta del día
          </span>
          {!editandoMeta ? (
            <button onClick={() => { setMetaInput(metaDiaria ? String(metaDiaria) : ""); setEditandoMeta(true); }}
              style={{ fontSize: 11, background: "var(--creme)", border: "none", borderRadius: 20, padding: "4px 12px", color: "var(--mid)", cursor: "pointer", fontWeight: 600 }}>
              {metaDiaria ? "Editar meta" : "Fijar meta"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="number" value={metaInput} onChange={e => setMetaInput(e.target.value)}
                placeholder="Ej: 300000" style={{ width: 120, fontSize: 12, padding: "4px 8px" }}
                onKeyDown={e => e.key === "Enter" && guardarMeta()} autoFocus />
              <button onClick={guardarMeta} style={{ background: "var(--success)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>OK</button>
              <button onClick={() => setEditandoMeta(false)} style={{ background: "var(--creme)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>✕</button>
            </div>
          )}
        </div>

        {metaDiaria > 0 ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--mid)" }}>{fmt(ingresosHoy)} de {fmt(metaDiaria)}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: progreso >= 100 ? "var(--success)" : "var(--rosa-deep)" }}>{progreso}%</span>
            </div>
            <div style={{ height: 10, background: "var(--rosa-pale)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progreso}%`, background: progreso >= 100 ? "var(--success)" : "linear-gradient(90deg, var(--rosa-deep), var(--rosa))", borderRadius: 10, transition: "width 0.6s ease" }} />
            </div>
            {progreso >= 100 && (
              <p style={{ fontSize: 12, color: "var(--success)", fontWeight: 700, marginTop: 6, textAlign: "center" }}>🎉 ¡Meta cumplida hoy!</p>
            )}
          </>
        ) : (
          <p style={{ fontSize: 12, color: "var(--mid)", textAlign: "center", padding: "8px 0" }}>Fija una meta diaria de ventas para ver tu progreso</p>
        )}
      </div>

      {/* ── STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "var(--white)", borderRadius: 18, padding: "16px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600, marginBottom: 4 }}>Ventas hoy</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--dark)", marginBottom: 4 }}>{fmt(ingresosHoy)}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Pct val={pctVentas} />
            <span style={{ fontSize: 11, color: "var(--mid)" }}>{fmtNum(unidadesHoy)} productos · {ticketsHoy} {ticketsHoy === 1 ? "venta" : "ventas"}</span>
          </div>
        </div>

        <div style={{ background: "var(--white)", borderRadius: 18, padding: "16px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600, marginBottom: 4 }}>Ganancia neta</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--success)", marginBottom: 4 }}>{fmt(gananciasHoy)}</p>
          {ingresosHoy > 0 && (
            <span style={{ fontSize: 11, color: "var(--mid)" }}>
              Margen: {Math.round((gananciasHoy / ingresosHoy) * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* ── TOP PRENDA ── */}
      {topPrenda && (
        <div style={{ background: "linear-gradient(135deg, #FFF8E1, #FFF3E0)", borderRadius: 18, padding: "14px 18px", border: "1px solid #FFE082", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🏆</span>
          <div>
            <p style={{ fontSize: 11, color: "#F57F17", fontWeight: 700, margin: 0 }}>Producto estrella hoy</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: "var(--dark)", margin: "2px 0 0" }}>{topPrenda[0]}</p>
            <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>{topPrenda[1]} {topPrenda[1] === 1 ? "unidad vendida" : "unidades vendidas"}</p>
          </div>
        </div>
      )}

      {/* ── CRÉDITOS EN CALLE ── */}
      {creditosAbiertos.length > 0 && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid #9C27B0", boxShadow: "0 4px 20px rgba(123,31,162,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>💳</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#6A1B9A", margin: 0 }}>Dinero en la calle</p>
                <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>{creditosAbiertos.length} crédito{creditosAbiertos.length !== 1 ? "s" : ""} abierto{creditosAbiertos.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#6A1B9A", margin: 0 }}>{fmt(totalEnCalle)}</p>
              <p style={{ fontSize: 10, color: "var(--mid)", margin: "2px 0 0" }}>por cobrar</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {creditosAbiertos
              .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
              .map(f => {
                const dias = diasDesde(f.fecha);
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 12, background: urgBg(dias), gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.clienteNombre || f.clienteCredito || "Sin nombre"}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>
                        {new Date(f.fecha).toLocaleDateString("es-CO")} · {urgLabel(dias)}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: urgColor(dias), margin: 0 }}>{fmt(f.total)}</p>
                      </div>
                      <button
                        onClick={() => marcarPagado(f)}
                        disabled={marcando === f.id}
                        style={{ background: marcando === f.id ? "var(--border)" : "var(--success)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        {marcando === f.id ? "…" : "✓ Pagado"}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Tiers de urgencia */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#7B1FA2" }}>🟣 0-6d normal</span>
            <span style={{ fontSize: 10, color: "var(--warn)" }}>⚠️ 7-13d urgente</span>
            <span style={{ fontSize: 10, color: "var(--danger)" }}>🔴 14d+ crítico</span>
          </div>
        </div>
      )}

      {/* ── STOCK ALERTAS ── */}
      {(alertas.length > 0 || agotadas.length > 0) && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1.5px solid #FFB74D", boxShadow: "0 4px 20px rgba(230,81,0,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="alert" size={16} color="var(--warn)" />
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, color: "var(--warn)", margin: 0 }}>Stock crítico</p>
                <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>
                  {agotadas.length} agotada{agotadas.length !== 1 ? "s" : ""} · {alertas.length} con stock bajo
                </p>
              </div>
            </div>
            {valorEnRiesgo > 0 && (
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)", margin: 0 }}>{fmt(valorEnRiesgo)}</p>
                <p style={{ fontSize: 10, color: "var(--mid)", margin: "2px 0 0" }}>en riesgo</p>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...agotadas, ...alertas].map(p => {
              const agotada = Number(p.stock) === 0;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: agotada ? "#FFEBEE" : "#FFF3E0" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--dark)", margin: 0 }}>{p.descripcion}</p>
                    <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>{p.codigo}{p.sku ? ` · SKU: ${p.sku}` : ""}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: agotada ? "var(--danger)" : "var(--warn)" }}>
                      {agotada ? "🔴 Agotado" : `⚠️ ${fmtNum(p.stock)} uds`}
                    </span>
                    {!agotada && p.precioVenta && (
                      <p style={{ fontSize: 10, color: "var(--mid)", margin: "2px 0 0" }}>{fmt(Number(p.precioVenta) * Number(p.stock))} en tienda</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
