import { useState } from "react";
import { Icon } from "../utils.jsx";

export const ONBOARDING_KEY = "mf_onboarding_visto";

const PASOS = [
  {
    icon: "💰", titulo: "Bienvenido a Mis Finanzas",
    texto: "Control personal de ingresos, gastos, cuentas y metas — todo en un solo lugar. Te mostramos rapidito cómo funciona cada parte."
  },
  {
    icon: "dashboard", titulo: "Inicio",
    texto: "Tu resumen: balance total de todas tus cuentas, ingresos y gastos del mes, gráfica de evolución, facturas próximas a vencer y presupuestos cerca del límite."
  },
  {
    icon: "chart", titulo: "Movimientos",
    texto: "Registrá ingresos y gastos a mano, o más rápido: escaneá un recibo con la cámara (🧾) o dictalo por voz (🎤) — la IA interpreta el monto y la categoría solita."
  },
  {
    icon: "wallet", titulo: "Cuentas",
    texto: "Efectivo, banco, tarjetas — cada una con su saldo calculado en tiempo real. Hacé transferencias entre cuentas o ajustá el saldo si no cuadra con el banco (⚖️)."
  },
  {
    icon: "receipt", titulo: "Facturas",
    texto: "Tus pagos fijos mensuales (arriendo, servicios, suscripciones) con estado pagada/pendiente/vencida. Tocá el botón de arriba pa cambiar a \"Préstamos y deudas\" — llevá el control de lo que debés o te deben."
  },
  {
    icon: "target", titulo: "Metas",
    texto: "Ponele límite mensual a tus categorías de gasto. Tocá el botón de arriba pa cambiar a \"Ahorro\" — creá metas de ahorro con objetivo y fecha, y aportá cuando quieras."
  },
];

export default function OnboardingTour({ onFinish }) {
  const [paso, setPaso] = useState(0);
  const esUltimo = paso === PASOS.length - 1;
  const actual = PASOS[paso];

  const cerrar = () => { localStorage.setItem(ONBOARDING_KEY, "1"); onFinish(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="animate" style={{ background: "var(--white)", borderRadius: 24, padding: "32px 28px", width: "100%", maxWidth: 400, textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--primary-pale)", color: "var(--primary-deep)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>
          {actual.icon.length <= 2 ? actual.icon : <Icon name={actual.icon} size={32} />}
        </div>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: "var(--dark)", marginBottom: 10 }}>{actual.titulo}</h3>
        <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.6, marginBottom: 24 }}>{actual.texto}</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
          {PASOS.map((_, i) => (
            <div key={i} style={{ width: i === paso ? 20 : 6, height: 6, borderRadius: 3, background: i === paso ? "var(--primary)" : "var(--border)", transition: "all 0.2s" }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {paso > 0 && (
            <button onClick={() => setPaso(p => p - 1)} style={{ flex: 1, background: "var(--bg)", color: "var(--mid)", border: "1px solid var(--border)", padding: "12px", borderRadius: 12, fontWeight: 600 }}>Atrás</button>
          )}
          <button onClick={() => esUltimo ? cerrar() : setPaso(p => p + 1)}
            style={{ flex: 2, background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", color: "#fff", border: "none", padding: "12px", borderRadius: 12, fontWeight: 700 }}>
            {esUltimo ? "¡Empezar!" : "Siguiente"}
          </button>
        </div>
        {!esUltimo && (
          <button onClick={cerrar} style={{ marginTop: 14, background: "transparent", border: "none", color: "var(--mid)", fontSize: 12, textDecoration: "underline" }}>Saltar tour</button>
        )}
      </div>
    </div>
  );
}
