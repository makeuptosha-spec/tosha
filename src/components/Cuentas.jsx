import { useState, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fmt, fmtNum, parseNum, Icon, ProgressBar, TIPOS_CUENTA, HOGAR_ID, iconoCuenta, aplica4x1000, calcular4x1000, getMoneda, mesActual, sumarMes, fmtMes } from "../utils.jsx";

export const calcularSaldo = (cuenta, movimientos) => {
  let saldo = Number(cuenta.saldoInicial) || 0;
  movimientos.forEach(m => {
    if (m.tipo === "ingreso" && m.cuentaId === cuenta.id) saldo += Number(m.monto);
    else if (m.tipo === "gasto" && m.cuentaId === cuenta.id) saldo -= Number(m.monto) + Number(m.gmf4x1000 || 0);
    else if (m.tipo === "transferencia") {
      if (m.cuentaId === cuenta.id) saldo -= Number(m.monto) + Number(m.gmf4x1000 || 0);
      if (m.cuentaDestinoId === cuenta.id) saldo += Number(m.monto);
    }
    else if (m.tipo === "ajuste" && m.cuentaId === cuenta.id) saldo += Number(m.monto);
  });
  return saldo;
};

// Número de ciclo de facturación al que pertenece una fecha, dado el día
// de corte: si la fecha cae después del corte de su mes, ya pertenece al
// ciclo que cierra el corte del mes siguiente. Es un entero creciente
// (año*12+mes) que sirve para comparar "cuántos ciclos pasaron entre dos
// fechas" sin líos de calendario.
const numeroCiclo = (fecha, diaCorte) => {
  const d = new Date(fecha);
  let mes = d.getMonth();
  let anio = d.getFullYear();
  if (d.getDate() > diaCorte) { mes += 1; if (mes > 11) { mes = 0; anio += 1; } }
  return anio * 12 + mes;
};

// Cuota mensual de una tarjeta de crédito: suma, de cada compra a cuotas,
// la fracción (monto / cuotas) que corresponde al ciclo de facturación
// que ya cerró (el que se paga ahora), no al mes calendario. Si la
// cuenta no tiene fecha de corte configurada, se usa el mes calendario
// como aproximación. Una compra "de contado" tiene cuotas = 1, así que
// solo pesa un ciclo. Si la cuenta tiene cuotaMensualManual (el usuario
// la sobreescribió a mano, ej. porque el banco cobra distinto), esa gana.
export const calcularCuotaMensual = (cuenta, movimientos) => {
  if (cuenta.tipo !== "tarjeta_credito") return 0;
  if (cuenta.cuotaMensualManual > 0) return Number(cuenta.cuotaMensualManual);
  const hoy = new Date();
  const diaCorte = cuenta.fechaCorte;
  const cicloCerrado = diaCorte ? numeroCiclo(hoy, diaCorte) - 1 : null;
  return movimientos
    .filter(m => m.tipo === "gasto" && m.cuentaId === cuenta.id)
    .reduce((total, m) => {
      const cuotas = Number(m.cuotas) || 1;
      let activo;
      if (diaCorte) {
        const diff = cicloCerrado - numeroCiclo(m.fecha, diaCorte);
        activo = diff >= 0 && diff < cuotas;
      } else {
        const fechaCompra = new Date(m.fecha);
        const meses = (hoy.getFullYear() - fechaCompra.getFullYear()) * 12 + (hoy.getMonth() - fechaCompra.getMonth());
        activo = meses >= 0 && meses < cuotas;
      }
      return activo ? total + Number(m.monto) / cuotas : total;
    }, 0);
};

// Lo que hay que pagarle a la tarjeta en el ciclo vigente ("lo que debo
// este mes"), que no es lo mismo que la deuda total: la deuda total son
// todas las compras sin pagar, y la del mes es lo que el banco cobra ahora.
// Manda el valor que declaró el usuario (`deudaMesActual`, que se fija al
// crear la tarjeta y se renueva cada vez que se paga); si nunca lo declaró,
// se cae al estimado por cuotas para no mostrar la tarjeta en blanco.
export const deudaMesTarjeta = (cuenta, movimientos) => {
  if (cuenta.tipo !== "tarjeta_credito") return 0;
  if (cuenta.deudaMesActual != null) return Math.max(0, Number(cuenta.deudaMesActual));
  return calcularCuotaMensual(cuenta, movimientos);
};

