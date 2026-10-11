import type { ToolKind } from "@/lib/types";

export type ProductType = "app" | "web" | "both";
export type Applies = "app" | "web" | "all";

export type TaskLink =
  | { kind: ToolKind; section?: string; label: string }
  | { page: LaunchPageId; label: string };

export type LaunchTask = {
  id: string;
  stage: StageId;
  title: string;
  why: string;
  how: string[];
  applies: Applies;
  link?: TaskLink;
};

export type StageId = "prepare" | "launch" | "traction" | "monetize" | "measure" | "scale";

export type LaunchStage = {
  id: StageId;
  label: string;
  goal: string;
  color: string;
};

export type LaunchPageId = "roadmap" | "channels" | "metrics" | "pricing";

export const STAGES: LaunchStage[] = [
  { id: "prepare", label: "Preparar", goal: "Que tu producto esté listo para que un desconocido lo use y confíe.", color: "#6366f1" },
  { id: "launch", label: "Lanzar", goal: "Que el mundo se entere el mismo día, en los sitios correctos.", color: "#0ea5e9" },
  { id: "traction", label: "Tracción", goal: "Un flujo constante de usuarios nuevos que no dependa de ti.", color: "#0d9488" },
  { id: "monetize", label: "Monetizar", goal: "Que los usuarios que obtienen valor paguen por él.", color: "#f2545b" },
  { id: "measure", label: "Medir", goal: "Decidir con datos y con lo que dicen tus usuarios.", color: "#f59e0b" },
  { id: "scale", label: "Escalar", goal: "Convertir el proyecto en una empresa que funciona sin ti al 100%.", color: "#7c3aed" },
];

