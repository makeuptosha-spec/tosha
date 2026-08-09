import { useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, fmtFecha, Icon, ProgressBar, HOGAR_ID } from "../utils.jsx";

export default function MetasAhorro({ metas, setMetas, cuentas, setMovimientos }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [metaAEliminar, setMetaAEliminar] = useState(null);
  const [moviendo, setMoviendo] = useState(null); // { meta, accion: "aportar" | "retirar" }
  const [montoMov, setMontoMov] = useState("");
  const [cuentaMov, setCuentaMov] = useState("");
  const [guardandoMov, setGuardandoMov] = useState(false);
  const [toast, setToast] = useState(null);

  const formBase = { nombre: "", montoObjetivo: "", fechaObjetivo: "" };
  const [form, setForm] = useState(formBase);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const metasConProgreso = useMemo(() =>
    metas.filter(m => m.activa !== false).map(m => ({
      ...m, pct: m.montoObjetivo > 0 ? Math.round((Number(m.montoActual) / Number(m.montoObjetivo)) * 100) : 0
    })),
    [metas]
  );

  const totalAhorrado = metasConProgreso.reduce((s, m) => s + Number(m.montoActual), 0);

  const guardar = async () => {
    if (!form.nombre || !form.montoObjetivo) return showToast("⚠️ Completa nombre y objetivo", "warn");
    const datos = { nombre: form.nombre, montoObjetivo: Number(form.montoObjetivo), fechaObjetivo: form.fechaObjetivo || null, activa: true, hogarId: HOGAR_ID };
    try {
      if (editandoId) {
        await updateDoc(doc(db, "metas", editandoId), datos);
        setMetas(m => m.map(x => x.id === editandoId ? { ...x, ...datos } : x));
        showToast("✅ Meta actualizada");
      } else {
        datos.montoActual = 0;
        datos.fechaCreacion = new Date().toISOString();
        const ref = await addDoc(collection(db, "metas"), datos);
        setMetas(m => [{ id: ref.id, ...datos }, ...m]);
        showToast("✅ Meta creada");
      }
      setForm(formBase); setEditandoId(null); setMostrarForm(false);
    } catch { showToast("❌ Error al guardar", "danger"); }
  };

  const abrirEdicion = (m) => {
    setForm({ nombre: m.nombre, montoObjetivo: String(m.montoObjetivo), fechaObjetivo: m.fechaObjetivo || "" });
    setEditandoId(m.id); setMostrarForm(true);
  };

  const confirmarEliminar = async () => {
    if (!metaAEliminar) return;
    try {
      await deleteDoc(doc(db, "metas", metaAEliminar.id));
      setMetas(m => m.filter(x => x.id !== metaAEliminar.id));
      setMetaAEliminar(null);
      showToast("🗑️ Meta eliminada");
    } catch { showToast("❌ Error al eliminar", "danger"); }
  };

  const abrirMovimiento = (meta, accion) => { setMoviendo({ meta, accion }); setMontoMov(""); setCuentaMov(cuentas[0]?.id || ""); };

  const confirmarMovimiento = async () => {
    if (!moviendo || !montoMov || !cuentaMov) return;
    setGuardandoMov(true);
    try {
      const { meta, accion } = moviendo;
      const fecha = new Date().toISOString();
      const monto = Number(montoMov);
      const esAporte = accion === "aportar";

      const nuevoMovimiento = {
        tipo: esAporte ? "gasto" : "ingreso", monto, categoria: "Ahorro", cuentaId: cuentaMov,
        descripcion: `${esAporte ? "Aporte a" : "Retiro de"} meta: ${meta.nombre}`, fecha, metaId: meta.id,
        hogarId: HOGAR_ID, fechaCreacion: fecha
      };
      const movRef = await addDoc(collection(db, "movimientos"), nuevoMovimiento);
      setMovimientos(mv => [{ id: movRef.id, ...nuevoMovimiento }, ...mv]);

      const nuevoMontoActual = Math.max(0, Number(meta.montoActual) + (esAporte ? monto : -monto));
      await updateDoc(doc(db, "metas", meta.id), { montoActual: nuevoMontoActual });
      setMetas(m => m.map(x => x.id === meta.id ? { ...x, montoActual: nuevoMontoActual } : x));

      showToast(nuevoMontoActual >= meta.montoObjetivo ? `🎉 ¡Meta "${meta.nombre}" cumplida!` : "✅ Registrado");
      setMoviendo(null); setMontoMov(""); setCuentaMov("");
    } catch { showToast("❌ Error al registrar", "danger"); }
    finally { setGuardandoMov(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--dark)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background: "linear-gradient(135deg, var(--primary-deep) 0%, var(--primary) 100%)", borderRadius: 20, padding: 20, color: "#fff" }}>
        <p style={{ fontSize: 11, opacity: 0.85, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Total ahorrado</p>
        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 800, marginTop: 4 }}>{fmt(totalAhorrado)}</p>
      </div>

      <button onClick={() => { setMostrarForm(!mostrarForm); setEditandoId(null); setForm(formBase); }}
        style={{ background: mostrarForm ? "var(--mid)" : "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 14, padding: "13px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {mostrarForm ? <><Icon name="close" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Nueva meta de ahorro</>}
      </button>

      {mostrarForm && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Nombre</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Viaje a fin de año, Fondo de emergencia" />
          </div>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto objetivo</label>
              <input type="text" value={form.montoObjetivo ? fmtNum(form.montoObjetivo) : ""} onChange={e => setForm({ ...form, montoObjetivo: parseNum(e.target.value) })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Fecha objetivo (opcional)</label>
              <input type="date" value={form.fechaObjetivo} onChange={e => setForm({ ...form, fechaObjetivo: e.target.value })} />
            </div>
          </div>
          <button onClick={guardar} style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14 }}>
            {editandoId ? "Actualizar" : "Guardar"}
          </button>
        </div>
      )}

      {moviendo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 26, borderRadius: 24, width: "90%", maxWidth: 380, boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 16 }}>
              {moviendo.accion === "aportar" ? "Aportar a" : "Retirar de"} "{moviendo.meta.nombre}"
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto</label>
                <input type="text" value={montoMov ? fmtNum(montoMov) : ""} onChange={e => setMontoMov(parseNum(e.target.value))} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>{moviendo.accion === "aportar" ? "Cuenta desde donde sale" : "Cuenta donde entra"}</label>
                <select value={cuentaMov} onChange={e => setCuentaMov(e.target.value)}>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setMoviendo(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarMovimiento} disabled={guardandoMov} style={{ flex: 1, background: "var(--success)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>
                {guardandoMov ? "Guardando…" : "✅ Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {metaAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "#FFEBEE", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Eliminar meta?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>{metaAEliminar.nombre}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setMetaAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {metasConProgreso.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--white)", borderRadius: 20, border: "1.5px dashed var(--border)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
            <p style={{ fontWeight: 700, color: "var(--dark)" }}>Sin metas de ahorro</p>
            <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 4 }}>Ponete un objetivo y empezá a aportar</p>
          </div>
        )}
        {metasConProgreso.map(m => (
          <div key={m.id} className="animate" style={{ background: "var(--white)", borderRadius: 16, padding: "16px 18px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", margin: 0 }}>{m.pct >= 100 ? "🎉 " : ""}{m.nombre}</p>
                {m.fechaObjetivo && <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>Meta: {fmtFecha(m.fechaObjetivo)}</p>}
              </div>
              <p style={{ fontSize: 15, fontWeight: 800, color: "var(--primary-deep)", margin: 0 }}>{fmt(m.montoActual)} <span style={{ fontSize: 11, color: "var(--mid)", fontWeight: 500 }}>/ {fmt(m.montoObjetivo)}</span></p>
            </div>
            <ProgressBar pct={m.pct} color={m.pct >= 100 ? "var(--success)" : "var(--primary)"} bg="var(--bg)" height={9} />
            <p style={{ fontSize: 11, fontWeight: 700, color: m.pct >= 100 ? "var(--success)" : "var(--primary-deep)", marginTop: 6 }}>{m.pct}%</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <button onClick={() => abrirMovimiento(m, "aportar")} style={{ flex: 1, background: "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700 }}>+ Aportar</button>
              {m.montoActual > 0 && <button onClick={() => abrirMovimiento(m, "retirar")} style={{ flex: 1, background: "var(--bg)", color: "var(--mid)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700 }}>− Retirar</button>}
              <button onClick={() => abrirEdicion(m)} style={{ flex: "0 0 auto", background: "var(--bg)", color: "var(--primary-deep)", border: "1px solid var(--primary-soft)", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>✏️</button>
              <button onClick={() => setMetaAEliminar(m)} style={{ flex: "0 0 auto", background: "#FFEBEE", color: "var(--danger)", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
