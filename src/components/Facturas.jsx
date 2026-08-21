import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { db, auth } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, Icon, CATEGORIAS_GASTO, HOGAR_ID, mesActual, iconoCuenta, registrarImpuesto4x1000, useTema, colorTema } from "../utils.jsx";
import Deudas from "./Deudas.jsx";

export const estadoFactura = (factura, pagosFactura) => {
  const mes = mesActual();
  const pago = pagosFactura.find(p => p.facturaRecurrenteId === factura.id && p.mes === mes);
  if (pago?.pagado) return { estado: "pagada", pago };
  const hoy = new Date().getDate();
  if (hoy > Number(factura.diaVencimiento)) return { estado: "vencida", pago: null };
  return { estado: "pendiente", pago: null };
};

const ESTILO_ESTADO = {
  pagada:   { bg: "var(--success-bg)", color: "var(--success)", label: "✅ Pagada" },
  vencida:  { bg: "var(--danger-bg)", color: "var(--danger)",  label: "🔴 Vencida" },
  pendiente:{ bg: "var(--accent-pale)", color: "var(--accent)", label: "⏳ Pendiente" },
};

const fmtMesCorto = (mesStr) => {
  const [y, m] = mesStr.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-CO", { month: "short" });
};

const TooltipHistorico = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--ink)", color: "#fff", padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
      <div style={{ opacity: 0.75, fontWeight: 500, marginBottom: 4, textTransform: "capitalize" }}>{label}</div>
      {fmt(payload[0].value)}
    </div>
  );
};

