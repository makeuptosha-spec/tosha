import { useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, esEsteMes, Icon, ProgressBar, CATEGORIAS_GASTO, HOGAR_ID } from "../utils.jsx";
import MetasAhorro from "./MetasAhorro.jsx";

const colorPct = (pct) => pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--warn)" : "var(--success)";

export default function Presupuestos({ presupuestos, setPresupuestos, movimientos, metas, setMetas, cuentas, setMovimientos }) {
  const [vista, setVista] = useState("presupuestos");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [presupuestoAEliminar, setPresupuestoAEliminar] = useState(null);
  const [toast, setToast] = useState(null);

  const formBase = { categoria: "", limiteMensual: "" };
  const [form, setForm] = useState(formBase);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const gastosMesPorCategoria = useMemo(() => {
    const mapa = {};
    movimientos.filter(m => m.tipo === "gasto" && esEsteMes(m.fecha)).forEach(m => {
      mapa[m.categoria] = (mapa[m.categoria] || 0) + Number(m.monto);
    });
    return mapa;
  }, [movimientos]);

  const presupuestosConGasto = useMemo(() =>
    presupuestos.map(p => {
      const gastado = gastosMesPorCategoria[p.categoria] || 0;
      const pct = p.limiteMensual > 0 ? Math.round((gastado / p.limiteMensual) * 100) : 0;
      return { ...p, gastado, pct };
    }).sort((a, b) => b.pct - a.pct),
    [presupuestos, gastosMesPorCategoria]
  );

  const categoriasDisponibles = CATEGORIAS_GASTO.filter(c => !presupuestos.some(p => p.categoria === c) || c === form.categoria);

  const guardar = async () => {
    if (!form.categoria || !form.limiteMensual) return showToast("⚠️ Completa categoría y límite", "warn");
    const datos = { categoria: form.categoria, limiteMensual: Number(form.limiteMensual), hogarId: HOGAR_ID };
    try {
      if (editandoId) {
        await updateDoc(doc(db, "presupuestos", editandoId), datos);
        setPresupuestos(p => p.map(x => x.id === editandoId ? { id: editandoId, ...datos } : x));
        showToast("✅ Presupuesto actualizado");
      } else {
        const ref = await addDoc(collection(db, "presupuestos"), datos);
        setPresupuestos(p => [{ id: ref.id, ...datos }, ...p]);
        showToast("✅ Presupuesto creado");
      }
      setForm(formBase); setEditandoId(null); setMostrarForm(false);
    } catch { showToast("❌ Error al guardar", "danger"); }
  };

  const abrirEdicion = (p) => {
    setForm({ categoria: p.categoria, limiteMensual: String(p.limiteMensual) });
    setEditandoId(p.id); setMostrarForm(true);
  };

  const confirmarEliminar = async () => {
    if (!presupuestoAEliminar) return;
    try {
      await deleteDoc(doc(db, "presupuestos", presupuestoAEliminar.id));
      setPresupuestos(p => p.filter(x => x.id !== presupuestoAEliminar.id));
      setPresupuestoAEliminar(null);
      showToast("🗑️ Presupuesto eliminado");
    } catch { showToast("❌ Error al eliminar", "danger"); }
  };

  const toggleBar = (
    <div style={{ display: "flex", gap: 8, background: "var(--white)", padding: 6, borderRadius: 14, border: "1px solid var(--border)" }}>
      <button onClick={() => setVista("presupuestos")} style={{ flex: 1, background: vista === "presupuestos" ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "transparent", color: vista === "presupuestos" ? "#fff" : "var(--mid)", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700 }}>🎯 Presupuestos</button>
      <button onClick={() => setVista("ahorro")} style={{ flex: 1, background: vista === "ahorro" ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "transparent", color: vista === "ahorro" ? "#fff" : "var(--mid)", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700 }}>💰 Ahorro</button>
    </div>
  );

  if (vista === "ahorro") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {toggleBar}
        <MetasAhorro metas={metas} setMetas={setMetas} cuentas={cuentas} setMovimientos={setMovimientos} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toggleBar}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--dark)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      <button onClick={() => { setMostrarForm(!mostrarForm); setEditandoId(null); setForm(formBase); }}
        style={{ background: mostrarForm ? "var(--mid)" : "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 14, padding: "13px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {mostrarForm ? <><Icon name="close" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Nuevo presupuesto</>}
      </button>

      {mostrarForm && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Categoría</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} disabled={!!editandoId}>
                <option value="">Selecciona…</option>
                {categoriasDisponibles.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Límite mensual</label>
              <input type="text" value={form.limiteMensual ? fmtNum(form.limiteMensual) : ""} onChange={e => setForm({ ...form, limiteMensual: parseNum(e.target.value) })} placeholder="Ej: 500000" />
            </div>
          </div>
          <button onClick={guardar} style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14 }}>
            {editandoId ? "Actualizar" : "Guardar"}
          </button>
        </div>
      )}

      {presupuestoAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "#FFEBEE", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Eliminar presupuesto?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>{presupuestoAEliminar.categoria}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPresupuestoAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {presupuestosConGasto.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--white)", borderRadius: 20, border: "1.5px dashed var(--border)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
            <p style={{ fontWeight: 700, color: "var(--dark)" }}>Sin presupuestos definidos</p>
            <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 4 }}>Pon un límite mensual a tus categorías de gasto</p>
          </div>
        )}
        {presupuestosConGasto.map(p => (
          <div key={p.id} className="animate" style={{ background: "var(--white)", borderRadius: 18, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", margin: 0 }}>{p.categoria}</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => abrirEdicion(p)} style={{ background: "var(--bg)", border: "none", borderRadius: 8, width: 28, height: 28, color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={12} /></button>
                <button onClick={() => setPresupuestoAEliminar(p)} style={{ background: "#FFEBEE", border: "none", borderRadius: 8, width: 28, height: 28, color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={12} /></button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--mid)" }}>{fmt(p.gastado)} de {fmt(p.limiteMensual)}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: colorPct(p.pct) }}>{p.pct}%</span>
            </div>
            <ProgressBar pct={p.pct} color={colorPct(p.pct)} bg="var(--bg)" />
            {p.pct >= 100 && <p style={{ fontSize: 11, color: "var(--danger)", fontWeight: 700, marginTop: 6 }}>🔴 Superaste el límite en {fmt(p.gastado - p.limiteMensual)}</p>}
            {p.pct >= 80 && p.pct < 100 && <p style={{ fontSize: 11, color: "var(--warn)", fontWeight: 700, marginTop: 6 }}>⚠️ Cerca del límite</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
