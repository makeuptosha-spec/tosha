import { useState, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { fmt, HOGAR_ID, hoyLocal, iconoCuenta, calcular4x1000 } from "../utils.jsx";

// Ventana (en días) alrededor de la fecha de creación de la deuda donde se
// busca un movimiento parecido ya registrado a mano. Si el usuario anotó el
// desembolso por su cuenta, lo normal es que lo haya fechado cerca.
const DIAS_CERCA = 15;

const diasEntre = (a, b) => {
  const fa = new Date(a), fb = new Date(b);
  if (isNaN(fa) || isNaN(fb)) return Infinity;
  return Math.abs(fa - fb) / 86400000;
};

// Las deudas creadas antes de que registrar un préstamo moviera el saldo
// guardaron la cuenta como simple etiqueta: nunca se creó el movimiento del
// desembolso, así que la cuenta quedó sin descontar (o sin sumar). Este panel
// las detecta por la ausencia de `movimientoOrigenId` y crea el movimiento
// faltante, fechado el día en que se creó la deuda.
//
// Es opt-in fila por fila a propósito: quien ya anotó el desembolso a mano
// duplicaría el movimiento. Esos casos se detectan por monto+cuenta+fecha
// cercana y vienen desmarcados, pero la decisión final es del usuario.
export default function MigracionDesembolsoPrestamos({ deudas, setDeudas, movimientos, setMovimientos, cuentas }) {
  const [migrando, setMigrando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [override, setOverride] = useState({});

  const candidatos = useMemo(() =>
    deudas
      .filter(d => d.activa !== false && !d.movimientoOrigenId && !d.sinDesembolso && cuentas.some(c => c.id === d.cuentaId))
      .map(d => {
        const esDebo = d.tipo === "debo";
        const monto = Number(d.montoPrincipal);
        // Tolerancia del 1% (mínimo $1) para que un redondeo no impida
        // reconocer el movimiento que el usuario ya había anotado.
        const margen = Math.max(1, monto * 0.01);
        const yaRegistrado = movimientos.some(m =>
          !m.deudaId &&
          m.cuentaId === d.cuentaId &&
          m.tipo === (esDebo ? "ingreso" : "gasto") &&
          Math.abs(Number(m.monto) - monto) <= margen &&
          (!d.fechaCreacion || diasEntre(m.fecha, d.fechaCreacion) <= DIAS_CERCA)
        );
        return { ...d, monto, esDebo, yaRegistrado };
      }),
    [deudas, movimientos, cuentas]
  );

  if (candidatos.length === 0 && !resultado) return null;

  const marcado = (c) => override[c.id] ?? !c.yaRegistrado;
  const alternar = (c) => setOverride(o => ({ ...o, [c.id]: !marcado(c) }));
  const elegidos = candidatos.filter(marcado);

  // Marca deudas como "no necesitan desembolso" para que el panel no vuelva a
  // preguntar por ellas cada vez que se abre la app. Es la única salida que
  // faltaba: antes, un préstamo que el usuario no quería corregir seguía
  // apareciendo para siempre.
  const descartar = async (lista) => {
    const ids = [];
    for (const d of lista) {
      try {
        await updateDoc(doc(db, "deudas", d.id), { sinDesembolso: true });
        ids.push(d.id);
      } catch { /* si falla, vuelve a aparecer la próxima vez */ }
    }
    if (ids.length) setDeudas(ds => ds.map(x => ids.includes(x.id) ? { ...x, sinDesembolso: true } : x));
    return ids.length;
  };

  const descartarTodos = async () => {
    setMigrando(true);
    const descartados = await descartar(candidatos);
    setResultado({ creados: 0, fallidos: 0, omitidos: descartados });
    setMigrando(false);
  };

  const migrar = async () => {
    if (elegidos.length === 0) return;
    setMigrando(true);
    const nuevos = [];
    const enlaces = [];
    let fallidos = 0;

    for (const d of elegidos) {
      try {
        const mov = {
          tipo: d.esDebo ? "ingreso" : "gasto",
          monto: d.monto,
          categoria: "Préstamo",
          cuentaId: d.cuentaId,
          descripcion: `${d.esDebo ? "Préstamo recibido" : "Préstamo otorgado"}: ${d.nombre}`,
          // El movimiento va con la fecha de la deuda, no con la de hoy: si
          // no, un préstamo de hace meses aparecería como gasto del mes
          // actual y desviaría los totales del mes.
          fecha: d.fechaCreacion || hoyLocal(),
          deudaId: d.id,
          esOrigenDeuda: true,
          gmf4x1000: d.esDebo ? 0 : calcular4x1000(cuentas.find(c => c.id === d.cuentaId), d.monto),
          hogarId: HOGAR_ID,
          uid: auth.currentUser.uid,
          fechaCreacion: new Date().toISOString()
        };
        const movRef = await addDoc(collection(db, "movimientos"), mov);
        await updateDoc(doc(db, "deudas", d.id), { movimientoOrigenId: movRef.id });
        nuevos.push({ id: movRef.id, ...mov });
        enlaces.push({ deudaId: d.id, movId: movRef.id });
      } catch {
        fallidos++;
      }
    }

    setMovimientos(m => [...nuevos, ...m]);
    setDeudas(ds => ds.map(x => {
      const e = enlaces.find(y => y.deudaId === x.id);
      return e ? { ...x, movimientoOrigenId: e.movId } : x;
    }));
    // Lo que el usuario dejó desmarcado es una decisión, no un pendiente:
    // se marca como descartado para que el panel no lo vuelva a sacar.
    const omitidos = await descartar(candidatos.filter(c => !marcado(c)));
    setResultado({ creados: nuevos.length, fallidos, omitidos });
    setMigrando(false);
  };

  return (
    <div className="animate" style={{ background: "var(--warn-bg)", border: "1.5px solid var(--warn-border)", borderRadius: 16, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {candidatos.length > 0 ? (
        <>
          <div>
            <p style={{ fontSize: 13, color: "var(--warn)", fontWeight: 700, margin: 0 }}>
              🔧 {candidatos.length} préstamo{candidatos.length === 1 ? "" : "s"} sin movimiento en la cuenta
            </p>
            <p style={{ fontSize: 11, color: "var(--warn)", margin: "4px 0 0", opacity: 0.85 }}>
              Se registraron cuando la app todavía no descontaba el desembolso del saldo. Marcá los que quieras corregir y se crea el movimiento faltante con la fecha original. Los que dejes desmarcados se dan por buenos y no se vuelven a preguntar.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {candidatos.map(c => {
              const cuenta = cuentas.find(x => x.id === c.cuentaId);
              const gmf = c.esDebo ? 0 : calcular4x1000(cuenta, c.monto);
              return (
                <div key={c.id} onClick={() => alternar(c)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--white)", borderRadius: 12, padding: "10px 12px", border: "1px solid var(--border)", cursor: "pointer", opacity: marcado(c) ? 1 : 0.55 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</p>
                    <p style={{ fontSize: 11, color: "var(--mid)", margin: "2px 0 0" }}>
                      {c.esDebo ? "Entra" : "Sale"} {fmt(c.monto)}{gmf > 0 ? ` + 4x1000 ${fmt(gmf)}` : ""} · {cuenta ? `${iconoCuenta(cuenta)} ${cuenta.nombre}` : "—"}
                    </p>
                    {c.yaRegistrado && (
                      <p style={{ fontSize: 10, color: "var(--warn)", margin: "2px 0 0", fontWeight: 700 }}>Ya hay un movimiento parecido en esa cuenta</p>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 100, padding: 3, background: marcado(c) ? "linear-gradient(135deg, var(--primary-deep), var(--primary))" : "#A8BDB4", transition: "background 0.2s" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow)", transform: marcado(c) ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={migrar} disabled={migrando || elegidos.length === 0} style={{ background: "var(--warn)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, opacity: migrando || elegidos.length === 0 ? 0.6 : 1 }}>
              {migrando ? "Guardando…" : `Corregir ${elegidos.length} préstamo${elegidos.length === 1 ? "" : "s"}`}
            </button>
            <button onClick={descartarTodos} disabled={migrando} style={{ background: "transparent", color: "var(--warn)", border: "1px solid var(--warn-border)", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, opacity: migrando ? 0.6 : 1 }}>
              Están bien, no preguntar más
            </button>
          </div>
        </>
      ) : resultado && (
        <p style={{ fontSize: 13, color: "var(--warn)", margin: 0 }}>
          ✅ Movimientos creados: {resultado.creados}
          {resultado.omitidos > 0 ? ` · Dados por buenos: ${resultado.omitidos}` : ""}
          {resultado.fallidos > 0 ? ` · Con error: ${resultado.fallidos} (revisalos a mano)` : ""}
        </p>
      )}
    </div>
  );
}
