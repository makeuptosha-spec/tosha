import { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { fmt, Icon, LoaderInteractivo } from "../utils.jsx";

const NUMERO_WA = "573017886206";
const ORDEN_PRESENTACIONES = ["Única","Mini","Regular","Grande","Duo","Kit","Tono 01","Tono 02","Tono 03","Tono 04","Tono 05"];

/* ── SVG ICONS ─────────────────────────────────────────── */
const HeartIcon = ({ filled, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#A855F7" : "none"} stroke={filled ? "#A855F7" : "#fff"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const CartIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);

const SearchIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

/* ── CATEGORY ICON MAPPING ──────────────────────────────── */
const CatIcon = ({ cat, size = 22 }) => {
  const icons = {
    "Todas":      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    "Labial":     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="10" rx="3"/><path d="M9 8h6"/><rect x="8" y="12" width="8" height="10" rx="1"/></svg>,
    "Base":       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="16" rx="3"/><path d="M8 18h8l1 4H7z"/></svg>,
    "Corrector":  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="6" rx="4" ry="5"/><path d="M8 11h8l1 11H7z"/></svg>,
    "Iluminador": <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9"/></svg>,
    "Sombra":     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8V21M7 8V21M17 8V21"/></svg>,
    "Rubor":      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4"/><circle cx="12" cy="14" r="3"/></svg>,
    "Bronzer":    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M7 6V4a2 2 0 0 1 4 0v2M13 6V4a2 2 0 0 1 4 0v2"/></svg>,
    "Delineador": <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20L18 5a2 2 0 0 1 3 3L6 23z"/><path d="M18 5l-3 3"/></svg>,
    "Máscara":    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C9 2 7 4 7 7v10a5 5 0 0 0 10 0V7c0-3-2-5-5-5z"/><path d="M9 9l6 0M9 12h6M9 15h4"/></svg>,
    "Crema":      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="8" width="14" height="14" rx="3"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="M9 14c0-1.7 1.3-3 3-3s3 1.3 3 3"/></svg>,
    "Suero":      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 2h4v5l3 3v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V10l3-3V2z"/><path d="M9 13h6M9 16h6"/></svg>,
    "Perfume":    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="8" width="12" height="14" rx="3"/><path d="M10 8V6h4v2"/><path d="M12 4v2M9 4l1.5 2M15 4l-1.5 2"/></svg>,
    "Esmalte":    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 2h4l1 5H9z"/><rect x="8" y="7" width="8" height="15" rx="2"/></svg>,
  };
  return icons[cat] || (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
  );
};

/* ── PRODUCT CARD (GRID) ───────────────────────────────── */
const ProductCard = ({ p, liked, onToggleLike, onClick }) => {
  const imgSrc = p.imagenes?.[0] || p.imagen;
  const stockTotal = Number(p.stock) || 0;
  const ultimaUnidad = stockTotal > 0 && stockTotal <= 3;
  const presDisp = ORDEN_PRESENTACIONES.filter(t => Number(p.stockPorTalla?.[t] || 0) > 0);

  return (
    <div
      onClick={onClick}
      style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(126,34,206,0.08)", border: "1px solid #EDE9FE", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(126,34,206,0.15)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 16px rgba(126,34,206,0.08)"; }}
    >
      {/* IMAGE */}
      <div style={{ position: "relative", aspectRatio: "3/4", background: "#F5F3FF", flexShrink: 0 }}>
        {imgSrc
          ? <img src={imgSrc} alt={p.descripcion} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="image" size={32} color="#C4B5FD" /></div>
        }
        {/* HEART */}
        <button
          onClick={e => { e.stopPropagation(); onToggleLike(p.id); }}
          style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.28)", backdropFilter: "blur(4px)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
          onMouseLeave={e => e.currentTarget.style.transform = ""}
        >
          <HeartIcon filled={liked} size={17} />
        </button>
        {/* BADGE */}
        {ultimaUnidad && (
          <div style={{ position: "absolute", top: 10, left: 10, background: "#E65100", color: "#fff", fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5 }}>
            ¡Última unidad!
          </div>
        )}
        {/* PRESENTACIÓN CHIPS mini */}
        {presDisp.length > 0 && (
          <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {presDisp.slice(0, 4).map(t => (
              <span key={t} style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(4px)", color: "#7E22CE", fontSize: 9, fontWeight: 800, padding: "3px 6px", borderRadius: 6, letterSpacing: 0.3 }}>{t}</span>
            ))}
            {presDisp.length > 4 && (
              <span style={{ background: "rgba(255,255,255,0.7)", color: "#7E22CE", fontSize: 9, fontWeight: 700, padding: "3px 6px", borderRadius: 6 }}>+{presDisp.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* INFO */}
      <div style={{ padding: "12px 12px 14px" }}>
        <p style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 4px" }}>{p.categoria}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: "0 0 8px", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.descripcion}</p>
        <p style={{ fontSize: 16, fontWeight: 800, color: "var(--rosa-deep)", margin: 0 }}>{fmt(p.precioVenta)}</p>
      </div>
    </div>
  );
};

/* ── PRODUCT DETAIL MODAL ──────────────────────────────── */
const DetalleModal = ({ p, liked, onToggleLike, onAdd, onClose }) => {
  const imgSrc = p.imagenes?.[0] || p.imagen;
  const presDisp = ORDEN_PRESENTACIONES.filter(t => Number(p.stockPorTalla?.[t] || 0) > 0);
  const [presSel, setPresSel] = useState(presDisp[0] || "");
  const stockPres = presSel ? Number(p.stockPorTalla?.[presSel] || 0) : Number(p.stock);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="animate"
        onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "28px 28px 0 0", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#EDE9FE" }} />
        </div>

        {/* Imagen */}
        <div style={{ position: "relative", margin: "12px 16px 0", borderRadius: 20, overflow: "hidden", aspectRatio: "4/3", background: "#F5F3FF" }}>
          {imgSrc
            ? <img src={imgSrc} alt={p.descripcion} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="image" size={48} color="#C4B5FD" /></div>
          }
          <button onClick={onClose} style={{ position: "absolute", top: 12, left: 12, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          <button
            onClick={() => onToggleLike(p.id)}
            style={{ position: "absolute", top: 12, right: 12, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <HeartIcon filled={liked} size={17} />
          </button>
        </div>

        {/* Info */}
        <div style={{ padding: "20px 20px 32px" }}>
          <p style={{ fontSize: 11, color: "var(--mid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>{p.categoria}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: "var(--dark)", margin: 0, lineHeight: 1.2, flex: 1, paddingRight: 16 }}>{p.descripcion}</h2>
            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--rosa-deep)", flexShrink: 0 }}>{fmt(p.precioVenta)}</span>
          </div>

          {/* Selector presentación */}
          {presDisp.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Presentación {presSel && <span style={{ color: "var(--rosa)" }}>— {presSel}</span>}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {presDisp.map(t => {
                  const stock = Number(p.stockPorTalla?.[t] || 0);
                  const sel = presSel === t;
                  return (
                    <button key={t} onClick={() => setPresSel(t)} style={{ minWidth: 48, padding: "8px 14px", borderRadius: 12, border: sel ? "2px solid var(--rosa)" : "1.5px solid var(--border)", background: sel ? "var(--rosa-pale)" : "#fff", color: sel ? "var(--rosa-deep)" : "var(--mid)", fontWeight: sel ? 800 : 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s", position: "relative" }}>
                      {t}
                      {stock <= 2 && <span style={{ position: "absolute", top: -5, right: -5, width: 8, height: 8, borderRadius: "50%", background: "#E65100", border: "1.5px solid #fff" }} />}
                    </button>
                  );
                })}
              </div>
              {presSel && stockPres <= 3 && (
                <p style={{ fontSize: 11, color: "#E65100", marginTop: 8, fontWeight: 600 }}>⚠️ Solo {stockPres} {stockPres === 1 ? "unidad" : "unidades"} disponibles</p>
              )}
            </div>
          )}

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => { if (presSel || presDisp.length === 0) { onAdd(p, presSel || p.talla); onClose(); } }}
              disabled={presDisp.length > 0 && !presSel}
              style={{ width: "100%", padding: "16px", borderRadius: 16, background: (presDisp.length === 0 || presSel) ? "linear-gradient(135deg, var(--rosa-deep), var(--rosa))" : "var(--border)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: (presDisp.length === 0 || presSel) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "opacity 0.2s" }}
            >
              <CartIcon size={18} /> Agregar al pedido
            </button>
            <button
              onClick={() => {
                const txt = `Hola! Me interesa: *${p.descripcion}*${presSel ? ` - ${presSel}` : ""}\nPrecio: ${fmt(p.precioVenta)} 💜`;
                window.open(`https://wa.me/${NUMERO_WA}?text=${encodeURIComponent(txt)}`, "_blank");
              }}
              style={{ width: "100%", padding: "14px", borderRadius: 16, background: "#E8F5E9", color: "#2E7D32", border: "1.5px solid #A5D6A7", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              📱 Preguntar por WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── MAIN COMPONENT ────────────────────────────────────── */
export default function CatalogoPublico({ onLoginClick }) {
  const [prendas, setPrendas]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [busqueda, setBusqueda]     = useState("");
  const [categoriaSel, setCategoriaSel] = useState("Todas");
  const [presSel, setPresSel]       = useState("Todas");
  const [carrito, setCarrito]       = useState([]);
  const [verCarrito, setVerCarrito] = useState(false);
  const [detalle, setDetalle]       = useState(null);
  const [liked, setLiked]           = useState(new Set());

  useEffect(() => {
    getDocs(collection(db, "prendas"))
      .then(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPrendas(data.filter(p => Number(p.stock) > 0));
      })
      .finally(() => setCargando(false));
  }, []);

  const toggleLike = (id) => setLiked(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const categorias = useMemo(() => ["Todas", ...new Set(prendas.map(p => p.categoria).filter(Boolean))], [prendas]);

  const presentacionesDisponibles = useMemo(() => {
    const s = new Set();
    prendas.forEach(p => {
      if (p.stockPorTalla) Object.entries(p.stockPorTalla).forEach(([t, c]) => { if (Number(c) > 0) s.add(t); });
      else if (p.talla && Number(p.stock) > 0) s.add(p.talla);
    });
    return ["Todas", ...ORDEN_PRESENTACIONES.filter(t => s.has(t))];
  }, [prendas]);

  const filtradas = useMemo(() => prendas.filter(p => {
    const coincideCat  = categoriaSel === "Todas" || p.categoria === categoriaSel;
    const coincideBusq = (p.descripcion || "").toLowerCase().includes(busqueda.toLowerCase());
    const coincidePres = presSel === "Todas" || (p.stockPorTalla ? Number(p.stockPorTalla[presSel]) > 0 : p.talla === presSel);
    return coincideCat && coincidePres && coincideBusq;
  }), [prendas, categoriaSel, presSel, busqueda]);

  const agregarAlCarrito = (prenda, pres) => {
    if (!pres) return;
    setCarrito(prev => {
      const existe = prev.find(i => i.id === prenda.id && i.talla === pres);
      if (existe) return prev.map(i => i.id === prenda.id && i.talla === pres ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { id: prenda.id, descripcion: prenda.descripcion, precio: Number(prenda.precioVenta), talla: pres, cantidad: 1, imagen: prenda.imagenes?.[0] || prenda.imagen }];
    });
    setVerCarrito(true);
  };

  const totalCarrito = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const enviarWA = () => {
    if (!carrito.length) return;
    const lineas = carrito.map(i => `*${i.descripcion}*\n- ${i.talla} | x${i.cantidad} | ${fmt(i.precio * i.cantidad)}`).join("\n\n");
    const txt = `¡Hola *Tosha*! Quiero hacer este pedido:\n\n${lineas}\n\n*TOTAL: ${fmt(totalCarrito)}*\n\n¡Quedo atenta! 💜`;
    window.open(`https://wa.me/${NUMERO_WA}?text=${encodeURIComponent(txt)}`, "_blank");
  };

  if (cargando) return <LoaderInteractivo />;

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8FF", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── CARRITO FLOTANTE ── */}
      {carrito.length > 0 && !verCarrito && (
        <button onClick={() => setVerCarrito(true)} className="animate" style={{ position: "fixed", bottom: 28, right: 20, zIndex: 800, background: "linear-gradient(135deg, var(--rosa-deep), var(--rosa))", color: "#fff", border: "none", borderRadius: 50, padding: "14px 22px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 28px rgba(126,34,206,0.4)", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
          <CartIcon size={20} />
          Mi pedido
          <span style={{ background: "#fff", color: "var(--rosa-deep)", borderRadius: 20, padding: "2px 8px", fontSize: 13, fontWeight: 800 }}>{carrito.reduce((s, i) => s + i.cantidad, 0)}</span>
        </button>
      )}

      {/* ── MODAL CARRITO ── */}
      {verCarrito && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(6px)" }} onClick={() => setVerCarrito(false)}>
          <div className="animate" onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 420, height: "100%", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.12)" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontFamily: "'Fraunces', serif", margin: 0, fontSize: 22, color: "var(--dark)" }}>Tu Pedido</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--mid)" }}>{carrito.reduce((s,i)=>s+i.cantidad,0)} productos seleccionados</p>
              </div>
              <button onClick={() => setVerCarrito(false)} style={{ background: "var(--rosa-pale)", border: "none", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--mid)" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {carrito.length === 0
                ? <p style={{ textAlign: "center", color: "var(--mid)", marginTop: 40 }}>Tu carrito está vacío.</p>
                : carrito.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, background: "var(--creme)", borderRadius: 16, padding: 12, alignItems: "center" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", background: "var(--rosa-pale)", flexShrink: 0 }}>
                      {item.imagen ? <img src={item.imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="image" size={20} color="#C4B5FD" /></div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.descripcion}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--mid)" }}>{item.talla} · {item.cantidad} {item.cantidad === 1 ? "ud" : "uds"}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 800, color: "var(--rosa-deep)" }}>{fmt(item.precio * item.cantidad)}</p>
                    </div>
                    <button onClick={() => setCarrito(c => c.filter((_,j)=>j!==i))} style={{ background: "#FFEBEE", color: "#C62828", border: "none", width: 32, height: 32, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                  </div>
                ))
              }
            </div>
            <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 17, fontWeight: 800, color: "var(--dark)" }}>
                <span>Total estimado</span><span style={{ color: "var(--rosa-deep)" }}>{fmt(totalCarrito)}</span>
              </div>
              <button onClick={enviarWA} disabled={!carrito.length} style={{ width: "100%", padding: 16, borderRadius: 14, background: "#25D366", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                📱 Enviar pedido por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETALLE PRODUCTO ── */}
      {detalle && (
        <DetalleModal
          p={detalle}
          liked={liked.has(detalle.id)}
          onToggleLike={toggleLike}
          onAdd={agregarAlCarrito}
          onClose={() => setDetalle(null)}
        />
      )}

      {/* ── HERO — compact ── */}
      <div style={{ background: "linear-gradient(135deg, var(--rosa-deep) 0%, var(--rosa) 100%)", padding: "32px 20px 28px", color: "#fff", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "5px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
            ✨ {prendas.length}+ productos disponibles
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(34px, 7vw, 52px)", fontWeight: 800, margin: "0 0 8px", lineHeight: 1.1 }}>Tosha</h1>
          <p style={{ fontSize: 14, opacity: 0.85, margin: 0, fontWeight: 400 }}>Cosméticos & Belleza · Tu aliada de glamour</p>
        </div>
      </div>

      {/* ── FILTROS STICKY ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 500, background: "rgba(250,248,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Búsqueda */}
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--rosa)" }}><SearchIcon size={17} /></span>
          <input
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ width: "100%", paddingLeft: 42, paddingRight: 16, borderRadius: 50, border: "1.5px solid var(--border)", background: "#fff", padding: "11px 16px 11px 42px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "var(--dark)", outline: "none" }}
          />
        </div>

        {/* Categorías con iconos */}
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {categorias.map(cat => {
            const sel = categoriaSel === cat;
            return (
              <button key={cat} onClick={() => setCategoriaSel(cat)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: "2px 4px" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: sel ? "linear-gradient(135deg, var(--rosa-deep), var(--rosa))" : "#fff", border: sel ? "none" : "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: sel ? "#fff" : "var(--rosa-deep)", transition: "all 0.2s", boxShadow: sel ? "0 4px 14px rgba(126,34,206,0.3)" : "none" }}>
                  <CatIcon cat={cat} size={22} />
                </div>
                <span style={{ fontSize: 10, fontWeight: sel ? 700 : 500, color: sel ? "var(--rosa-deep)" : "var(--mid)", whiteSpace: "nowrap" }}>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Filtro presentaciones */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {presentacionesDisponibles.map(t => {
            const sel = presSel === t;
            return (
              <button key={t} onClick={() => setPresSel(t)} style={{ padding: "6px 14px", borderRadius: 20, border: sel ? "1.5px solid var(--rosa-deep)" : "1.5px solid var(--border)", background: sel ? "var(--rosa-deep)" : "#fff", color: sel ? "#fff" : "var(--mid)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── GRID DE PRODUCTOS ── */}
      <div style={{ padding: "20px 14px 100px", maxWidth: 1200, margin: "0 auto" }}>
        <p style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {filtradas.length} {filtradas.length === 1 ? "producto" : "productos"}
        </p>

        {filtradas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 24, border: "1px dashed var(--border)" }}>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 40, color: "var(--border)", margin: "0 0 12px" }}>💜</p>
            <p style={{ fontWeight: 700, fontSize: 16, color: "var(--dark)" }}>No encontramos productos</p>
            <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 4 }}>Intenta con otros filtros</p>
          </div>
        ) : (
          <div className="tosha-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {filtradas.map(p => (
              <ProductCard
                key={p.id}
                p={p}
                liked={liked.has(p.id)}
                onToggleLike={toggleLike}
                onClick={() => setDetalle(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: "center", padding: "36px 20px 24px", borderTop: "1px solid var(--border)", background: "#fff" }}>
        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "var(--rosa-deep)", margin: "0 0 6px" }}>Tosha</p>
        <p style={{ fontSize: 12, color: "var(--mid)", margin: "0 0 20px" }}>Tu belleza, tus reglas. © {new Date().getFullYear()}</p>
        <button onClick={onLoginClick} style={{ background: "none", border: "1px solid var(--border)", color: "var(--mid)", fontSize: 10, padding: "5px 12px", borderRadius: 20, cursor: "pointer" }}>
          Acceso Administrativo
        </button>
      </div>

      <style>{`
        @media (min-width: 500px) {
          .tosha-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 768px) {
          .tosha-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (min-width: 1100px) {
          .tosha-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
