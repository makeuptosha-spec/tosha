import { useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, Icon, ProgressBar, HOGAR_ID } from "../utils.jsx";

export default function Deudas({ deudas, setDeudas, setMovimientos, cuentas }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [deudaAEliminar, setDeudaAEliminar] = useState(null);
  const [abonando, setAbonando] = useState(null);
  const [montoAbono, setMontoAbono] = useState("");
  const [cuentaAbono, setCuentaAbono] = useState("");
  const [guardandoAbono, setGuardandoAbono] = useState(false);
  const [toast, setToast] = useState(null);

  const formBase = { nombre: "", tipo: "debo", montoPrincipal: "", tasaInteresAnual: "", cuotaMensual: "", cuentaId: "" };
  const [form, setForm] = useState(formBase);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const deudasConProgreso = useMemo(() =>
    deudas.filter(d => d.activa !== false).map(d => {
      const pagado = Number(d.montoPrincipal) - Number(d.saldoRestante);
      const pct = d.montoPrincipal > 0 ? Math.round((pagado / Number(d.montoPrincipal)) * 100) : 0;
      return { ...d, pagado, pct };
    }),
    [deudas]
  );

  const totalDebo = deudasConProgreso.filter(d => d.tipo === "debo").reduce((s, d) => s + Number(d.saldoRestante), 0);
  const totalMeDeben = deudasConProgreso.filter(d => d.tipo === "me_deben").reduce((s, d) => s + Number(d.saldoRestante), 0);

  const guardar = async () => {
    if (!form.nombre || !form.montoPrincipal || !form.cuentaId) return showToast("⚠️ Completa nombre, capital y cuenta", "warn");
    const datos = {
      nombre: form.nombre, tipo: form.tipo, montoPrincipal: Number(form.montoPrincipal),
      tasaInteresAnual: form.tasaInteresAnual ? Number(form.tasaInteresAnual) : null,
      cuotaMensual: form.cuotaMensual ? Number(form.cuotaMensual) : null,
      cuentaId: form.cuentaId, activa: true, hogarId: HOGAR_ID
    };
    try {
      if (editandoId) {
        await updateDoc(doc(db, "deudas", editandoId), datos);
        setDeudas(d => d.map(x => x.id === editandoId ? { ...x, ...datos } : x));
        showToast("✅ Actualizado");
      } else {
        datos.saldoRestante = Number(form.montoPrincipal);
        datos.historialPagos = [];
        datos.fechaCreacion = new Date().toISOString();
        const ref = await addDoc(collection(db, "deudas"), datos);
        setDeudas(d => [{ id: ref.id, ...datos }, ...d]);
        showToast("✅ Registrado");
      }
      setForm(formBase); setEditandoId(null); setMostrarForm(false);
    } catch { showToast("❌ Error al guardar", "danger"); }
  };

  const abrirEdicion = (d) => {
    setForm({ nombre: d.nombre, tipo: d.tipo, montoPrincipal: String(d.montoPrincipal), tasaInteresAnual: d.tasaInteresAnual ? String(d.tasaInteresAnual) : "", cuotaMensual: d.cuotaMensual ? String(d.cuotaMensual) : "", cuentaId: d.cuentaId });
    setEditandoId(d.id); setMostrarForm(true);
  };

  const confirmarEliminar = async () => {
    if (!deudaAEliminar) return;
    try {
      await deleteDoc(doc(db, "deudas", deudaAEliminar.id));
      setDeudas(d => d.filter(x => x.id !== deudaAEliminar.id));
      setDeudaAEliminar(null);
      showToast("🗑️ Eliminado");
    } catch { showToast("❌ Error al eliminar", "danger"); }
  };

  const abrirAbono = (d) => { setAbonando(d); setMontoAbono(""); setCuentaAbono(d.cuentaId); };

  const confirmarAbono = async () => {
    if (!abonando || !montoAbono || !cuentaAbono) return;
    setGuardandoAbono(true);
    try {
      const fecha = new Date().toISOString();
      const abono = Math.min(Number(montoAbono), Number(abonando.saldoRestante));
      const esDebo = abonando.tipo === "debo";

      const nuevoMovimiento = {
        tipo: esDebo ? "gasto" : "ingreso", monto: abono, categoria: esDebo ? "Deudas" : "Préstamo",
        cuentaId: cuentaAbono, descripcion: `Abono: ${abonando.nombre}`, fecha, deudaId: abonando.id,
        hogarId: HOGAR_ID, fechaCreacion: fecha
      };
      const movRef = await addDoc(collection(db, "movimientos"), nuevoMovimiento);
      setMovimientos(m => [{ id: movRef.id, ...nuevoMovimiento }, ...m]);

      const nuevoSaldo = Math.max(0, Number(abonando.saldoRestante) - abono);
      const nuevoHistorial = [...(abonando.historialPagos || []), { fecha, monto: abono, movimientoId: movRef.id }];
      await updateDoc(doc(db, "deudas", abonando.id), { saldoRestante: nuevoSaldo, historialPagos: nuevoHistorial });
      setDeudas(d => d.map(x => x.id === abonando.id ? { ...x, saldoRestante: nuevoSaldo, historialPagos: nuevoHistorial } : x));

      showToast(nuevoSaldo === 0 ? `🎉 ${abonando.nombre} saldada por completo` : "✅ Abono registrado");
      setAbonando(null); setMontoAbono(""); setCuentaAbono("");
    } catch { showToast("❌ Error al registrar abono", "danger"); }
    finally { setGuardandoAbono(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--dark)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#FFEBEE", borderRadius: 18, padding: 16, border: "1px solid #FFCDD2" }}>
          <p style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>Yo debo</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--danger)", marginTop: 4 }}>{fmt(totalDebo)}</p>
        </div>
        <div style={{ background: "var(--primary-pale)", borderRadius: 18, padding: 16, border: "1px solid var(--primary-soft)" }}>
          <p style={{ fontSize: 11, color: "var(--primary-deep)", fontWeight: 600 }}>Me deben</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--primary-deep)", marginTop: 4 }}>{fmt(totalMeDeben)}</p>
        </div>
      </div>

      <button onClick={() => { setMostrarForm(!mostrarForm); setEditandoId(null); setForm(formBase); }}
        style={{ background: mostrarForm ? "var(--mid)" : "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 14, padding: "13px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {mostrarForm ? <><Icon name="close" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Nueva deuda o préstamo</>}
      </button>

      {mostrarForm && (
        <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: 20, border: "1.5px solid var(--primary-soft)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setForm({ ...form, tipo: "debo" })} style={{ flex: 1, background: form.tipo === "debo" ? "var(--danger)" : "var(--bg)", color: form.tipo === "debo" ? "#fff" : "var(--mid)", border: "none", borderRadius: 12, padding: "10px", fontWeight: 700, fontSize: 13 }}>💸 Yo debo</button>
            <button onClick={() => setForm({ ...form, tipo: "me_deben" })} style={{ flex: 1, background: form.tipo === "me_deben" ? "var(--primary-deep)" : "var(--bg)", color: form.tipo === "me_deben" ? "#fff" : "var(--mid)", border: "none", borderRadius: 12, padding: "10px", fontWeight: 700, fontSize: 13 }}>💰 Me deben</button>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Nombre</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Préstamo banco, Le presté a Juan" />
          </div>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Capital</label>
              <input type="text" value={form.montoPrincipal ? fmtNum(form.montoPrincipal) : ""} onChange={e => setForm({ ...form, montoPrincipal: parseNum(e.target.value) })} disabled={!!editandoId} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Cuenta asociada</label>
              <select value={form.cuentaId} onChange={e => setForm({ ...form, cuentaId: e.target.value })}>
                <option value="">Selecciona…</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Tasa interés anual % (opcional)</label>
              <input type="number" value={form.tasaInteresAnual} onChange={e => setForm({ ...form, tasaInteresAnual: e.target.value })} placeholder="Ej: 18" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Cuota sugerida (opcional)</label>
              <input type="text" value={form.cuotaMensual ? fmtNum(form.cuotaMensual) : ""} onChange={e => setForm({ ...form, cuotaMensual: parseNum(e.target.value) })} />
            </div>
          </div>
          <button onClick={guardar} style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14 }}>
            {editandoId ? "Actualizar" : "Guardar"}
          </button>
        </div>
      )}

      {abonando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 26, borderRadius: 24, width: "90%", maxWidth: 380, boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 6 }}>Abonar a "{abonando.nombre}"</h3>
            <p style={{ fontSize: 12, color: "var(--mid)", marginBottom: 16 }}>Saldo restante: {fmt(abonando.saldoRestante)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto del abono</label>
                <input type="text" value={montoAbono ? fmtNum(montoAbono) : ""} onChange={e => setMontoAbono(parseNum(e.target.value))} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>{abonando.tipo === "debo" ? "Cuenta desde donde pagas" : "Cuenta donde recibes"}</label>
                <select value={cuentaAbono} onChange={e => setCuentaAbono(e.target.value)}>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setAbonando(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarAbono} disabled={guardandoAbono} style={{ flex: 1, background: "var(--success)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>
                {guardandoAbono ? "Guardando…" : "✅ Registrar abono"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deudaAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "white", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "#FFEBEE", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 8 }}>¿Eliminar registro?</h3>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24 }}>{deudaAEliminar.nombre}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeudaAEliminar(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ flex: 1, background: "var(--danger)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {deudasConProgreso.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--white)", borderRadius: 20, border: "1.5px dashed var(--border)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🤝</div>
            <p style={{ fontWeight: 700, color: "var(--dark)" }}>Sin deudas ni préstamos</p>
            <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 4 }}>Registra lo que debés o lo que te deben</p>
          </div>
        )}
        {deudasConProgreso.map(d => (
          <div key={d.id} className="animate" style={{ background: "var(--white)", borderRadius: 16, padding: "16px 18px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", margin: 0 }}>{d.nombre}</p>
                  <span style={{ fontSize: 10, background: d.tipo === "debo" ? "#FFEBEE" : "var(--primary-pale)", color: d.tipo === "debo" ? "var(--danger)" : "var(--primary-deep)", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                    {d.tipo === "debo" ? "Yo debo" : "Me deben"}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--mid)", margin: "3px 0 0" }}>
                  {d.tasaInteresAnual ? `${d.tasaInteresAnual}% anual · ` : ""}{d.cuotaMensual ? `Cuota: ${fmt(d.cuotaMensual)}` : "Sin cuota fija"}
                </p>
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: d.tipo === "debo" ? "var(--danger)" : "var(--primary-deep)", margin: 0, flexShrink: 0 }}>{fmt(d.saldoRestante)}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--mid)" }}>{fmt(d.pagado)} pagado de {fmt(d.montoPrincipal)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-deep)" }}>{d.pct}%</span>
            </div>
            <ProgressBar pct={d.pct} color="var(--primary)" bg="var(--bg)" height={8} />
            <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              {d.saldoRestante > 0 && (
                <button onClick={() => abrirAbono(d)} style={{ flex: 1, background: "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700 }}>
                  {d.tipo === "debo" ? "💸 Abonar" : "💰 Registrar cobro"}
                </button>
              )}
              <button onClick={() => abrirEdicion(d)} style={{ flex: d.saldoRestante > 0 ? "0 0 auto" : 1, background: "var(--bg)", color: "var(--primary-deep)", border: "1px solid var(--primary-soft)", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>✏️</button>
              <button onClick={() => setDeudaAEliminar(d)} style={{ flex: "0 0 auto", background: "#FFEBEE", color: "var(--danger)", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
