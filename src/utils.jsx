import { useState, useEffect } from "react";

// ── UTILIDADES DE FORMATO Y FECHAS ──
export const fmt = (n) => {
  const num = Number(n);
  if (isNaN(num)) return "$ 0";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(num);
};

export const fmtNum = (n) => {
  const num = Number(n);
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("es-CO").format(num);
};

export const parseNum = (str) => String(str).replace(/\D/g, "");

export const hoyObj = new Date();
export const esHoy = (fechaISO) => {
  if (!fechaISO) return false;
  const d = new Date(fechaISO);
  return d.getDate() === hoyObj.getDate() && d.getMonth() === hoyObj.getMonth() && d.getFullYear() === hoyObj.getFullYear();
};
export const esEsteMes = (fechaISO) => {
  if (!fechaISO) return false;
  const d = new Date(fechaISO);
  return d.getMonth() === hoyObj.getMonth() && d.getFullYear() === hoyObj.getFullYear();
};

export const fmtFecha = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' });
};

export const comprimirImagen = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
    };
  });
};

// ── COMPONENTES BASE Y CARGADOR ──
export const LoaderInteractivo = () => {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const frases = [
      "Espantando hadas rabiosas 🧚‍♀️", "Manifestando ventas 😌🫰✨", "Sirena costeña besa rico 🧜‍♀️",
      "Abriendo ventanas 🌤️", "Cortando flores 🌷✂️", "Endulzando cafecito ☕🍯", "Alimentando mariposas 🦋",
      "Cosechando bendiciones 🌾✨", "Haciendo ojitos al universo 😉🌙", "Poniendo bonita la vida 🎀",
      "Recolectando sonrisas 🌸", "Organizando mis sueños 📖✨", "Floreciendo sin permiso 🌺", "Tomando solecito ☀️",
      "Sanando linajes con glamour 👑", "Cuidando mi jardín secreto 🌿", "Desayunando autoestima 🥐✨",
      "Enviando buena vibra por correo 📩💖", "Tejiendo milagritos 🧵✨", "Aprendiendo a brillar más ✨",
      "Contando estrellas 🌟", "Decorando pensamientos bonitos 🎨", "Coleccionando momentos felices 📸",
      "Haciendo magia doméstica 🏡🪄", "Besando la suerte 💋🍀", "Acariciando gatitos imaginarios 🐈✨",
      "Regando sueños 🌱", "Preparando el próximo éxito 💼✨", "Puliendo mi corona 👑", "Cazando arcoíris 🌈",
      "Afinando mi intuición 🔮", "Horneando felicidad 🍪", "Empacando abundancia 🎁✨", "Pintando nubes rosadas ☁️🎀",
      "Practicando mi sonrisa favorita 😊", "Conquistando metas silenciosamente 🤫✨", "Encendiendo velitas para mis deseos 🕯️",
      "Mimando mi alma 🌸", "Escribiendo capítulos bonitos 📚", "Bailando con el viento 💃🍃", "Repartiendo dulzura 🍬",
      "Aromatizando el ambiente 🌺", "Haciendo espacio para milagros ✨", "Coleccionando razones para agradecer 🙏",
      "Creciendo despacito 🌱", "Atrayendo oportunidades 💫", "Tomando agua como princesa 👸💧", "Dándole vacaciones al estrés 🏖️",
      "Afinando mi energía ✨", "Escuchando a las flores 🌷", "Cargando batería emocional 🔋💖", "Fabricando recuerdos bonitos 📷",
      "Encontrando tesoros cotidianos 💎", "Sonriendo por deporte 😌", "Enamorándome de mi vida 💕", "Encantando el ambiente ✨",
      "Enderezando la corona sin drama 👑", "Paseando pensamientos felices 🚶‍♀️🌸", "Haciendo acuerdos con la luna 🌙",
      "Repartiendo brillo ✨", "Tomando vitaminas y chisme sano 🍊☕", "Cultivando paz mental 🌿", "Diseñando mi mejor versión 🎀",
      "Recargando energía solar ☀️", "Abrazando mi proceso 🤍", "Organizando abundancia 💸✨", "Haciendo planes secretos con el destino 🤫",
      "Decorando mi día 🌷", "Practicando gratitud elegante ✨", "Consintiendo a mi niña interior 🎈", "Escuchando canciones que curan 🎶",
      "Arreglando el mundo desde mi cuarto 🌎", "Haciendo travesuras elegantes 🎀", "Entrenando mi paciencia 🧘‍♀️",
      "Creando momentos Pinterest 📌✨", "Hablando bonito conmigo misma 💕", "Activando modo diosa 👑✨", "Recibiendo regalos del universo 🎁",
      "Tomando aire de protagonista 🌸", "Sonriendo en femenino 💋", "Guardando secretos con las estrellas 🌟", "Estrenando energía bonita ✨",
      "Preparando sorpresas para mí 🎀", "Recolectando buena suerte 🍀", "Apapachando mi corazón 🤍", "Viviendo despacio y bonito 🌷",
      "Teñiendo el día de rosa 🎀", "Dejando miguitas de magia ✨", "Admirando atardeceres 🌅", "Inventando excusas para ser feliz 😌",
      "Celebrando pequeñas victorias 🥂✨", "Esparciendo encanto femenino 🌸", "Tomando café con actitud ☕💅", "Haciendo brillar mis proyectos 💼✨",
      "Cuidando mi paz como tesoro 💎", "Bendiciendo mis pasos 👣✨", "Escribiendo mi historia favorita 📖💕", "Viviendo como si fuera primavera 🌷",
      "Coqueteando con la abundancia 💸✨", "Siendo una girl top sin esfuerzo 👑💖✨", "Invocando mi poder secreto ✨🎀",
      "Protegiendo mi arco de personaje 🌸⚔️", "Esperando mi transformación mágica 🌙💖", "Coleccionando husbandos imposibles 🫰🌷",
      "Entrando en modo protagonista 🎐✨", "Corriendo tarde como en un anime 🍞🏃‍♀️", "Haciendo contacto visual de episodio 12 👀💕",
      "Acumulando puntos de experiencia ⭐🎮", "Cargando chakra 🍃✨", "Despertando mi energía kawaii 🎀🌸", "Buscando mi opening personal 🎶🌈",
      "Entrenando para el torneo de la amistad 🏆✨", "Huyendo de mis responsabilidades con estilo 🐇💨", "Activando el poder de la amistad 🤝💖",
      "Sobreviviendo al relleno de la semana 🍜📺", "Practicando poses innecesariamente épicas ⚔️✨", "Esperando mi momento de brillar 🌟",
      "Acumulando suerte gacha 🎰🍀", "Haciendo hechizos de chica mágica 🪄🌙", "Subiendo de nivel emocional 🎮💖",
      "Protegiendo mi paz interior como una waifu legendaria 🌸🛡️", "Recargando maná ☕✨", "Escuchando openings a volumen emocional 🎧🌈",
      "Desbloqueando nuevos outfits 🎀✨", "Perfeccionando mi mirada de anime 👀🌸", "Esperando el capítulo de mi vida donde todo mejora 📖✨",
      "Caminando como si sonara música épica detrás de mí 🌷🎶", "Esquivando dramas secundarios ⚡🌸", "Acumulando energía protagonista 🌟👑",
      "Practicando sonrisas de idol 🎤💖", "Derrotando villanos imaginarios ⚔️✨", "Haciendo cosplay mental todo el día 🎀🌙",
      "Buscando señales del destino anime 🍃💫", "Cultivando mi jardín kawaii 🌷🎀", "Tomando té como personaje elegante 🍵✨",
      "Reuniendo mi escuadrón de chicas mágicas 🌙💖", "Guardando secretos de temporada final 🤫🌸", "Viviendo en modo slice of life 🌼☁️",
      "Esperando una escena bajo los cerezos 🌸🌸", "Entrenando mi poder oculto ✨⚔️", "Acumulando ternura legendaria 🐰💖",
      "Decorando mi mundo con brillo kawaii 🎀✨", "Sobreanalizando cada mirada como protagonista de shojo 👀💞",
      "Flotando entre nubes y soundtrack de anime ☁️🎶", "Cazando criaturas mágicas imaginarias 🦊✨", "Preparando mi comeback de temporada 🎬🌷",
      "Tomando descansos estratégicos como una heroína 🌙💖", "Brillando con energía de personaje favorito ⭐🎀", "Haciendo pactos con gatos misteriosos 🐈✨",
      "Manifestando un episodio feliz 🌸🎬", "Viviendo mi arco de crecimiento personal 🌷📖", "Protegiendo mi energía como reliquia legendaria 💎✨",
      "Siendo una waifu de alto valor emocional 🎀",
      // ── acciones femeninas cotidianas ──
      "Eligiendo outfit número siete del día 👗✨", "Pintándome las uñas 💅🌸", "Buscando el labial que perdí 💄🔍",
      "Haciéndome las cejas con bisturí emocional 🪮✨", "Poniéndome crema como si fuera ritual sagrado 🧴💖",
      "Organizando el closet que va a quedar igual 🗂️", "Tomando foto al espejo diez veces 📸💁‍♀️",
      "Eligiendo los aretes del día como si fuera Oscar 💎✨", "Poniéndome mascarilla y asustando al gato 🎭🐈",
      "Cantando en la ducha sin vergüenza 🎤🚿", "Eligiendo playlist según mi humor del momento 🎧✨",
      "Mandando vocal de 11 minutos 🎙️💬", "Viendo outfits de Pinterest que nunca voy a usar 📌✨",
      "Probando la fragancia del día como sommelier 🌸👃", "Editando la foto antes de subirla 24 minutos 📱✨",
      "Consultando el horóscopo para tomar decisiones 🔮⭐", "Mandando memes a las amigas a las 2am 🤣💕",
      "Haciéndome un moño que quedó perfecto de milagro 🧶✨", "Cambiando el fondo de pantalla del celular 📱🎀",
      "Revisando wishlist que nunca voy a comprar 🛍️💸", "Mirando TikToks de outfits con piernas cruzadas 📱🛋️",
      "Probándome 8 outfits para ir al supermercado 👗👗", "Guardando recetas saludables que nunca voy a hacer 🥗📱",
      "Planeando viaje sin fecha ni presupuesto ✈️✨", "Comprando skincare que no necesito pero lo merezco 🧴💅",
      "Haciendo lista de propósitos del mes el día 28 📝✨", "Actualizando playlist del crush que ya no existe 💕🎵",
      "Buscando el perfume que huele a dinero 💸🌹", "Eligiendo canción para llorar con estilo 🎵😭✨",
      "Viendo tutoriales de maquillaje que no puedo replicar 💄📱", "Guardando recetas de cocina para no cocinarlas 👩‍🍳📱",
      "Haciendo ritual de skincare de 12 pasos a las 11pm 🧴🌙", "Decidiendo qué bolso usar en base a mi chakra 👜✨",
      "Revisando notificaciones tres veces en un minuto 📱🔄", "Cambiando de opinión sobre el outfit de mañana 👗🤔",
      "Guardando audios de amor propio para no escucharlos 🎙️💕", "Cantando a todo volumen con la ventana abajo 🚗🎤",
      "Buscando el mejor ángulo como profesional 📸🌟", "Mirando el closet como si no supiera qué hay 👀👗",
      "Retocando el labial que quedaba perfecto 💄✨", "Haciéndome un top knot y llamándolo 'look casual' 🧶💁‍♀️",
      "Perfumando hasta las pestañas 🌸✨", "Eligiendo serie para no ver porque me quedé dormida 📺😴",
      "Respondiendo el mensaje 4 horas después 'acabo de ver' 📱😅", "Reorganizando carpeta de memes 🗂️🤣",
      "Guardando pines de habitaciones que no tengo 📌🏠✨", "Comprando vela que huele a librería en lluvia 🕯️📚",
      "Tomando cafecito con actitud de protagonista ☕💅", "Mirando fotos antiguas y diciendo 'qué bonita era' 📸💕",
      "Haciendo lista de cosas que ya hice para tacharlas ✅📝", "Cantando en el carro como si hubiera cámara 🎤🚗",
      "Comprando cuadernos aunque tenga diez sin usar 📓✨", "Redecorar el cuarto moviendo solo una cosa 🏠✨",
      "Mandando sticker en vez de responder 🎀📱", "Pidiéndole al universo estacionamiento cercano 🅿️🙏✨",
      "Eligiendo film de nail art por 40 minutos 💅🎨", "Haciendo GRWM mental antes de salir 💄✨",
      "Rezando por el Wi-Fi de alguien más 📶🙏", "Abriendo el fridge esperando que aparezca algo nuevo 🧊🔍",
      "Guardando screenshot de look para nunca usarlo 📸🗂️", "Tomando agua con limón y sintiéndome influencer 💧🍋✨",
      "Eligiendo qué ver en Netflix en vez de dormir 🎬😴", "Leyendo reseñas de hotel que no voy a reservar 🏨✨",
      "Buscando receta de brownie para no hacerlo 🍫📱", "Preguntándole a mi amiga si el mensaje sonó pasivo-agresivo 📱😬",
      "Creando álbum de Spotify con nombre poético para 3 canciones 🎵✨", "Comprando planta que voy a olvidar regar 🌿💸",
      "Dándole like a mis propias fotos desde otra cuenta 💅📱", "Dibujando 'ella' en el cuaderno de reuniones 📓✨",
      "Probando si mi perfume es compatible con el del crush 🌹💕", "Haciendo yoga mental sin moverme del sofá 🧘‍♀️🛋️",
      "Calculando cuánto pierdo si cancelo el gym hoy 🏋️‍♀️💸", "Eligiendo emoji de respuesta durante 3 minutos 💭📱",
      "Buscando looks de 'chica que tiene todo bajo control' 👗✨", "Diciéndole a la planta que la amo 🌿💕",
      "Escogiendo qué borrar del cel para la foto nueva 🗑️📱", "Probando si el labial dura con vaso de agua 💄💧",
      "Buscando el pelo de un chip en el espejo 🪞🔍", "Oliendo ropa para ver si puede durar un día más 👃👗✨",
      "Eligiendo color de esmalte como si cambiara mi destino 💅🔮", "Contando cuántos días quedan para el viernes 📅✨",
      "Armando el carrito de compras online para no comprarlo 🛒💕", "Respondiendo encuesta de Netflix como si importara 📺📊",
      "Borrando y reescribiendo caption cinco veces 📱✍️", "Tomando selfie sin flash y llamándolo 'natural' 📸🌿",
      "Guardando memes de motivación que no aplico 💪📱", "Mandando corazón en vez de responder el mensaje largo 💕📱",
      "Pidiendo opinión sobre el outfit a todas menos a quien me lo critiquen 👗💬", "Viendo reels de perritos cuando debería estar trabajando 🐾📱",
      "Cantando en la cola del supermercado en voz baja 🎤🛒", "Eligiendo que el próximo lunes sí empiezo 📅💪✨",
      "Buscando canción que escuché en tienda hace 3 años 🎵🔍", "Haciéndome spa en casa con lo que había en la cocina 🛁🍯✨",
      "Tomando agua de moras y llamándolo detox 🫐💧✨", "Armando outfit de 'no me esforcé' que tardó 45 minutos 👗✨",
      "Guardando número de pizza para 'emergencias' 🍕📱", "Eligiendo font del cartel que nadie va a ver 🖊️✨",
      "Mirando si me queda bien el color morado 💜👗", "Hablando conmigo misma como si fuera entrevista 🎤💭✨",
      "Buscando el clip de cabello en el fondo del bolso 👜🔍", "Organizando el bolso por tercera vez esta semana 👜✨",
      "Descubriendo que tengo ropa que no sabía que tenía 🤩👗", "Prometiéndome que esta vez sí uso el diario 📔✨",
      "Eligiendo vela aromática según mi estado emocional 🕯️🌸", "Mirando el cielo y haciendo petición específica ☁️🙏✨",
      "Decidiendo si el mensaje fue leído o ignorado 📱👀", "Buscando video de ASMR de tiendas de ropa 🎧🛍️✨",
      "Probando si el look dice 'busy but make it fashion' 💼👗✨"
    ];
    const ciclo = setInterval(() => setMsg(frases[Math.floor(Math.random() * frases.length)]), 2200);
    setMsg(frases[Math.floor(Math.random() * frases.length)]);
    return () => clearInterval(ciclo);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--creme)', padding: 20, textAlign: 'center' }}>
      <div className="pulsing" style={{ fontSize: 50, marginBottom: 20 }}>💜</div>
      <p style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: 'var(--rosa-deep)', maxWidth: 320, lineHeight: 1.4 }}>{msg}</p>
    </div>
  );
};

