import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { Icon } from "../utils.jsx";

export default function Usuarios({ onClose }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const emailPropio = auth.currentUser?.email;

  useEffect(() => {
    getDocs(collection(db, "usuariosPermitidos"))
      .then(snap => setUsuarios(snap.docs.map(d => ({ email: d.id, ...d.data() }))))
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  const agregarUsuario = async (e) => {
    e.preventDefault();
    setError("");
    const email = nuevoEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return setError("Correo inválido.");
    if (usuarios.some(u => u.email === email)) return setError("Ese correo ya está autorizado.");
    setGuardando(true);
    try {
      const datos = { agregadoPor: emailPropio, fecha: new Date().toISOString() };
      await setDoc(doc(db, "usuariosPermitidos", email), datos);
      setUsuarios(u => [...u, { email, ...datos }]);
      setNuevoEmail("");
    } catch (err) {
      setError("Error al agregar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitarUsuario = async (email) => {
    try {
      await deleteDoc(doc(db, "usuariosPermitidos", email));
      setUsuarios(u => u.filter(x => x.email !== email));
    } catch (err) {
      setError("Error al quitar: " + err.message);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="animate" style={{ background: "var(--white)", borderRadius: 24, padding: 28, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: "var(--primary-deep)", margin: 0 }}>Usuarios autorizados</h3>
          <button onClick={onClose} style={{ background: "var(--bg)", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 18, color: "var(--mid)" }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--mid)", marginBottom: 20 }}>Solo los correos de esta lista pueden ver los datos de la app. Agregá a alguien y decile que se registre en la pantalla de login con ese mismo correo.</p>

        <form onSubmit={agregarUsuario} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input type="email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} placeholder="correo@ejemplo.com" style={{ flex: 1 }} />
          <button type="submit" disabled={guardando} style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "0 18px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
            {guardando ? "…" : "+ Agregar"}
          </button>
        </form>

        {error && <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)", fontSize: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>{error}</div>}

        {cargando ? (
          <p style={{ fontSize: 13, color: "var(--mid)", textAlign: "center", padding: 20 }}>Cargando…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--primary-pale)", borderRadius: 12, padding: "10px 14px" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary-deep)" }}>makeuptosha@gmail.com</span>
              <span style={{ fontSize: 10, color: "var(--primary-deep)", fontWeight: 700, textTransform: "uppercase" }}>Dueño</span>
            </div>
            {usuarios.length === 0 && <p style={{ fontSize: 12, color: "var(--mid)", textAlign: "center", padding: "12px 0" }}>Sin usuarios adicionales todavía.</p>}
            {usuarios.map(u => (
              <div key={u.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)", borderRadius: 12, padding: "10px 14px" }}>
                <span style={{ fontSize: 13, color: "var(--dark)" }}>{u.email}</span>
                <button onClick={() => quitarUsuario(u.email)} style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="trash" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
