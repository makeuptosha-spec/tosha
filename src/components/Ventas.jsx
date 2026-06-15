import { useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, Icon, Badge, fmtFecha } from "../utils.jsx";
import FacturaPDF from "./FacturaPDF.jsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Ventas({ prendas, setPrendas, ventas, setVentas, facturas, setFacturas }) {
  const [mostrarForm, setMostrarForm]           = useState(false);
  const [carrito, setCarrito]                   = useState([]);
  const [codigoSel, setCodigoSel]               = useState("");
  const [cantidad, setCantidad]                 = useState(1);
  const [precioFinal, setPrecioFinal]           = useState("");
  const [tallaSel, setTallaSel]                 = useState("");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [formaPago, setFormaPago]               = useState("Efectivo");
  const [clienteNombre, setClienteNombre]       = useState("");
  const [clienteTelefono, setClienteTelefono]   = useState("");
  const [busqueda, setBusqueda]                 = useState("");
  const [filtroTiempo, setFiltroTiempo]         = useState("todo");
  const [toast, setToast]                       = useState(null);
  const [ultimaVentaPdf, setUltimaVentaPdf]     = useState(null);
  const [facturaAEliminar, setFacturaAEliminar] = useState(null);
  const [itemAEliminar, setItemAEliminar]       = useState(null);
  const [mostrarModalImpresion, setMostrarModalImpresion] = useState(false);
  const [generandoPDF, setGenerandoPDF]         = useState(false);

  const prendaSel  = prendas.find(p => p.codigo === codigoSel);
  const ordenTallas = ["Única","Mini","Regular","Grande","Duo","Kit"];
  const showToast  = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  // ── COMPATIBILIDAD CON DATOS VIEJOS ─────────────────────────────────────
  const facturasCompletas = useMemo(() => {
    const lista = [...facturas];
    const ticketsOficiales = new Set(facturas.map(f => f.ticketId));
    const ventasViejas = ventas.filter(v => !ticketsOficiales.has(v.ticketId) && !ticketsOficiales.has(v.id));
    const agrupadas = ventasViejas.reduce((acc, v) => {
      const tId = v.ticketId || v.id;
      if (!acc[tId]) acc[tId] = { id: tId, ticketId: tId, fecha: v.fecha || new Date().toISOString(), formaPago: v.formaPago || "Prueba", total: 0, items: [], esVieja: true };
      acc[tId].items.push({ cantidad: v.cantidad, descripcion: v.descripcion, talla: v.talla, precioFinal: v.precioVenta, codigo: v.codigo });
      acc[tId].total += (Number(v.precioVenta) * Number(v.cantidad));
      return acc;
    }, {});
    return [...lista, ...Object.values(agrupadas)];
  }, [facturas, ventas]);

  // ── FILTROS ──────────────────────────────────────────────────────────────
  const facturasFiltradas = useMemo(() => {
    const hoy = new Date();
    const hace7Dias = new Date(); hace7Dias.setDate(hoy.getDate() - 7);
    return facturasCompletas.filter(f => {
      const q = busqueda.toLowerCase();
      const coincideTexto =
        (f.ticketId || "").toLowerCase().includes(q) ||
        (f.formaPago || "").toLowerCase().includes(q) ||
        (f.clienteNombre || "").toLowerCase().includes(q) ||
        (f.clienteCredito || "").toLowerCase().includes(q) ||
        (f.items || []).some(i => (i.descripcion || "").toLowerCase().includes(q));
      if (filtroTiempo === "creditos") return coincideTexto && f.formaPago === "Crédito" && f.estadoCredito === "abierto";
      let coincideFecha = true;
      if (f.fecha && filtroTiempo !== "todo") {
        const d = new Date(f.fecha);
        if      (filtroTiempo === "hoy")    coincideFecha = d.toDateString() === hoy.toDateString();
        else if (filtroTiempo === "semana") coincideFecha = d >= hace7Dias;
        else if (filtroTiempo === "mes")    coincideFecha = d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
      }
      return coincideTexto && coincideFecha;
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [facturasCompletas, busqueda, filtroTiempo]);

  // Resumen del filtro activo — via ventas para obtener costoCompra
  const ticketsFiltrados  = useMemo(() => new Set(facturasFiltradas.map(f => f.ticketId)), [facturasFiltradas]);
  const ventasFiltradas   = useMemo(() => ventas.filter(v => ticketsFiltrados.has(v.ticketId)), [ventas, ticketsFiltrados]);
  const totalFiltrado     = facturasFiltradas.reduce((s, f) => s + Number(f.total), 0);
  const gananciaFiltrada  = ventasFiltradas.reduce((s, v) => s + (Number(v.precioVenta) - Number(v.costoCompra)) * Number(v.cantidad), 0);

  // ── CARRITO ──────────────────────────────────────────────────────────────
  const totalCarrito    = carrito.reduce((s, i) => s + i.precioFinal * i.cantidad, 0);
  const gananciaCarrito = carrito.reduce((s, i) => s + (i.precioFinal - Number(i.costoCompra || 0)) * i.cantidad, 0);
  const margenCarrito   = totalCarrito > 0 ? Math.round((gananciaCarrito / totalCarrito) * 100) : 0;

  // Descuento / pérdida en precio editado
  const precioOriginal  = Number(prendaSel?.precioVenta || 0);
  const precioActual    = Number(precioFinal || 0);
  const descuentoPct    = precioOriginal > 0 && precioActual > 0 && precioActual < precioOriginal
    ? Math.round(((precioOriginal - precioActual) / precioOriginal) * 100) : 0;
  const bajoCosto       = precioActual > 0 && precioActual < Number(prendaSel?.costoCompra || 0);

  const handleSelectPrenda = (codigo) => {
    setCodigoSel(codigo);
    setTallaSel("");
    const p = prendas.find(pr => pr.codigo === codigo);
    if (p) setPrecioFinal(String(p.precioVenta));
  };

  const agregarAlCarrito = () => {
    if (!prendaSel || cantidad < 1 || precioFinal === "") return showToast("⚠️ Revisa los datos", "warn");
    if (prendaSel.stockPorTalla && !tallaSel) return showToast("⚠️ Selecciona la talla", "warn");
    const stockTalla = prendaSel.stockPorTalla ? (Number(prendaSel.stockPorTalla[tallaSel]) || 0) : Number(prendaSel.stock);
    const yaEnCarrito = carrito.find(item => item.id === prendaSel.id && item.tallaSel === tallaSel);
    const cantTotal   = yaEnCarrito ? yaEnCarrito.cantidad + cantidad : cantidad;
    if (stockTalla < cantTotal) return showToast("🔴 No hay stock suficiente para esta talla", "danger");
    if (yaEnCarrito) {
      setCarrito(carrito.map(item => item.id === prendaSel.id && item.tallaSel === tallaSel ? { ...item, cantidad: cantTotal } : item));
    } else {
      setCarrito([...carrito, { ...prendaSel, cantidad, precioFinal: Number(precioFinal), tallaSel }]);
    }
    setCodigoSel(""); setCantidad(1); setPrecioFinal(""); setTallaSel(""); setBusquedaProducto("");
  };

  // ── PROCESAR VENTA ───────────────────────────────────────────────────────
  const procesarVentaMultiple = async () => {
    if (carrito.length === 0) return;
    const ticketId      = `TK-${Date.now()}`;
    const fechaActual   = new Date().toISOString();
    const numeroFactura = facturas.filter(f => !f.esVieja).length + 1;
    let nuevasVentasLocal = [];
    try {
      for (const item of carrito) {
        const tallaVendida = item.tallaSel || item.talla;
        const nuevaVenta   = { ticketId, fecha: fechaActual, formaPago, codigo: item.codigo, descripcion: item.descripcion, talla: tallaVendida, cantidad: item.cantidad, precioVenta: item.precioFinal, costoCompra: item.costoCompra };
        const ventaRef     = await addDoc(collection(db, "ventas"), nuevaVenta);
        nuevasVentasLocal.push({ id: ventaRef.id, ...nuevaVenta });

        const prendaRef = doc(db, "prendas", item.id);
        if (item.stockPorTalla && item.tallaSel) {
          const nuevoSPT = { ...item.stockPorTalla };
          nuevoSPT[item.tallaSel] = Math.max(0, Number(nuevoSPT[item.tallaSel] || 0) - item.cantidad);
          const nuevoTotal = Object.values(nuevoSPT).reduce((a, b) => a + Number(b), 0);
          await updateDoc(prendaRef, { stock: nuevoTotal, stockPorTalla: nuevoSPT });
          setPrendas(p => p.map(pr => pr.id === item.id ? { ...pr, stock: nuevoTotal, stockPorTalla: nuevoSPT } : pr));
        } else {
          const stockRestante = Number(item.stock) - item.cantidad;
          await updateDoc(prendaRef, { stock: stockRestante });
          setPrendas(p => p.map(pr => pr.id === item.id ? { ...pr, stock: stockRestante } : pr));
        }
      }

      const esCredito   = formaPago === "Crédito";
      const nuevaFac    = {
        ticketId, fecha: fechaActual, formaPago, total: totalCarrito, numeroFactura,
        ...(clienteNombre    ? { clienteNombre }    : {}),
        ...(clienteTelefono  ? { clienteTelefono }  : {}),
        ...(esCredito        ? { estadoCredito: "abierto" } : {}),
        items: carrito.map(i => ({ cantidad: i.cantidad, descripcion: i.descripcion, talla: i.tallaSel || i.talla, precioFinal: i.precioFinal, codigo: i.codigo }))
      };
      const facRef = await addDoc(collection(db, "facturas"), nuevaFac);
      setFacturas(f => [{ id: facRef.id, ...nuevaFac }, ...f]);
      setVentas(v  => [...nuevasVentasLocal, ...v]);
      setUltimaVentaPdf({ id: facRef.id, ...nuevaFac });
      setCarrito([]); setMostrarForm(false); setClienteNombre(""); setClienteTelefono("");
      setMostrarModalImpresion(true);
    } catch { showToast("❌ Error al procesar", "danger"); }
  };

  // ── PDF ──────────────────────────────────────────────────────────────────
  const generarFacturaPDF = async () => {
    const el = document.getElementById("factura-pdf-render");
    if (!el || !ultimaVentaPdf) return;
    setGenerandoPDF(true);
    try {
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 200));
      const canvas  = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf     = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      const num    = String(ultimaVentaPdf.numeroFactura || 0).padStart(4, "0");
      const nombre = ultimaVentaPdf.numeroFactura ? `Factura_TOSHA-${num}.pdf` : `Factura_${ultimaVentaPdf.ticketId?.slice(-6)}.pdf`;
      pdf.save(nombre);
    } catch { showToast("❌ Error generando PDF", "danger"); }
    finally { setGenerandoPDF(false); }
  };

  const enviarWhatsApp = () => {
    if (!ultimaVentaPdf?.clienteTelefono) return;
    const num      = String(ultimaVentaPdf.numeroFactura || 0).padStart(4, "0");
    const idFac    = ultimaVentaPdf.numeroFactura ? `TOSHA-${num}` : ultimaVentaPdf.ticketId?.slice(-6);
    const texto    = `Hola! Aquí tienes tu factura *${idFac}* de Tosha 💜\nTotal: *${fmt(ultimaVentaPdf.total)}*\nFecha: ${new Date(ultimaVentaPdf.fecha).toLocaleDateString("es-CO")}\n¡Gracias por tu compra, hermosa! 💜`;
    window.open(`https://wa.me/57${ultimaVentaPdf.clienteTelefono.replace(/\D/g,"")}?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const reImprimir = (factura) => { setUltimaVentaPdf(factura); setTimeout(() => setMostrarModalImpresion(true), 100); };

  // ── CANCELAR VENTA COMPLETA — BUG FIX: restaura stockPorTalla ────────────
  const confirmarEliminarVenta = async () => {
    if (!facturaAEliminar) return;
    try {
      const prendasMut = [...prendas];
      for (const item of facturaAEliminar.items) {
        const p = prendasMut.find(pr => pr.codigo === item.codigo || pr.descripcion === item.descripcion);
        if (!p || !item.cantidad) continue;
        const nuevoSPT = { ...(p.stockPorTalla || {}) };
        if (item.talla && nuevoSPT[item.talla] !== undefined) {
          nuevoSPT[item.talla] = Number(nuevoSPT[item.talla] || 0) + Number(item.cantidad);
        }
        const nuevoTotal = Object.values(nuevoSPT).reduce((a, b) => a + Number(b), 0);
        await updateDoc(doc(db, "prendas", p.id), { stock: nuevoTotal, stockPorTalla: nuevoSPT });
        p.stock = nuevoTotal; p.stockPorTalla = nuevoSPT;
      }
      setPrendas(prendasMut);

      if (!facturaAEliminar.esVieja) {
        await deleteDoc(doc(db, "facturas", facturaAEliminar.id));
        setFacturas(f => f.filter(x => x.id !== facturaAEliminar.id));
      }
      const ventasABorrar = ventas.filter(v => v.ticketId === facturaAEliminar.ticketId || v.id === facturaAEliminar.ticketId);
      for (const v of ventasABorrar) await deleteDoc(doc(db, "ventas", v.id));
      setVentas(v => v.filter(x => x.ticketId !== facturaAEliminar.ticketId && x.id !== facturaAEliminar.ticketId));
      setFacturaAEliminar(null);
      showToast("🗑️ Venta anulada y stock restaurado por talla");
    } catch (err) { showToast("❌ Error al eliminar", "danger"); }
  };

  // ── CANCELAR ÍTEM — BUG FIX: restaura stockPorTalla ────────────────────
  const confirmarEliminarItem = async () => {
    if (!itemAEliminar) return;
    const { factura, index, item } = itemAEliminar;
    try {
      const p = prendas.find(pr => pr.codigo === item.codigo || pr.descripcion === item.descripcion);
      if (p) {
        const nuevoSPT = { ...(p.stockPorTalla || {}) };
        if (item.talla && nuevoSPT[item.talla] !== undefined) {
          nuevoSPT[item.talla] = Number(nuevoSPT[item.talla] || 0) + Number(item.cantidad);
        }
        const nuevoTotal = Object.values(nuevoSPT).reduce((a, b) => a + Number(b), 0);
        await updateDoc(doc(db, "prendas", p.id), { stock: nuevoTotal, stockPorTalla: nuevoSPT });
        setPrendas(prev => prev.map(x => x.id === p.id ? { ...x, stock: nuevoTotal, stockPorTalla: nuevoSPT } : x));
      }

      const ventaDoc = ventas.find(v => (v.ticketId === factura.ticketId || v.id === factura.ticketId) && (v.codigo === item.codigo || v.descripcion === item.descripcion));
      if (ventaDoc) { await deleteDoc(doc(db, "ventas", ventaDoc.id)); setVentas(prev => prev.filter(v => v.id !== ventaDoc.id)); }

      if (!factura.esVieja) {
        const nuevosItems = factura.items.filter((_, i) => i !== index);
        if (nuevosItems.length === 0) {
          await deleteDoc(doc(db, "facturas", factura.id));
          setFacturas(prev => prev.filter(f => f.id !== factura.id));
        } else {
          const nuevoTotal = nuevosItems.reduce((acc, i) => acc + (i.cantidad * i.precioFinal), 0);
          await updateDoc(doc(db, "facturas", factura.id), { items: nuevosItems, total: nuevoTotal });
          setFacturas(prev => prev.map(f => f.id === factura.id ? { ...f, items: nuevosItems, total: nuevoTotal } : f));
        }
      }
      setItemAEliminar(null);
      showToast("✅ Producto anulado y stock devuelto");
    } catch (err) { showToast("❌ Error al anular prenda", "danger"); }
  };

  const cerrarCredito = async (factura) => {
    try {
      const fechaCierre = new Date().toISOString();
      await updateDoc(doc(db, "facturas", factura.id), { estadoCredito: "cerrado", fechaCierre });
      setFacturas(f => f.map(x => x.id === factura.id ? { ...x, estadoCredito: "cerrado", fechaCierre } : x));
      showToast("✅ Crédito cerrado — dinero ingresado a cuentas");
    } catch { showToast("❌ Error al cerrar crédito", "danger"); }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>

      {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--dark)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>{toast.msg}</div>}

      {/* Factura off-screen para html2canvas */}
      {ultimaVentaPdf && (
        <div style={{ position: "fixed", left: -9999, top: 0, zIndex: -1, pointerEvents: "none" }}>
          <FacturaPDF factura={ultimaVentaPdf} />
        </div>
      )}

      {/* MODAL: Anular venta completa */}
      {facturaAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 30, borderRadius: 24, width: "90%", maxWidth: 360, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "#FFEBEE", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Anular Venta Completa?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>Se eliminará el recibo <strong>{facturaAEliminar.ticketId?.slice(-6)}</strong> y el stock por talla volverá al inventario.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setFacturaAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarEliminarVenta} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600, cursor: "pointer" }}>Anular Todo</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Anular ítem */}
      {itemAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 30, borderRadius: 24, width: "90%", maxWidth: 360, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "#FFF3E0", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--warn)" }}><Icon name="alert" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Anular este producto?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>Se quitará <strong>{itemAEliminar.item.descripcion} ({itemAEliminar.item.talla})</strong> y su stock regresará al inventario.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setItemAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarEliminarItem} style={{ flex: 1, background: "var(--warn)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600, cursor: "pointer" }}>Quitar Prenda</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PDF / WhatsApp */}
      {mostrarModalImpresion && ultimaVentaPdf && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 30, borderRadius: 24, width: "90%", maxWidth: 380, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "linear-gradient(135deg, var(--rosa-deep), var(--rosa))", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>💜</div>
            <h3 style={{ fontSize: 19, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 4 }}>¡Venta registrada!</h3>
            {ultimaVentaPdf.numeroFactura && (
              <p style={{ fontSize: 13, color: "var(--rosa-deep)", fontWeight: 700, marginBottom: 4 }}>TOSHA-{String(ultimaVentaPdf.numeroFactura).padStart(4,"0")}</p>
            )}
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>¿Qué deseas hacer con la factura?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={generarFacturaPDF} disabled={generandoPDF}
                style={{ background: "linear-gradient(135deg, var(--rosa-deep), var(--rosa))", color: "white", border: "none", padding: "13px", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: generandoPDF ? 0.7 : 1 }}>
                {generandoPDF ? "⏳ Generando PDF..." : "⬇️ Descargar PDF"}
              </button>
              {ultimaVentaPdf.clienteTelefono && (
                <button onClick={enviarWhatsApp}
                  style={{ background: "#25D366", color: "white", border: "none", padding: "13px", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  📱 Enviar por WhatsApp
                </button>
              )}
              <button onClick={() => setMostrarModalImpresion(false)}
                style={{ background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600, cursor: "pointer" }}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR */}
      <div className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", background: "var(--white)", padding: "16px 20px", borderRadius: 20, boxShadow: "var(--shadow)" }}>
        <div style={{ position: "relative", flex: "1 1 180px" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--mid)" }}><Icon name="search" size={16} /></span>
          <input placeholder="Buscar factura, prenda o cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} disabled={mostrarForm} style={{ paddingLeft: 40 }} />
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none", opacity: mostrarForm ? 0.4 : 1, pointerEvents: mostrarForm ? "none" : "auto" }}>
          {[{ id: "hoy", label: "Hoy" },{ id: "semana", label: "7 Días" },{ id: "mes", label: "Mes" },{ id: "todo", label: "Todas" },{ id: "creditos", label: "💳 Créditos" }].map(f => (
            <button key={f.id} onClick={() => setFiltroTiempo(f.id)}
              style={{ background: filtroTiempo === f.id ? "var(--dark)" : "var(--creme)", color: filtroTiempo === f.id ? "white" : "var(--mid)", border: filtroTiempo === f.id ? "1px solid var(--dark)" : "1px solid var(--border)", padding: "8px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer" }}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => { setMostrarForm(!mostrarForm); setCarrito([]); setCodigoSel(""); setTallaSel(""); setBusquedaProducto(""); }}
          style={{ background: mostrarForm ? "var(--mid)" : "linear-gradient(135deg, var(--rosa-deep), var(--rosa))", color: "#fff", border: "none", borderRadius: 14, padding: "13px 20px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", marginLeft: "auto", cursor: "pointer" }}>
          {mostrarForm ? <><Icon name="close" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Nueva Venta</>}
        </button>
      </div>

      {!mostrarForm ? (
        <div className="animate no-print" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* RESUMEN DEL FILTRO ACTIVO */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mid)" }}>
              {facturasFiltradas.length} {facturasFiltradas.length === 1 ? "venta" : "ventas"}
            </span>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 11, color: "var(--mid)", margin: 0 }}>Ingresos</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--rosa-deep)", margin: 0 }}>{fmt(totalFiltrado)}</p>
              </div>
              {gananciaFiltrada > 0 && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 11, color: "var(--mid)", margin: 0 }}>Ganancia</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "var(--success)", margin: 0 }}>{fmt(gananciaFiltrada)}</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {facturasFiltradas.length === 0 && <p style={{ fontSize: 13, color: "var(--mid)", padding: "10px" }}>No hay ventas en este filtro.</p>}
            {facturasFiltradas.map(f => {
              const numStr        = f.numeroFactura ? `TOSHA-${String(f.numeroFactura).padStart(4,"0")}` : `TK-${f.ticketId?.slice(-6)}`;
              const nombreCliente = f.clienteNombre || f.clienteCredito || "";
              return (
                <div key={f.id} style={{ background: "var(--white)", borderRadius: 16, padding: "18px", boxShadow: "var(--shadow)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px dashed var(--border)", paddingBottom: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)" }}>{numStr}</p>
                        {f.formaPago === "Crédito" && f.estadoCredito === "abierto"  && <span style={{ fontSize: 9, background: "#F3E5F5", color: "#7B1FA2", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>💳 CRÉDITO ABIERTO</span>}
                        {f.formaPago === "Crédito" && f.estadoCredito === "cerrado" && <span style={{ fontSize: 9, background: "#E8F5E9", color: "var(--success)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>✅ COBRADO</span>}
                      </div>
                      {nombreCliente && <p style={{ fontSize: 12, fontWeight: 600, color: "#7B1FA2", marginTop: 2 }}>👤 {nombreCliente}</p>}
                      <p style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>{fmtFecha(f.fecha)} · {new Date(f.fecha).toLocaleTimeString("es-CO",{ hour:"2-digit", minute:"2-digit" })}</p>
                    </div>
                    <Badge variant="default">{f.formaPago}</Badge>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--mid)", flex: 1 }}>
                    {f.items.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span>{item.cantidad}× {item.descripcion} {item.talla ? `(${item.talla})` : ""}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, color: "var(--dark)" }}>{fmt(item.precioFinal * item.cantidad)}</span>
                          <button onClick={() => setItemAEliminar({ factura: f, index: idx, item })} style={{ background: "transparent", border: "none", color: "var(--danger)", padding: "2px 4px", cursor: "pointer", fontSize: 16, fontWeight: "bold", lineHeight: 1 }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "var(--rosa-deep)" }}>{fmt(f.total)}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {f.formaPago === "Crédito" && f.estadoCredito === "abierto" && (
                        <button onClick={() => cerrarCredito(f)} style={{ background: "#F3E5F5", color: "#7B1FA2", border: "1px solid #CE93D8", borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          💳 Cobrar
                        </button>
                      )}
                      <button onClick={() => setFacturaAEliminar(f)} style={{ background: "#FFEBEE", color: "var(--danger)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑️</button>
                      <button onClick={() => reImprimir(f)} style={{ background: "var(--creme)", color: "var(--dark)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📄 Factura</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      ) : (
        <div className="animate no-print" style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 600, background: "var(--white)", borderRadius: 20, padding: "24px", boxShadow: "var(--shadow)", border: "1.5px solid var(--rosa-soft)" }}>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: "var(--rosa-deep)", marginBottom: 20 }}>Facturar Productos</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Buscador de producto */}
              {!prendaSel && (
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--mid)" }}><Icon name="search" size={16} /></span>
                  <input placeholder="Busca por nombre, código, SKU o categoría..." value={busquedaProducto} onChange={e => setBusquedaProducto(e.target.value)} style={{ paddingLeft: 40 }} autoFocus />
                </div>
              )}

              {/* Resultados de búsqueda */}
              {busquedaProducto && !prendaSel && (() => {
                const q = busquedaProducto.toLowerCase();
                const resultados = prendas.filter(p =>
                  Number(p.stock) > 0 && (
                    (p.descripcion || "").toLowerCase().includes(q) ||
                    (p.codigo || "").toLowerCase().includes(q) ||
                    (p.sku || "").toLowerCase().includes(q) ||
                    (p.categoria || "").toLowerCase().includes(q)
                  )
                );
                return (
                  <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    {resultados.length === 0 && <p style={{ fontSize: 13, color: "var(--mid)", textAlign: "center", padding: "20px 0" }}>Sin resultados para "{busquedaProducto}"</p>}
                    {resultados.map(p => {
                      const tallasDisp = ordenTallas.filter(t => Number(p.stockPorTalla?.[t] || 0) > 0);
                      const imgSrc = p.imagenes?.[0] || p.imagen;
                      return (
                        <div key={p.id} style={{ background: "var(--creme)", borderRadius: 12, padding: "12px", display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--border)" }}>
                          <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--rosa-pale)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {imgSrc ? <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="image" size={18} color="var(--rosa-deep)" />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--dark)", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.descripcion}</p>
                            <p style={{ fontSize: 10, color: "var(--mid)", margin: "0 0 8px" }}>
                              {p.codigo}{p.sku ? ` · SKU: ${p.sku}` : ""} · {fmt(p.precioVenta)}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {tallasDisp.length === 0 && <span style={{ fontSize: 11, color: "var(--danger)" }}>Sin stock por talla</span>}
                              {tallasDisp.map(t => (
                                <button key={t} onClick={() => { handleSelectPrenda(p.codigo); setTallaSel(t); setBusquedaProducto(p.descripcion); }}
                                  style={{ background: "var(--rosa-deep)", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  {t} <span style={{ opacity: 0.75, fontWeight: 400 }}>({p.stockPorTalla[t]})</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Producto + talla seleccionados */}
              {prendaSel && (
                <div style={{ background: "#F0FFF4", border: "1.5px solid var(--success)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0 }}>{prendaSel.descripcion}</p>
                    <p style={{ fontSize: 11, color: "var(--success)", margin: "3px 0 0", fontWeight: 600 }}>
                      {tallaSel ? `Talla ${tallaSel} · ${prendaSel.stockPorTalla?.[tallaSel] ?? prendaSel.stock} disponibles` : "Selecciona talla"}
                    </p>
                  </div>
                  <button onClick={() => { setCodigoSel(""); setTallaSel(""); setBusquedaProducto(""); }} style={{ background: "transparent", border: "none", color: "var(--mid)", fontSize: 20, cursor: "pointer" }}>×</button>
                </div>
              )}

              {/* Cantidad + Precio */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--mid)", marginLeft: 4 }}>Cantidad</label>
                  <input type="number" min="1" value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--mid)", marginLeft: 4 }}>Precio Final c/u ($)</label>
                  <input type="text" value={precioFinal ? fmtNum(precioFinal) : ""} onChange={e => setPrecioFinal(parseNum(e.target.value))} style={{ borderColor: bajoCosto ? "var(--danger)" : descuentoPct > 0 ? "var(--warn)" : undefined }} />
                  {bajoCosto && <p style={{ fontSize: 11, color: "var(--danger)", fontWeight: 700, marginTop: 4 }}>⚠️ Precio por debajo del costo ({fmt(prendaSel?.costoCompra)})</p>}
                  {!bajoCosto && descuentoPct > 0 && <p style={{ fontSize: 11, color: "var(--warn)", marginTop: 4 }}>Descuento: −{descuentoPct}% del precio original ({fmt(precioOriginal)})</p>}
                </div>
              </div>

              <button onClick={agregarAlCarrito}
                style={{ background: prendaSel && tallaSel ? "var(--rosa-pale)" : "var(--creme)", color: prendaSel && tallaSel ? "var(--rosa-deep)" : "var(--mid)", border: `1px dashed ${prendaSel && tallaSel ? "var(--rosa)" : "var(--border)"}`, borderRadius: 12, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Añadir al carrito
              </button>
            </div>

            {/* CARRITO */}
            {carrito.length > 0 && (
              <div className="animate" style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🛒 Carrito</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {carrito.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--creme)", padding: "12px", borderRadius: 12 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{item.descripcion} ({item.tallaSel || item.talla})</p>
                        <p style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>{item.cantidad} × {fmt(item.precioFinal)}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <strong style={{ fontSize: 14, color: "var(--dark)" }}>{fmt(item.cantidad * item.precioFinal)}</strong>
                        <button onClick={() => setCarrito(carrito.filter(c => !(c.id === item.id && c.tallaSel === item.tallaSel)))} style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 16 }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen ganancia del ticket */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, padding: "12px 14px", background: gananciaCarrito < 0 ? "#FFEBEE" : "var(--rosa-pale)", borderRadius: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--mid)", margin: 0 }}>Total a cobrar</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: "var(--dark)", margin: "2px 0 0" }}>{fmt(totalCarrito)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 11, color: "var(--mid)", margin: 0 }}>Ganancia estimada</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: gananciaCarrito < 0 ? "var(--danger)" : "var(--success)", margin: "2px 0 0" }}>
                      {fmt(gananciaCarrito)} <span style={{ fontSize: 12, fontWeight: 600 }}>({margenCarrito}%)</span>
                    </p>
                  </div>
                </div>

                {/* Cliente */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--mid)", marginLeft: 4 }}>Nombre cliente (opcional)</label>
                    <input placeholder="Ej: María García" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} style={{ marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--mid)", marginLeft: 4 }}>WhatsApp (opcional)</label>
                    <input placeholder="Ej: 3001234567" value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} style={{ marginTop: 4 }} />
                  </div>
                </div>

                {/* Pago + botón cobrar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: "var(--mid)", marginLeft: 4 }}>Método de pago</label>
                    <select value={formaPago} onChange={e => setFormaPago(e.target.value)} style={{ marginTop: 2 }}>
                      {["Efectivo","Nequi","Daviplata","Transfiya","Tarjeta","Crédito"].map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <button onClick={procesarVentaMultiple}
                    style={{ flex: 1.5, background: formaPago === "Crédito" ? "linear-gradient(135deg, #7B1FA2, #9C27B0)" : "linear-gradient(135deg, var(--success), #43A047)", color: "white", border: "none", borderRadius: 12, padding: "14px", fontWeight: 700, fontSize: 15, alignSelf: "flex-end", cursor: "pointer" }}>
                    {formaPago === "Crédito" ? `💳 Registrar crédito` : `Cobrar ${fmt(totalCarrito)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
