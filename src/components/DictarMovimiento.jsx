import { useState, useRef } from "react";
import { fmt, fmtNum, parseNum, CATEGORIAS_GASTO, CATEGORIAS_INGRESO } from "../utils.jsx";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

const PROMPT = (texto) => `Eres un extractor de datos para una app de finanzas personales en Colombia.
El usuario dictó por voz esta frase describiendo un movimiento de dinero: "${texto}"

Categorías de GASTO válidas: ${CATEGORIAS_GASTO.join(", ")}.
Categorías de INGRESO válidas: ${CATEGORIAS_INGRESO.join(", ")}.

Responde ÚNICAMENTE con un JSON, sin texto adicional, sin markdown:
{
  "tipo": "gasto",
  "monto": 45000,
  "categoria": "Alimentación",
  "descripcion": "resumen corto de lo que dijo"
}

Reglas:
- tipo: "gasto" si pagó/compró/gastó algo, "ingreso" si recibió/le pagaron/vendió algo
- monto: número entero sin puntos ni símbolos ("45 mil" → 45000, "cien mil" → 100000)
- categoria: la más cercana de la lista correspondiente al tipo
- Si no hay certeza del monto usa null
- NADA fuera del JSON`;

async function interpretarConGroq(texto) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.1,
      max_tokens: 256,
      messages: [{ role: "user", content: PROMPT(texto) }]
    })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  const contenido = data.choices?.[0]?.message?.content?.trim();
  if (!contenido) throw new Error("Groq no devolvió respuesta");
  const jsonStr = contenido.startsWith("{") ? contenido : contenido.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) throw new Error("La IA no devolvió JSON válido");
  return JSON.parse(jsonStr);
}

const SpeechRecognitionAPI = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function DictarMovimiento({ cuentas, onGuardar, onClose }) {
  const [estado, setEstado] = useState(SpeechRecognitionAPI ? "idle" : "no-soportado");
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [resultado, setResultado] = useState(null);
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id || "");
  const recognitionRef = useRef(null);

  const empezarEscucha = () => {
    setErrorMsg(""); setTranscript(""); setResultado(null);
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "es-CO";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setEstado("escuchando");
    recognition.onresult = (e) => {
      const texto = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setTranscript(texto);
    };
    recognition.onerror = (e) => { setEstado("error"); setErrorMsg("Error de micrófono: " + e.error); };
    recognition.onend = async () => {
      setTranscript(actual => {
        if (actual.trim()) procesarTexto(actual.trim());
        else setEstado("idle");
        return actual;
      });
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const detenerEscucha = () => recognitionRef.current?.stop();

  const procesarTexto = async (texto) => {
    if (!GROQ_KEY) { setEstado("error"); setErrorMsg("Falta VITE_GROQ_API_KEY."); return; }
    setEstado("procesando");
    try {
      const datos = await interpretarConGroq(texto);
      if (!datos.monto) throw new Error("No entendí el monto, intenta de nuevo siendo más específico");
      setResultado(datos);
      setEstado("confirmar");
    } catch (err) {
      setEstado("error"); setErrorMsg(err.message);
    }
  };

  const confirmar = () => {
    if (!resultado || !cuentaId) return;
    onGuardar({ ...resultado, cuentaId });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="animate" style={{ background: "#fff", borderRadius: 24, padding: 30, width: "90%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: "var(--primary-deep)", margin: 0 }}>Dictar movimiento</h3>
          <button onClick={onClose} style={{ background: "var(--bg)", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 18, color: "var(--mid)" }}>×</button>
        </div>

        {estado === "no-soportado" && (
          <p style={{ fontSize: 13, color: "var(--danger)", textAlign: "center", padding: "20px 0" }}>Tu navegador no soporta reconocimiento de voz. Probá en Chrome.</p>
        )}

        {estado === "idle" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 20 }}>Decí algo como "pagué 45 mil de mercado" o "recibí 200 mil de salario"</p>
            <button onClick={empezarEscucha} style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", border: "none", color: "#fff", fontSize: 28, cursor: "pointer" }}>🎤</button>
          </div>
        )}

        {estado === "escuchando" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <button onClick={detenerEscucha} className="pulsing" style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--danger)", border: "none", color: "#fff", fontSize: 28, cursor: "pointer" }}>🎤</button>
            <p style={{ fontSize: 13, color: "var(--mid)", marginTop: 16 }}>Escuchando… tocá pa terminar</p>
            {transcript && <p style={{ fontSize: 14, color: "var(--dark)", marginTop: 10, fontStyle: "italic" }}>"{transcript}"</p>}
          </div>
        )}

        {estado === "procesando" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "pulseLoader 1.5s infinite ease-in-out" }}>✨</div>
            <p style={{ fontWeight: 600, color: "var(--primary-deep)", fontSize: 15 }}>Interpretando "{transcript}"…</p>
          </div>
        )}

        {estado === "confirmar" && resultado && (
          <div>
            <div style={{ background: "var(--bg)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--mid)" }}>{resultado.tipo === "ingreso" ? "💰 Ingreso" : "💸 Gasto"}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: resultado.tipo === "ingreso" ? "var(--success)" : "var(--danger)" }}>{fmt(resultado.monto)}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--dark)", margin: 0 }}>{resultado.categoria} — {resultado.descripcion}</p>
            </div>
            <label style={{ fontSize: 11, color: "var(--mid)" }}>Cuenta</label>
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={{ marginBottom: 16 }}>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEstado("idle")} style={{ flex: 1, background: "var(--border)", color: "var(--dark)", border: "none", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Repetir</button>
              <button onClick={confirmar} disabled={!cuentaId} style={{ flex: 1, background: "linear-gradient(135deg, var(--success), #43A047)", color: "white", border: "none", padding: "12px", borderRadius: 12, fontWeight: 700 }}>✅ Guardar</button>
            </div>
          </div>
        )}

        {estado === "error" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 12, color: "var(--mid)", background: "#FFEBEE", padding: "10px", borderRadius: 10, marginBottom: 20 }}>{errorMsg}</p>
            <button onClick={() => setEstado("idle")} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 24px", fontWeight: 600, cursor: "pointer" }}>Intentar de nuevo</button>
          </div>
        )}
      </div>
    </div>
  );
}
