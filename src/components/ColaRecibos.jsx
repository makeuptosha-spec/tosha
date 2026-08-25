import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc, addDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, hoyLocal, HOGAR_ID, iconoCuenta, calcular4x1000 } from "../utils.jsx";

export default function ColaRecibos({ cuentas, categorias, setMovimientos, onCerrar }) {
  const [borradores, setBorradores] = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(null);

  useEffect(() => {
    getDocs(query(collection(db, "borradores"), where("uid", "==", auth.currentUser.uid)))
      .then(snap => {
        const data = snap.docs
          .map(d => ({ _id: d.id, ...d.data() }))
          .filter(b => b.estado === "pendiente" && (b.tipo === "gasto" || b.tipo === "ingreso"))
          .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
        setBorradores(data);
      })
      .finally(() => setCargando(false));
  }, []);

  const actualizarCampo = (id, campo, valor) =>
    setBorradores(prev => prev.map(b => b._id === id ? { ...b, [campo]: valor } : b));

  const cambiarTipo = (id, tipo) =>
    setBorradores(prev => prev.map(b => b._id === id ? { ...b, tipo, categoriaSugerida: "" } : b));

  const confirmarBorrador = async (b) => {
    if (!b.monto || !b.categoriaSugerida || !b.cuentaId) {
      alert("Completa monto, categoría y cuenta.");
      return;
    }
    setGuardando(b._id);
    try {
      const gmf = b.tipo === "gasto" ? calcular4x1000(cuentas.find(c => c.id === b.cuentaId), b.monto) : 0;
      const nuevoMovimiento = {
        tipo: b.tipo,
        monto: Number(b.monto),
        categoria: b.categoriaSugerida,
        cuentaId: b.cuentaId,
        descripcion: b.comercio || b.descripcion || (b.tipo === "ingreso" ? "Ingreso escaneado" : "Gasto escaneado"),
        fecha: b.fecha || hoyLocal(),
        hogarId: HOGAR_ID, uid: auth.currentUser.uid,
        fechaCreacion: new Date().toISOString()
      };
      if (gmf) nuevoMovimiento.gmf4x1000 = gmf;
      const ref = await addDoc(collection(db, "movimientos"), nuevoMovimiento);
      setMovimientos(m => [{ id: ref.id, ...nuevoMovimiento }, ...m]);
      await deleteDoc(doc(db, "borradores", b._id));
      setBorradores(prev => {
        const restantes = prev.filter(x => x._id !== b._id);
        if (restantes.length === 0 && onCerrar) onCerrar();
        return restantes;
      });
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setGuardando(null);
    }
  };

  const descartarBorrador = async (id) => {
    await deleteDoc(doc(db, "borradores", id));
    setBorradores(prev => {
      const restantes = prev.filter(b => b._id !== id);
      if (restantes.length === 0 && onCerrar) onCerrar();
      return restantes;
    });
  };

  if (cargando) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--mid)" }}>Cargando recibos…</div>
  );

  if (borradores.length === 0) return (
    <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--white)", borderRadius: 20, border: "1.5px dashed var(--border)" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
      <p style={{ fontWeight: 700, color: "var(--dark)", fontSize: 16 }}>Sin recibos pendientes</p>
      <p style={{ fontSize: 13, color: "var(--mid)" }}>Escanea un recibo pa comenzar</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {borradores.map(b => (
        <div key={b._id} style={{ background: "var(--bg)", borderRadius: 16, padding: 16, border: "1.5px solid var(--primary-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ fontSize: 11, background: "var(--primary-pale)", color: "var(--primary-deep)", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>🧾 {b.comercio || "Recibo escaneado"}</span>
            <button onClick={() => descartarBorrador(b._id)} style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 600 }}>Descartar</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => cambiarTipo(b._id, "gasto")} style={{ flex: 1, background: b.tipo === "gasto" ? "var(--danger)" : "var(--bg)", color: b.tipo === "gasto" ? "#fff" : "var(--mid)", border: "none", borderRadius: 12, padding: "10px", fontWeight: 700, fontSize: 13 }}>💸 Gasto</button>
              <button onClick={() => cambiarTipo(b._id, "ingreso")} style={{ flex: 1, background: b.tipo === "ingreso" ? "var(--success)" : "var(--bg)", color: b.tipo === "ingreso" ? "#fff" : "var(--mid)", border: "none", borderRadius: 12, padding: "10px", fontWeight: 700, fontSize: 13 }}>💰 Ingreso</button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Monto</label>
                <input type="text" value={b.monto ? fmtNum(b.monto) : ""} onChange={e => actualizarCampo(b._id, "monto", parseNum(e.target.value))} style={{ marginTop: 4, width: "100%" }} />
              </div>
              <div style={{ flex: "0 0 132px", overflow: "hidden" }}>
                <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Fecha</label>
                <input type="date" value={(b.fecha || "").slice(0, 10)} onChange={e => actualizarCampo(b._id, "fecha", e.target.value)} style={{ marginTop: 4, width: "100%", fontSize: 13, padding: "10px 8px" }} />
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Categoría</label>
                <select value={b.categoriaSugerida || ""} onChange={e => actualizarCampo(b._id, "categoriaSugerida", e.target.value)} style={{ marginTop: 4 }}>
                  <option value="">Selecciona…</option>
                  {categorias.filter(c => c.tipo === (b.tipo === "ingreso" ? "ingreso" : "gasto")).map(c => <option key={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Cuenta</label>
                <select value={b.cuentaId || ""} onChange={e => actualizarCampo(b._id, "cuentaId", e.target.value)} style={{ marginTop: 4 }}>
                  <option value="">Selecciona…</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{iconoCuenta(c)} {c.nombre}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Descripción / comercio</label>
              <input value={b.comercio || ""} onChange={e => actualizarCampo(b._id, "comercio", e.target.value)} style={{ marginTop: 4 }} placeholder="Ej: Éxito, Rappi, Farmatodo" />
            </div>

            <button
              onClick={() => confirmarBorrador(b)}
              disabled={guardando === b._id}
              style={{ background: guardando === b._id ? "var(--border)" : "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 14, padding: "13px", fontWeight: 700, fontSize: 14 }}
            >
              {guardando === b._id ? "Guardando…" : `✅ Confirmar ${b.tipo === "ingreso" ? "ingreso" : "gasto"} de ${fmt(b.monto || 0)}`}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
