import { useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, Icon, TIPOS_CUENTA, HOGAR_ID } from "../utils.jsx";

export const calcularSaldo = (cuenta, movimientos) => {
  let saldo = Number(cuenta.saldoInicial) || 0;
  movimientos.forEach(m => {
    if (m.tipo === "ingreso" && m.cuentaId === cuenta.id) saldo += Number(m.monto);
    else if (m.tipo === "gasto" && m.cuentaId === cuenta.id) saldo -= Number(m.monto);
    else if (m.tipo === "transferencia") {
      if (m.cuentaId === cuenta.id) saldo -= Number(m.monto);
      if (m.cuentaDestinoId === cuenta.id) saldo += Number(m.monto);
    }
  });
  return saldo;
};

const iconoTipo = (tipo) => ({ efectivo: "money", banco: "wallet", tarjeta_credito: "tag", ahorros: "target", otro: "wallet" }[tipo] || "wallet");

export default function Cuentas({ cuentas, setCuentas, movimientos }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [cuentaAEliminar, setCuentaAEliminar] = useState(null);
  const [toast, setToast] = useState(null);

  const formBase = { nombre: "", tipo: "efectivo", saldoInicial: "" };
  const [form, setForm] = useState(formBase);

  const transferBase = { cuentaId: "", cuentaDestinoId: "", monto: "", descripcion: "" };
  const [transferForm, setTransferForm] = useState(transferBase);
  const [enviandoTransfer, setEnviandoTransfer] = useState(false);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const cuentasConSaldo = useMemo(() =>
    cuentas.map(c => ({ ...c, saldo: calcularSaldo(c, movimientos) })),
    [cuentas, movimientos]
  );
  const balanceTotal = cuentasConSaldo.reduce((s, c) => s + c.saldo, 0);

  const guardar = async () => {
    if (!form.nombre || form.saldoInicial === "") return showToast("⚠️ Completa nombre y saldo inicial", "warn");
    const datos = { nombre: form.nombre, tipo: form.tipo, saldoInicial: Number(form.saldoInicial), activa: true, hogarId: HOGAR_ID };
    try {
      if (editandoId) {
        await updateDoc(doc(db, "cuentas", editandoId), datos);
        setCuentas(c => c.map(x => x.id === editandoId ? { id: editandoId, ...datos } : x));
        showToast("✅ Cuenta actualizada");
      } else {
        datos.fechaCreacion = new Date().toISOString();
        const ref = await addDoc(collection(db, "cuentas"), datos);
        setCuentas(c => [{ id: ref.id, ...datos }, ...c]);
        showToast("✅ Cuenta creada");
      }
      setForm(formBase); setEditandoId(null); setMostrarForm(false);
    } catch { showToast("❌ Error al guardar", "danger"); }
  };

  const abrirEdicion = (c) => {
    setForm({ nombre: c.nombre, tipo: c.tipo, saldoInicial: String(c.saldoInicial) });
    setEditandoId(c.id); setMostrarForm(true);
  };

  const confirmarEliminar = async () => {
    if (!cuentaAEliminar) return;
    try {
      await deleteDoc(doc(db, "cuentas", cuentaAEliminar.id));
      setCuentas(c => c.filter(x => x.id !== cuentaAEliminar.id));
      setCuentaAEliminar(null);
      showToast("🗑️ Cuenta eliminada");
    } catch { showToast("❌ Error al eliminar", "danger"); }
  };

  const cuentaOrigen = cuentas.find(c => c.id === transferForm.cuentaId);
  const saldoOrigen = cuentaOrigen ? calcularSaldo(cuentaOrigen, movimientos) : 0;

  const hacerTransferencia = async () => {
    const { cuentaId, cuentaDestinoId, monto } = transferForm;
    if (!cuentaId || !cuentaDestinoId || !monto) return showToast("⚠️ Completa origen, destino y monto", "warn");
    if (cuentaId === cuentaDestinoId) return showToast("⚠️ Elige cuentas distintas", "warn");
    setEnviandoTransfer(true);
    try {
      await addDoc(collection(db, "movimientos"), {
        tipo: "transferencia", monto: Number(monto), cuentaId, cuentaDestinoId,
        categoria: "Transferencia", descripcion: transferForm.descripcion || "Transferencia entre cuentas",
        fecha: new Date().toISOString(), hogarId: HOGAR_ID, fechaCreacion: new Date().toISOString()
      });
      showToast("✅ Transferencia realizada");
      setTransferForm(transferBase); setMostrarTransferencia(false);
    } catch { showToast("❌ Error en la transferencia", "danger"); }
    finally { setEnviandoTransfer(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--dark)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* BALANCE TOTAL */}
      <div style={{ background: "linear-gradient(135deg, var(--primary-deep) 0%, var(--primary) 100%)", borderRadius: 24, padding: "24px", color: "#fff" }}>
        <p style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Balance total</p>
        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 800, marginTop: 4 }}>{fmt(balanceTotal)}</p>
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{cuentasConSaldo.length} {cuentasConSaldo.length === 1 ? "cuenta" : "cuentas"}</p>
      </div>

      {/* ACCIONES */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => { setMostrarForm(!mostrarForm); setEditandoId(null); setForm(formBase); }}
          style={{ flex: 1, background: mostrarForm ? "var(--mid)" : "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 14, padding: "13px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {mostrarForm ? <><Icon name="close" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Nueva cuenta</>}
        </button>
        <button onClick={() => setMostrarTransferencia(!mostrarTransferencia)}
          style={{ flex: 1, background: mostrarTransferencia ? "var(--mid)" : "var(--white)", color: mostrarTransferencia ? "#fff" : "var(--primary-deep)", border: "1.5px solid var(--primary-soft)", borderRadius: 14, padding: "13px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="transfer" size={16} /> Transferir
        </button>
      </div>

      {/* FORM TRANSFERENCIA */}
      {mostrarTransferencia && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 700, color: "var(--primary-deep)" }}>Transferir entre cuentas</p>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Desde</label>
              <select value={transferForm.cuentaId} onChange={e => setTransferForm({ ...transferForm, cuentaId: e.target.value })}>
                <option value="">Selecciona…</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Hacia</label>
              <select value={transferForm.cuentaDestinoId} onChange={e => setTransferForm({ ...transferForm, cuentaDestinoId: e.target.value })}>
                <option value="">Selecciona…</option>
                {cuentas.filter(c => c.id !== transferForm.cuentaId).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          {cuentaOrigen && <p style={{ fontSize: 11, color: "var(--mid)" }}>Saldo disponible en {cuentaOrigen.nombre}: <strong>{fmt(saldoOrigen)}</strong></p>}
          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto</label>
            <input type="text" value={transferForm.monto ? fmtNum(transferForm.monto) : ""} onChange={e => setTransferForm({ ...transferForm, monto: parseNum(e.target.value) })} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Descripción (opcional)</label>
            <input value={transferForm.descripcion} onChange={e => setTransferForm({ ...transferForm, descripcion: e.target.value })} placeholder="Ej: Ahorro del mes" />
          </div>
          <button onClick={hacerTransferencia} disabled={enviandoTransfer}
            style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14 }}>
            {enviandoTransfer ? "Procesando…" : "Confirmar transferencia"}
          </button>
        </div>
      )}

      {/* FORM CUENTA */}
      {mostrarForm && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 700, color: "var(--primary-deep)" }}>{editandoId ? "Editar cuenta" : "Nueva cuenta"}</p>
          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Nombre</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Bancolombia, Efectivo, Nequi" />
          </div>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_CUENTA.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Saldo inicial</label>
              <input type="text" value={form.saldoInicial ? fmtNum(form.saldoInicial) : ""} onChange={e => setForm({ ...form, saldoInicial: parseNum(e.target.value) })} />
            </div>
          </div>
          <button onClick={guardar} style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14 }}>
            {editandoId ? "Actualizar" : "Guardar cuenta"}
          </button>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {cuentaAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "#FFEBEE", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Eliminar cuenta?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>Los movimientos históricos de <strong>{cuentaAEliminar.nombre}</strong> no se borran, pero quedarán sin cuenta asociada.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCuentaAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* LISTA DE CUENTAS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cuentasConSaldo.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--white)", borderRadius: 20, border: "1.5px dashed var(--border)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏦</div>
            <p style={{ fontWeight: 700, color: "var(--dark)" }}>Aún no tienes cuentas</p>
            <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 4 }}>Crea tu primera cuenta pa empezar a registrar movimientos</p>
          </div>
        )}
        {cuentasConSaldo.map(c => (
          <div key={c.id} className="animate" style={{ background: "var(--white)", borderRadius: 18, padding: "16px 18px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary-pale)", color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={iconoTipo(c.tipo)} size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", margin: 0 }}>{c.nombre}</p>
              <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>{TIPOS_CUENTA.find(t => t.id === c.tipo)?.label}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: c.saldo < 0 ? "var(--danger)" : "var(--dark)", margin: 0 }}>{fmt(c.saldo)}</p>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => abrirEdicion(c)} style={{ background: "var(--bg)", border: "none", borderRadius: 8, width: 32, height: 32, color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={14} /></button>
              <button onClick={() => setCuentaAEliminar(c)} style={{ background: "#FFEBEE", border: "none", borderRadius: 8, width: 32, height: 32, color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