export const TASKS: LaunchTask[] = [
  {
    id: "legal",
    stage: "prepare",
    title: "Publica política de privacidad y términos",
    why: "Las tiendas y los pagos lo exigen, y los usuarios lo buscan antes de registrarse.",
    how: ["Genera los textos legales de tu app.", "Enlázalos en el footer, en el registro y en la ficha de tienda."],
    applies: "all",
    link: { kind: "miapp", section: "legal", label: "Abrir legal" },
  },
  {
    id: "store-listing",
    stage: "prepare",
    title: "Ficha de tienda con screenshots que venden",
    why: "Los screenshots deciden más descargas que la descripción.",
    how: ["La primera captura cuenta el beneficio, no la función.", "Texto grande, una idea por captura.", "Prepara versiones para iPhone y Android."],
    applies: "app",
    link: { kind: "miapp", section: "screenshots", label: "Crear screenshots" },
  },
  {
    id: "landing",
    stage: "prepare",
    title: "Landing con una sola promesa y un solo botón",
    why: "Si en 5 segundos no se entiende qué haces y para quién, se van.",
    how: ["Titular: el resultado que obtiene tu cliente.", "Prueba visual: demo, GIF o captura real.", "Un CTA principal arriba y repetido abajo."],
    applies: "web",
  },
  {
    id: "public-page",
    stage: "prepare",
    title: "Publica la página de tu producto",
    why: "Necesitas un enlace al que mandar a la gente desde cada canal, y una forma de guardar a los interesados.",
    how: ["Escribe la frase principal: el resultado que obtiene tu cliente.", "Añade los enlaces a la web o a las tiendas.", "Activa la recogida de emails y publica."],
    applies: "all",
    link: { kind: "page", label: "Abrir Página" },
  },
  {
    id: "aso",
    stage: "prepare",
    title: "Investiga keywords y competidores",
    why: "Saber qué buscan y qué ya existe te dice cómo posicionarte.",
    how: ["Revisa las apps top de tu categoría.", "Lee sus reseñas de 1–3 estrellas: ahí está tu oportunidad.", "Elige 3–5 keywords para nombre y subtítulo."],
    applies: "all",
    link: { kind: "market", label: "Abrir Market" },
  },
  {
    id: "analytics",
    stage: "prepare",
    title: "Mide los 3 eventos que importan",
    why: "Sin datos no sabrás dónde se cae la gente.",
    how: ["Registro, activación (el momento aha) y pago.", "PostHog, Mixpanel o Firebase sirven para empezar.", "Comprueba que los eventos llegan antes de lanzar."],
    applies: "all",
  },
  {
    id: "support",
    stage: "prepare",
    title: "Correo de soporte en tu dominio",
    why: "hola@tuapp.com da confianza; un gmail personal no.",
    how: ["Crea soporte@ o hola@ en tu dominio.", "Conéctalo para responder desde un solo sitio."],
    applies: "all",
    link: { kind: "emails", label: "Conectar correo" },
  },
  {
    id: "launch-date",
    stage: "launch",
    title: "Pon fecha de lanzamiento",
    why: "Sin fecha, siempre habrá una cosa más que pulir.",
    how: ["Elige un martes o miércoles.", "Cuenta hacia atrás y reparte las tareas.", "Anúncialo para comprometerte."],
    applies: "all",
  },
  {
    id: "launch-assets",
    stage: "launch",
    title: "Prepara los materiales: video, GIF e imágenes",
    why: "Un video de 30 segundos explica más que cualquier texto.",
    how: ["Demo vertical de 15–30s para redes.", "GIF corto para directorios.", "Logo e imágenes en alta resolución."],
    applies: "all",
    link: { kind: "marketing", label: "Abrir Studio" },
  },
  {
    id: "socials",
    stage: "launch",
    title: "Crea y conecta tus redes",
    why: "El día del lanzamiento la gente buscará tu marca.",
    how: ["Reserva el mismo @ en TikTok, Instagram y X.", "Bio con la promesa y enlace.", "Publica 3–5 posts antes de lanzar."],
    applies: "all",
    link: { kind: "redes", label: "Abrir Redes" },
  },
  {
    id: "launch-channels",
    stage: "launch",
    title: "Elige tus 5 canales de lanzamiento",
    why: "Lanzar en todos lados a la vez no funciona; elige donde está tu cliente.",
    how: ["Márcalos en Canales.", "Prepara el texto de cada uno con antelación.", "Reparte los lanzamientos en 2 semanas."],
    applies: "all",
    link: { page: "channels", label: "Ver canales" },
  },
  {
    id: "warm-list",
    stage: "launch",
    title: "Avisa a tu gente antes que a nadie",
    why: "Los primeros votos y reseñas vienen de quien ya te conoce.",
    how: ["Lista de 50 personas: amigos, beta testers, comunidad.", "Mensaje personal, no masivo.", "Pídeles una acción concreta (votar, reseñar, compartir)."],
    applies: "all",
  },
  {
    id: "content",
    stage: "traction",
    title: "Contenido corto 3 veces por semana",
    why: "El vídeo corto es el canal orgánico más barato hoy.",
    how: ["Formato repetible: problema → app → resultado.", "Varias cuentas por nicho si tienes capacidad.", "Mide qué formatos retienen y repite."],
    applies: "all",
    link: { kind: "viewtracker", label: "Abrir Marketing" },
  },
  {
    id: "ugc",
    stage: "traction",
    title: "Prueba creadores e influencers (UGC)",
    why: "Una cara humana convierte mejor que una captura de pantalla.",
    how: ["Empieza con micro-creadores de tu nicho.", "Dales un guion de 3 frases, no un anuncio.", "Paga por video, no por seguidores."],
    applies: "all",
    link: { kind: "marketing", label: "Abrir Studio" },
  },
  {
    id: "reviews",
    stage: "traction",
    title: "Pide reseñas en el momento correcto",
    why: "Más y mejores reseñas suben tu ranking y la conversión de la ficha.",
    how: ["Pídela justo después de un éxito del usuario.", "Usa el diálogo nativo (SKStoreReviewController / In-App Review).", "Responde a todas las reseñas negativas."],
    applies: "app",
  },
  {
    id: "pricing",
    stage: "monetize",
    title: "Define tus precios con números",
    why: "Cobrar poco es el error más común de los fundadores.",
    how: ["Calcula costes por usuario y punto de equilibrio.", "Ancla con un plan anual.", "Sube precios antes de lo que crees."],
    applies: "all",
    link: { page: "pricing", label: "Abrir calculadora" },
  },
  {
    id: "payments",
    stage: "monetize",
    title: "Conecta pagos",
    why: "Sin forma de pagar no hay negocio, aunque haya usuarios.",
    how: ["Apps: compras in-app con RevenueCat o StoreKit.", "Web: Stripe Checkout o Lemon Squeezy.", "Prueba una compra real de principio a fin."],
    applies: "all",
  },
  {
    id: "north-star",
    stage: "measure",
    title: "Registra tu métrica norte cada semana",
    why: "Lo que se mide cada semana mejora; lo que no, se olvida.",
    how: ["Usuarios activos, clientes de pago y MRR.", "Mismo día cada semana.", "Mira la tendencia, no el número aislado."],
    applies: "all",
    link: { page: "metrics", label: "Registrar semana" },
  },
  {
    id: "localize",
    stage: "scale",
    title: "Traduce a 2–3 idiomas más",
    why: "Abrir mercados nuevos con el mismo producto es crecimiento barato.",
    how: ["Empieza por inglés, español y portugués.", "Traduce también la ficha de tienda y los screenshots.", "Ajusta precios por país."],
    applies: "all",
    link: { kind: "miapp", section: "screenshots", label: "Screenshots por idioma" },
  },
];

export function appliesTo(applies: Applies, type: ProductType | null): boolean {
  if (!type || type === "both" || applies === "all") return true;
  return applies === type;
}

export type ChannelKind = "directory" | "community" | "social" | "store" | "press";
export type ChannelStatus = "todo" | "planned" | "launched" | "skipped";

export type LaunchChannel = {
  id: string;
  name: string;
  url: string;
  kind: ChannelKind;
  applies: Applies;
  effort: "bajo" | "medio" | "alto";
  tip: string;
};

export const CHANNEL_KIND_LABEL: Record<ChannelKind, string> = {
  directory: "Directorio",
  community: "Comunidad",
  social: "Red social",
  store: "Tienda",
  press: "Prensa y newsletters",
};

