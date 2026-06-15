import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, deleteDoc, doc, addDoc, getDoc } from "firebase/firestore";
import { fmt, Icon } from "../utils.jsx";

const ORDEN_PRESENTACIONES = ["Única","Mini","Regular","Grande","Duo","Kit","Tono 01","Tono 02","Tono 03","Tono 04","Tono 05"];
const CATEGORIAS = ["Labial","Base","Corrector","Iluminador","Sombra","Rubor","Bronzer","Delineador","Máscara","Crema","Suero","Perfume","Esmalte","Otro"];

export default function ColaBorradores({ setPrendas, onCerrar }) {
  const [borradores, setBorradores] = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(null);

  useEffect(() => {
    getDocs(collection(db, "borradores"))
      .then(snap => {
        const data = snap.docs
          .map(d => ({ _id: d.id, ...d.data() }))
          .filter(b => b.estado === "pendiente")
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setBorradores(data);
      })
      .finally(() => setCargando(false));
  }, []);

  const actualizarCampo = (id, campo, valor) =>
    setBorradores(prev => prev.map(b => b._id === id ? { ...b, [campo]: valor } : b));

  const actualizarTalla = (id, idx, subcampo, valor) =>
    setBorradores(prev => prev.map(b => {
      if (b._id !== id) return b;
      const tallas = b.tallas.map((t, i) => i === idx ? { ...t, [subcampo]: valor } : t);
      return { ...b, tallas };
    }));

  const agregarTalla = (id) =>
    setBorradores(prev => prev.map(b => b._id !== id ? b : { ...b, tallas: [...(b.tallas || []), { talla: "Única", cantidad: 1 }] }));

  const quitarTalla = (id, idx) =>
    setBorradores(prev => prev.map(b => b._id !== id ? b : { ...b, tallas: b.tallas.filter((_, i) => i !== idx) }));

  const confirmarBorrador = async (b) => {
    setGuardando(b._id);
    try {
      if (b.tipo === "restock") {
        if (!b.prendaExistenteId) throw new Error("No se encontró el ID del producto existente");
        const prendaRef  = doc(db, "prendas", b.prendaExistenteId);
        const prendaSnap = await getDoc(prendaRef);
        if (!prendaSnap.exists()) throw new Error("El producto ya no existe en inventario");

        const stockActual = prendaSnap.data().stockPorTalla || {};
        const nuevoStock  = { ...stockActual };
        (b.tallas || []).forEach(({ talla, cantidad }) => {
          nuevoStock[talla] = (Number(nuevoStock[talla]) || 0) + (Number(cantidad) || 0);
        });
        const nuevoTotal = Object.values(nuevoStock).reduce((s, v) => s + Number(v), 0);
        const tallasResurtido = {};
        (b.tallas || []).forEach(({ talla, cantidad }) => { tallasResurtido[talla] = Number(cantidad) || 0; });
        const historialActual = prendaSnap.data().historial || [];
        const nuevoHistorial = [
          ...historialActual,
          { fecha: new Date().toISOString(), tipo: "resurtido", tallas: tallasResurtido, costoCompra: Number(b.costoUnitario) || 0 }
        ];

        await updateDoc(prendaRef, { stockPorTalla: nuevoStock, stock: nuevoTotal, historial: nuevoHistorial });
        setPrendas(p => p.map(pr =>
          pr.id === b.prendaExistenteId
            ? { ...pr, stockPorTalla: nuevoStock, stock: nuevoTotal, historial: nuevoHistorial }
            : pr
        ));
      } else {
        if (!b.descripcion || !b.precioVenta || !b.categoria) {
          alert("Completa descripción, categoría y precio de venta.");
          setGuardando(null);
          return;
        }
        const stockPorTalla = {};
        let stockTotal = 0;
        (b.tallas || []).forEach(({ talla, cantidad }) => {
          const c = Number(cantidad) || 0;
          stockPorTalla[talla] = c;
          stockTotal += c;
        });
        const fechaCreacion = new Date().toISOString();
        const tallasNueva = {};
        (b.tallas || []).forEach(({ talla, cantidad }) => { tallasNueva[talla] = Number(cantidad) || 0; });
        const nuevaProenda = {
          codigo:       b.referencia || `REF-${Date.now()}`,
          sku:          (b.sku || "").trim(),
          descripcion:  b.descripcion,
          categoria:    b.categoria,
          costoCompra:  Number(b.costoUnitario) || 0,
          precioVenta:  Number(b.precioVenta)   || 0,
          stock:        stockTotal,
          stockPorTalla,
          stockMinimo:  3,
          imagenes:     [],
          fechaIngreso: fechaCreacion,
          historial:    [{ fecha: fechaCreacion, tipo: "ingreso", tallas: tallasNueva, costoCompra: Number(b.costoUnitario) || 0 }],
        };
        const ref = await addDoc(collection(db, "prendas"), nuevaProenda);
        setPrendas(p => [{ id: ref.id, ...nuevaProenda }, ...p]);
      }

      await updateDoc(doc(db, "borradores", b._id), { estado: "confirmado" });
      setBorradores(prev => prev.filter(x => x._id !== b._id));
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setGuardando(null);
    }
  };

  const descartarBorrador = async (id) => {
    await deleteDoc(doc(db, "borradores", id));
    setBorradores(prev => prev.filter(b => b._id !== id));
  };

  if (cargando) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--mid)" }}>Cargando borradores…</div>
  );

  if (borradores.length === 0) return (
    <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--white)", borderRadius: 20, border: "1.5px dashed var(--border)" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
      <p style={{ fontWeight: 700, color: "var(--dark)", fontSize: 16 }}>Sin borradores pendientes</p>
      <p style={{ fontSize: 13, color: "var(--mid)" }}>Importa una factura para comenzar</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: "var(--rosa-deep)", margin: 0 }}>Cola de Revisión</h3>
          <p style={{ fontSize: 12, color: "var(--mid)", margin: "4px 0 0" }}>{borradores.length} borradores pendientes</p>
        </div>
      </div>

      {borradores.map(b => {
        const esRestock = b.tipo === "restock";
        return (
          <div key={b._id} style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: `1.5px solid ${esRestock ? "#90CAF9" : "var(--rosa-soft)"}`, boxShadow: "var(--shadow)" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: "1px dashed var(--border)" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  {esRestock ? (
                    <span style={{ fontSize: 11, background: "#E3F2FD", color: "#1565C0", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>📦 RESURTIDO</span>
                  ) : (
                    <span style={{ fontSize: 11, background: "#F3E8FF", color: "var(--rosa-deep)", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>✨ NUEVO PRODUCTO</span>
                  )}
                  {b.sku && <span style={{ fontSize: 11, background: "var(--creme)", color: "var(--mid)", padding: "3px 8px", borderRadius: 20 }}>SKU: {b.sku}</span>}
                </div>

                {esRestock ? (
                  <div style={{ background: "#E3F2FD", borderRadius: 10, padding: "8px 12px", marginTop: 4 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#1565C0", margin: 0 }}>
                      Producto existente: {b.prendaExistenteNombre}
                    </p>
                    <p style={{ fontSize: 11, color: "#1976D2", margin: "4px 0 0" }}>
                      Stock actual:&nbsp;
                      {Object.entries(b.stockActualPorTalla || {}).map(([t, c]) => `${t}:${c}`).join(", ") || "sin stock"}
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--mid)", margin: 0 }}>
                    Ref: {b.referencia || "—"} · Costo extraído: {b.costoUnitario ? `$${Number(b.costoUnitario).toLocaleString("es-CO")}` : "—"}
                  </p>
                )}
              </div>
              <button onClick={() => descartarBorrador(b._id)} style={{ background: "#FFEBEE", color: "var(--danger)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Descartar</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {!esRestock && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Descripción *</label>
                  <input value={b.descripcion || ""} onChange={e => actualizarCampo(b._id, "descripcion", e.target.value)} style={{ marginTop: 4 }} placeholder="Nombre del producto" />
                </div>
              )}

              {!esRestock && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Categoría *</label>
                    <select value={b.categoria || ""} onChange={e => actualizarCampo(b._id, "categoria", e.target.value)} style={{ marginTop: 4 }}>
                      <option value="">Seleccionar…</option>
                      {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Precio de venta * ($)</label>
                    <input type="number" value={b.precioVenta || ""} onChange={e => actualizarCampo(b._id, "precioVenta", e.target.value)} style={{ marginTop: 4 }} placeholder="Ej: 35000" />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>Costo de compra ($) — extraído por IA</label>
                <input type="number" value={b.costoUnitario || ""} onChange={e => actualizarCampo(b._id, "costoUnitario", e.target.value)} style={{ marginTop: 4 }} placeholder="Costo unitario" />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600, marginBottom: 8, display: "block" }}>
                  {esRestock ? "Presentaciones a agregar al stock actual" : "Presentaciones y cantidades — extraídas por IA"}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(b.tallas || []).map((t, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={t.talla || ""} onChange={e => actualizarTalla(b._id, idx, "talla", e.target.value)} style={{ flex: 1 }}>
                        {ORDEN_PRESENTACIONES.map(ta => <option key={ta}>{ta}</option>)}
                      </select>
                      <input type="number" value={t.cantidad || ""} onChange={e => actualizarTalla(b._id, idx, "cantidad", e.target.value)} style={{ width: 70 }} placeholder="Cant" min="1" />
                      {esRestock && b.stockActualPorTalla?.[t.talla] !== undefined && (
                        <span style={{ fontSize: 11, color: "#1565C0", whiteSpace: "nowrap", minWidth: 60 }}>
                          actual: {b.stockActualPorTalla[t.talla]}
                        </span>
                      )}
                      <button onClick={() => quitarTalla(b._id, idx)} style={{ background: "#FFEBEE", color: "var(--danger)", border: "none", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => agregarTalla(b._id)} style={{ marginTop: 8, background: "var(--creme)", border: "1px dashed var(--border)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--mid)" }}>
                  + Añadir presentación
                </button>
              </div>

              <div style={{ background: esRestock ? "#E3F2FD" : "var(--rosa-pale)", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: esRestock ? "#1565C0" : "var(--rosa-deep)", fontWeight: 600 }}>
                {esRestock ? (
                  <>Unidades a sumar: {(b.tallas || []).reduce((s, t) => s + (Number(t.cantidad) || 0), 0)} uds</>
                ) : (
                  <>
                    Total unidades: {(b.tallas || []).reduce((s, t) => s + (Number(t.cantidad) || 0), 0)} uds
                    {b.costoUnitario && b.precioVenta ? ` · Margen: ${Math.round(((b.precioVenta - b.costoUnitario) / b.precioVenta) * 100)}%` : ""}
                  </>
                )}
              </div>

              <button
                onClick={() => confirmarBorrador(b)}
                disabled={guardando === b._id}
                style={{ background: guardando === b._id ? "var(--border)" : esRestock ? "linear-gradient(135deg, #1565C0, #1976D2)" : "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 14, padding: "13px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                {guardando === b._id
                  ? "Guardando…"
                  : esRestock
                    ? "📦 Confirmar Resurtido"
                    : "✅ Confirmar y agregar al inventario"
                }
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
