import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { LoaderInteractivo, Icon, globalStyles } from "./utils.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import Inicio from "./components/Inicio.jsx"; 
import Dashboard from "./components/Dashboard.jsx";
import Inventario from "./components/Inventario.jsx";
import Ventas from "./components/Ventas.jsx";
import CatalogoPublico from "./components/CatalogoPublico.jsx"; // NUEVO

export default function App() {
  const [usuario, setUsuario] = useState(undefined);
  const [tab, setTab] = useState("inicio"); 
  const [prendas, setPrendas] = useState([]); 
  const [ventas, setVentas] = useState([]);
  const [facturas, setFacturas] = useState([]); 
  const [cargando, setCargando] = useState(true);

  // NUEVO ESTADO: Para alternar entre la tienda y el login
  const [mostrarLogin, setMostrarLogin] = useState(false);

  useEffect(() => { 
    const unsub = onAuthStateChanged(auth, (user) => setUsuario(user)); 
    return unsub; 
  }, []);

  useEffect(() => {
    // Si no hay usuario, no cargamos los datos privados del panel
    if (!usuario) return;
    const fetchData = async () => {
      try {
        const prendasSnap = await getDocs(collection(db, "prendas"));
        const ventasSnap = await getDocs(collection(db, "ventas"));
        const facturasSnap = await getDocs(collection(db, "facturas"));

        setPrendas(prendasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setVentas(ventasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setFacturas(facturasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { console.error(error); } 
      finally { setCargando(false); }
    };
    fetchData();
  }, [usuario]);

  const tabs = [ 
    { id: "inicio", label: "Inicio", icon: "dashboard" }, 
    { id: "dashboard", label: "Dashboard", icon: "chart" }, 
    { id: "inventario", label: "Inventario", icon: "inventory" }, 
    { id: "ventas", label: "Ventas", icon: "sales" } 
  ];

  // LOGICA PARA USUARIOS NO AUTENTICADOS (El público o tú entrando a loguearte)
  if (usuario === undefined) return <div style={{ minHeight: '100vh', background: '#FAF8FF' }} />;
  if (usuario === null) {
    return (
      <>
        <style>{globalStyles}</style>
        {!mostrarLogin ? (
          // El público ve esto por defecto
          <CatalogoPublico onLoginClick={() => setMostrarLogin(true)} />
        ) : (
          // Tú ves esto cuando le das al botón secreto
          <div style={{ position: "relative" }}>
            <button onClick={() => setMostrarLogin(false)} style={{ position: "absolute", top: 20, left: 20, zIndex: 10, background: "rgba(255,255,255,0.5)", backdropFilter: "blur(4px)", border: "1px solid var(--border)", borderRadius: 50, padding: "8px 16px", color: "var(--dark)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              ← Volver a la Tienda
            </button>
            <LoginScreen />
          </div>
        )}
      </>
    );
  }

  // Si hay usuario logueado, carga el sistema
  if (cargando) return <><style>{globalStyles}</style><LoaderInteractivo /></>;

  return (
    <>
      <style>{globalStyles}</style>
      <div className="app-wrapper">
        <div style={{ padding: "0 16px" }}>
          
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 24, fontWeight: 700, color: "var(--rosa-deep)", lineHeight: 1 }}>Tosha</p>
              <p style={{ fontSize: 10, color: "var(--mid)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>Panel de gestión</p>
            </div>
            <button onClick={() => {signOut(auth); setMostrarLogin(false);}} style={{ background: "transparent", border: "none", color: "var(--danger)", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8 }}>
               <Icon name="logout" size={14} /> Salir
            </button>
          </div>

          {tab === "inicio"     && <Inicio prendas={prendas} ventas={ventas} facturas={facturas} setFacturas={setFacturas} />}
          {tab === "dashboard"  && <Dashboard prendas={prendas} ventas={ventas} facturas={facturas} />}
          {tab === "inventario" && <Inventario prendas={prendas} setPrendas={setPrendas} />}
          {tab === "ventas"     && <Ventas prendas={prendas} setPrendas={setPrendas} ventas={ventas} setVentas={setVentas} facturas={facturas} setFacturas={setFacturas} />}
        </div>
        
        <nav className="nav-menu no-print">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="nav-item" style={{ color: tab === t.id ? "var(--rosa)" : "var(--mid)" }}>
              <div style={{ padding: "8px 20px", borderRadius: 100, background: tab === t.id ? "var(--rosa-pale)" : "transparent", transition: "background 0.2s" }}><Icon name={t.icon} size={22} /></div>
              <span style={{ fontSize: 11, fontWeight: tab === t.id ? 700 : 500, marginTop: 4 }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}