// Días que faltan para el próximo día-del-mes dado (corte/pago de
// tarjeta). Igual que se hace con diaVencimiento en Facturas: puede dar
// negativo si ya pasó este mes.
export const diasHasta = (diaMes) => {
  if (!diaMes) return null;
  const hoy = new Date();
  return Number(diaMes) - hoy.getDate();
};

export default function Cuentas({ cuentas, setCuentas, movimientos, setMovimientos }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [cuentaAEliminar, setCuentaAEliminar] = useState(null);
  const [ajustando, setAjustando] = useState(null);
  const [saldoReal, setSaldoReal] = useState("");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [pagandoTarjeta, setPagandoTarjeta] = useState(null);
  const [pagoForm, setPagoForm] = useState({ cuentaOrigenId: "", monto: "" });
  const [pasoPago, setPasoPago] = useState("pago");
  const [deudaProximoMes, setDeudaProximoMes] = useState("");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [toast, setToast] = useState(null);

  const formBase = { nombre: "", tipo: "efectivo", saldoInicial: "", cupoTotal: "", fechaCorte: "", fechaPago: "", deudaMesActual: "", exento4x1000: false };
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

  const esTarjeta = form.tipo === "tarjeta_credito";
  const esCuentaGravable = form.tipo === "banco" || form.tipo === "ahorros" || esTarjeta;

  const guardar = async () => {
    if (guardandoCuenta) return;
    if (!form.nombre || (!editandoId && form.saldoInicial === "")) return showToast(esTarjeta ? "⚠️ Completa nombre y deuda actual" : "⚠️ Completa nombre y saldo inicial", "warn");
    if (esTarjeta && form.cupoTotal === "") return showToast("⚠️ Completa el cupo total", "warn");
    setGuardandoCuenta(true);
    const datos = {
      nombre: form.nombre, tipo: form.tipo,
      cupoTotal: esTarjeta ? Number(form.cupoTotal) : null,
      fechaCorte: esTarjeta && form.fechaCorte !== "" ? Number(form.fechaCorte) : null,
      fechaPago: esTarjeta && form.fechaPago !== "" ? Number(form.fechaPago) : null,
      // `deudaMesActual` es lo que el banco cobra en el ciclo vigente, dicho
      // por el usuario. `cuotaMensualManual` era el campo viejo que hacía las
      // veces de esto: al guardar una tarjeta se migra a null para no dejar
      // dos fuentes de verdad peleando.
      deudaMesActual: esTarjeta && form.deudaMesActual !== "" ? Number(form.deudaMesActual) : null,
      periodoDeudaMes: esTarjeta && form.deudaMesActual !== "" ? mesActual() : null,
      cuotaMensualManual: null,
      exento4x1000: esCuentaGravable ? !!form.exento4x1000 : false,
      activa: true, hogarId: HOGAR_ID, uid: auth.currentUser.uid
    };
    // saldoInicial es la base del cálculo de saldo (base + movimientos ya
    // registrados). Solo se fija al crear la cuenta — si se pudiera tocar
    // de nuevo en una edición con movimientos ya encima, el saldo quedaría
    // mal sumado. Para corregir el saldo real se usa "⚖️ Ajustar", que
    // crea un movimiento de ajuste en vez de pisar la base.
    if (!editandoId) {
      datos.saldoInicial = esTarjeta ? -Math.abs(Number(form.saldoInicial)) : Number(form.saldoInicial);
    }
    try {
      if (editandoId) {
        await updateDoc(doc(db, "cuentas", editandoId), datos);
        setCuentas(c => c.map(x => x.id === editandoId ? { ...x, ...datos } : x));
        showToast("✅ Cuenta actualizada");
      } else {
        datos.fechaCreacion = new Date().toISOString();
        const ref = await addDoc(collection(db, "cuentas"), datos);
        setCuentas(c => [{ id: ref.id, ...datos }, ...c]);
        showToast("✅ Cuenta creada");
      }
      setForm(formBase); setEditandoId(null); setMostrarForm(false);
    } catch { showToast("❌ Error al guardar", "danger"); }
    finally { setGuardandoCuenta(false); }
  };

  const abrirEdicion = (c) => {
    setForm({
      nombre: c.nombre, tipo: c.tipo,
      saldoInicial: c.tipo === "tarjeta_credito" ? String(Math.abs(c.saldoInicial)) : String(c.saldoInicial),
      cupoTotal: c.cupoTotal != null ? String(c.cupoTotal) : "",
      fechaCorte: c.fechaCorte != null ? String(c.fechaCorte) : "",
      fechaPago: c.fechaPago != null ? String(c.fechaPago) : "",
      deudaMesActual: c.deudaMesActual != null ? String(c.deudaMesActual) : (c.cuotaMensualManual != null ? String(c.cuotaMensualManual) : ""),
      exento4x1000: !!c.exento4x1000,
    });
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
      const gmf = calcular4x1000(cuentaOrigen, monto);
      const nuevoMovimiento = {
        tipo: "transferencia", monto: Number(monto), cuentaId, cuentaDestinoId,
        categoria: "Transferencia", descripcion: transferForm.descripcion || "Transferencia entre cuentas",
        fecha: new Date().toISOString(), hogarId: HOGAR_ID, uid: auth.currentUser.uid, fechaCreacion: new Date().toISOString()
      };
      if (gmf) nuevoMovimiento.gmf4x1000 = gmf;
      const ref = await addDoc(collection(db, "movimientos"), nuevoMovimiento);
      setMovimientos(m => [{ id: ref.id, ...nuevoMovimiento }, ...m]);

      showToast(gmf ? `✅ Transferencia realizada (+${fmt(gmf)} de 4x1000)` : "✅ Transferencia realizada");
      setTransferForm(transferBase); setMostrarTransferencia(false);
    } catch { showToast("❌ Error en la transferencia", "danger"); }
    finally { setEnviandoTransfer(false); }
  };

  const abrirAjuste = (c) => {
    setAjustando(c);
    const saldoActual = calcularSaldo(c, movimientos);
    setSaldoReal(String(Math.round(c.tipo === "tarjeta_credito" ? Math.max(0, -saldoActual) : saldoActual)));
  };

  // Pagar la tarjeta es una transferencia (sale plata de una cuenta y baja la
  // deuda de la tarjeta), pero además cierra el ciclo: deja la deuda del mes
  // en cero y pregunta la del mes siguiente. Por eso tiene modal propio y no
  // reusa el de transferencias.
  const abrirPagoTarjeta = (c) => {
    const deudaMes = deudaMesTarjeta(c, movimientos);
    const deudaTotal = Math.max(0, -calcularSaldo(c, movimientos));
    const origen = cuentas.find(x => x.tipo !== "tarjeta_credito" && x.activa !== false);
    setPagandoTarjeta(c);
    setPasoPago("pago");
    setDeudaProximoMes("");
    setPagoForm({ cuentaOrigenId: origen?.id || "", monto: String(Math.round(deudaMes || deudaTotal)) });
    setMostrarForm(false);
  };

  const confirmarPagoTarjeta = async () => {
    if (!pagandoTarjeta || !pagoForm.cuentaOrigenId || !pagoForm.monto) return showToast("⚠️ Elegí cuenta y monto", "warn");
    setGuardandoPago(true);
    try {
      const monto = Number(pagoForm.monto);
      const origen = cuentas.find(c => c.id === pagoForm.cuentaOrigenId);
      const gmf = calcular4x1000(origen, monto);
      const fecha = new Date().toISOString();
      const mov = {
        tipo: "transferencia", monto, cuentaId: pagoForm.cuentaOrigenId, cuentaDestinoId: pagandoTarjeta.id,
        categoria: "Transferencia", descripcion: `Pago tarjeta: ${pagandoTarjeta.nombre}`,
        esPagoTarjeta: true, fecha, hogarId: HOGAR_ID, uid: auth.currentUser.uid, fechaCreacion: fecha
      };
      if (gmf) mov.gmf4x1000 = gmf;
      const ref = await addDoc(collection(db, "movimientos"), mov);
      setMovimientos(m => [{ id: ref.id, ...mov }, ...m]);

      // Lo pagado baja de la deuda del mes. Si el pago no la cubre entera,
      // queda el resto pendiente en vez de saltar al ciclo siguiente.
      const deudaMes = deudaMesTarjeta(pagandoTarjeta, movimientos);
      const restante = Math.max(0, Math.round(deudaMes - monto));
      const cambios = { deudaMesActual: restante, periodoDeudaMes: mesActual() };
      await updateDoc(doc(db, "cuentas", pagandoTarjeta.id), cambios);
      setCuentas(cs => cs.map(x => x.id === pagandoTarjeta.id ? { ...x, ...cambios } : x));

      if (restante > 0) {
        showToast(`✅ Pago registrado · quedan ${fmt(restante)} de este mes`);
        setPagandoTarjeta(null);
      } else {
        setPagandoTarjeta(t => ({ ...t, ...cambios }));
        setPasoPago("siguiente");
      }
    } catch { showToast("❌ Error al registrar el pago", "danger"); }
    finally { setGuardandoPago(false); }
  };

  const guardarDeudaProximoMes = async () => {
    if (!pagandoTarjeta) return;
    setGuardandoPago(true);
    try {
      const cambios = {
        deudaMesActual: deudaProximoMes === "" ? 0 : Number(deudaProximoMes),
        periodoDeudaMes: sumarMes(mesActual(), 1)
      };
      await updateDoc(doc(db, "cuentas", pagandoTarjeta.id), cambios);
      setCuentas(cs => cs.map(x => x.id === pagandoTarjeta.id ? { ...x, ...cambios } : x));
      showToast(deudaProximoMes === "" ? "Listo, lo cargás cuando llegue el extracto" : `✅ Mes siguiente: ${fmt(Number(deudaProximoMes))}`);
      setPagandoTarjeta(null); setDeudaProximoMes("");
    } catch { showToast("❌ Error al guardar", "danger"); }
    finally { setGuardandoPago(false); }
  };

  const confirmarAjuste = async () => {
    if (!ajustando || saldoReal === "") return;
    setGuardandoAjuste(true);
    try {
      const saldoActual = calcularSaldo(ajustando, movimientos);
      const saldoRealNum = ajustando.tipo === "tarjeta_credito" ? -Math.abs(Number(saldoReal)) : Number(saldoReal);
      const diferencia = saldoRealNum - saldoActual;
      if (diferencia === 0) { showToast("Ya estaban iguales, nada que ajustar"); setAjustando(null); return; }
      const fecha = new Date().toISOString();
      const nuevoMovimiento = {
        tipo: "ajuste", monto: diferencia, categoria: "Ajuste de saldo", cuentaId: ajustando.id,
        descripcion: "Conciliación con saldo real", fecha, hogarId: HOGAR_ID, uid: auth.currentUser.uid, fechaCreacion: fecha
      };
      const ref = await addDoc(collection(db, "movimientos"), nuevoMovimiento);
      setMovimientos(m => [{ id: ref.id, ...nuevoMovimiento }, ...m]);
      showToast(`✅ Saldo ajustado (${diferencia > 0 ? "+" : ""}${fmt(diferencia)})`);
      setAjustando(null); setSaldoReal("");
    } catch { showToast("❌ Error al ajustar", "danger"); }
    finally { setGuardandoAjuste(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "ok" ? "var(--ink)" : toast.tipo === "warn" ? "var(--warn)" : "var(--danger)", color: "#fff", padding: "10px 20px", borderRadius: 100, fontSize: 13, zIndex: 9999, boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* BALANCE TOTAL */}
      <div style={{ background: "linear-gradient(135deg, #374151 0%, #1F2937 100%)", borderRadius: 24, padding: "24px", color: "#fff" }}>
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
                {cuentas.map(c => <option key={c.id} value={c.id}>{iconoCuenta(c)} {c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--mid)" }}>Hacia</label>
              <select value={transferForm.cuentaDestinoId} onChange={e => setTransferForm({ ...transferForm, cuentaDestinoId: e.target.value })}>
                <option value="">Selecciona…</option>
                {cuentas.filter(c => c.id !== transferForm.cuentaId).map(c => <option key={c.id} value={c.id}>{iconoCuenta(c)} {c.nombre}</option>)}
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
              <label style={{ fontSize: 11, color: "var(--mid)" }}>{esTarjeta ? "Deuda actual" : "Saldo inicial"}</label>
              {editandoId ? (
                <p style={{ fontSize: 13, color: "var(--mid)", background: "var(--bg)", borderRadius: 10, padding: "10px 12px", margin: 0 }}>
                  Usá "⚖️ Ajustar" en la lista para corregirlo
                </p>
              ) : (
                <input type="text" value={form.saldoInicial ? fmtNum(form.saldoInicial) : ""} onChange={e => setForm({ ...form, saldoInicial: parseNum(e.target.value) })} />
              )}
            </div>
          </div>
          {esTarjeta && (
            <>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>Cupo total</label>
                <input type="text" value={form.cupoTotal ? fmtNum(form.cupoTotal) : ""} onChange={e => setForm({ ...form, cupoTotal: parseNum(e.target.value) })} />
              </div>
              <div className="form-grid">
                <div>
                  <label style={{ fontSize: 11, color: "var(--mid)" }}>Día de corte</label>
                  <input type="number" min="1" max="31" value={form.fechaCorte} onChange={e => setForm({ ...form, fechaCorte: e.target.value })} placeholder="Ej: 15" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--mid)" }}>Día de pago</label>
                  <input type="number" min="1" max="31" value={form.fechaPago} onChange={e => setForm({ ...form, fechaPago: e.target.value })} placeholder="Ej: 5" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--mid)" }}>Deuda de este mes (lo que te cobran ahora)</label>
                <input type="text" value={form.deudaMesActual ? fmtNum(form.deudaMesActual) : ""} onChange={e => setForm({ ...form, deudaMesActual: parseNum(e.target.value) })} placeholder="Lo del extracto vigente" />
                <p style={{ fontSize: 10, color: "var(--mid)", margin: "4px 0 0" }}>Al pagarla te preguntamos cuánto queda para el mes siguiente. Si lo dejás vacío, se estima con las cuotas de tus compras.</p>
              </div>
            </>
          )}
          {esCuentaGravable && getMoneda() === "COP" && (
            <div onClick={() => setForm(f => ({ ...f, exento4x1000: !f.exento4x1000 }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bg)", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border)", cursor: "pointer" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0 }}>Exenta de 4x1000</p>
                <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>Marca esto solo en la cuenta que la ley exime (normalmente una sola). Las demás cuentas (banco, ahorros, tarjeta de crédito) pagan 0.4% en cada gasto/transferencia/pago.</p>
              </div>
              <div style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 100, padding: 3, background: form.exento4x1000 ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "#A8BDB4", transition: "background 0.2s" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow)", transform: form.exento4x1000 ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s" }} />
              </div>
            </div>
          )}
          <button onClick={guardar} disabled={guardandoCuenta} style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14, opacity: guardandoCuenta ? 0.6 : 1 }}>
            {guardandoCuenta ? "Guardando…" : editandoId ? "Actualizar" : "Guardar cuenta"}
          </button>
        </div>
      )}

      {/* MODAL AJUSTAR SALDO */}
      {pagandoTarjeta && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "var(--white)", padding: 26, borderRadius: 24, width: "90%", maxWidth: 400, boxShadow: "var(--shadow-lg)" }}>
            {pasoPago === "pago" ? (
              <>
                <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 6 }}>Pagar "{pagandoTarjeta.nombre}"</h3>
                <p style={{ fontSize: 12, color: "var(--mid)", marginBottom: 16 }}>
                  Deuda total: <strong>{fmt(Math.max(0, -calcularSaldo(pagandoTarjeta, movimientos)))}</strong> · Este mes: <strong>{fmt(deudaMesTarjeta(pagandoTarjeta, movimientos))}</strong>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--mid)" }}>Cuenta desde donde pagás</label>
                    <select value={pagoForm.cuentaOrigenId} onChange={e => setPagoForm({ ...pagoForm, cuentaOrigenId: e.target.value })}>
                      <option value="">Selecciona…</option>
                      {cuentas.filter(c => c.tipo !== "tarjeta_credito" && c.activa !== false).map(c => (
                        <option key={c.id} value={c.id}>{iconoCuenta(c)} {c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--mid)" }}>Monto a pagar</label>
                    <input type="text" value={pagoForm.monto ? fmtNum(pagoForm.monto) : ""} onChange={e => setPagoForm({ ...pagoForm, monto: parseNum(e.target.value) })} autoFocus />
                    <p style={{ fontSize: 10, color: "var(--mid)", margin: "4px 0 0" }}>
                      Sale de la cuenta elegida y baja la deuda de la tarjeta. Si pagás menos que la deuda del mes, el resto queda pendiente.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button onClick={() => setPagandoTarjeta(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
                  <button onClick={confirmarPagoTarjeta} disabled={guardandoPago} style={{ flex: 1, background: "var(--success)", color: "#fff", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600, opacity: guardandoPago ? 0.6 : 1 }}>
                    {guardandoPago ? "Pagando…" : "💳 Pagar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 6 }}>Este mes queda en cero 🎉</h3>
                <p style={{ fontSize: 12, color: "var(--mid)", marginBottom: 16 }}>
                  ¿Cuánto te cobran en {fmtMes(sumarMes(mesActual(), 1))}? Lo podés dejar vacío y cargarlo cuando llegue el extracto.
                </p>
                <div>
                  <label style={{ fontSize: 11, color: "var(--mid)" }}>Deuda del mes siguiente</label>
                  <input type="text" value={deudaProximoMes ? fmtNum(deudaProximoMes) : ""} onChange={e => setDeudaProximoMes(parseNum(e.target.value))} autoFocus />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button onClick={() => { setDeudaProximoMes(""); guardarDeudaProximoMes(); }} disabled={guardandoPago} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Lo pongo después</button>
                  <button onClick={guardarDeudaProximoMes} disabled={guardandoPago} style={{ flex: 1, background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600, opacity: guardandoPago ? 0.6 : 1 }}>
                    {guardandoPago ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {ajustando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "var(--white)", padding: 26, borderRadius: 24, width: "90%", maxWidth: 380, boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: "var(--dark)", marginBottom: 6 }}>Ajustar "{ajustando.nombre}"</h3>
            <p style={{ fontSize: 12, color: "var(--mid)", marginBottom: 16 }}>
              {ajustando.tipo === "tarjeta_credito"
                ? <>Debés en la app: <strong>{fmt(Math.max(0, -calcularSaldo(ajustando, movimientos)))}</strong> — poné cuánto debés hoy según el banco y se crea un ajuste automático por la diferencia.</>
                : <>Saldo en la app: <strong>{fmt(calcularSaldo(ajustando, movimientos))}</strong> — poné el saldo real (ej: el que ves en el banco) y se crea un ajuste automático por la diferencia.</>}
            </p>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>{ajustando.tipo === "tarjeta_credito" ? "¿Cuánto debés hoy?" : "Saldo real"}</label>
            <input type="text" value={saldoReal ? fmtNum(saldoReal) : ""} onChange={e => setSaldoReal(parseNum(e.target.value))} autoFocus />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setAjustando(null)} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarAjuste} disabled={guardandoAjuste} style={{ flex: 1, background: "var(--success)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>
                {guardandoAjuste ? "Guardando…" : "✅ Ajustar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {cuentaAEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="animate" style={{ background: "var(--white)", padding: 28, borderRadius: 24, width: "90%", maxWidth: 340, textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ background: "var(--danger-bg)", width: 60, height: 60, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--danger)" }}><Icon name="trash" size={28} /></div>
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
        {cuentasConSaldo.map(c => {
          const esTC = c.tipo === "tarjeta_credito";
          const deuda = esTC ? Math.max(0, -c.saldo) : 0;
          const cupo = esTC ? Number(c.cupoTotal) || 0 : 0;
          const disponible = esTC ? Math.max(0, cupo - deuda) : 0;
          const pctUsado = esTC && cupo ? Math.min(100, (deuda / cupo) * 100) : 0;
          const deudaMes = esTC ? deudaMesTarjeta(c, movimientos) : 0;
          return (
            <div key={c.id} className="animate" style={{ background: "var(--white)", borderRadius: 18, padding: "16px 18px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary-pale)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
                  {iconoCuenta(c)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dark)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</p>
                  <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
                    {TIPOS_CUENTA.find(t => t.id === c.tipo)?.label}
                    {aplica4x1000(c) && <span style={{ fontSize: 10, background: "var(--warn-bg)", color: "var(--warn)", padding: "1px 7px", borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>4x1000</span>}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: esTC ? "var(--danger)" : (c.saldo < 0 ? "var(--danger)" : "var(--dark)"), margin: 0 }}>{fmt(esTC ? deuda : c.saldo)}</p>
                  {esTC && <p style={{ fontSize: 10, color: "var(--mid)", margin: "2px 0 0" }}>debes</p>}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {esTC && <button onClick={() => abrirPagoTarjeta(c)} title="Pagar tarjeta" style={{ background: "var(--primary-pale)", border: "none", borderRadius: 8, width: 32, height: 32, color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>💳</button>}
                  <button onClick={() => abrirAjuste(c)} title="Ajustar saldo" style={{ background: "var(--bg)", border: "none", borderRadius: 8, width: 32, height: 32, color: "var(--mid)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚖️</button>
                  <button onClick={() => abrirEdicion(c)} style={{ background: "var(--bg)", border: "none", borderRadius: 8, width: 32, height: 32, color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={14} /></button>
                  <button onClick={() => setCuentaAEliminar(c)} style={{ background: "var(--danger-bg)", border: "none", borderRadius: 8, width: 32, height: 32, color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={14} /></button>
                </div>
              </div>
              {esTC && (
                <div>
                  <ProgressBar pct={pctUsado} color={pctUsado > 80 ? "var(--danger)" : "var(--primary)"} bg="var(--border)" height={8} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--mid)", margin: 0 }}>Cupo total</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: "2px 0 0" }}>{fmt(cupo)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--mid)", margin: 0 }}>Deuda total</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", margin: "2px 0 0" }}>{fmt(deuda)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--mid)", margin: 0 }}>Disponible</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--success)", margin: "2px 0 0" }}>{fmt(disponible)}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, background: "var(--bg)", borderRadius: 12, padding: "8px 12px", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--mid)" }}>
                      Este mes: <strong style={{ color: deudaMes > 0 ? "var(--dark)" : "var(--mid)" }}>{deudaMes > 0 ? fmt(deudaMes) : "sin deuda"}</strong>
                      {c.deudaMesActual == null && deudaMes > 0 ? " (estimado)" : ""}
                    </span>
                    {deudaMes > 0 && (
                      <button onClick={() => abrirPagoTarjeta(c)} style={{ background: "var(--success)", color: "#fff", border: "none", borderRadius: 10, padding: "6px 14px", fontSize: 11, fontWeight: 700 }}>💳 Pagar este mes</button>
                    )}
                  </div>
                  {(c.fechaCorte || c.fechaPago) && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--mid)", flexWrap: "wrap", gap: 6 }}>
                      {c.fechaCorte && <span>Corte: día {c.fechaCorte}</span>}
                      {c.fechaPago && <span>Pago: día {c.fechaPago}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
