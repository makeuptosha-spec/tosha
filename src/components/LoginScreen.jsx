import { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); setError(""); setCargando(true);
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Correo o contraseña incorrectos."); } 
    finally { setCargando(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden", background: "radial-gradient(circle at 20% 30%, #fdfbf7 0%, transparent 50%), radial-gradient(circle at 80% 80%, #ffecd2 0%, transparent 50%), radial-gradient(circle at 80% 20%, #f5e6e6 0%, transparent 40%), #e8e1da" }}>
      <div style={{ position: "absolute", top: "5%", left: "10%", width: 300, height: 300, background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.0))", borderRadius: "50%", filter: "blur(1px)", boxShadow: "20px 20px 40px rgba(0,0,0,0.05)" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: 250, height: 250, background: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)", borderRadius: "50%", filter: "blur(2px)", boxShadow: "inset -20px -20px 40px rgba(0,0,0,0.1)" }} />

      <div className="animate" style={{ background: "rgba(255, 255, 255, 0.45)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.6)", borderRadius: 32, padding: "40px 30px", width: "100%", maxWidth: 360, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.05)", zIndex: 2, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36, fontSize: 13, color: "#666" }}><span>Tosha</span></div>
        <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 500, color: "#111", marginBottom: 28 }}>Log in</h1>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", background: "rgba(255, 255, 255, 0.6)", borderRadius: 50, padding: "4px 20px", border: "1px solid rgba(255, 255, 255, 0.8)", boxShadow: "inset 0 2px 5px rgba(0,0,0,0.02)" }}>
            <span style={{ color: "#888", marginRight: 12, fontSize: 15, fontWeight: 600 }}>@</span>
            <input type="email" placeholder="e-mail address" value={email} onChange={e => setEmail(e.target.value)} required style={{ border: "none", background: "transparent", padding: "12px 0", width: "100%", outline: "none", boxShadow: "none", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", background: "rgba(255, 255, 255, 0.6)", borderRadius: 50, padding: "4px 20px", border: "1px solid rgba(255, 255, 255, 0.8)", boxShadow: "inset 0 2px 5px rgba(0,0,0,0.02)" }}>
            <span style={{ color: "#888", marginRight: 12, fontSize: 15 }}>🔑</span>
            <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ border: "none", background: "transparent", padding: "12px 0", width: "100%", outline: "none", boxShadow: "none", fontSize: 13 }} />
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 12, textAlign: "center", marginTop: 4 }}>{error}</div>}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
            <p style={{ fontSize: 10, color: "#777", maxWidth: "60%", lineHeight: 1.4, margin: 0 }}>Acceso restringido. Mantén tus credenciales seguras.</p>
            <button type="submit" disabled={cargando} style={{ background: "#1c0f17", color: "#fff", border: "none", borderRadius: 50, width: 56, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: cargando ? 0.7 : 1 }}>
              {cargando ? <span style={{fontSize: 10}}>...</span> : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>}
            </button>
          </div>
        </form>
      </div>
      <div className="animate" style={{ background: "#1c0f17", color: "#fff", borderRadius: 32, padding: "36px 30px 24px", width: "90%", maxWidth: 320, marginTop: -30, zIndex: 1, position: "relative", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
        <h3 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4, letterSpacing: -0.5 }}>New in</h3>
        <p style={{ color: "#aaa", fontSize: 13 }}>Tosha Beauty</p>
      </div>
    </div>
  );
}