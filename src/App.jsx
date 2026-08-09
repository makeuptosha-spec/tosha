import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { LoaderInteractivo, Icon, globalStyles } from "./utils.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import Inicio from "./components/Inicio.jsx";
import Movimientos from "./components/Movimientos.jsx";
import Cuentas from "./components/Cuentas.jsx";
import Facturas from "./components/Facturas.jsx";
import Presupuestos from "./components/Presupuestos.jsx";

export default function App() {
  const [usuario, setUsuario] = useState(undefined);
  const [tab, setTab] = useState("inicio");
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [facturasRecurrentes, setFacturasRecurrentes] = useState([]);
  const [pagosFactura, setPagosFactura] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUsuario(user));
    return unsub;
  }, []);

  useEffect(() => {
    if (!usuario) return;
    const fetchData = async () => {
      try {
        const [cuentasSnap, movSnap, facSnap, pagosSnap, presSnap] = await Promise.all([
          getDocs(collection(db, "cuentas")),
          getDocs(collection(db, "movimientos")),
          getDocs(collection(db, "facturasRecurrentes")),
          getDocs(collection(db, "pagosFactura")),
          getDocs(collection(db, "presupuestos")),
        ]);
        setCuentas(cuentasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setMovimientos(movSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setFacturasRecurrentes(facSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPagosFactura(pagosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPresupuestos(presSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) { console.error(error); }
      finally { setCargando(false); }
    };
    fetchData();
  }, [usuario]);

  const tabs = [
    { id: "inicio", label: "Inicio", icon: "dashboard" },
    { id: "movimientos", label: "Movimientos", icon: "chart" },
    { id: "cuentas", label: "Cuentas", icon: "wallet" },
    { id: "facturas", label: "Facturas", icon: "receipt" },
    { id: "presupuestos", label: "Metas", icon: "target" },
  ];

  if (usuario === undefined) return <div style={{ minHeight: '100vh', background: '#F6FAF8' }} />;
  if (usuario === null) {
    return (
      <>
        <style>{globalStyles}</style>
        <LoginScreen />
      </>
    );
  }

  if (cargando) return <><style>{globalStyles}</style><LoaderInteractivo /></>;

  return (
    <>
      <style>{globalStyles}</style>
      <div className="app-wrapper">
        <div style={{ padding: "0 16px" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 24, fontWeight: 700, color: "var(--primary-deep)", lineHeight: 1 }}>Mis Finanzas</p>
              <p style={{ fontSize: 10, color: "var(--mid)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>Control personal</p>
            </div>
            <button onClick={() => signOut(auth)} style={{ background: "transparent", border: "none", color: "var(--danger)", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8 }}>
              <Icon name="logout" size={14} /> Salir
            </button>
          </div>

          {tab === "inicio" && <Inicio cuentas={cuentas} movimientos={movimientos} facturasRecurrentes={facturasRecurrentes} pagosFactura={pagosFactura} presupuestos={presupuestos} />}
          {tab === "movimientos" && <Movimientos movimientos={movimientos} setMovimientos={setMovimientos} cuentas={cuentas} />}
          {tab === "cuentas" && <Cuentas cuentas={cuentas} setCuentas={setCuentas} movimientos={movimientos} />}
          {tab === "facturas" && <Facturas facturasRecurrentes={facturasRecurrentes} setFacturasRecurrentes={setFacturasRecurrentes} pagosFactura={pagosFactura} setPagosFactura={setPagosFactura} setMovimientos={setMovimientos} cuentas={cuentas} />}
          {tab === "presupuestos" && <Presupuestos presupuestos={presupuestos} setPresupuestos={setPresupuestos} movimientos={movimientos} />}
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
