import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

const PROMPT = `Eres un extractor de datos para una tienda de cosméticos y belleza en Colombia.
Analiza esta imagen de factura de compra y extrae TODOS los productos.

La factura tiene este formato:
- SKU: código único del producto (alfanumérico, puede aparecer como "Ref", "SKU", "Código" o similar)
- Descripción: nombre del producto tal cual aparece (labial, base, sombra, crema, etc.)
- Cantidad: aparece con formato "x1", "x2", "x3" etc — extrae solo el número
- Presentación: puede ser "Única", "Mini", "Regular", "Grande", tono/shade, ml — respétalas exactamente. Si no hay, usa "Única"
- Costo unitario: precio por unidad en pesos colombianos

REGLA CRÍTICA: Si el mismo SKU aparece varias veces con distintas presentaciones, agrúpalas en UN SOLO objeto con array de tallas.

Responde ÚNICAMENTE con un JSON array, sin texto adicional, sin markdown:
[
  {
    "sku": "ABC123",
    "descripcion": "Labial Matte Terciopelo",
    "tallas": [
      {"talla": "Única", "cantidad": 5}
    ],
    "costoUnitario": 25000
  }
]

Reglas:
- costoUnitario: número entero sin puntos ni símbolos (25000 no $25.000)
- cantidad: número entero (extraer el número de "x2" → 2)
- talla: usa "Única" si no hay presentación específica
- Si no puedes leer un campo con certeza usa null
- NADA fuera del JSON`;

async function imagenABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfPaginaABase64(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.5 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/png").split(",")[1];
}

async function llamarGroq(base64, mediaType = "image/png") {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.1,
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: "text", text: PROMPT }
        ]
      }]
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const texto = data.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error("Groq no devolvió respuesta");
  const jsonStr = texto.startsWith("[") ? texto : texto.match(/\[[\s\S]*\]/)?.[0];
  if (!jsonStr) throw new Error("La IA no devolvió JSON válido");
  return JSON.parse(jsonStr);
}

async function buscarProductoPorSku(sku) {
  if (!sku) return null;
  const snap = await getDocs(query(collection(db, "prendas"), where("sku", "==", String(sku).trim())));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export default function ImportarFactura({ onBorradorCreado, onClose }) {
  const [estado, setEstado]   = useState("idle");
  const [progreso, setProgreso] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [resumen, setResumen]   = useState({ nuevos: 0, restock: 0 });

  const procesarArchivo = async (file) => {
    if (!GROQ_KEY) {
      setEstado("error");
      setErrorMsg("Falta VITE_GROQ_API_KEY en las variables de entorno.");
      return;
    }
    setEstado("procesando");
    setErrorMsg("");

    try {
      setProgreso("Leyendo archivo…");
      let base64, mediaType;
      if (file.type === "application/pdf") {
        setProgreso("Convirtiendo PDF a imagen…");
        base64 = await pdfPaginaABase64(file);
        mediaType = "image/png";
      } else {
        base64 = await imagenABase64(file);
        mediaType = file.type || "image/png";
      }

      setProgreso("Analizando factura con IA…");
      const productos = await llamarGroq(base64, mediaType);
      if (!productos.length) throw new Error("No se encontraron productos en la imagen");

      setProgreso("Verificando SKUs en inventario…");
      const fecha = new Date().toISOString();
      const lote  = `LOTE-${Date.now()}`;
      let nuevos = 0, restock = 0;

      for (const p of productos) {
        const productoExistente = await buscarProductoPorSku(p.sku);

        if (productoExistente) {
          await addDoc(collection(db, "borradores"), {
            ...p,
            lote,
            fecha,
            estado: "pendiente",
            tipo: "restock",
            prendaExistenteId:     productoExistente.id,
            prendaExistenteNombre: productoExistente.descripcion,
            stockActualPorTalla:   productoExistente.stockPorTalla || {},
            categoria:             productoExistente.categoria || "Labial",
            precioVenta:           productoExistente.precioVenta || "",
          });
          restock++;
        } else {
          await addDoc(collection(db, "borradores"), {
            ...p,
            lote,
            fecha,
            estado: "pendiente",
            tipo: "nuevo",
            precioVenta: "",
            categoria:   "Labial",
            imagenes:    [],
          });
          nuevos++;
        }
      }

      setResumen({ nuevos, restock });
      setEstado("ok");
      setProgreso(`¡${productos.length} ${productos.length === 1 ? "producto" : "productos"} procesados!`);
      onBorradorCreado?.();
    } catch (err) {
      setEstado("error");
      setErrorMsg(err.message);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="animate" style={{ background: "#fff", borderRadius: 24, padding: 30, width: "90%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: "var(--rosa-deep)", margin: 0 }}>Importar Factura</h3>
            <p style={{ fontSize: 12, color: "var(--mid)", margin: "4px 0 0" }}>PNG, JPG o PDF — la IA extrae todo</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--creme)", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 18, color: "var(--mid)" }}>×</button>
        </div>

        {estado === "idle" && (
          <label onDrop={onDrop} onDragOver={e => e.preventDefault()}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, border: "2px dashed var(--rosa-soft)", borderRadius: 16, padding: "32px 20px", cursor: "pointer", background: "var(--rosa-pale)", textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🧾</div>
            <p style={{ fontWeight: 700, color: "var(--rosa-deep)", margin: 0 }}>Arrastra aquí tu factura</p>
            <p style={{ fontSize: 12, color: "var(--mid)", margin: 0 }}>o haz clic para seleccionar</p>
            <span style={{ background: "linear-gradient(135deg, var(--rosa-deep), var(--rosa))", color: "#fff", borderRadius: 10, padding: "10px 24px", fontWeight: 700, fontSize: 13 }}>
              Seleccionar archivo
            </span>
            <input type="file" accept="image/*,.pdf" style={{ display: "none" }}
              onChange={e => e.target.files[0] && procesarArchivo(e.target.files[0])} />
          </label>
        )}

        {estado === "procesando" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "pulseLoader 1.5s infinite ease-in-out" }}>✨</div>
            <p style={{ fontWeight: 600, color: "var(--rosa-deep)", fontSize: 15 }}>{progreso}</p>
            <p style={{ fontSize: 12, color: "var(--mid)", marginTop: 8 }}>La IA está leyendo tu factura…</p>
          </div>
        )}

        {estado === "ok" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
            <p style={{ fontWeight: 700, color: "var(--success)", fontSize: 16 }}>{progreso}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "12px 0 20px" }}>
              {resumen.nuevos > 0 && (
                <span style={{ background: "#E8F5E9", color: "var(--success)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  ✨ {resumen.nuevos} nuevo{resumen.nuevos !== 1 ? "s" : ""}
                </span>
              )}
              {resumen.restock > 0 && (
                <span style={{ background: "#E3F2FD", color: "#1565C0", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  📦 {resumen.restock} restock
                </span>
              )}
            </div>
            <button onClick={onClose} style={{ background: "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 700, cursor: "pointer" }}>
              Ver borradores
            </button>
          </div>
        )}

        {estado === "error" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontWeight: 700, color: "var(--danger)", fontSize: 14, marginBottom: 8 }}>Error al procesar</p>
            <p style={{ fontSize: 12, color: "var(--mid)", background: "#FFEBEE", padding: "10px", borderRadius: 10, marginBottom: 20 }}>{errorMsg}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setEstado("idle"); setErrorMsg(""); }} style={{ flex: 1, background: "var(--creme)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px", fontWeight: 600, cursor: "pointer" }}>Intentar de nuevo</button>
              <button onClick={onClose} style={{ flex: 1, background: "var(--danger)", color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
