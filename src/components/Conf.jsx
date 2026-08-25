import { useState, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Icon, MONEDAS, useMoneda, guardarMoneda } from "../utils.jsx";

export default function Conf({ categorias, setCategorias }) {
  const monedaActual = useMoneda();
  const [guardandoMoneda, setGuardandoMoneda] = useState(false);
  const [tipoTab, setTipoTab] = useState("gasto");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdicion, setNombreEdicion] = useState("");
  const [aEliminar, setAEliminar] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const cambiarMoneda = async (id) => {
    if (id === monedaActual || guardandoMoneda) return;
    setGuardandoMoneda(true);
    try {
      await guardarMoneda(auth.currentUser.uid, id);
      showToast("✅ Moneda actualizada");
    } catch {
      showToast("❌ Error al guardar la moneda", "danger");
    } finally {
      setGuardandoMoneda(false);
    }
  };

  const categoriasDelTab = useMemo(() =>
    categorias.filter(c => c.tipo === tipoTab).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre)),
    [categorias, tipoTab]
  );

  const crearCategoria = async () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    const datos = { nombre, tipo: tipoTab, uid: auth.currentUser.uid, orden: categoriasDelTab.length };
    try {
      const ref = await addDoc(collection(db, "categorias"), datos);
      setCategorias(c => [...c, { id: ref.id, ...datos }]);
      setNuevaCategoria("");
    } catch {
      showToast("❌ Error al crear categoría", "danger");
    }
  };

  const abrirEdicion = (c) => { setEditandoId(c.id); setNombreEdicion(c.nombre); };

  const guardarEdicion = async (id) => {
    const nombre = nombreEdicion.trim();
    if (!nombre) return setEditandoId(null);
    try {
      await updateDoc(doc(db, "categorias", id), { nombre });
      setCategorias(c => c.map(x => x.id === id ? { ...x, nombre } : x));
    } catch {
      showToast("❌ Error al renombrar", "danger");
    } finally {
      setEditandoId(null);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      await deleteDoc(doc(db, "categorias", aEliminar.id));
      setCategorias(c => c.filter(x => x.id !== aEliminar.id));
      showToast("🗑️ Categoría eliminada");
    } catch {
      showToast("❌ Error al eliminar", "danger");
    } finally {
      setAEliminar(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--ink)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", marginBottom: 12 }}>💱 Moneda</p>
        <div style={{ display: "flex", gap: 8 }}>
          {MONEDAS.map(m => (
            <button key={m.id} onClick={() => cambiarMoneda(m.id)} disabled={guardandoMoneda}
              style={{ flex: 1, background: monedaActual === m.id ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "var(--bg)", color: monedaActual === m.id ? "#fff" : "var(--mid)", border: "none", borderRadius: 12, padding: "12px", fontWeight: 700, fontSize: 13 }}>
              {m.id}
              <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.85, marginTop: 2 }}>{m.label}</div>
            </button>
          ))}
        </div>
        {monedaActual === "USD" && <p style={{ fontSize: 11, color: "var(--mid)", marginTop: 10 }}>El 4x1000 (impuesto colombiano) no aplica en USD.</p>}
      </div>

      <div style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", marginBottom: 12 }}>🏷️ Categorías</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setTipoTab("gasto")} style={{ flex: 1, background: tipoTab === "gasto" ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "var(--bg)", color: tipoTab === "gasto" ? "#fff" : "var(--mid)", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700 }}>💸 Gasto</button>
          <button onClick={() => setTipoTab("ingreso")} style={{ flex: 1, background: tipoTab === "ingreso" ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "var(--bg)", color: tipoTab === "ingreso" ? "#fff" : "var(--mid)", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700 }}>💰 Ingreso</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {categoriasDelTab.length === 0 && <p style={{ fontSize: 12, color: "var(--mid)", textAlign: "center", padding: "12px 0" }}>Sin categorías de {tipoTab}</p>}
          {categoriasDelTab.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", borderRadius: 12, padding: "8px 10px" }}>
              {editandoId === c.id ? (
                <input autoFocus value={nombreEdicion} onChange={e => setNombreEdicion(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && guardarEdicion(c.id)}
                  style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 13 }} />
              ) : (
                <span style={{ flex: 1, fontSize: 13, color: "var(--dark)" }}>{c.nombre}</span>
              )}
              {editandoId === c.id ? (
                <button onClick={() => guardarEdicion(c.id)} style={{ background: "var(--primary-pale)", border: "none", borderRadius: 8, width: 28, height: 28, color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={13} /></button>
              ) : (
                <button onClick={() => abrirEdicion(c)} style={{ background: "var(--white)", border: "none", borderRadius: 8, width: 28, height: 28, color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={12} /></button>
              )}
              <button onClick={() => setAEliminar(c)} disabled={categoriasDelTab.length === 1}
                title={categoriasDelTab.length === 1 ? "Debe quedar al menos una categoría" : "Eliminar"}
                style={{ background: "var(--danger-bg)", border: "none", borderRadius: 8, width: 28, height: 28, color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", opacity: categoriasDelTab.length === 1 ? 0.4 : 1, cursor: categoriasDelTab.length === 1 ? "not-allowed" : "pointer" }}>
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)}
            onKeyDown={e => e.key === "Enter" && crearCategoria()}
            placeholder={`Nueva categoría de ${tipoTab}...`}
            style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }} />
          <button onClick={crearCategoria} style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 10, width: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>

      {aEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "var(--white)", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "var(--danger-bg)", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Eliminar categoría?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>{aEliminar.nombre}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
