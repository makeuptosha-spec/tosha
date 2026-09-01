import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import { collection, getDocs, addDoc, query, where, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";

// ── TEMA (claro/oscuro) ──
const TEMA_KEY = "tosha-tema";
const TEMA_EVENTO = "tosha-tema-cambio";

export const colorTema = (tema) => tema === "dark"
  ? { grid: "#1F3329", texto: "#8FA79C", label: "#EAF5EF" }
  : { grid: "#DCEEE5", texto: "#5B7268", label: "#0F2A20" };

export const getTema = () => {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
};

export const aplicarTema = (tema) => {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem(TEMA_KEY, tema);
  window.dispatchEvent(new Event(TEMA_EVENTO));
};

export const initTema = () => {
  const guardado = localStorage.getItem(TEMA_KEY);
  document.documentElement.setAttribute("data-theme", guardado === "dark" ? "dark" : "light");
};

export const useTema = () => {
  const [tema, setTema] = useState(getTema());
  useEffect(() => {
    const onChange = () => setTema(getTema());
    window.addEventListener(TEMA_EVENTO, onChange);
    return () => window.removeEventListener(TEMA_EVENTO, onChange);
  }, []);
  return [tema, () => aplicarTema(tema === "dark" ? "light" : "dark")];
};

// ── MONEDA ──
// Mismo patrón que TEMA: cache local (localStorage) + evento custom, así
// fmt()/fmtNum() (funciones puras llamadas desde decenas de archivos sin
// hooks) pueden leer la moneda actual sin Context ni prop-drilling. La
// fuente de verdad real vive en Firestore (configuracion/{uid}, doc ID =
// uid) y se sincroniza al cache local una vez por sesión en App.jsx —
// así un cambio hecho en otro dispositivo se refleja al volver a entrar.
const MONEDA_KEY = "tosha-moneda";
const MONEDA_EVENTO = "tosha-moneda-cambio";
export const MONEDAS = [
  { id: "COP", label: "Peso colombiano", locale: "es-CO" },
  { id: "USD", label: "Dólar estadounidense", locale: "en-US" },
];

export const getMoneda = () => {
  if (typeof localStorage === "undefined") return "COP";
  return localStorage.getItem(MONEDA_KEY) === "USD" ? "USD" : "COP";
};

export const aplicarMoneda = (moneda) => {
  localStorage.setItem(MONEDA_KEY, moneda === "USD" ? "USD" : "COP");
  window.dispatchEvent(new Event(MONEDA_EVENTO));
};

export const useMoneda = () => {
  const [moneda, setMoneda] = useState(getMoneda());
  useEffect(() => {
    const onChange = () => setMoneda(getMoneda());
    window.addEventListener(MONEDA_EVENTO, onChange);
    return () => window.removeEventListener(MONEDA_EVENTO, onChange);
  }, []);
  return moneda;
};

// Trae configuracion/{uid}; si no existe la crea con default COP. Sincroniza
// el cache local con el doc real de Firestore al iniciar sesión.
export async function sincronizarConfiguracion(uid) {
  const ref = doc(db, "configuracion", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    aplicarMoneda(snap.data()?.moneda);
  } else {
    await setDoc(ref, { uid, moneda: "COP" });
    aplicarMoneda("COP");
  }
}

// Escribe la moneda elegida en Firestore y actualiza el cache local. La usa Conf.jsx.
export async function guardarMoneda(uid, moneda) {
  await setDoc(doc(db, "configuracion", uid), { uid, moneda }, { merge: true });
  aplicarMoneda(moneda);
}

// ── IDENTIDAD DEL HOGAR (campo legado, ya no se usa pa aislar datos) ──
export const HOGAR_ID = "hogar-principal";

// Debe coincidir con esDueno() en firestore.rules — es quien administra
// la lista de usuariosPermitidos (las reglas ya no dejan escribir ahí a
// nadie más, así que la UI debe reflejar lo mismo).
export const EMAIL_DUENO = "makeuptosha@gmail.com";

// ── PERFILES PRIVADOS POR USUARIO ──
// Trae solo los docs del usuario actual. La consulta va filtrada por `uid`
// porque las reglas de Firestore exigen que el propio query esté acotado
// (un getDocs de la colección entera sin filtro se rechaza por completo,
// incluso pa el dueño, aunque todos los docs ya tengan uid). La migración
// de docs viejos sin `uid` ya se hizo una sola vez con las reglas viejas.
export async function fetchPropio(nombreColeccion, uid) {
  const snap = await getDocs(query(collection(db, nombreColeccion), where("uid", "==", uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── CATEGORÍAS ──
// Ya no son un array fijo: viven en Firestore (colección `categorias`,
// editable desde el tab Conf) para que el usuario las personalice. Estos
// defaults solo se usan como semilla la primera vez que un uid no tiene
// ningún doc todavía (migración automática de usuarios existentes).
const CATEGORIAS_GASTO_DEFAULT = [
  "Alimentación", "Transporte", "Vivienda", "Servicios", "Salud",
  "Entretenimiento", "Educación", "Ropa", "Suscripciones", "Deudas", "Préstamo", "Ahorro", "Impuestos", "Mascotas", "Otros"
];
const CATEGORIAS_INGRESO_DEFAULT = ["Salario", "Ventas", "Trabajo", "Devolución", "Préstamo", "Otros"];

// Si el uid no tiene ningún doc en `categorias`, siembra los defaults una
// sola vez (batch atómico, ~21 docs, muy por debajo del límite de 500).
export async function asegurarCategorias(uid) {
  const existentes = await fetchPropio("categorias", uid);
  if (existentes.length > 0) return existentes;

  const batch = writeBatch(db);
  const nuevas = [];
  let orden = 0;
  for (const tipo of ["gasto", "ingreso"]) {
    const lista = tipo === "gasto" ? CATEGORIAS_GASTO_DEFAULT : CATEGORIAS_INGRESO_DEFAULT;
    for (const nombre of lista) {
      const ref = doc(collection(db, "categorias"));
      const datos = { uid, nombre, tipo, orden: orden++ };
      batch.set(ref, datos);
      nuevas.push({ id: ref.id, ...datos });
    }
  }
  await batch.commit();
  return nuevas;
}

// ── SANEO DE RESPUESTAS DE IA (Groq: escaneo de recibos + dictado por voz) ──
// El JSON que devuelve el modelo no es de fiar por más que el prompt le pida
// un formato exacto: un recibo/dictado manipulado, o el modelo alucinando,
// puede mandar un monto no-numérico, una categoría inventada, o texto larguísimo.
// Sin esto, esa basura se guarda tal cual en Firestore y rompe silenciosamente
// sumas (NaN), filtros por categoría y fechas en el resto de la app.
export function limpiarRespuestaIA(datos, categorias, tipoForzado) {
  const tipo = tipoForzado || (datos?.tipo === "ingreso" ? "ingreso" : "gasto");
  const nombresValidos = (categorias || []).filter(c => c.tipo === tipo).map(c => c.nombre);
  const montoNum = Number(datos?.monto);
  const acortar = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const fallbackSugerida = nombresValidos.includes("Otros") ? "Otros" : (nombresValidos[0] || null);
  return {
    tipo,
    monto: Number.isFinite(montoNum) && montoNum > 0 ? Math.round(montoNum) : null,
    categoria: nombresValidos.includes(datos?.categoria) ? datos.categoria : null,
    categoriaSugerida: nombresValidos.includes(datos?.categoriaSugerida) ? datos.categoriaSugerida : fallbackSugerida,
    descripcion: acortar(datos?.descripcion, 140),
    comercio: acortar(datos?.comercio, 80),
    fecha: typeof datos?.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ? datos.fecha : null,
  };
}

export const TIPOS_CUENTA = [
  { id: "efectivo", label: "Efectivo" },
  { id: "banco", label: "Cuenta bancaria" },
  { id: "tarjeta_credito", label: "Tarjeta de crédito" },
  { id: "ahorros", label: "Ahorros" },
  { id: "otro", label: "Otro" },
];

// ── ÍCONO POR BANCO (emoji, no logos con copyright) ──
// Coincide por nombre de cuenta contra bancos/billeteras comunes en Colombia;
// si no reconoce el nombre, cae al ícono genérico según el tipo de cuenta.
export const iconoCuenta = (cuenta) => {
  const n = (cuenta?.nombre || "").toLowerCase();
  if (n.includes("nequi")) return "💜";
  if (n.includes("bancolombia")) return "🟡";
  if (n.includes("daviplata") || n.includes("davivienda") || n.includes("davi")) return "🔴";
  if (n.includes("bbva")) return "🔵";
  if (n.includes("bogot")) return "🟠";
  if (n.includes("caja social")) return "🟢";
  if (n.includes("popular")) return "🟢";
  if (n.includes("av villas") || n.includes("avvillas")) return "💚";
  if (n.includes("rappipay") || n.includes("rappi")) return "🧡";
  if (n.includes("lulo")) return "💚";
  if (n.includes("movii")) return "💙";
  if (n.includes("scotiabank") || n.includes("colpatria")) return "❤️";
  if (n.includes("itau") || n.includes("itaú")) return "🧡";
  if (n.includes("falabella")) return "🩷";
  switch (cuenta?.tipo) {
    case "efectivo": return "💵";
    case "banco": return "🏦";
    case "tarjeta_credito": return "💳";
    case "ahorros": return "🐷";
    default: return "👛";
  }
};

// ── GMF (4x1000) ──
// 0.4% en cada gasto/transferencia/pago desde una cuenta banco, ahorros o
// tarjeta de crédito. Por cuenta se puede marcar "exenta" (ej: la que la ley
// exime, normalmente una sola). Efectivo nunca aplica.
export const TASA_4X1000 = 0.004;
export const TIPOS_GRAVADOS_4X1000 = ["banco", "ahorros", "tarjeta_credito"];

export const aplica4x1000 = (cuenta) =>
  getMoneda() === "COP" && !!cuenta && TIPOS_GRAVADOS_4X1000.includes(cuenta.tipo) && !cuenta.exento4x1000;

// Calcula el 4x1000 de un débito, si la cuenta está gravada. Devuelve el
// valor (entero, redondeado) o 0. Se guarda como campo del propio
// movimiento (gmf4x1000), no como un movimiento aparte.
export function calcular4x1000(cuenta, monto) {
  if (!aplica4x1000(cuenta)) return 0;
  return Math.round(Number(monto) * TASA_4X1000);
}

// ── UTILIDADES DE FORMATO Y FECHAS ──
export const fmt = (n) => {
  const num = Number(n);
  const cfg = MONEDAS.find(m => m.id === getMoneda()) || MONEDAS[0];
  return new Intl.NumberFormat(cfg.locale, { style: "currency", currency: cfg.id, minimumFractionDigits: 0 }).format(isNaN(num) ? 0 : num);
};

export const fmtNum = (n) => {
  const num = Number(n);
  const cfg = MONEDAS.find(m => m.id === getMoneda()) || MONEDAS[0];
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat(cfg.locale).format(num);
};

export const parseNum = (str) => String(str).replace(/\D/g, "");

export const hoyObj = new Date();
export const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const mesAnterior = () => {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
};

// Si una factura activa no tiene ya un pagosFactura para el mes anterior
// (pagada o no), congela su montoEstimado vigente en uno con pagado:false.
// Corre una vez por sesion, antes de que el usuario pueda editar nada, para
// que un monto variable no se pierda al pisarse con el del mes nuevo.
export async function congelarEstimadosMesAnterior(uid, facturasRecurrentes, pagosFactura) {
  const mesAnt = mesAnterior();
  const inicioMesActual = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
  const nuevas = [];
  for (const f of facturasRecurrentes) {
    if (f.activa === false) continue;
    if (new Date(f.fechaCreacion) >= inicioMesActual) continue;
    if (pagosFactura.some(p => p.facturaRecurrenteId === f.id && p.mes === mesAnt)) continue;
    const datos = { facturaRecurrenteId: f.id, mes: mesAnt, pagado: false, montoPagado: Number(f.montoEstimado), movimientoId: null, hogarId: HOGAR_ID, uid };
    const ref = await addDoc(collection(db, "pagosFactura"), datos);
    nuevas.push({ id: ref.id, ...datos });
  }
  return nuevas;
}

// "YYYY-MM-DD" de HOY en hora local — new Date().toISOString().slice(0,10)
// da la fecha en UTC, que en Colombia (UTC-5) ya cae en "mañana" de noche.
export const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Fechas guardadas como "YYYY-MM-DD" (sin hora) las interpreta el motor JS como
// medianoche UTC — en timezones negativos (Colombia UTC-5) eso cae el día
// anterior al leerla en hora local, corriendo la fecha un día pa atrás.
export const parseFecha = (fechaStr) => {
  if (!fechaStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    const [y, m, d] = fechaStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(fechaStr);
};

export const esHoy = (fechaISO) => {
  if (!fechaISO) return false;
  const d = parseFecha(fechaISO);
  return d.getDate() === hoyObj.getDate() && d.getMonth() === hoyObj.getMonth() && d.getFullYear() === hoyObj.getFullYear();
};
export const esEsteMes = (fechaISO) => {
  if (!fechaISO) return false;
  const d = parseFecha(fechaISO);
  return d.getMonth() === hoyObj.getMonth() && d.getFullYear() === hoyObj.getFullYear();
};

export const fmtFecha = (iso) => {
  if (!iso) return "";
  return parseFecha(iso).toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtMes = (mesStr) => {
  if (!mesStr) return "";
  const [y, m] = mesStr.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
};

// ── COMPONENTES BASE Y CARGADOR ──
const N_BILLETES = 8;
const RADIO_BILLETES = 78;
const BILLETES = Array.from({ length: N_BILLETES }, (_, i) => {
  const angulo = (i / N_BILLETES) * 2 * Math.PI - Math.PI / 2;
  return {
    tx: Math.round(Math.cos(angulo) * RADIO_BILLETES),
    ty: Math.round(Math.sin(angulo) * RADIO_BILLETES),
    rot: 180 + i * 47,
    delay: i * 0.16,
  };
});

export const LoaderInteractivo = () => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 18, height: '100vh', background: 'var(--bg)' }}>
    <div style={{ position: 'relative', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="money-cannon" style={{ fontSize: 44, position: 'relative', zIndex: 2 }}>🤑</span>
      {BILLETES.map((b, i) => (
        <span
          key={i}
          className="money-blast-bill"
          style={{ left: '50%', top: '50%', fontSize: 20, '--tx': `${b.tx}px`, '--ty': `${b.ty}px`, '--rot': `${b.rot}deg`, animationDelay: `${b.delay}s` }}
        >💵</span>
      ))}
    </div>
    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: 'var(--mid)' }}>Cargando tus finanzas...</span>
  </div>
);

export const Badge = ({ children, variant = "default" }) => {
  const styles = { default: { background: "var(--primary-pale)", color: "var(--primary-deep)" }, success: { background: "var(--success-bg)", color: "var(--success)" }, warn: { background: "var(--warn-bg)", color: "var(--warn)" }, danger: { background: "var(--danger-bg)", color: "var(--danger)" } };
  return <span style={{ ...styles[variant], display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>{children}</span>;
};

export const Icon = ({ name, size = 18, color }) => {
  const props = { width: size, height: size, fill: "none", stroke: color || "currentColor", strokeWidth: "2", viewBox: "0 0 24 24" };
  const icons = {
    dashboard:  <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    wallet:     <svg {...props}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>,
    receipt:    <svg {...props}><path d="M4 2h16v20l-3-2-2 2-2-2-2 2-2-2-2 2-3-2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>,
    target:     <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>,
    transfer:   <svg {...props}><path d="M17 3l4 4-4 4"/><path d="M21 7H9"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h12"/></svg>,
    search:     <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    alert:      <svg {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    trending:   <svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    trendingDown: <svg {...props}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
    plus:       <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    check:      <svg {...props} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    tag:        <svg {...props}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    money:      <svg {...props}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    close:      <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    logout:     <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    calendar:   <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    calendarCheck: <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg>,
    chart:      <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    trash:      <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    edit:       <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>,
    camera:     <svg {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    settings:   <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  };
  return icons[name] || null;
};

const PALE_TOKEN = { "var(--success)": "var(--success-bg)", "var(--danger)": "var(--danger-bg)", "var(--warn)": "var(--warn-bg)", "var(--primary)": "var(--primary-pale)" };

const fontSizeMonto = (str) => {
  const len = String(str).length;
  if (len <= 8) return 24;
  if (len <= 9) return 21;
  if (len <= 10) return 19;
  if (len <= 11) return 17;
  if (len <= 12) return 15;
  if (len <= 13) return 13.5;
  return 12;
};

export const StatCard = ({ icon, label, value, sub, color = "var(--primary)" }) => (
  <div className="animate" style={{ position: "relative", background: "var(--white)", borderRadius: 20, padding: "20px 22px 20px 26px", boxShadow: "var(--shadow)", border: "1.5px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: color }} />
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--mid)", letterSpacing: 0.5 }}>{label}</span>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: PALE_TOKEN[color] || "var(--primary-pale)", color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} /></span>
    </div>
    <div style={{ fontFamily: "'Fraunces', serif", fontSize: fontSizeMonto(value), fontWeight: 700, color: "var(--dark)", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "var(--mid)" }}>{sub}</div>}
  </div>
);

export const ProgressBar = ({ pct, color = "var(--primary)", bg = "var(--primary-pale)", height = 10 }) => (
  <div style={{ height, background: bg, borderRadius: 10, overflow: "hidden" }}>
    <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 10, transition: "width 0.6s ease" }} />
  </div>
);

export const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --primary:      #10B981;
    --primary-deep: #065F46;
    --primary-soft: #6EE7B7;
    --primary-pale: #ECFDF5;
    --accent:    #0F766E;
    --accent-pale: #F0FDFA;
    --accent-soft: #5EEAD4;
    --bg:        #F6FAF8;
    --dark:      #0F2A20;
    --mid:       #5B7268;
    --border:    #C5E2D3;
    --success:   #16A34A;
    --success-bg: #E8F5E9;
    --warn:      #D97706;
    --warn-bg:   #FFF3E0;
    --warn-border: #FFB74D;
    --danger:    #DC2626;
    --danger-bg: #FFEBEE;
    --danger-border: #FFCDD2;
    --white:     #FFFFFF;
    --ink:       #0F2A20;
    --nav-bg:    rgba(255,255,255,0.95);
    --overlay:   rgba(0,0,0,0.4);
    --shadow:    0 4px 24px rgba(6,95,70,0.10);
    --shadow-lg: 0 8px 40px rgba(6,95,70,0.16);
  }

  :root[data-theme="dark"] {
    --primary:      #34D399;
    --primary-deep: #10B981;
    --primary-soft: #6EE7B7;
    --primary-pale: #113828;
    --accent:    #2DD4BF;
    --accent-pale: #113330;
    --accent-soft: #5EEAD4;
    --bg:        #0B1712;
    --dark:      #EAF5EF;
    --mid:       #8FA79C;
    --border:    #1F3329;
    --success:   #22C55E;
    --success-bg: #113322;
    --warn:      #F59E0B;
    --warn-bg:   #3A2A0F;
    --warn-border: #5C4620;
    --danger:    #F87171;
    --danger-bg: #3A1418;
    --danger-border: #5C2129;
    --white:     #142019;
    --ink:       #24382F;
    --nav-bg:    rgba(11,23,18,0.92);
    --overlay:   rgba(0,0,0,0.6);
    --shadow:    0 4px 24px rgba(0,0,0,0.35);
    --shadow-lg: 0 8px 40px rgba(0,0,0,0.5);
  }

  body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--dark); overflow-x: hidden; transition: background 0.2s, color 0.2s; }

  input, select, textarea {
    font-family: 'DM Sans', sans-serif; outline: none; border: 1.5px solid var(--border);
    border-radius: 12px; padding: 10px 14px; font-size: 14px; background: var(--white);
    color: var(--dark); transition: border-color 0.2s, box-shadow 0.2s; width: 100%;
  }
  input:focus, select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
  button { cursor: pointer; font-family: 'DM Sans', sans-serif; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--primary-pale); }
  ::-webkit-scrollbar-thumb { background: var(--primary-soft); border-radius: 10px; }

  @keyframes slideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulseLoader { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes moneyFloat { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-8px) rotate(6deg); } }
  @keyframes cannonKick { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
  @keyframes moneyBlast { 0% { transform: translate(-50%,-50%) translate(0,0) rotate(0deg) scale(0.3); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(-50%,-50%) translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(1); opacity: 0; } }
  .animate { animation: slideIn 0.35s ease both; }
  .pulsing { animation: pulseLoader 1.5s infinite ease-in-out; }
  .spinner { width: 40px; height: 40px; border: 3.5px solid var(--primary-pale); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.7s linear infinite; }
  .money-float { display: inline-block; animation: moneyFloat 2.4s ease-in-out infinite; }
  .money-cannon { animation: cannonKick 1.1s ease-in-out infinite; }
  .money-blast-bill { position: absolute; animation: moneyBlast 1.3s ease-out infinite; }

  .app-wrapper { max-width: 430px; margin: 0 auto; min-height: 100vh; position: relative; padding-bottom: 90px; transition: all 0.3s ease; }
  .nav-menu { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: var(--nav-bg); backdrop-filter: blur(16px); border-top: 1px solid var(--border); display: flex; padding: 10px 0 20px; z-index: 1000; transition: all 0.3s ease; }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; border: none; background: transparent; padding: 4px 0; transition: color 0.2s; }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .form-grid > div { min-width: 0; }
  .form-grid input[type="date"] { min-width: 0; }
  .desktop-flex { display: flex; flex-direction: column; gap: 20px; }
  .mov-toolbar { display: flex; flex-direction: column; gap: 12px; }
  .mov-toolbar-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .mov-toolbar-actions button { width: 100%; justify-content: center; padding: 8px 4px !important; font-size: 11px !important; }

  @media (min-width: 768px) {
    .app-wrapper { max-width: 1200px; padding-bottom: 30px; padding-left: 120px; padding-top: 20px; }
    .nav-menu { left: 0; top: 0; bottom: 0; width: 100px; max-width: none; transform: none; flex-direction: column; justify-content: flex-start; padding-top: 40px; gap: 24px; border-top: none; border-right: 1px solid var(--border); box-shadow: 2px 0 10px rgba(0,0,0,0.03); }
    .nav-item { flex: none; width: 100%; }
    .stats-grid { grid-template-columns: repeat(4, 1fr); }
    .form-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .desktop-flex { flex-direction: row; align-items: flex-start; }
    .desktop-flex > div { flex: 1; }
    .mov-toolbar { flex-direction: row; align-items: center; justify-content: space-between; }
    .mov-toolbar-actions { display: flex; justify-content: flex-end; }
    .mov-toolbar-actions button { width: auto; padding: 8px 16px !important; font-size: 12px !important; }
  }

  #reporte-imprimible { display: none; }
  @media print {
    @page { margin: 0; }
    body { background: white; padding: 1.5cm; }
    body * { visibility: hidden; }
    #reporte-imprimible { display: block !important; visibility: visible; position: absolute; left: 0; top: 0; width: 100%; padding: 40px; font-family: monospace; color: black; background: white; }
    #reporte-imprimible * { visibility: visible; }
  }
`;
