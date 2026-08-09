// ── IDENTIDAD DEL HOGAR ──
// Fijo por ahora (single-user). Cuando se agregue multi-usuario/familia,
// esto pasa a ser el id del hogar compartido — el resto del modelo de datos
// ya está preparado (todo doc lleva hogarId) y no requiere migración.
export const HOGAR_ID = "hogar-principal";

// ── CATEGORÍAS POR DEFECTO ──
export const CATEGORIAS_GASTO = [
  "Alimentación", "Transporte", "Vivienda", "Servicios", "Salud",
  "Entretenimiento", "Educación", "Ropa", "Suscripciones", "Deudas", "Préstamo", "Ahorro", "Mascotas", "Otros"
];
export const CATEGORIAS_INGRESO = ["Salario", "Freelance", "Ventas", "Préstamo", "Ahorro", "Regalo", "Inversión", "Otros"];

export const TIPOS_CUENTA = [
  { id: "efectivo", label: "Efectivo" },
  { id: "banco", label: "Cuenta bancaria" },
  { id: "tarjeta_credito", label: "Tarjeta de crédito" },
  { id: "ahorros", label: "Ahorros" },
  { id: "otro", label: "Otro" },
];

// ── UTILIDADES DE FORMATO Y FECHAS ──
export const fmt = (n) => {
  const num = Number(n);
  if (isNaN(num)) return "$ 0";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(num);
};

export const fmtNum = (n) => {
  const num = Number(n);
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("es-CO").format(num);
};

export const parseNum = (str) => String(str).replace(/\D/g, "");

export const hoyObj = new Date();
export const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const esHoy = (fechaISO) => {
  if (!fechaISO) return false;
  const d = new Date(fechaISO);
  return d.getDate() === hoyObj.getDate() && d.getMonth() === hoyObj.getMonth() && d.getFullYear() === hoyObj.getFullYear();
};
export const esEsteMes = (fechaISO) => {
  if (!fechaISO) return false;
  const d = new Date(fechaISO);
  return d.getMonth() === hoyObj.getMonth() && d.getFullYear() === hoyObj.getFullYear();
};

export const fmtFecha = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtMes = (mesStr) => {
  if (!mesStr) return "";
  const [y, m] = mesStr.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
};

// ── COMPONENTES BASE Y CARGADOR ──
export const LoaderInteractivo = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg)' }}>
    <div className="spinner" />
  </div>
);

export const Badge = ({ children, variant = "default" }) => {
  const styles = { default: { background: "var(--primary-pale)", color: "var(--primary-deep)" }, success: { background: "#E8F5E9", color: "var(--success)" }, warn: { background: "#FFF3E0", color: "var(--warn)" }, danger: { background: "#FFEBEE", color: "var(--danger)" } };
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
  };
  return icons[name] || null;
};

export const StatCard = ({ icon, label, value, sub, color = "var(--primary)" }) => (
  <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: "20px 22px", boxShadow: "var(--shadow)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--mid)", letterSpacing: 0.5 }}>{label}</span>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: color + "18", color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} /></span>
    </div>
    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: "var(--dark)", lineHeight: 1.1 }}>{value}</div>
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
    --border:    #DCEEE5;
    --success:   #16A34A;
    --warn:      #D97706;
    --danger:    #DC2626;
    --white:     #FFFFFF;
    --shadow:    0 4px 24px rgba(6,95,70,0.10);
    --shadow-lg: 0 8px 40px rgba(6,95,70,0.16);
  }

  body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--dark); overflow-x: hidden; }

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
  .animate { animation: slideIn 0.35s ease both; }
  .pulsing { animation: pulseLoader 1.5s infinite ease-in-out; }
  .spinner { width: 40px; height: 40px; border: 3.5px solid var(--primary-pale); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.7s linear infinite; }

  .app-wrapper { max-width: 430px; margin: 0 auto; min-height: 100vh; position: relative; padding-bottom: 90px; transition: all 0.3s ease; }
  .nav-menu { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: rgba(255,255,255,0.95); backdrop-filter: blur(16px); border-top: 1px solid var(--border); display: flex; padding: 10px 0 20px; z-index: 1000; transition: all 0.3s ease; }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; border: none; background: transparent; padding: 4px 0; transition: color 0.2s; }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .desktop-flex { display: flex; flex-direction: column; gap: 20px; }

  @media (min-width: 768px) {
    .app-wrapper { max-width: 1200px; padding-bottom: 30px; padding-left: 120px; padding-top: 20px; }
    .nav-menu { left: 0; top: 0; bottom: 0; width: 100px; max-width: none; transform: none; flex-direction: column; justify-content: flex-start; padding-top: 40px; gap: 24px; border-top: none; border-right: 1px solid var(--border); box-shadow: 2px 0 10px rgba(0,0,0,0.03); }
    .nav-item { flex: none; width: 100%; }
    .stats-grid { grid-template-columns: repeat(4, 1fr); }
    .form-grid { grid-template-columns: repeat(4, 1fr); }
    .desktop-flex { flex-direction: row; align-items: flex-start; }
    .desktop-flex > div { flex: 1; }
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
