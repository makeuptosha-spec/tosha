import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { LoaderInteractivo, Icon, globalStyles, fetchPropio, initTema, useTema, asegurarCategorias, sincronizarConfiguracion, useMoneda, congelarEstimadosMesAnterior } from "./utils.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import SignupScreen from "./components/SignupScreen.jsx";
import Inicio from "./components/Inicio.jsx";
import Movimientos from "./components/Movimientos.jsx";
import Cuentas from "./components/Cuentas.jsx";
import Facturas from "./components/Facturas.jsx";
import Conf from "./components/Conf.jsx";
import Usuarios from "./components/Usuarios.jsx";

initTema();

export default function App() {
  const [tema, toggleTema] = useTema();
  useMoneda();
  const [usuario, setUsuario] = useState(undefined);
  const [vistaAuth, setVistaAuth] = useState("login");
  const [tab, setTab] = useState("inicio");
  const [mostrarUsuarios, setMostrarUsuarios] = useState(false);
  const [noAutorizado, setNoAutorizado] = useState(false);
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [facturasRecurrentes, setFacturasRecurrentes] = useState([]);
  const [pagosFactura, setPagosFactura] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUsuario(user));
    return unsub;
  }, []);

  useEffect(() => {
    if (!usuario) return;
    setNoAutorizado(false);
    const fetchData = async () => {
      try {
        const uid = usuario.uid;
        const [cuentasP, movP, facP, pagosP, deudasP, categoriasP] = await Promise.all([
          fetchPropio("cuentas", uid),
          fetchPropio("movimientos", uid),
          fetchPropio("facturasRecurrentes", uid),
          fetchPropio("pagosFactura", uid),
          fetchPropio("deudas", uid),
          asegurarCategorias(uid),
          sincronizarConfiguracion(uid),
        ]);
        const pagosCongelados = await congelarEstimadosMesAnterior(uid, facP, pagosP);
        setCuentas(cuentasP);
        setMovimientos(movP);
        setFacturasRecurrentes(facP);
        setPagosFactura([...pagosP, ...pagosCongelados]);
        setDeudas(deudasP);
        setCategorias(categoriasP);
      } catch (error) {
        console.error(error);
        if (error.code === "permission-denied") setNoAutorizado(true);
      }
      finally { setCargando(false); }
    };
    fetchData();
  }, [usuario]);

  const tabs = [
    { id: "inicio", label: "Inicio", icon: "dashboard" },
    { id: "movimientos", label: "Movimientos", icon: "chart" },
    { id: "cuentas", label: "Cuentas", icon: "wallet" },
    { id: "facturas", label: "Facturas", icon: "receipt" },
    { id: "conf", label: "Conf", icon: "settings" },
  ];

  if (usuario === undefined) return <><style>{globalStyles}</style><div style={{ minHeight: '100vh', background: 'var(--bg)' }} /></>;
  if (usuario === null) {
    return (
      <>
        <style>{globalStyles}</style>
        {vistaAuth === "login"
          ? <LoginScreen onMostrarSignup={() => setVistaAuth("signup")} />
          : <SignupScreen onVolverLogin={() => setVistaAuth("login")} />}
      </>
    );
  }

  if (cargando) return <><style>{globalStyles}</style><LoaderInteractivo /></>;

  if (noAutorizado) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", background: "var(--bg)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: "var(--dark)", marginBottom: 8 }}>Cuenta creada, esperando autorización</h2>
          <p style={{ fontSize: 13, color: "var(--mid)", maxWidth: 320, marginBottom: 24 }}>
            Tu cuenta (<strong>{usuario.email}</strong>) se creó bien, pero el administrador todavía no autorizó este correo pa ver los datos. Pedile que lo agregue.
          </p>
          <button onClick={() => signOut(auth)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 600, cursor: "pointer" }}>
            Cerrar sesión
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      {mostrarUsuarios && <Usuarios onClose={() => setMostrarUsuarios(false)} />}
      <div className="app-wrapper">
        <div style={{ padding: "0 16px" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 24, fontWeight: 700, color: "var(--primary-deep)", lineHeight: 1 }}>Mis Finanzas</p>
              <p style={{ fontSize: 10, color: "var(--mid)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>Control personal</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={toggleTema} title={tema === "dark" ? "Modo claro" : "Modo oscuro"} style={{ background: "transparent", border: "none", color: "var(--mid)", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, fontSize: 15 }}>{tema === "dark" ? "☀️" : "🌙"}</button>
              <button onClick={() => setMostrarUsuarios(true)} title="Usuarios autorizados" style={{ background: "transparent", border: "none", color: "var(--mid)", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8 }}>👥</button>
              <button onClick={() => signOut(auth)} style={{ background: "transparent", border: "none", color: "var(--danger)", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8 }}>
                <Icon name="logout" size={14} /> Salir
              </button>
            </div>
          </div>

          {tab === "inicio" && <Inicio cuentas={cuentas} movimientos={movimientos} facturasRecurrentes={facturasRecurrentes} pagosFactura={pagosFactura} deudas={deudas} />}
          {tab === "movimientos" && <Movimientos movimientos={movimientos} setMovimientos={setMovimientos} cuentas={cuentas} categorias={categorias} />}
          {tab === "cuentas" && <Cuentas cuentas={cuentas} setCuentas={setCuentas} movimientos={movimientos} setMovimientos={setMovimientos} />}
          {tab === "facturas" && <Facturas facturasRecurrentes={facturasRecurrentes} setFacturasRecurrentes={setFacturasRecurrentes} pagosFactura={pagosFactura} setPagosFactura={setPagosFactura} setMovimientos={setMovimientos} cuentas={cuentas} deudas={deudas} setDeudas={setDeudas} categorias={categorias} />}
          {tab === "conf" && <Conf categorias={categorias} setCategorias={setCategorias} />}
        </div>

        <nav className="nav-menu no-print">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="nav-item" style={{ color: tab === t.id ? "var(--primary)" : "var(--mid)" }}>
              <div style={{ padding: "8px 20px", borderRadius: 100, background: tab === t.id ? "var(--primary-pale)" : "transparent", transition: "background 0.2s" }}><Icon name={t.icon} size={22} /></div>
              <span style={{ fontSize: 11, fontWeight: tab === t.id ? 700 : 500, marginTop: 4 }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