const GraficaHistorico = ({ data }) => {
  const [tema] = useTema();
  const c = colorTema(tema);
  return (
    <div style={{ width: "100%", height: 160, marginTop: 14 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.texto, textTransform: "capitalize" }} axisLine={{ stroke: c.grid }} tickLine={false} />
          <YAxis width={0} tick={false} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipHistorico />} cursor={{ fill: "var(--primary-pale)" }} />
          <Bar dataKey="total" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => <Cell key={d.mes} fill={i === data.length - 1 ? "var(--accent)" : "var(--primary-soft)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function Facturas({ facturasRecurrentes, setFacturasRecurrentes, pagosFactura, setPagosFactura, setMovimientos, cuentas, deudas, setDeudas }) {
  const [vista, setVista] = useState("fijas");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [facturaAEliminar, setFacturaAEliminar] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [montoPago, setMontoPago] = useState("");
  const [cuentaPago, setCuentaPago] = useState("");
  const [yaPagado, setYaPagado] = useState(false);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [toast, setToast] = useState(null);

  const formBase = { nombre: "", montoEstimado: "", categoria: "", cuentaId: "", diaVencimiento: "1", codigoReferencia: "", urlPago: "" };
  const [form, setForm] = useState(formBase);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const facturasConEstado = useMemo(() =>
    facturasRecurrentes
      .filter(f => f.activa !== false)
      .map(f => ({ ...f, ...estadoFactura(f, pagosFactura) }))
      .sort((a, b) => Number(a.diaVencimiento) - Number(b.diaVencimiento)),
    [facturasRecurrentes, pagosFactura]
  );

  const totalMes = facturasConEstado.reduce((s, f) => s + Number(f.montoEstimado), 0);
  const totalPendiente = facturasConEstado.filter(f => f.estado !== "pagada").reduce((s, f) => s + Number(f.montoEstimado), 0);

  const historico = useMemo(() => {
    const meses = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return meses.map(mes => ({
      mes, label: fmtMesCorto(mes),
      total: pagosFactura.filter(p => p.pagado && p.mes === mes).reduce((s, p) => s + Number(p.montoPagado ?? 0), 0)
    }));
  }, [pagosFactura]);

  const totalMesActual = historico[historico.length - 1]?.total || 0;
  const totalMesAnterior = historico[historico.length - 2]?.total || 0;
  const diferenciaMes = totalMesActual - totalMesAnterior;
  const pctCambioMes = totalMesAnterior > 0 ? Math.round((diferenciaMes / totalMesAnterior) * 100) : null;

  const guardar = async () => {
    if (!form.nombre || !form.montoEstimado || !form.categoria || !form.cuentaId || !form.diaVencimiento) return showToast("⚠️ Completa todos los campos", "warn");
    const datos = {
      nombre: form.nombre, montoEstimado: Number(form.montoEstimado), categoria: form.categoria,
      cuentaId: form.cuentaId, diaVencimiento: Number(form.diaVencimiento), codigoReferencia: form.codigoReferencia || null,
      urlPago: form.urlPago || null,
      activa: true, hogarId: HOGAR_ID, uid: auth.currentUser.uid
    };
    try {
      if (editandoId) {
        await updateDoc(doc(db, "facturasRecurrentes", editandoId), datos);
        setFacturasRecurrentes(f => f.map(x => x.id === editandoId ? { id: editandoId, ...datos } : x));
        showToast("✅ Factura actualizada");
      } else {
        datos.fechaCreacion = new Date().toISOString();
        const ref = await addDoc(collection(db, "facturasRecurrentes"), datos);
        setFacturasRecurrentes(f => [{ id: ref.id, ...datos }, ...f]);
        showToast("✅ Factura recurrente creada");
      }
      setForm(formBase); setEditandoId(null); setMostrarForm(false);
    } catch { showToast("❌ Error al guardar", "danger"); }
  };

  const abrirEdicion = (f) => {
    setForm({ nombre: f.nombre, montoEstimado: String(f.montoEstimado), categoria: f.categoria, cuentaId: f.cuentaId, diaVencimiento: String(f.diaVencimiento), codigoReferencia: f.codigoReferencia || "", urlPago: f.urlPago || "" });
    setEditandoId(f.id); setMostrarForm(true);
  };

  const copiarCodigo = async (codigo) => {
    try { await navigator.clipboard.writeText(codigo); showToast("📋 Código copiado"); }
    catch { showToast("❌ No se pudo copiar", "danger"); }
  };

  const abrirLinkPago = (url) => {
    const conProtocolo = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(conProtocolo, "_blank", "noopener,noreferrer");
  };

  const confirmarEliminar = async () => {
    if (!facturaAEliminar) return;
    try {
      await deleteDoc(doc(db, "facturasRecurrentes", facturaAEliminar.id));
      setFacturasRecurrentes(f => f.filter(x => x.id !== facturaAEliminar.id));
      setFacturaAEliminar(null);
      showToast("🗑️ Factura eliminada");
    } catch { showToast("❌ Error al eliminar", "danger"); }
  };

  const abrirPago = (f) => {
    setPagando(f);
    setMontoPago(String(f.montoEstimado));
    setCuentaPago(f.cuentaId);
    setYaPagado(false);
  };

  const cerrarPago = () => {
    setPagando(null); setMontoPago(""); setCuentaPago(""); setYaPagado(false);
  };

  const confirmarPago = async () => {
    if (!pagando || !montoPago || (!yaPagado && !cuentaPago)) return;
    setGuardandoPago(true);
    try {
      const fecha = new Date().toISOString();
      let movimientoId = null;

      let impuesto = null;
      if (!yaPagado) {
        const nuevoMovimiento = {
          tipo: "gasto", monto: Number(montoPago), categoria: pagando.categoria, cuentaId: cuentaPago,
          descripcion: pagando.nombre, fecha, facturaRecurrenteId: pagando.id, hogarId: HOGAR_ID, uid: auth.currentUser.uid, fechaCreacion: fecha
        };
        const movRef = await addDoc(collection(db, "movimientos"), nuevoMovimiento);
        setMovimientos(m => [{ id: movRef.id, ...nuevoMovimiento }, ...m]);
        movimientoId = movRef.id;
        impuesto = await registrarImpuesto4x1000({ cuenta: cuentas.find(c => c.id === cuentaPago), monto: montoPago, fecha, origen: pagando.nombre, uid: auth.currentUser.uid });
        if (impuesto) setMovimientos(m => [impuesto, ...m]);
      }

      const nuevoPago = { facturaRecurrenteId: pagando.id, mes: mesActual(), pagado: true, fechaPago: fecha, montoPagado: Number(montoPago), movimientoId, hogarId: HOGAR_ID, uid: auth.currentUser.uid };
      const pagoRef = await addDoc(collection(db, "pagosFactura"), nuevoPago);
      setPagosFactura(p => [{ id: pagoRef.id, ...nuevoPago }, ...p]);

      if (Number(montoPago) !== Number(pagando.montoEstimado)) {
        await updateDoc(doc(db, "facturasRecurrentes", pagando.id), { montoEstimado: Number(montoPago) });
        setFacturasRecurrentes(f => f.map(x => x.id === pagando.id ? { ...x, montoEstimado: Number(montoPago) } : x));
      }

      showToast(impuesto ? `✅ ${pagando.nombre} marcada como pagada (+${fmt(impuesto.monto)} de 4x1000)` : `✅ ${pagando.nombre} marcada como pagada`);
      cerrarPago();
    } catch { showToast("❌ Error al registrar el pago", "danger"); }
    finally { setGuardandoPago(false); }
  };

  const toggleBar = (
    <div style={{ display: "flex", gap: 8, background: "var(--white)", padding: 6, borderRadius: 14, border: "1px solid var(--border)" }}>
      <button onClick={() => setVista("fijas")} style={{ flex: 1, background: vista === "fijas" ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "transparent", color: vista === "fijas" ? "#fff" : "var(--mid)", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700 }}>🧾 Facturas fijas</button>
      <button onClick={() => setVista("deudas")} style={{ flex: 1, background: vista === "deudas" ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "transparent", color: vista === "deudas" ? "#fff" : "var(--mid)", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700 }}>🤝 Préstamos y deudas</button>
    </div>
  );

  if (vista === "deudas") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {toggleBar}
        <Deudas deudas={deudas} setDeudas={setDeudas} setMovimientos={setMovimientos} cuentas={cuentas} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toggleBar}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--ink)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* RESUMEN */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "var(--white)", borderRadius: 18, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Total pagos fijos/mes</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--dark)", marginTop: 4 }}>{fmt(totalMes)}</p>
        </div>
        <div style={{ background: totalPendiente > 0 ? "var(--accent-pale)" : "var(--white)", borderRadius: 18, padding: 16, border: `1px solid ${totalPendiente > 0 ? "var(--accent-soft)" : "var(--border)"}`, boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>Pendiente este mes</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)", marginTop: 4 }}>{fmt(totalPendiente)}</p>
        </div>
      </div>

      {/* HISTÓRICO PAGADO POR MES */}
      {historico.some(h => h.total > 0) && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)" }}>📊 Pagado en facturas fijas por mes</p>
            {pctCambioMes !== null && diferenciaMes !== 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: diferenciaMes > 0 ? "var(--danger)" : "var(--success)", background: diferenciaMes > 0 ? "var(--danger-bg)" : "var(--success-bg)", padding: "3px 10px", borderRadius: 20 }}>
                {diferenciaMes > 0 ? "▲" : "▼"} {Math.abs(pctCambioMes)}% vs mes anterior
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>Este mes: <strong style={{ color: "var(--dark)" }}>{fmt(totalMesActual)}</strong> · Mes anterior: <strong style={{ color: "var(--dark)" }}>{fmt(totalMesAnterior)}</strong></p>
          <GraficaHistorico data={historico} />
        </div>
      )}

      <button onClick={() => { setMostrarForm(!mostrarForm); setEditandoId(null); setForm(formBase); }}
        style={{ background: mostrarForm ? "var(--mid)" : "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 14, padding: "13px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {mostrarForm ? <><Icon name="close" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Nueva factura recurrente</>}
      </button>

      {/* FORM */}
      {mostrarForm && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Nombre</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Arriendo, Netflix, Energía" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Ref. / código de factura (opcional)</label>
            <textarea rows={2} value={form.codigoReferencia} onChange={e => setForm({ ...form, codigoReferencia: e.target.value })} placeholder="Ej: número de cuenta/contrato pa pagar" style={{ resize: "vertical", fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Link de pago (opcional)</label>
            <input value={form.urlPago} onChange={e => setForm({ ...form, urlPago: e.target.value })} placeholder="https://..." />
          </div>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto estimado</label>
              <input type="text" value={form.montoEstimado ? fmtNum(form.montoEstimado) : ""} onChange={e => setForm({ ...form, montoEstimado: parseNum(e.target.value) })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Día de vencimiento</label>
              <input type="number" min="1" max="31" value={form.diaVencimiento} onChange={e => setForm({ ...form, diaVencimiento: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Categoría</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                <option value="">Selecciona…</option>
                {CATEGORIAS_GASTO.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Cuenta de pago</label>
              <select value={form.cuentaId} onChange={e => setForm({ ...form, cuentaId: e.target.value })}>
                <option value="">Selecciona…</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{iconoCuenta(c)} {c.nombre}</option>)}
              </select>
            </div>
          </div>
          <button onClick={guardar} style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14 }}>
            {editandoId ? "Actualizar" : "Guardar"}
          </button>
        </div>
      )}

      {/* MODAL PAGAR */}
      {pagando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "var(--white)", padding: 26, borderRadius: 24, width: "90%", maxWidth: 380, boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 16 }}>Marcar "{pagando.nombre}" como pagada</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pagando.codigoReferencia && (
                <div onClick={() => copiarCodigo(pagando.codigoReferencia)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--primary-pale)", padding: "10px 14px", borderRadius: 12, cursor: "pointer" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10, color: "var(--primary-deep)", fontWeight: 700, margin: 0 }}>REF. / CÓDIGO</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pagando.codigoReferencia}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary-deep)", flexShrink: 0 }}>📋 Copiar</span>
                </div>
              )}
              {pagando.urlPago && (
                <button onClick={() => abrirLinkPago(pagando.urlPago)} style={{ background: "var(--accent-pale)", color: "var(--accent)", border: "1px solid var(--accent-soft)", borderRadius: 12, padding: "11px", fontSize: 13, fontWeight: 700 }}>
                  💳 Ir a pagar
                </button>
              )}
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto pagado</label>
                <input type="text" value={montoPago ? fmtNum(montoPago) : ""} onChange={e => setMontoPago(parseNum(e.target.value))} />
              </div>
              <div onClick={() => setYaPagado(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bg)", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border)", cursor: "pointer" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0 }}>Ya pagué esto antes</p>
                  <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>No descuenta de ninguna cuenta, solo marca pagada</p>
                </div>
                <div style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 100, padding: 3, background: yaPagado ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "#A8BDB4", transition: "background 0.2s" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow)", transform: yaPagado ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s" }} />
                </div>
              </div>
              {!yaPagado && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--mid)" }}>Cuenta desde donde pagas</label>
                  <select value={cuentaPago} onChange={e => setCuentaPago(e.target.value)}>
                    {cuentas.map(c => <option key={c.id} value={c.id}>{iconoCuenta(c)} {c.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={cerrarPago} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarPago} disabled={guardandoPago} style={{ flex: 1, background: "var(--success)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>
                {guardandoPago ? "Guardando…" : "✅ Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {facturaAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "var(--white)", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "var(--danger-bg)", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Eliminar factura recurrente?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>{facturaAEliminar.nombre}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setFacturaAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* LISTA */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {facturasConEstado.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--white)", borderRadius: 20, border: "1.5px dashed var(--border)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🧾</div>
            <p style={{ fontWeight: 700, color: "var(--dark)" }}>Sin facturas recurrentes</p>
            <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 4 }}>Agrega tus pagos fijos: arriendo, servicios, suscripciones…</p>
          </div>
        )}
        {facturasConEstado.map(f => {
          const est = ESTILO_ESTADO[f.estado];
          return (
            <div key={f.id} className="animate" style={{ background: "var(--white)", borderRadius: 16, padding: "16px 18px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", margin: 0 }}>{f.nombre}</p>
                    <span style={{ fontSize: 10, background: est.bg, color: est.color, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{est.label}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--mid)", margin: "3px 0 0" }}>{f.categoria} · Vence el {f.diaVencimiento} de cada mes</p>
                  {f.codigoReferencia && (
                    <div style={{ marginTop: 6 }}>
                      <span onClick={() => copiarCodigo(f.codigoReferencia)} title="Copiar código" style={{ fontSize: 10, color: "var(--primary-deep)", background: "var(--primary-pale)", padding: "2px 8px", borderRadius: 20, fontWeight: 700, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>🔖 {f.codigoReferencia}</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--dark)", margin: 0, flexShrink: 0 }}>{fmt(f.montoEstimado)}</p>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12, flexWrap: "wrap" }}>
                {f.estado !== "pagada" && f.urlPago && (
                  <button onClick={() => { abrirLinkPago(f.urlPago); abrirPago(f); }} style={{ flex: "1 1 90px", background: "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700 }}>
                    💳 Pagar y registrar
                  </button>
                )}
                {f.estado !== "pagada" && !f.urlPago && (
                  <button onClick={() => abrirPago(f)} style={{ flex: "1 1 90px", background: "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700 }}>
                    ✅ Marcar pagada
                  </button>
                )}
                <button onClick={() => abrirEdicion(f)} style={{ flex: "0 0 auto", background: "var(--bg)", color: "var(--primary-deep)", border: "1px solid var(--primary-soft)", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
                <button onClick={() => setFacturaAEliminar(f)} style={{ flex: "0 0 auto", background: "var(--danger-bg)", color: "var(--danger)", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