export const CHANNEL_STATUS_LABEL: Record<ChannelStatus, string> = {
  todo: "Pendiente",
  planned: "Programado",
  launched: "Lanzado",
  skipped: "Descartado",
};

export const CHANNELS: LaunchChannel[] = [
  { id: "producthunt", name: "Product Hunt", url: "https://www.producthunt.com/launch", kind: "directory", applies: "all", effort: "alto", tip: "Lanza a las 00:01 PST de martes a jueves. Prepara galería, video y el primer comentario del maker." },
  { id: "show-hn", name: "Show HN (Hacker News)", url: "https://news.ycombinator.com/showhn.html", kind: "community", applies: "web", effort: "medio", tip: "Título sobrio “Show HN: X – hace Y”. Cuenta lo técnico y responde a todo con humildad." },
  { id: "reddit-sideproject", name: "r/SideProject", url: "https://www.reddit.com/r/SideProject/", kind: "community", applies: "all", effort: "bajo", tip: "Comparte la historia y lo que aprendiste, no solo el enlace." },
  { id: "indiehackers", name: "Indie Hackers", url: "https://www.indiehackers.com/", kind: "community", applies: "all", effort: "bajo", tip: "Publica cifras reales (usuarios, ingresos). La transparencia genera conversación." },
  { id: "x-bip", name: "X · Build in public", url: "https://x.com/", kind: "social", applies: "all", effort: "medio", tip: "Hilo con el antes/después, capturas y números. Etiqueta a quien te inspiró." },
  { id: "linkedin", name: "LinkedIn", url: "https://www.linkedin.com/", kind: "social", applies: "all", effort: "bajo", tip: "Funciona muy bien para B2B. Historia personal + captura del producto." },
  { id: "tiktok", name: "TikTok / Reels / Shorts", url: "https://www.tiktok.com/", kind: "social", applies: "all", effort: "alto", tip: "Varios videos cortos el mismo día. El gancho en los primeros 2 segundos." },
  { id: "betalist", name: "BetaList", url: "https://betalist.com/submit", kind: "directory", applies: "all", effort: "bajo", tip: "Ideal antes del lanzamiento oficial para captar early adopters." },
  { id: "uneed", name: "Uneed", url: "https://www.uneed.best/submit-a-tool", kind: "directory", applies: "all", effort: "bajo", tip: "Lanzamientos diarios con ranking; buena alternativa a Product Hunt." },
  { id: "alternativeto", name: "AlternativeTo", url: "https://alternativeto.net/", kind: "directory", applies: "all", effort: "bajo", tip: "Añádete como alternativa a los líderes de tu categoría." },
  { id: "appstore-featuring", name: "App Store · Nominación para destacar", url: "https://developer.apple.com/contact/app-store/promote/", kind: "store", applies: "app", effort: "medio", tip: "Nomina tu app o actualización 2–3 semanas antes. Apple valora diseño y uso de funciones nativas." },
  { id: "play-featuring", name: "Google Play · Formulario de destacados", url: "https://play.google.com/console/about/programs/", kind: "store", applies: "app", effort: "medio", tip: "Revisa los programas de Play Console para apps independientes." },
];

export const FEEDBACK_SOURCES = ["Email", "Reseña", "Entrevista", "Redes", "Soporte", "Otro"] as const;
export const FEEDBACK_STATUSES = ["new", "planned", "progress", "done", "declined"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Nuevo",
  planned: "Planeado",
  progress: "En progreso",
  done: "Hecho",
  declined: "Descartado",
};

export type LaunchProfile = {
  product_type: ProductType | null;
  launch_date: string | null;
  goal_mrr: number | null;
  pitch: string | null;
};

export type ChannelState = {
  status: ChannelStatus;
  planned_for: string | null;
  url: string | null;
  result: string | null;
};

export type FeedbackItem = {
  id: string;
  title: string;
  detail: string | null;
  source: string | null;
  votes: number;
  status: FeedbackStatus;
  created_at: string;
};

export type MetricWeek = {
  week_start: string;
  visitors: number | null;
  signups: number | null;
  active_users: number | null;
  paying: number | null;
  mrr: number | null;
};

export type LaunchState = {
  profile: LaunchProfile;
  tasks: Record<string, string>;
  channels: Record<string, ChannelState>;
  feedback: FeedbackItem[];
  metrics: MetricWeek[];
  context?: { name: string; tagline: string | null; url: string | null };
};

export const TASK_IDS = new Set(TASKS.map((t) => t.id));
export const CHANNEL_IDS = new Set(CHANNELS.map((c) => c.id));

export function visibleTasks(type: ProductType | null) {
  return TASKS.filter((t) => appliesTo(t.applies, type));
}

/** First unfinished task in stage order. */
export function nextTasks(state: Pick<LaunchState, "profile" | "tasks">, limit = 3) {
  return visibleTasks(state.profile.product_type).filter((t) => !state.tasks[t.id]).slice(0, limit);
}

export function currentStage(state: Pick<LaunchState, "profile" | "tasks">): LaunchStage {
  const next = nextTasks(state, 1)[0];
  return STAGES.find((s) => s.id === next?.stage) ?? STAGES[STAGES.length - 1];
}
