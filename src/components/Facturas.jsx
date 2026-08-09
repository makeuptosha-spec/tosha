import { useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, Icon, CATEGORIAS_GASTO, HOGAR_ID, mesActual } from "../utils.jsx";

const estadoFactura = (factura, pagosFactura) => {
  const mes = mesActual();
  const pago = pagosFactura.find(p => p.facturaRecurrenteId === factura.id && p.mes === mes);
  if (pago?.pagado) return { estado: "pagada", pago };
  const hoy = new Date().getDate();
  if (hoy > Number(factura.diaVencimiento)) return { estado: "vencida", pago: null };
  return { estado: "pendiente", pago: null };
};

const ESTILO_ESTADO = {
  pagada:   { bg: "#E8F5E9", color: "var(--success)", label: "✅ Pagada" },
  vencida:  { bg: "#FFEBEE", color: "var(--danger)",  label: "🔴 Vencida" },
  pendiente:{ bg: "var(--accent-pale)", color: "var(--accent)", label: "⏳ Pendiente" },
};

export default function Facturas({ facturasRecurrentes, setFacturasRecurrentes, pagosFactura, setPagosFactura, setMovimientos, cuentas }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [facturaAEliminar, setFacturaAEliminar] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [montoPago, setMontoPago] = useState("");
  const [cuentaPago, setCuentaPago] = useState("");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [toast, setToast] = useState(null);

  const formBase = { nombre: "", montoEstimado: "", categoria: "", cuentaId: "", diaVencimiento: "1" };
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

  const guardar = async () => {
    if (!form.nombre || !form.montoEstimado || !form.categoria || !form.cuentaId || !form.diaVencimiento) return showToast("⚠️ Completa todos los campos", "warn");
    const datos = {
      nombre: form.nombre, montoEstimado: Number(form.montoEstimado), categoria: form.categoria,
      cuentaId: form.cuentaId, diaVencimiento: Number(form.diaVencimiento), activa: true, hogarId: HOGAR_ID
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
    setForm({ nombre: f.nombre, montoEstimado: String(f.montoEstimado), categoria: f.categoria, cuentaId: f.cuentaId, diaVencimiento: String(f.diaVencimiento) });
    setEditandoId(f.id); setMostrarForm(true);
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
  };

  const confirmarPago = async () => {
    if (!pagando || !montoPago || !cuentaPago) return;
    setGuardandoPago(true);
    try {
      const fecha = new Date().toISOString();
      const nuevoMovimiento = {
        tipo: "gasto", monto: Number(montoPago), categoria: pagando.categoria, cuentaId: cuentaPago,
        descripcion: pagando.nombre, fecha, facturaRecurrenteId: pagando.id, hogarId: HOGAR_ID, fechaCreacion: fecha
      };
      const movRef = await addDoc(collection(db, "movimientos"), nuevoMovimiento);
      setMovimientos(m => [{ id: movRef.id, ...nuevoMovimiento }, ...m]);

      const nuevoPago = { facturaRecurrenteId: pagando.id, mes: mesActual(), pagado: true, fechaPago: fecha, montoPagado: Number(montoPago), movimientoId: movRef.id, hogarId: HOGAR_ID };
      const pagoRef = await addDoc(collection(db, "pagosFactura"), nuevoPago);
      setPagosFactura(p => [{ id: pagoRef.id, ...nuevoPago }, ...p]);

      showToast(`✅ ${pagando.nombre} marcada como pagada`);
      setPagando(null); setMontoPago(""); setCuentaPago("");
    } catch { showToast("❌ Error al registrar el pago", "danger"); }
    finally { setGuardandoPago(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--dark)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
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
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
          <div className="animate" style={{ background: "white", padding: 26, borderRadius: 24, width: "90%", maxWidth: 380, boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 16 }}>Marcar "{pagando.nombre}" como pagada</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto pagado</label>
                <input type="text" value={montoPago ? fmtNum(montoPago) : ""} onChange={e => setMontoPago(parseNum(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>Cuenta desde donde pagas</label>
                <select value={cuentaPago} onChange={e => setCuentaPago(e.target.value)}>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setPagando(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
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
          <div className="animate" style={{ background: "white", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "#FFEBEE", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
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
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--dark)", margin: 0, flexShrink: 0 }}>{fmt(f.montoEstimado)}</p>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                {f.estado !== "pagada" && (
                  <button onClick={() => abrirPago(f)} style={{ flex: 1, background: "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700 }}>
                    ✅ Marcar pagada
                  </button>
                )}
                <button onClick={() => abrirEdicion(f)} style={{ flex: f.estado === "pagada" ? 1 : "0 0 auto", background: "var(--bg)", color: "var(--primary-deep)", border: "1px solid var(--primary-soft)", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
                <button onClick={() => setFacturaAEliminar(f)} style={{ flex: "0 0 auto", background: "#FFEBEE", color: "var(--danger)", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
