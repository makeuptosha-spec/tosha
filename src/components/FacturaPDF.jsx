import { fmt } from "../utils.jsx";

const R  = "#A855F7";
const RD = "#7E22CE";
const RS = "#D8B4FE";
const RP = "#F5F3FF";
const M  = "#7C6A9B";
const D  = "#1E1027";

export default function FacturaPDF({ factura }) {
  if (!factura) return null;

  const num          = String(factura.numeroFactura || 0).padStart(4, "0");
  const idFactura    = factura.numeroFactura ? `TOSHA-${num}` : `TK-${(factura.ticketId || "").slice(-6)}`;
  const cliente      = factura.clienteNombre || factura.clienteCredito || "";
  const telefono     = factura.clienteTelefono || "";
  const esCredito    = factura.formaPago === "Crédito";
  const cobrado      = factura.estadoCredito === "cerrado";

  return (
    <div id="factura-pdf-render" style={{ width: 620, background: "#fff", fontFamily: "'DM Sans', Arial, sans-serif", color: D, fontSize: 13 }}>

      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg, ${RD} 0%, ${R} 100%)`, padding: "30px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 40, color: "#fff", lineHeight: 1 }}>Tosha</div>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginTop: 6 }}>Cosméticos & Belleza · Colombia</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, letterSpacing: 3, textTransform: "uppercase" }}>Factura de Venta</div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: 1 }}>{idFactura}</div>
        </div>
      </div>

      {/* ACCENT LINE */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${RS}, ${R}, ${RS})` }} />

      {/* META */}
      <div style={{ padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", background: RP, borderBottom: `1px solid ${RS}` }}>
        <div>
          <div style={{ fontSize: 10, color: M, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Fecha de emisión</div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>
            {new Date(factura.fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
            {" · "}
            {new Date(factura.fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: M, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Método de pago</div>
          <div style={{ fontWeight: 700, color: RD, fontSize: 13 }}>{factura.formaPago}</div>
          {esCredito && !cobrado && <div style={{ fontSize: 10, color: "#E65100", fontWeight: 600, marginTop: 2 }}>⏳ Crédito pendiente</div>}
          {esCredito && cobrado  && <div style={{ fontSize: 10, color: "#2E7D32", fontWeight: 600, marginTop: 2 }}>✅ Crédito cobrado</div>}
        </div>
      </div>

      {/* PARTIES */}
      <div style={{ padding: "18px 40px", display: "flex", gap: 0, borderBottom: `1px solid ${RS}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: RD, fontWeight: 700, marginBottom: 8 }}>Vendedor</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Tosha</div>
          <div style={{ fontSize: 11, color: M, marginTop: 3 }}>Colombia</div>
        </div>
        {cliente && (
          <div style={{ flex: 1, borderLeft: `1px solid ${RS}`, paddingLeft: 28 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: RD, fontWeight: 700, marginBottom: 8 }}>Cliente</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{cliente}</div>
            {telefono && <div style={{ fontSize: 11, color: M, marginTop: 3 }}>📞 {telefono}</div>}
          </div>
        )}
      </div>

      {/* PRODUCTS */}
      <div style={{ padding: "18px 40px" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: RD, fontWeight: 700, marginBottom: 14 }}>Detalle de Productos</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${RS}` }}>
              {["Descripción", "Present.", "Cant.", "Precio", "Subtotal"].map((h, i) => (
                <th key={h} style={{ textAlign: i === 0 ? "left" : i >= 3 ? "right" : "center", fontSize: 10, color: M, fontWeight: 600, paddingBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factura.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: `1px solid ${RP}` }}>
                <td style={{ padding: "10px 0", fontSize: 12, fontWeight: 500 }}>{item.descripcion}</td>
                <td style={{ textAlign: "center", fontSize: 11, color: M, padding: "10px 4px" }}>{item.talla || "—"}</td>
                <td style={{ textAlign: "center", fontSize: 12, padding: "10px 4px" }}>{item.cantidad}</td>
                <td style={{ textAlign: "right", fontSize: 12, padding: "10px 0" }}>{fmt(item.precioFinal)}</td>
                <td style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: RD, padding: "10px 0" }}>{fmt(item.precioFinal * item.cantidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTAL */}
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ background: `linear-gradient(135deg, ${RD}, ${R})`, borderRadius: 12, padding: "16px 28px", minWidth: 210, textAlign: "right" }}>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Total a pagar</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 800, marginTop: 4, letterSpacing: -0.5 }}>{fmt(factura.total)}</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ margin: "0 40px", borderTop: `1px solid ${RS}` }} />
      <div style={{ padding: "18px 40px 28px", textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 18, color: R, marginBottom: 8 }}>¡Gracias por tu compra, hermosa! 💜</div>
        <div style={{ fontSize: 11, color: M }}>Colombia</div>
        <div style={{ fontSize: 10, color: R, marginTop: 4, letterSpacing: 1 }}>@toshabeauty</div>
      </div>
    </div>
  );
}