export const Badge = ({ children, variant = "default" }) => {
  const styles = { default: { background: "var(--rosa-pale)", color: "var(--rosa-deep)" }, success: { background: "#E8F5E9", color: "var(--success)" }, warn: { background: "#FFF3E0", color: "var(--warn)" }, danger: { background: "#FFEBEE", color: "var(--danger)" } };
  return <span style={{ ...styles[variant], display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>{children}</span>;
};

export const Icon = ({ name, size = 18 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    inventory:  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    sales:      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    search:     <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    alert:      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    trending:   <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    plus:       <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    check:      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
    tag:        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    money:      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    close:      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    logout:     <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    image:      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    trash:      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    calendar:   <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    chart:      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  };
  return icons[name] || null;
};

export const StatCard = ({ icon, label, value, sub, color = "var(--rosa)" }) => (
  <div className="animate" style={{ background: "var(--white)", borderRadius: 20, padding: "20px 22px", boxShadow: "var(--shadow)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--mid)", letterSpacing: 0.5 }}>{label}</span>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: color + "18", color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} /></span>
    </div>
    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: "var(--dark)", lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "var(--mid)" }}>{sub}</div>}
  </div>
);

export const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --rosa:      #A855F7;
    --rosa-deep: #7E22CE;
    --rosa-soft: #D8B4FE;
    --rosa-pale: #F5F3FF;
    --creme:     #FAF8FF;
    --dark:      #1E1027;
    --mid:       #7C6A9B;
    --border:    #EDE9FE;
    --success:   #2E7D32;
    --warn:      #E65100;
    --danger:    #C62828;
    --white:     #FFFFFF;
    --shadow:    0 4px 24px rgba(126,34,206,0.10);
    --shadow-lg: 0 8px 40px rgba(126,34,206,0.16);
  }

  body { font-family: 'DM Sans', sans-serif; background: var(--creme); color: var(--dark); overflow-x: hidden; }

  input, select, textarea {
    font-family: 'DM Sans', sans-serif; outline: none; border: 1.5px solid var(--border);
    border-radius: 12px; padding: 10px 14px; font-size: 14px; background: var(--white);
    color: var(--dark); transition: border-color 0.2s, box-shadow 0.2s; width: 100%;
  }
  input:focus, select:focus { border-color: var(--rosa); box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }
  button { cursor: pointer; font-family: 'DM Sans', sans-serif; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--rosa-pale); }
  ::-webkit-scrollbar-thumb { background: var(--rosa-soft); border-radius: 10px; }

  @keyframes slideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulseLoader { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
  .animate { animation: slideIn 0.35s ease both; }
  .pulsing { animation: pulseLoader 1.5s infinite ease-in-out; }

  .img-zoom-container { position: relative; width: 50px; height: 50px; border-radius: 8px; overflow: visible; z-index: 1; }
  .img-zoom-container img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: pointer; }
  .img-zoom-container:hover img { transform: scale(3.5) translate(25%, 0%); box-shadow: var(--shadow-lg); z-index: 100; position: absolute; }

  .app-wrapper { max-width: 430px; margin: 0 auto; min-height: 100vh; position: relative; padding-bottom: 90px; transition: all 0.3s ease; }
  .nav-menu { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: rgba(255,255,255,0.95); backdrop-filter: blur(16px); border-top: 1px solid var(--border); display: flex; padding: 10px 0 20px; z-index: 1000; transition: all 0.3s ease; }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; border: none; background: transparent; padding: 4px 0; transition: color 0.2s; }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .desktop-flex { display: flex; flex-direction: column; gap: 20px; }

  @media (min-width: 768px) {
    .app-wrapper { max-width: 1200px; padding-bottom: 30px; padding-left: 120px; padding-top: 20px; }
    .nav-menu { left: 0; top: 0; bottom: 0; width: 100px; max-width: none; transform: none; flex-direction: column; justify-content: flex-start; padding-top: 40px; gap: 30px; border-top: none; border-right: 1px solid var(--border); box-shadow: 2px 0 10px rgba(0,0,0,0.03); }
    .nav-item { flex: none; width: 100%; }
    .stats-grid { grid-template-columns: repeat(4, 1fr); }
    .form-grid { grid-template-columns: repeat(4, 1fr); }
    .desktop-flex { flex-direction: row; align-items: flex-start; }
    .desktop-flex > div { flex: 1; }
    .img-zoom-container:hover img { transform: scale(4) translate(30%, -10%); }
  }

  /* NUEVO CSS DE IMPRESIÓN */
  #recibo-imprimible { display: none; }
  @media print {
    @page { margin: 0; }
    body { background: white; padding: 1.5cm; }
    body * { visibility: hidden; }
    #recibo-imprimible { display: block !important; visibility: visible; position: absolute; left: 0; top: 0; width: 100%; padding: 40px; font-family: monospace; color: black; background: white; }
    #recibo-imprimible * { visibility: visible; }
  }
`;