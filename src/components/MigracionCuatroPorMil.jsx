import { useState, useMemo } from "react";
import { db } from "../firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";

const norm = (s) => (s || "").trim().toLowerCase();

// Fusiona, con un clic, los movimientos "4x1000 · {origen}" que quedaron
// sueltos (creados antes de guardar el GMF como campo del movimiento
// original) con su transacción original. Usa la sesión ya autenticada del
// usuario, así que solo toca los documentos que le pertenecen. Se oculta
// sola cuando ya no queda nada por fusionar.
export default function MigracionCuatroPorMil({ movimientos, setMovimientos }) {
  const [migrando, setMigrando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const impuestosSueltos = useMemo(
    () => movimientos.filter(m => m.esImpuesto4x1000 || (m.descripcion || "").startsWith("4x1000")),
    [movimientos]
  );

  if (impuestosSueltos.length === 0 && !resultado) return null;

  const migrar = async () => {
    setMigrando(true);
    const candidatos = movimientos.filter(m => !impuestosSueltos.includes(m));
    const idsFundidos = [];
    const actualizaciones = [];
    let pendientes = 0;

    for (const imp of impuestosSueltos) {
      const origen = norm((imp.descripcion || "").replace(/^4x1000\s*·?\s*/, ""));
      const fechaDia = (imp.fecha || "").slice(0, 10);
      const pareja = candidatos.find(m => {
        if (m.cuentaId !== imp.cuentaId) return false;
        if ((m.fecha || "").slice(0, 10) !== fechaDia) return false;
        const desc = norm(m.descripcion || m.categoria);
        return desc === origen || desc.includes(origen) || origen.includes(desc);
      });
      if (!pareja) { pendientes++; continue; }
      try {
        await updateDoc(doc(db, "movimientos", pareja.id), { gmf4x1000: imp.monto });
        await deleteDoc(doc(db, "movimientos", imp.id));
        actualizaciones.push({ parejaId: pareja.id, gmf: imp.monto });
        idsFundidos.push(imp.id);
      } catch {
        pendientes++;
      }
    }

    setMovimientos(prev => prev
      .filter(m => !idsFundidos.includes(m.id))
      .map(m => {
        const act = actualizaciones.find(a => a.parejaId === m.id);
        return act ? { ...m, gmf4x1000: act.gmf } : m;
      })
    );
    setResultado({ fusionados: idsFundidos.length, pendientes });
    setMigrando(false);
  };

  return (
    <div className="animate" style={{ background: "var(--warn-bg)", border: "1.5px solid var(--warn-border)", borderRadius: 16, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      {impuestosSueltos.length > 0 ? (
        <>
          <p style={{ fontSize: 13, color: "var(--warn)", margin: 0 }}>
            🔧 Tenés <strong>{impuestosSueltos.length}</strong> registro{impuestosSueltos.length === 1 ? "" : "s"} viejo{impuestosSueltos.length === 1 ? "" : "s"} de 4x1000 suelto{impuestosSueltos.length === 1 ? "" : "s"} en la lista. Se pueden fusionar con su movimiento original en un clic.
          </p>
          <button onClick={migrar} disabled={migrando} style={{ alignSelf: "flex-start", background: "var(--warn)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700 }}>
            {migrando ? "Fusionando…" : "Fusionar ahora"}
          </button>
        </>
      ) : resultado && (
        <p style={{ fontSize: 13, color: "var(--warn)", margin: 0 }}>
          ✅ Fusionados: {resultado.fusionados}{resultado.pendientes > 0 ? ` · Sin pareja o sin permiso: ${resultado.pendientes} (revisalos a mano)` : ""}
        </p>
      )}
    </div>
  );
}
