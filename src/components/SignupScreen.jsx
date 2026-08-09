import { useState } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

const ERRORES = {
  "auth/email-already-in-use": "Ese correo ya tiene una cuenta. Iniciá sesión en vez de registrarte.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/invalid-email": "Correo inválido.",
};

export default function SignupScreen({ onVolverLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const inputStyle = {
    border: "1px solid #30363d", borderRadius: 6, padding: "8px 12px",
    fontSize: 14, width: "100%", outline: "none", background: "#0d1117", color: "#e6edf3",
    boxShadow: "inset 0 1px 0 rgba(0,0,0,0.2)",
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmar) return setError("Las contraseñas no coinciden.");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    setCargando(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(ERRORES[err.code] || "Error al crear la cuenta: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", background: "#010409", padding: "40px 20px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
        <div className="money-float" style={{ width: 96, height: 96, borderRadius: "50%", background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, boxShadow: "0 8px 28px rgba(16,185,129,0.4)" }}>
          💰
        </div>
      </div>

      <div className="animate" style={{ width: "100%", maxWidth: 320, background: "#0d1117", border: "1px solid #30363d", borderRadius: 10, padding: "24px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: "#f0f6fc", marginBottom: 6 }}>Crear cuenta</h2>
        <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 18 }}>Tu correo debe estar autorizado por el administrador pa acceder a los datos.</p>

        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>Confirmar contraseña</label>
            <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} required style={inputStyle} />
          </div>

          {error && (
            <div style={{ background: "#3d1418", border: "1px solid #6e2029", color: "#ffa1a8", fontSize: 12, padding: "8px 12px", borderRadius: 6 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={cargando}
            style={{ marginTop: 4, background: "var(--primary)", color: "#04120c", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6, padding: "8px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: cargando ? 0.7 : 1 }}>
            {cargando ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <button onClick={onVolverLogin} style={{ marginTop: 16, background: "transparent", border: "none", color: "#8b949e", fontSize: 12, textDecoration: "underline", width: "100%", textAlign: "center" }}>
          Ya tengo cuenta — Iniciar sesión
        </button>
      </div>
    </div>
  );
}
