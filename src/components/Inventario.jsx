import { useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, comprimirImagen, Icon, fmtFecha } from "../utils.jsx";
import ImportarFactura from "./ImportarFactura.jsx";
import ColaBorradores from "./ColaBorradores.jsx";

export default function Inventario({ prendas, setPrendas }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroTiempo, setFiltroTiempo] = useState("todo");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroStock, setFiltroStock] = useState("todas");
  const [ordenarPor, setOrdenarPor] = useState("fecha");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [prendaAEliminar, setPrendaAEliminar] = useState(null);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [mostrarBorradores, setMostrarBorradores] = useState(false);
  const [ajusteRapido, setAjusteRapido] = useState(null);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(null);

  const formBase = {
    codigo: "", descripcion: "", sku: "", stockMinimo: "1",
    costoCompra: "", precioVenta: "", categoria: "Labial", imagen: "", imagenes: [],
    tallas: { "Única": "", "Mini": "", "Regular": "", "Grande": "", "Duo": "", "Kit": "" }
  };
  const [form, setForm] = useState(formBase);

  const ordenTallas = ["Única", "Mini", "Regular", "Grande", "Duo", "Kit"];
  const categorias = ["Labial", "Base", "Corrector", "Iluminador", "Sombra", "Rubor", "Bronzer", "Delineador", "Máscara", "Crema", "Suero", "Perfume", "Esmalte", "Otro"];

  const filtradas = useMemo(() => {
    const hoy = new Date();
    const hace7Dias = new Date(); hace7Dias.setDate(hoy.getDate() - 7);

    let result = prendas.filter(p => {
      const q = busqueda.toLowerCase();
      const coincideTexto = !q
        || (p.descripcion || "").toLowerCase().includes(q)
        || (p.codigo || "").toLowerCase().includes(q)
        || (p.sku || "").toLowerCase().includes(q)
        || (p.categoria || "").toLowerCase().includes(q);

      let coincideFecha = true;
      if (filtroTiempo !== "todo") {
        const fechaRef = p.fechaEdicion || p.fechaIngreso;
        if (!fechaRef) coincideFecha = false;
        else {
          const d = new Date(fechaRef);
          if (filtroTiempo === "hoy") coincideFecha = d.toDateString() === hoy.toDateString();
          else if (filtroTiempo === "semana") coincideFecha = d >= hace7Dias;
          else if (filtroTiempo === "mes") coincideFecha = d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
        }
      }

      const coincideCategoria = filtroCategoria === "todas" || p.categoria === filtroCategoria;

      let coincideStock = true;
      if (filtroStock === "critico") {
        coincideStock = Number(p.stock) > 0 && Number(p.stock) <= Number(p.stockMinimo || 1);
      } else if (filtroStock === "agotadas") {
        coincideStock = Number(p.stock) === 0;
      } else if (filtroStock === "ok") {
        coincideStock = Number(p.stock) > Number(p.stockMinimo || 1);
      }

      return coincideTexto && coincideFecha && coincideCategoria && coincideStock;
    });

    result = [...result].sort((a, b) => {
      if (ordenarPor === "margen") {
        const mA = Number(a.costoCompra) > 0 ? ((Number(a.precioVenta) - Number(a.costoCompra)) / Number(a.costoCompra)) * 100 : 0;
        const mB = Number(b.costoCompra) > 0 ? ((Number(b.precioVenta) - Number(b.costoCompra)) / Number(b.costoCompra)) * 100 : 0;
        return mB - mA;
      }
      if (ordenarPor === "precio") return Number(b.precioVenta) - Number(a.precioVenta);
      if (ordenarPor === "stock") return Number(b.stock) - Number(a.stock);
      const fA = a.fechaEdicion || a.fechaIngreso || "";
      const fB = b.fechaEdicion || b.fechaIngreso || "";
      return fB.localeCompare(fA);
    });

    return result;
  }, [prendas, busqueda, filtroTiempo, filtroCategoria, filtroStock, ordenarPor]);

  const resumen = useMemo(() => {
    const refs = prendas.length;
    const unidades = prendas.reduce((s, p) => s + Number(p.stock || 0), 0);
    const capital = prendas.reduce((s, p) => s + Number(p.costoCompra || 0) * Number(p.stock || 0), 0);
    return { refs, unidades, capital };
  }, [prendas]);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (form.imagenes.length + files.length > 4) return showToast("⚠️ Máximo 4 fotos por prenda", "warn");
    const nuevasImagenes = [];
    for (let file of files) {
      if (file.size > 2 * 1024 * 1024) { showToast("⚠️ Una imagen supera los 2MB, fue omitida.", "warn"); continue; }
      try { nuevasImagenes.push(await comprimirImagen(file)); }
      catch { showToast("Error procesando imagen", "danger"); }
    }
    setForm({ ...form, imagenes: [...form.imagenes, ...nuevasImagenes] });
  };

  const eliminarFoto = (index) => {
    const nuevas = [...form.imagenes];
    nuevas.splice(index, 1);
    setForm({ ...form, imagenes: nuevas });
  };

  const generarCodigo = (categoria) => {
    const prefijo = categoria.substring(0, 3).toUpperCase();
    let maxNum = 0;
    prendas.forEach(p => {
      if (p.codigo && p.codigo.startsWith(prefijo)) {
        const num = parseInt(p.codigo.split("-").pop(), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `${prefijo}-${String(maxNum + 1).padStart(3, "0")}`;
  };

  const guardar = async () => {
    if (!form.descripcion || !form.precioVenta || !form.costoCompra) return showToast("⚠️ Llena todos los campos clave", "warn");

    const stockPorTallaObj = {};
    let totalStockForm = 0;
    let tieneTallas = false;
    Object.keys(form.tallas).forEach(k => {
      if (form.tallas[k] !== "") {
        const val = Number(form.tallas[k]);
        stockPorTallaObj[k] = val;
        totalStockForm += val;
        tieneTallas = true;
      }
    });
    if (!tieneTallas) return showToast("⚠️ Ingresa el stock de al menos una presentación", "warn");

    const codigoFinal = editandoId ? form.codigo : generarCodigo(form.categoria);
    const cNum = Number(form.costoCompra) || 0;
    const pNum = Number(form.precioVenta) || 0;
    const porcGananciaFinal = cNum > 0 ? ((pNum - cNum) / cNum) * 100 : pNum > 0 ? 100 : 0;

    const datosGuardar = {
      codigo: codigoFinal,
      sku: (form.sku || "").trim(),
      descripcion: form.descripcion,
      stockPorTalla: stockPorTallaObj,
      stock: totalStockForm,
      stockMinimo: Number(form.stockMinimo) || 1,
      costoCompra: cNum,
      precioVenta: pNum,
      porcentajeGanancia: porcGananciaFinal,
      categoria: form.categoria,
      imagen: form.imagenes.length > 0 ? form.imagenes[0] : "",
      imagenes: form.imagenes,
      talla: "Varias"
    };

    try {
      if (editandoId) {
        datosGuardar.fechaEdicion = new Date().toISOString();
        if (form.fechaIngreso) datosGuardar.fechaIngreso = form.fechaIngreso;
        const prendaActual = prendas.find(pr => pr.id === editandoId);
        datosGuardar.historial = [
          ...(prendaActual?.historial || []),
          { fecha: datosGuardar.fechaEdicion, tipo: "ajuste_manual", tallas: stockPorTallaObj, costoCompra: cNum }
        ];
        await updateDoc(doc(db, "prendas", editandoId), datosGuardar);
        setPrendas(p => p.map(pr => pr.id === editandoId ? { id: editandoId, ...datosGuardar } : pr));
        showToast("✅ Producto actualizado");
      } else {
        datosGuardar.fechaIngreso = new Date().toISOString();
        datosGuardar.historial = [{ fecha: datosGuardar.fechaIngreso, tipo: "ingreso", tallas: stockPorTallaObj, costoCompra: cNum }];
        const docRef = await addDoc(collection(db, "prendas"), datosGuardar);
        setPrendas(p => [{ id: docRef.id, ...datosGuardar }, ...p]);
        showToast(`✅ Producto guardado: ${codigoFinal}`);
      }
      setForm(formBase); setEditandoId(null); setMostrarForm(false);
    } catch { showToast("❌ Error al guardar", "danger"); }
  };

  const confirmarEliminar = async () => {
    if (!prendaAEliminar) return;
    try {
      await deleteDoc(doc(db, "prendas", prendaAEliminar.id));
      setPrendas(p => p.filter(pr => pr.id !== prendaAEliminar.id));
      setPrendaAEliminar(null); showToast("🗑️ Producto eliminado");
    } catch { showToast("❌ Error al eliminar", "danger"); }
  };

  const abrirEdicion = (p) => {
    let tallasForm = { "Única": "", "Mini": "", "Regular": "", "Grande": "", "Duo": "", "Kit": "" };
    if (p.stockPorTalla) {
      Object.keys(p.stockPorTalla).forEach(k => { if (tallasForm[k] !== undefined) tallasForm[k] = String(p.stockPorTalla[k]); });
    } else if (p.talla && tallasForm[p.talla] !== undefined) {
      tallasForm[p.talla] = String(p.stock);
    }
    const imgsRecuperadas = p.imagenes ? [...p.imagenes] : (p.imagen ? [p.imagen] : []);
    setForm({ ...p, stockMinimo: String(p.stockMinimo || 1), costoCompra: String(p.costoCompra), precioVenta: String(p.precioVenta), tallas: tallasForm, imagenes: imgsRecuperadas });
    setEditandoId(p.id); setMostrarForm(true); window.scrollTo(0, 0);
  };

  const duplicarPrenda = (p) => {
    let tallasForm = { "Única": "", "Mini": "", "Regular": "", "Grande": "", "Duo": "", "Kit": "" };
    if (p.stockPorTalla) {
      Object.keys(p.stockPorTalla).forEach(k => { if (tallasForm[k] !== undefined) tallasForm[k] = String(p.stockPorTalla[k]); });
    }
    const imgsRecuperadas = p.imagenes ? [...p.imagenes] : (p.imagen ? [p.imagen] : []);
    setForm({
      ...formBase,
      descripcion: p.descripcion + " (copia)",
      sku: p.sku || "",
      categoria: p.categoria || "Labial",
      costoCompra: String(p.costoCompra),
      precioVenta: String(p.precioVenta),
      stockMinimo: String(p.stockMinimo || 1),
      tallas: tallasForm,
      imagenes: imgsRecuperadas
    });
    setEditandoId(null); setMostrarForm(true); window.scrollTo(0, 0);
    showToast("📋 Producto duplicado — edita y guarda", "ok");
  };

  const abrirAjusteRapido = (p) => {
    const spt = p.stockPorTalla || {};
    const tallasActuales = {};
    ordenTallas.forEach(t => { if (spt[t] !== undefined) tallasActuales[t] = Number(spt[t]); });
    setAjusteRapido({ prenda: p, tallas: tallasActuales });
  };

  const cambiarStockRapido = (talla, delta) => {
    setAjusteRapido(prev => ({
      ...prev,
      tallas: { ...prev.tallas, [talla]: Math.max(0, (prev.tallas[talla] || 0) + delta) }
    }));
  };

  const guardarAjusteRapido = async () => {
    if (!ajusteRapido) return;
    setGuardandoAjuste(true);
    try {
      const { prenda, tallas } = ajusteRapido;
      const nuevoTotal = Object.values(tallas).reduce((s, v) => s + Number(v), 0);
      const nuevoSPT = { ...(prenda.stockPorTalla || {}) };
      Object.keys(tallas).forEach(t => { nuevoSPT[t] = tallas[t]; });
      const fechaAjuste = new Date().toISOString();
      const tallasEntrada = {};
      Object.keys(tallas).forEach(t => {
        const anterior = Number((prenda.stockPorTalla || {})[t] || 0);
        if (tallas[t] !== anterior) tallasEntrada[t] = tallas[t] - anterior;
      });
      const nuevoHistorial = [
        ...(prenda.historial || []),
        { fecha: fechaAjuste, tipo: "ajuste", tallas: tallasEntrada }
      ];
      await updateDoc(doc(db, "prendas", prenda.id), { stockPorTalla: nuevoSPT, stock: nuevoTotal, fechaEdicion: fechaAjuste, historial: nuevoHistorial });
      setPrendas(p => p.map(pr => pr.id === prenda.id ? { ...pr, stockPorTalla: nuevoSPT, stock: nuevoTotal, historial: nuevoHistorial } : pr));
      setAjusteRapido(null);
      showToast("✅ Stock actualizado");
    } catch { showToast("❌ Error al guardar", "danger"); }
    setGuardandoAjuste(false);
  };

  const cForm = Number(form.costoCompra) || 0;
  const pForm = Number(form.precioVenta) || 0;
  const gananciaCalculada = cForm > 0 ? ((pForm - cForm) / cForm) * 100 : pForm > 0 ? 100 : 0;
  const gananciaDinero = pForm - cForm;

  const margenColor = (pct) => pct >= 40 ? "#2E7D32" : pct >= 20 ? "#E65100" : "#C62828";
  const margenBg = (pct) => pct >= 40 ? "#E8F5E9" : pct >= 20 ? "#FFF3E0" : "#FFEBEE";

  return (
    <div className="inv-wrapper" style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: "100%", boxSizing: "border-box", overflowX: "hidden" }}>

      <style>{`
        .inv-wrapper * { box-sizing: border-box !important; }
        .grid-prendas { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; width: 100%; }
        @media (min-width: 768px) { .grid-prendas { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); } }
        .grid-tallas { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 8px; width: 100%; }
        .grid-precios { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; }
        .img-zoom-container { transition: all 0.35s cubic-bezier(0.165,0.84,0.44,1); transform-origin: center left; position: relative; z-index: 10; cursor: pointer; overflow: visible !important; }
        .img-zoom-container img { transition: transform 0.35s ease; backface-visibility: hidden; }
        .img-zoom-container:hover { transform: scale(1.04) translateY(-1px); z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.12); border-radius: 10px !important; }
        @media (min-width: 768px) { .img-zoom-container:hover { transform: scale(1.08) translateY(-2px); } }
        .upload-mini-btn { width: 60px; height: 60px; border-radius: 12px; background: var(--creme); border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center; color: var(--mid); cursor: pointer; flex-shrink: 0; }
        .ajuste-btn { width: 30px; height: 30px; border-radius: 50%; border: none; font-size: 18px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.1s; }
        .ajuste-btn:active { transform: scale(0.88); }
        .inv-select { background: var(--creme); border: 1px solid var(--border); border-radius: 10px; padding: 7px 10px; font-size: 12px; color: var(--dark); font-family: inherit; }
      `}</style>

      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--dark)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "var(--white)", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {mostrarImportar && (
        <ImportarFactura onBorradorCreado={() => { setMostrarImportar(false); setMostrarBorradores(true); }} onClose={() => setMostrarImportar(false)} />
      )}

      {/* MODAL ELIMINAR con imagen */}
      {prendaAEliminar && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            {(() => {
              const img = (prendaAEliminar.imagenes && prendaAEliminar.imagenes[0]) || prendaAEliminar.imagen;
              return img
                ? <img src={img} alt="prenda" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 16, margin: "0 auto 16px", display: "block", border: "3px solid #FFCDD2" }} />
                : <div style={{ background: "#FFEBEE", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>;
            })()}
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Eliminar Producto?</h3>
            <p style={{ fontSize: 13, color: "var(--dark)", fontWeight: 700, marginBottom: 4 }}>{prendaAEliminar.descripcion}</p>
            <p style={{ fontSize: 12, color: "var(--mid)", marginBottom: 24 }}>{prendaAEliminar.codigo} · {Number(prendaAEliminar.stock)} uds en stock</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPrendaAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE RÁPIDO */}
      {ajusteRapido && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "24px 20px 40px", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 700, color: "var(--dark)", margin: 0 }}>Ajuste rápido de stock</p>
                <p style={{ fontSize: 12, color: "var(--mid)", margin: 0 }}>{ajusteRapido.prenda.descripcion}</p>
              </div>
              <button onClick={() => setAjusteRapido(null)} style={{ background: "var(--creme)", border: "none", borderRadius: 50, width: 34, height: 34, fontSize: 20, cursor: "pointer", color: "var(--mid)" }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {Object.entries(ajusteRapido.tallas).map(([talla, cant]) => (
                <div key={talla} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--creme)", borderRadius: 12, padding: "10px 14px" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", width: 44 }}>{talla}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button className="ajuste-btn" onClick={() => cambiarStockRapido(talla, -1)} style={{ background: "#FFEBEE", color: "var(--danger)" }}>−</button>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--dark)", minWidth: 30, textAlign: "center" }}>{cant}</span>
                    <button className="ajuste-btn" onClick={() => cambiarStockRapido(talla, 1)} style={{ background: "#E8F5E9", color: "#2E7D32" }}>+</button>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--mid)", width: 52, textAlign: "right" }}>
                    {cant === 0 ? "Agotada" : `${cant} uds`}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ textAlign: "center", fontSize: 13, color: "var(--mid)", marginBottom: 14 }}>
              Total: <strong style={{ color: "var(--dark)" }}>{Object.values(ajusteRapido.tallas).reduce((s, v) => s + v, 0)} unidades</strong>
            </p>

            <button onClick={guardarAjusteRapido} disabled={guardandoAjuste} style={{ width: "100%", background: "linear-gradient(135deg, var(--rosa-deep), var(--rosa))", color: "white", border: "none", borderRadius: 14, padding: "14px", fontSize: 14, fontWeight: 700 }}>
              {guardandoAjuste ? "Guardando..." : "✅ Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR */}
      <div className="no-print" style={{ background: "var(--white)", borderRadius: 20, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", width: "100%" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--mid)" }}><Icon name="search" size={16} /></span>
            <input placeholder="Buscar por nombre, código, SKU o categoría..." value={busqueda} onChange={e => setBusqueda(e.target.value)} disabled={mostrarForm} style={{ paddingLeft: 40, width: "100%", background: "var(--creme)", border: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setMostrarImportar(true)} style={{ background: "var(--creme)", color: "var(--rosa-deep)", border: "1.5px solid var(--rosa-soft)", borderRadius: 50, padding: "8px 16px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              🧾 Importar
            </button>
            <button onClick={() => { setMostrarForm(!mostrarForm); if (mostrarForm) { setEditandoId(null); setForm(formBase); } }} style={{ background: mostrarForm ? "var(--mid)" : "linear-gradient(135deg, var(--rosa-deep), var(--rosa))", color: "var(--white)", border: "none", borderRadius: 50, padding: "8px 20px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              {mostrarForm ? <><Icon name="close" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Agregar</>}
            </button>
          </div>
        </div>

        {/* Filtros tiempo */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none", opacity: mostrarForm ? 0.4 : 1, pointerEvents: mostrarForm ? "none" : "auto", marginBottom: 12 }}>
          {[{ id: "hoy", label: "Hoy" }, { id: "semana", label: "7 Días" }, { id: "mes", label: "Este Mes" }, { id: "todo", label: "Todas" }].map(f => (
            <button key={f.id} onClick={() => setFiltroTiempo(f.id)} style={{ background: filtroTiempo === f.id ? "var(--dark)" : "var(--creme)", color: filtroTiempo === f.id ? "white" : "var(--dark)", border: filtroTiempo === f.id ? "1px solid var(--dark)" : "1px solid transparent", padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.2s", cursor: "pointer" }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtros secundarios */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", opacity: mostrarForm ? 0.4 : 1, pointerEvents: mostrarForm ? "none" : "auto" }}>
          <select className="inv-select" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="todas">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="inv-select" value={filtroStock} onChange={e => setFiltroStock(e.target.value)}>
            <option value="todas">Todo el stock</option>
            <option value="ok">Stock OK</option>
            <option value="critico">Stock crítico</option>
            <option value="agotadas">Agotadas</option>
          </select>
          <select className="inv-select" value={ordenarPor} onChange={e => setOrdenarPor(e.target.value)}>
            <option value="fecha">Recientes primero</option>
            <option value="margen">Mayor margen</option>
            <option value="precio">Mayor precio</option>
            <option value="stock">Mayor stock</option>
          </select>
        </div>
      </div>

      {/* COLA DE BORRADORES */}
      {mostrarBorradores && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--warn)", boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 12, background: "#FFF3E0", color: "var(--warn)", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>🧾 Cola de Revisión IA</span>
            <button onClick={() => setMostrarBorradores(false)} style={{ background: "transparent", border: "none", color: "var(--mid)", fontSize: 18, cursor: "pointer" }}>×</button>
          </div>
          <ColaBorradores setPrendas={setPrendas} onCerrar={() => setMostrarBorradores(false)} />
        </div>
      )}

      {/* FORMULARIO */}
      {mostrarForm && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: "20px", boxShadow: "var(--shadow)", border: "1.5px solid var(--rosa-soft)", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: "var(--rosa-deep)", margin: 0 }}>{editandoId ? `Editando: ${form.codigo}` : "Nuevo producto"}</p>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--mid)", background: "var(--creme)", padding: "4px 10px", borderRadius: 50 }}>{form.imagenes.length} / 4 fotos</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", minWidth: 0 }}>

            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
              {form.imagenes.map((img, idx) => (
                <div key={idx} style={{ position: "relative", width: 60, height: 60, borderRadius: 12, overflow: "hidden", flexShrink: 0, border: "1px solid var(--border)" }}>
                  <img src={img} alt={`foto ${idx}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => eliminarFoto(idx)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✕</button>
                  {idx === 0 && <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--rosa-deep)", color: "white", fontSize: 8, textAlign: "center", padding: "2px 0", fontWeight: "bold" }}>Principal</span>}
                </div>
              ))}
              {form.imagenes.length < 4 && (
                <label className="upload-mini-btn">
                  <Icon name="plus" size={20} />
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
                </label>
              )}
            </div>

            <div style={{ width: "100%" }}>
              <label style={{ fontSize: 11, color: "var(--mid)", paddingLeft: 4 }}>Descripción del Producto</label>
              <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={{ width: "100%" }} />
            </div>

            <div style={{ width: "100%" }}>
              <label style={{ fontSize: 11, color: "var(--mid)", paddingLeft: 4 }}>SKU del Proveedor <span style={{ fontWeight: 400 }}>(opcional — para resurtido automático)</span></label>
              <input value={form.sku || ""} onChange={e => setForm({ ...form, sku: e.target.value })} style={{ width: "100%" }} placeholder="Ej: ABC-123" />
            </div>

            <div className="grid-precios">
              <div style={{ width: "100%" }}>
                <label style={{ fontSize: 11, color: "var(--mid)", paddingLeft: 4 }}>Categoría</label>
                <select className="inv-select" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={{ width: "100%" }}>
                  {categorias.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ width: "100%" }}>
                <label style={{ fontSize: 11, color: "var(--mid)", paddingLeft: 4 }}>Alerta Mínimos</label>
                <input type="number" value={form.stockMinimo} onChange={e => setForm({ ...form, stockMinimo: e.target.value })} style={{ width: "100%" }} />
              </div>
            </div>

            <div style={{ background: "var(--creme)", padding: "16px", borderRadius: 12, width: "100%" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--dark)", marginBottom: 12, display: "block" }}>Stock por Presentación</label>
              <div className="grid-tallas">
                {ordenTallas.map(t => (
                  <div key={t} style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                    <label style={{ fontSize: 11, color: "var(--mid)", textAlign: "center", fontWeight: 600 }}>{t}</label>
                    <input type="number" min="0" placeholder="0" value={form.tallas[t]} onChange={e => setForm({ ...form, tallas: { ...form.tallas, [t]: e.target.value } })} style={{ textAlign: "center", padding: "8px 0", width: "100%" }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#FDF5F6", padding: 16, borderRadius: 12, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="grid-precios">
                <div style={{ width: "100%" }}>
                  <label style={{ fontSize: 11, color: "var(--mid)", paddingLeft: 4 }}>Costo ($)</label>
                  <input type="text" value={form.costoCompra ? fmtNum(form.costoCompra) : ""} style={{ width: "100%", background: "white" }} onChange={e => setForm({ ...form, costoCompra: parseNum(e.target.value) })} />
                </div>
                <div style={{ width: "100%" }}>
                  <label style={{ fontSize: 11, color: "var(--rosa-deep)", fontWeight: 600, paddingLeft: 4 }}>Precio Venta ($)</label>
                  <input type="text" value={form.precioVenta ? fmtNum(form.precioVenta) : ""} style={{ width: "100%", background: "white", borderColor: "var(--rosa-soft)" }} onChange={e => setForm({ ...form, precioVenta: parseNum(e.target.value) })} />
                </div>
              </div>
              <div style={{ width: "100%", background: "white", padding: "12px", borderRadius: 10, border: `1px dashed ${gananciaCalculada > 0 ? "var(--success)" : "var(--mid)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Ganancia calculada:</span>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: gananciaCalculada > 0 ? "var(--success)" : "var(--dark)" }}>{gananciaCalculada.toFixed(0)}%</p>
                  <p style={{ margin: 0, fontSize: 10, color: "var(--mid)" }}>Neto: {fmt(gananciaDinero)}</p>
                </div>
              </div>
            </div>
          </div>

          <button onClick={guardar} style={{ marginTop: 20, width: "100%", background: "linear-gradient(135deg, var(--rosa-deep), var(--rosa))", color: "var(--white)", border: "none", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 600, display: "flex", justifyContent: "center", gap: 8 }}>
            <Icon name="check" size={16} /> {editandoId ? "Actualizar Inventario" : "Guardar Producto"}
          </button>
        </div>
      )}

      {/* MINI RESUMEN */}
      <div style={{ background: "var(--white)", borderRadius: 16, padding: "14px 20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--rosa-deep)", margin: 0 }}>{resumen.refs}</p>
            <p style={{ fontSize: 10, color: "var(--mid)", margin: 0, textTransform: "uppercase", letterSpacing: 0.8 }}>Referencias</p>
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--dark)", margin: 0 }}>{resumen.unidades}</p>
            <p style={{ fontSize: 10, color: "var(--mid)", margin: 0, textTransform: "uppercase", letterSpacing: 0.8 }}>Unidades</p>
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#2E7D32", margin: 0 }}>{fmt(resumen.capital)}</p>
            <p style={{ fontSize: 10, color: "var(--mid)", margin: 0, textTransform: "uppercase", letterSpacing: 0.8 }}>Capital</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--mid)", margin: 0 }}>
          Mostrando <strong style={{ color: "var(--dark)" }}>{filtradas.length}</strong> de {resumen.refs}
        </p>
      </div>

      {/* GRID */}
      <div className="grid-prendas">
        {filtradas.length === 0 && <p style={{ fontSize: 13, color: "var(--mid)", padding: "10px" }}>No hay productos con estos filtros.</p>}
        {filtradas.map(p => {
          const tallasArray = p.stockPorTalla
            ? Object.entries(p.stockPorTalla).sort((a, b) => ordenTallas.indexOf(a[0]) - ordenTallas.indexOf(b[0]))
            : (p.talla ? [[p.talla, Number(p.stock)]] : []);
          const totalStock = tallasArray.reduce((acc, [, cant]) => acc + Number(cant), 0);
          const fechaMostrar = p.fechaEdicion ? `Act: ${fmtFecha(p.fechaEdicion)}` : p.fechaIngreso ? `Ing: ${fmtFecha(p.fechaIngreso)}` : "Registro antiguo";
          const imgMostrar = (p.imagenes && p.imagenes.length > 0) ? p.imagenes[0] : p.imagen;
          const costo = Number(p.costoCompra) || 0;
          const precio = Number(p.precioVenta) || 0;
          const margen = costo > 0 ? Math.round(((precio - costo) / costo) * 100) : precio > 0 ? 100 : 0;
          const tallasAjustables = p.stockPorTalla
            ? Object.fromEntries(Object.entries(p.stockPorTalla).map(([t, v]) => [t, Number(v)]))
            : {};
          const tieneAjustables = Object.keys(tallasAjustables).length > 0;

          return (
            <div key={p.id} className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 14, width: "100%", position: "relative" }}>

              {/* Badge margen */}
              <div style={{ position: "absolute", top: 14, right: 14, background: margenBg(margen), color: margenColor(margen), padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, zIndex: 1 }}>
                {margen}% margen
              </div>

              {/* Header */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingRight: 88 }}>
                <div className="img-zoom-container" style={{ width: 64, height: 64, borderRadius: 12, background: "var(--rosa-pale)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {imgMostrar
                    ? <img src={imgMostrar} alt="Prenda" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                    : <Icon name="image" size={24} color="var(--rosa-deep)" />}
                  {p.imagenes && p.imagenes.length > 1 && (
                    <div style={{ position: "absolute", bottom: -4, right: -4, background: "var(--dark)", color: "white", padding: "2px 6px", borderRadius: 8, fontSize: 9, fontWeight: 800, border: "2px solid white" }}>+{p.imagenes.length - 1}</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", margin: "0 0 3px 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{p.descripcion}</p>
                  <p style={{ fontSize: 11, color: "var(--mid)", margin: "0 0 2px 0" }}>{p.categoria} · {p.codigo}</p>
                  {p.sku && (
                    <p style={{ fontSize: 10, color: "var(--mid)", margin: "0 0 4px 0", fontFamily: "monospace", background: "var(--creme)", display: "inline-block", padding: "1px 7px", borderRadius: 4 }}>SKU: {p.sku}</p>
                  )}
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--rosa-deep)", margin: 0 }}>{fmt(p.precioVenta)}</p>
                </div>
              </div>

              {/* Stock tallas */}
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--mid)", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>Stock por talla</p>
                  <p style={{ fontSize: 9, color: "var(--mid)", margin: 0 }}><Icon name="calendar" size={10} /> {fechaMostrar}</p>
                </div>
                <div className="grid-tallas">
                  {tallasArray.map(([t, cant]) => {
                    const num = Number(cant);
                    const isAgotada = num === 0;
                    const isWarn = num > 0 && num <= (Number(p.stockMinimo) || 1);
                    const bg = isAgotada ? "#FFEBEE" : isWarn ? "#FFF8E1" : "#E8F5E9";
                    const col = isAgotada ? "#C62828" : isWarn ? "#E65100" : "#2E7D32";
                    const brd = isAgotada ? "#FFCDD2" : isWarn ? "#FFECB3" : "#C8E6C9";
                    const dot = isAgotada ? "#E53935" : isWarn ? "#FB8C00" : "#43A047";
                    return (
                      <div key={t} style={{ background: bg, border: `1px solid ${brd}`, color: col, padding: "8px 4px", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot, position: "absolute", top: 4, right: 4 }} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{t}</span>
                        <span style={{ fontSize: 9, fontWeight: 600 }}>{isAgotada ? "Agotada" : `${num} uds`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totales */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#F9FAFB", borderRadius: 12 }}>
                <div>
                  <span style={{ fontSize: 10, color: "var(--mid)", display: "block" }}>Total stock</span>
                  <span style={{ fontSize: 13, color: "var(--dark)", fontWeight: 700 }}>{totalStock} uds</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, color: "var(--mid)", display: "block" }}>Valor inventario</span>
                  <span style={{ fontSize: 13, color: "var(--rosa-deep)", fontWeight: 700 }}>{fmt(totalStock * precio)}</span>
                </div>
              </div>

              {/* Historial */}
              {p.historial && p.historial.length > 0 && (
                <div>
                  <button
                    onClick={() => setHistorialAbierto(historialAbierto === p.id ? null : p.id)}
                    style={{ width: "100%", background: "var(--creme)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "var(--mid)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span>📋 Historial de movimientos ({p.historial.length})</span>
                    <span>{historialAbierto === p.id ? "▲" : "▼"}</span>
                  </button>
                  {historialAbierto === p.id && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {[...p.historial].reverse().map((h, i) => {
                        const tipoBg   = h.tipo === "ingreso" ? "#E8F5E9" : h.tipo === "resurtido" ? "#E3F2FD" : "#FFF3E0";
                        const tipoCol  = h.tipo === "ingreso" ? "#2E7D32" : h.tipo === "resurtido" ? "#1565C0" : "#E65100";
                        const tipoLabel = h.tipo === "ingreso" ? "Ingreso inicial" : h.tipo === "resurtido" ? "Resurtido" : "Ajuste";
                        const tallasEntries = Object.entries(h.tallas || {}).filter(([, v]) => v !== 0);
                        return (
                          <div key={i} style={{ background: "#FAFAFA", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, background: tipoBg, color: tipoCol, padding: "2px 8px", borderRadius: 20 }}>{tipoLabel}</span>
                              <span style={{ fontSize: 10, color: "var(--mid)" }}>{fmtFecha(h.fecha)}</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {tallasEntries.map(([t, v]) => (
                                <span key={t} style={{ fontSize: 11, fontWeight: 700, background: "white", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 8px", color: h.tipo === "ajuste" ? (v > 0 ? "#2E7D32" : "#C62828") : "var(--dark)" }}>
                                  {t}: {h.tipo === "ajuste" ? (v > 0 ? `+${v}` : v) : `+${v}`} uds
                                </span>
                              ))}
                              {tallasEntries.length === 0 && <span style={{ fontSize: 11, color: "var(--mid)" }}>Sin cambios de talla</span>}
                            </div>
                            {h.costoCompra > 0 && (
                              <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--mid)" }}>Costo: {fmt(h.costoCompra)} por ud</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Acciones */}
              <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 14, flexWrap: "wrap" }}>
                {tieneAjustables && (
                  <button onClick={() => abrirAjusteRapido(p)} style={{ flex: "1 1 auto", background: "#E3F2FD", color: "#1565C0", border: "none", borderRadius: 12, padding: "10px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ± Stock
                  </button>
                )}
                <button onClick={() => duplicarPrenda(p)} style={{ flex: "1 1 auto", background: "var(--creme)", color: "var(--dark)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  📋 Duplicar
                </button>
                <button onClick={() => abrirEdicion(p)} style={{ flex: "1 1 auto", background: "var(--white)", color: "var(--rosa-deep)", border: "1px solid var(--rosa-soft)", borderRadius: 12, padding: "10px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ✏️ Editar
                </button>
                <button onClick={() => setPrendaAEliminar(p)} style={{ flex: "0 0 auto", background: "#FFEBEE", color: "var(--danger)", border: "none", borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
