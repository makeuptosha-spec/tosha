import { useState } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { CATEGORIAS_GASTO, HOGAR_ID } from "../utils.jsx";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

const PROMPT = `Eres un extractor de datos para recibos y facturas de gastos personales en Colombia.
Analiza esta imagen de un recibo, factura o comprobante de pago y extrae la información de la compra.

Categorías válidas (usa la que más se acerque): ${CATEGORIAS_GASTO.join(", ")}.

Responde ÚNICAMENTE con un JSON, sin texto adicional, sin markdown:
{
  "comercio": "nombre del negocio o establecimiento",
  "monto": 45000,
  "fecha": "2026-08-09",
  "categoriaSugerida": "Alimentación",
  "descripcion": "breve resumen de la compra"
}

Reglas:
- monto: número entero sin puntos ni símbolos (45000 no $45.000), es el TOTAL pagado
- fecha: formato YYYY-MM-DD si aparece en el recibo, si no usa null
- categoriaSugerida: debe ser EXACTAMENTE una de las categorías listadas arriba
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
      max_tokens: 512,
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
  const jsonStr = texto.startsWith("{") ? texto : texto.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) throw new Error("La IA no devolvió JSON válido");
  return JSON.parse(jsonStr);
}

export default function EscanearRecibo({ onBorradorCreado, onClose }) {
  const [estado, setEstado]   = useState("idle");
  const [progreso, setProgreso] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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

      setProgreso("Analizando recibo con IA…");
      const datos = await llamarGroq(base64, mediaType);
      if (!datos.monto) throw new Error("No se pudo leer el monto del recibo");

      await addDoc(collection(db, "borradores"), {
        ...datos,
        tipo: "gasto",
        estado: "pendiente",
        fecha: datos.fecha || new Date().toISOString().slice(0, 10),
        categoriaSugerida: CATEGORIAS_GASTO.includes(datos.categoriaSugerida) ? datos.categoriaSugerida : "Otros",
        hogarId: HOGAR_ID, uid: auth.currentUser.uid,
        fechaCreacion: new Date().toISOString()
      });

      setEstado("ok");
      setProgreso("¡Recibo procesado!");
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
      <div className="animate" style={{ background: "var(--white)", borderRadius: 24, padding: 30, width: "90%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: "var(--primary-deep)", margin: 0 }}>Escanear Recibo</h3>
            <p style={{ fontSize: 12, color: "var(--mid)", margin: "4px 0 0" }}>PNG, JPG o PDF — la IA extrae todo</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg)", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 18, color: "var(--mid)" }}>×</button>
        </div>

        {estado === "idle" && (
          <label onDrop={onDrop} onDragOver={e => e.preventDefault()}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, border: "2px dashed var(--primary-soft)", borderRadius: 16, padding: "32px 20px", cursor: "pointer", background: "var(--primary-pale)", textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🧾</div>
            <p style={{ fontWeight: 700, color: "var(--primary-deep)", margin: 0 }}>Arrastra aquí tu recibo</p>
            <p style={{ fontSize: 12, color: "var(--mid)", margin: 0 }}>o haz clic para seleccionar</p>
            <span style={{ background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", borderRadius: 10, padding: "10px 24px", fontWeight: 700, fontSize: 13 }}>
              Seleccionar archivo
            </span>
            <input type="file" accept="image/*,.pdf" style={{ display: "none" }}
              onChange={e => e.target.files[0] && procesarArchivo(e.target.files[0])} />
          </label>
        )}

        {estado === "procesando" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "pulseLoader 1.5s infinite ease-in-out" }}>✨</div>
            <p style={{ fontWeight: 600, color: "var(--primary-deep)", fontSize: 15 }}>{progreso}</p>
            <p style={{ fontSize: 12, color: "var(--mid)", marginTop: 8 }}>La IA está leyendo tu recibo…</p>
          </div>
        )}

        {estado === "ok" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
            <p style={{ fontWeight: 700, color: "var(--success)", fontSize: 16 }}>{progreso}</p>
            <button onClick={onClose} style={{ marginTop: 20, background: "linear-gradient(135deg, var(--success), #43A047)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 700, cursor: "pointer" }}>
              Revisar y confirmar
            </button>
          </div>
        )}

        {estado === "error" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontWeight: 700, color: "var(--danger)", fontSize: 14, marginBottom: 8 }}>Error al procesar</p>
            <p style={{ fontSize: 12, color: "var(--mid)", background: "var(--danger-bg)", padding: "10px", borderRadius: 10, marginBottom: 20 }}>{errorMsg}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setEstado("idle"); setErrorMsg(""); }} style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px", fontWeight: 600, cursor: "pointer" }}>Intentar de nuevo</button>
              <button onClick={onClose} style={{ flex: 1, background: "var(--danger)", color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
