// Migración: fusiona los movimientos "4x1000 · {origen}" (creados por el
// código viejo como documentos aparte) dentro del movimiento original,
// como campo gmf4x1000, y borra el documento del impuesto.
//
// Uso:
//   npm install --no-save firebase-admin
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/migrar-4x1000.mjs           (dry-run, no escribe nada)
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/migrar-4x1000.mjs --apply    (aplica los cambios)
//
// El service account se descarga desde Firebase Console →
// Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APLICAR = process.argv.includes("--apply");

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const norm = (s) => (s || "").trim().toLowerCase();

async function main() {
  const snap = await db.collection("movimientos").get();
  const movimientos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const impuestos = movimientos.filter(
    (m) => m.esImpuesto4x1000 || (m.descripcion || "").startsWith("4x1000")
  );
  const candidatos = movimientos.filter((m) => !impuestos.includes(m));

  console.log(`Movimientos totales: ${movimientos.length}`);
  console.log(`Registros de 4x1000 sueltos encontrados: ${impuestos.length}`);

  let fusionados = 0;
  let sinPareja = [];

  for (const imp of impuestos) {
    const origen = norm(imp.descripcion.replace(/^4x1000\s*·?\s*/, ""));
    const fechaDia = (imp.fecha || "").slice(0, 10);

    const pareja = candidatos.find((m) => {
      if (m.cuentaId !== imp.cuentaId) return false;
      if ((m.fecha || "").slice(0, 10) !== fechaDia) return false;
      const desc = norm(m.descripcion || m.categoria);
      return desc === origen || desc.includes(origen) || origen.includes(desc);
    });

    if (!pareja) {
      sinPareja.push(imp);
      continue;
    }

    console.log(
      `${APLICAR ? "Fusionando" : "[dry-run] Fusionaría"}: "${pareja.descripcion || pareja.categoria}" (${pareja.id}) + 4x1000 $${imp.monto} (${imp.id})`
    );

    if (APLICAR) {
      await db.collection("movimientos").doc(pareja.id).update({ gmf4x1000: imp.monto });
      await db.collection("movimientos").doc(imp.id).delete();
    }
    fusionados++;
  }

  console.log(`\nFusionados: ${fusionados}`);
  if (sinPareja.length) {
    console.log(`Sin pareja encontrada (revisar manualmente): ${sinPareja.length}`);
    sinPareja.forEach((m) => console.log(`  - ${m.id} · ${m.descripcion} · ${m.fecha} · cuenta ${m.cuentaId} · $${m.monto}`));
  }
  if (!APLICAR) console.log("\nEsto fue un dry-run. Corré de nuevo con --apply para escribir los cambios.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
