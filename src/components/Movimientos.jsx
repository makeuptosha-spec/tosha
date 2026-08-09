import { useState, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, fmtFecha, Icon, Badge, CATEGORIAS_GASTO, CATEGORIAS_INGRESO, HOGAR_ID } from "../utils.jsx";
import EscanearRecibo from "./EscanearRecibo.jsx";
import ColaRecibos from "./ColaRecibos.jsx";
import DictarMovimiento from "./DictarMovimiento.jsx";

export default function Movimientos({ movimientos, setMovimientos, cuentas }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroTiempo, setFiltroTiempo] = useState("mes");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [movAEliminar, setMovAEliminar] = useState(null);
  const [toast, setToast] = useState(null);
  const [mostrarEscanear, setMostrarEscanear] = useState(false);
  const [mostrarCola, setMostrarCola] = useState(false);
  const [mostrarDictar, setMostrarDictar] = useState(false);

  const cuentaPorDefecto = () => cuentas.find(c => c.tipo === "efectivo")?.id || cuentas[0]?.id || "";
  const formBase = { tipo: "gasto", monto: "", categoria: "", cuentaId: cuentaPorDefecto(), descripcion: "", fecha: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(formBase);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const movimientosVisibles = useMemo(() => movimientos.filter(m => m.tipo !== "transferencia"), [movimientos]);
  const categoriasDisponibles = [...new Set(movimientosVisibles.map(m => m.categoria).filter(Boolean))];

  const filtrados = useMemo(() => {
    const hoy = new Date();
    const hace7Dias = new Date(); hace7Dias.setDate(hoy.getDate() - 7);
    return movimientosVisibles.filter(m => {
      const q = busqueda.toLowerCase();
      const coincideTexto = !q || (m.descripcion || "").toLowerCase().includes(q) || (m.categoria || "").toLowerCase().includes(q);
      let coincideFecha = true;
      if (filtroTiempo !== "todo" && m.fecha) {
        const d = new Date(m.fecha);
        if (filtroTiempo === "hoy") coincideFecha = d.toDateString() === hoy.toDateString();
        else if (filtroTiempo === "semana") coincideFecha = d >= hace7Dias;
        else if (filtroTiempo === "mes") coincideFecha = d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
      }
      const coincideTipo = filtroTipo === "todos" || m.tipo === filtroTipo;
      const coincideCategoria = filtroCategoria === "todas" || m.categoria === filtroCategoria;
      return coincideTexto && coincideFecha && coincideTipo && coincideCategoria;
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [movimientosVisibles, busqueda, filtroTiempo, filtroTipo, filtroCategoria]);

  const resumen = useMemo(() => {
    const ingresos = filtrados.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
    const gastos = filtrados.filter(m => m.tipo === "gasto").reduce((s, m) => s + Number(m.monto), 0);
    return { ingresos, gastos, neto: ingresos - gastos };
  }, [filtrados]);

  const categoriasForm = form.tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;

  const guardar = async () => {
    if (!form.monto || !form.categoria || !form.cuentaId) return showToast("⚠️ Completa monto, categoría y cuenta", "warn");
    const datos = {
      tipo: form.tipo, monto: Number(form.monto), categoria: form.categoria, cuentaId: form.cuentaId,
      descripcion: form.descripcion, fecha: new Date(form.fecha).toISOString(), hogarId: HOGAR_ID, uid: auth.currentUser.uid
    };
    try {
      if (editandoId) {
        await updateDoc(doc(db, "movimientos", editandoId), datos);
        setMovimientos(m => m.map(x => x.id === editandoId ? { id: editandoId, ...datos } : x));
        showToast("✅ Movimiento actualizado");
      } else {
        datos.fechaCreacion = new Date().toISOString();
        const ref = await addDoc(collection(db, "movimientos"), datos);
        setMovimientos(m => [{ id: ref.id, ...datos }, ...m]);
        showToast(form.tipo === "ingreso" ? "✅ Ingreso registrado" : "✅ Gasto registrado");
      }
      setForm(formBase); setEditandoId(null); setMostrarForm(false);
    } catch { showToast("❌ Error al guardar", "danger"); }
  };

  const abrirEdicion = (m) => {
    setForm({ tipo: m.tipo, monto: String(m.monto), categoria: m.categoria, cuentaId: m.cuentaId || "", descripcion: m.descripcion || "", fecha: (m.fecha || new Date().toISOString()).slice(0, 10) });
    setEditandoId(m.id); setMostrarForm(true); window.scrollTo(0, 0);
  };

  const confirmarEliminar = async () => {
    if (!movAEliminar) return;
    try {
      await deleteDoc(doc(db, "movimientos", movAEliminar.id));
      setMovimientos(m => m.filter(x => x.id !== movAEliminar.id));
      setMovAEliminar(null);
      showToast("🗑️ Movimiento eliminado");
    } catch { showToast("❌ Error al eliminar", "danger"); }
  };

  const nombreCuenta = (id) => cuentas.find(c => c.id === id)?.nombre || "Sin cuenta";

  const guardarDictado = async ({ tipo, monto, categoria, descripcion, cuentaId }) => {
    const datos = { tipo, monto: Number(monto), categoria, cuentaId, descripcion: descripcion || categoria, fecha: new Date().toISOString(), hogarId: HOGAR_ID, uid: auth.currentUser.uid, fechaCreacion: new Date().toISOString() };
    try {
      const ref = await addDoc(collection(db, "movimientos"), datos);
      setMovimientos(m => [{ id: ref.id, ...datos }, ...m]);
      setMostrarDictar(false);
      showToast(tipo === "ingreso" ? "✅ Ingreso registrado por voz" : "✅ Gasto registrado por voz");
    } catch { showToast("❌ Error al guardar", "danger"); }
  };

  const exportarCSV = () => {
    const encabezado = ["Fecha", "Tipo", "Categoría", "Cuenta", "Descripción", "Monto"];
    const filas = filtrados.map(m => [
      fmtFecha(m.fecha), m.tipo, m.categoria, nombreCuenta(m.cuentaId),
      (m.descripcion || "").replace(/"/g, '""'), m.monto
    ]);
    const csv = [encabezado, ...filas]
      .map(fila => fila.map(campo => `"${campo}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--dark)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {mostrarEscanear && (
        <EscanearRecibo onBorradorCreado={() => { setMostrarEscanear(false); setMostrarCola(true); }} onClose={() => setMostrarEscanear(false)} />
      )}

      {mostrarDictar && (
        <DictarMovimiento cuentas={cuentas} onGuardar={guardarDictado} onClose={() => setMostrarDictar(false)} />
      )}

      {/* MODAL ELIMINAR */}
      {movAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "#FFEBEE", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Eliminar movimiento?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>{movAEliminar.descripcion || movAEliminar.categoria} · {fmt(movAEliminar.monto)}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setMovAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR */}
      <div style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--mid)" }}><Icon name="search" size={16} /></span>
            <input placeholder="Buscar por descripción o categoría..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 40, width: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={exportarCSV} title="Exportar a CSV" style={{ background: "var(--bg)", color: "var(--mid)", border: "1.5px solid var(--border)", borderRadius: 50, padding: "8px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              ⬇️ CSV
            </button>
            <button onClick={() => setMostrarDictar(true)} style={{ background: "var(--bg)", color: "var(--primary-deep)", border: "1.5px solid var(--primary-soft)", borderRadius: 50, padding: "8px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              🎤
            </button>
            <button onClick={() => setMostrarEscanear(true)} style={{ background: "var(--bg)", color: "var(--primary-deep)", border: "1.5px solid var(--primary-soft)", borderRadius: 50, padding: "8px 16px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Icon name="camera" size={14} /> Escanear
            </button>
            <button onClick={() => { setMostrarForm(!mostrarForm); setEditandoId(null); setForm(formBase); }} style={{ background: mostrarForm ? "var(--mid)" : "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 50, padding: "8px 20px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              {mostrarForm ? <><Icon name="close" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Agregar</>}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none", marginBottom: 10 }}>
          {[{ id: "hoy", label: "Hoy" }, { id: "semana", label: "7 Días" }, { id: "mes", label: "Este Mes" }, { id: "todo", label: "Todo" }].map(f => (
            <button key={f.id} onClick={() => setFiltroTiempo(f.id)} style={{ background: filtroTiempo === f.id ? "var(--dark)" : "var(--bg)", color: filtroTiempo === f.id ? "white" : "var(--dark)", border: "1px solid transparent", padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="inv-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 10px", fontSize: 12 }}>
            <option value="todos">Ingresos y gastos</option>
            <option value="ingreso">Solo ingresos</option>
            <option value="gasto">Solo gastos</option>
          </select>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 10px", fontSize: 12 }}>
            <option value="todas">Todas las categorías</option>
            {categoriasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {cuentas.length === 0 && (
        <div style={{ background: "#FFF3E0", border: "1.5px solid #FFB74D", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <p style={{ fontSize: 13, color: "var(--warn)", margin: 0 }}>Todavía no tenés ninguna cuenta creada. Andá a la pestaña <strong>Cuentas</strong> y creá al menos una (por ejemplo "Efectivo") antes de registrar movimientos.</p>
        </div>
      )}

      {/* FORM */}
      {mostrarForm && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setForm({ ...form, tipo: "gasto", categoria: "" })} style={{ flex: 1, background: form.tipo === "gasto" ? "var(--danger)" : "var(--bg)", color: form.tipo === "gasto" ? "#fff" : "var(--mid)", border: "none", borderRadius: 12, padding: "10px", fontWeight: 700, fontSize: 13 }}>💸 Gasto</button>
            <button onClick={() => setForm({ ...form, tipo: "ingreso", categoria: "" })} style={{ flex: 1, background: form.tipo === "ingreso" ? "var(--success)" : "var(--bg)", color: form.tipo === "ingreso" ? "#fff" : "var(--mid)", border: "none", borderRadius: 12, padding: "10px", fontWeight: 700, fontSize: 13 }}>💰 Ingreso</button>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto</label>
            <input type="text" value={form.monto ? fmtNum(form.monto) : ""} onChange={e => setForm({ ...form, monto: parseNum(e.target.value) })} placeholder="0" autoFocus />
          </div>

          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Categoría</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                <option value="">Selecciona…</option>
                {categoriasForm.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Cuenta</label>
              <select value={form.cuentaId} onChange={e => setForm({ ...form, cuentaId: e.target.value })}>
                <option value="">Selecciona…</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Descripción (opcional)</label>
              <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Mercado del mes" />
            </div>
          </div>

          <button onClick={guardar} style={{ background: form.tipo === "ingreso" ? "linear-gradient(135deg, var(--success), #43A047)" : "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontWeight: 700, fontSize: 14 }}>
            {editandoId ? "Actualizar" : "Guardar"}
          </button>
        </div>
      )}

      {mostrarCola && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--warn)", boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 12, background: "#FFF3E0", color: "var(--warn)", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>🧾 Recibos por confirmar</span>
            <button onClick={() => setMostrarCola(false)} style={{ background: "transparent", border: "none", color: "var(--mid)", fontSize: 18 }}>×</button>
          </div>
          <ColaRecibos cuentas={cuentas} setMovimientos={setMovimientos} onCerrar={() => setMostrarCola(false)} />
        </div>
      )}

      {/* RESUMEN */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "var(--white)", borderRadius: 16, border: "1px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mid)" }}>{filtrados.length} {filtrados.length === 1 ? "movimiento" : "movimientos"}</span>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "var(--mid)", margin: 0 }}>Ingresos</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--success)", margin: 0 }}>{fmt(resumen.ingresos)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "var(--mid)", margin: 0 }}>Gastos</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--danger)", margin: 0 }}>{fmt(resumen.gastos)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "var(--mid)", margin: 0 }}>Neto</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: resumen.neto >= 0 ? "var(--success)" : "var(--danger)", margin: 0 }}>{fmt(resumen.neto)}</p>
          </div>
        </div>
      </div>

      {/* LISTA */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtrados.length === 0 && <p style={{ fontSize: 13, color: "var(--mid)", padding: "10px", textAlign: "center" }}>No hay movimientos con estos filtros.</p>}
        {filtrados.map(m => {
          const esAjuste = m.tipo === "ajuste";
          const esIngreso = m.tipo === "ingreso" || (esAjuste && Number(m.monto) >= 0);
          return (
          <div key={m.id} className="animate" style={{ background: "var(--white)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: esAjuste ? "var(--bg)" : esIngreso ? "#E8F5E9" : "#FFEBEE", color: esAjuste ? "var(--mid)" : esIngreso ? "var(--success)" : "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={esAjuste ? "edit" : esIngreso ? "trending" : "trendingDown"} size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{esAjuste ? "⚖️ Ajuste de saldo" : (m.descripcion || m.categoria)}</p>
              <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>{m.categoria} · {nombreCuenta(m.cuentaId)} · {fmtFecha(m.fecha)}</p>
            </div>
            <p style={{ fontSize: 15, fontWeight: 800, color: esAjuste ? "var(--mid)" : esIngreso ? "var(--success)" : "var(--danger)", margin: 0, flexShrink: 0 }}>
              {esIngreso ? "+" : "−"}{fmt(Math.abs(m.monto))}
            </p>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {!esAjuste && <button onClick={() => abrirEdicion(m)} style={{ background: "var(--bg)", border: "none", borderRadius: 8, width: 30, height: 30, color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={13} /></button>}
              <button onClick={() => setMovAEliminar(m)} style={{ background: "#FFEBEE", border: "none", borderRadius: 8, width: 30, height: 30, color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={13} /></button>
            </div>
          </div>
        );})}
      </div>
    </div>
  );
}
