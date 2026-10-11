import { has, type Answers } from "@/lib/onboarding/questions";


export type ProductType = "app" | "web" | "both";
export type Applies = "app" | "web" | "all";

export type PlanView = "today" | "create" | "publish" | "creators" | "results" | "ideas" | "miapp" | "page";

export type TaskLink = { view: PlanView; params?: Record<string, string>; label: string };

export type LaunchTask = {
  id: string;
  stage: StageId;
  title: string;
  why: string;
  how: string[];
  applies: Applies;
  link?: TaskLink;
  when?: (answers: Answers) => boolean;
};

export type StageId = "base" | "content" | "distribution" | "creators" | "iterate";

export type LaunchStage = {
  id: StageId;
  label: string;
};

export const STAGES: LaunchStage[] = [
  { id: "base", label: "Base que convierte" },
  { id: "content", label: "Contenido en volumen" },
  { id: "distribution", label: "Distribución" },
  { id: "creators", label: "Creadores" },
  { id: "iterate", label: "Iterar" },
];

export const TASKS: LaunchTask[] = [
  {
    id: "hard-paywall",
    stage: "base",
    title: "Paywall duro con plan semanal",
    why: "Un paywall duro convierte ~5 veces más que freemium, con la misma retención. El plan semanal ya es más de la mitad de los ingresos por suscripción.",
    how: ["Muestra el paywall al terminar el onboarding, antes de usar la app.", "Plan semanal con prueba gratis + anual con descuento.", "Prueba variantes con Superwall o RevenueCat."],
    applies: "app",
    when: (a) => !has(a, "monetization", "one-time"),
  },
  {
    id: "onboarding-quiz",
    stage: "base",
    title: "Onboarding de varias pantallas",
    why: "Los paywalls tras un onboarding largo convierten un 37% más que los de una sola pantalla.",
    how: ["5–10 preguntas sobre el objetivo del usuario.", "Muestra un resultado personalizado antes del paywall.", "Inspírate en los onboardings que mejor funcionan en tu categoría."],
    applies: "app",
    link: { view: "ideas", params: { mk: "onboardings" }, label: "Ver onboardings" },
  },
  {
    id: "connect-revenue",
    stage: "base",
    title: "Conecta tus ingresos",
    why: "Sin ingresos diarios no sabrás qué video te trae dinero, solo vistas.",
    how: ["Conecta Superwall en Ajustes.", "Vantko cruzará vistas e ingresos cada día en Hoy."],
    applies: "app",
  },
  {
    id: "public-page",
    stage: "base",
    title: "Publica la página de tu producto",
    why: "Un enlace para tu bio en cada cuenta, que además guarda a los interesados.",
    how: ["Frase principal con el resultado que obtiene tu cliente.", "Enlaces a la tienda o a la web.", "Activa la recogida de emails."],
    applies: "all",
    link: { view: "page", label: "Abrir Página" },
  },
  {
    id: "store-ready",
    stage: "base",
    title: "Screenshots y textos legales",
    why: "El tráfico de los videos llega a tu ficha: si no convence, pierdes la descarga.",
    how: ["La primera captura vende el resultado, no la función.", "Privacidad y términos publicados."],
    applies: "app",
    link: { view: "miapp", params: { app: "screenshots" }, label: "Abrir Mi app" },
  },
  {
    id: "formats",
    stage: "content",
    title: "Elige 3 formatos que ya funcionan",
    why: "No inventes: copia la estructura de videos que ya son virales en tu nicho y cambia el producto.",
    how: ["Busca videos orgánicos de apps parecidas a la tuya.", "Guarda 3 formatos: slideshow, reacción + demo, talking head.", "Anota el gancho de los 2 primeros segundos de cada uno."],
    applies: "all",
    link: { view: "ideas", params: { mk: "organic" }, label: "Ver videos virales" },
  },
  {
    id: "ai-creator",
    stage: "content",
    title: "Crea tu influencer con IA",
    why: "Una cara constante te permite publicar a diario sin grabarte ni pagar a nadie.",
    how: ["Define edad, estilo y nicho de tu cliente ideal.", "Genera sus fotos de referencia.", "Úsalo en todos tus formatos."],
    applies: "all",
    when: (a) => !has(a, "audience", "b2b") && !has(a, "audience", "dev"),
    link: { view: "create", label: "Abrir Crear" },
  },
  {
    id: "first-batch",
    stage: "content",
    title: "Genera tus primeros 20 videos",
    why: "El post medio se queda en ~1.000 vistas; los hits salen del volumen. Con 20–40 videos al mes tus probabilidades de un viral se multiplican por 4.",
    how: ["Varía solo el gancho entre videos del mismo formato.", "15–30 segundos, producto visible antes del segundo 15.", "Deja que el autopiloto haga la cola."],
    applies: "all",
    link: { view: "create", label: "Crear videos" },
  },
  {
    id: "accounts",
    stage: "distribution",
    title: "Abre 3 cuentas por plataforma",
    why: "Las apps que más crecen publican desde muchas cuentas a la vez: cada una es otra oportunidad de viral.",
    how: ["TikTok, Instagram y YouTube Shorts.", "Una temática por cuenta, misma app.", "Calienta cada cuenta 3–5 días antes de publicar."],
    applies: "app",
    link: { view: "results", params: { vt: "accounts" }, label: "Añadir cuentas" },
  },
  {
    id: "autopublish",
    stage: "distribution",
    title: "Activa la publicación automática",
    why: "Publicar 2–3 veces al día por cuenta a mano es imposible de sostener.",
    how: ["Conecta tus cuentas.", "Crea un flujo: qué influencer, cada cuántas horas, qué texto.", "Revisa la cola una vez al día."],
    applies: "all",
    link: { view: "publish", label: "Abrir Publicar" },
  },
  {
    id: "recruit-creators",
    stage: "creators",
    title: "Recluta 10 creadores pagados por vista",
    why: "Pagar por vistas reales (~$1–4 por cada 1.000) pone el riesgo del lado del creador, no del tuyo.",
    how: ["Busca micro-creadores de tu nicho.", "Oferta: pago fijo pequeño + bono por cada 1.000 vistas.", "Exige mostrar la app en los primeros 15 segundos."],
    applies: "app",
    link: { view: "creators", label: "Abrir Creadores" },
  },
  {
    id: "web-activation",
    stage: "base",
    title: "Primer resultado en la primera sesión",
    why: "Quien no ve valor en sus primeros minutos no vuelve. La activación pesa más que cualquier campaña.",
    how: ["Define la acción que demuestra el valor (primer informe, primera integración…).", "Quita todo paso que no lleve a esa acción.", "Datos de ejemplo para que nadie empiece con una pantalla vacía."],
    applies: "web",
  },
  {
    id: "web-pricing",
    stage: "base",
    title: "Página de precios clara",
    why: "Es la página que más visitan quienes están a punto de pagar.",
    how: ["Tres planes con uno destacado.", "Precio anual con descuento visible.", "Prueba gratis y preguntas frecuentes al lado del botón."],
    applies: "web",
    when: (a) => !has(a, "monetization", "none"),
  },
  {
    id: "free-tool",
    stage: "content",
    title: "Lanza una herramienta gratis",
    why: "Una calculadora o un generador gratuito atrae búsquedas y enlaces durante años, y lleva a tu producto.",
    how: ["Resuelve un trozo pequeño del problema que resuelve tu producto.", "Sin registro para usarla, registro para guardar el resultado.", "Una página por variante de búsqueda."],
    applies: "web",
  },
  {
    id: "founder-content",
    stage: "distribution",
    title: "Publica como fundador en LinkedIn y X",
    why: "En software para empresas y desarrolladores, la gente compra a personas. El fundador es el mejor canal.",
    how: ["3–5 publicaciones por semana.", "Cuenta lo que construyes, cifras reales y casos de clientes.", "Recicla cada publicación que funcione en video corto."],
    applies: "web",
    when: (a) => has(a, "audience", "b2b") || has(a, "audience", "dev") || has(a, "platforms", "linkedin") || has(a, "platforms", "x"),
    link: { view: "publish", label: "Abrir Publicar" },
  },
  {
    id: "comparison-pages",
    stage: "distribution",
    title: "Páginas de comparación y alternativas",
    why: "“Alternativa a X” y “X vs Y” son búsquedas de gente lista para comprar, en Google y en ChatGPT.",
    how: ["Una página por competidor: honesta, con tabla comparativa.", "Explica para quién eres mejor y para quién no.", "Enlázalas desde tu página de precios."],
    applies: "web",
  },
  {
    id: "affiliates",
    stage: "creators",
    title: "Programa de afiliados",
    why: "Creadores y newsletters de tu nicho venden por ti y solo pagas cuando hay ventas.",
    how: ["Comisión recurrente del 20–30% durante 12 meses.", "Contacta a 20 creadores y newsletters de tu nicho.", "Dales una demo y un enlace con seguimiento."],
    applies: "web",
    link: { view: "creators", label: "Abrir Creadores" },
  },
  {
    id: "integrations",
    stage: "iterate",
    title: "Aparece en marketplaces e integraciones",
    why: "Los marketplaces de otras plataformas (Shopify, Zapier, Slack…) traen clientes que ya buscan una solución.",
    how: ["Elige la plataforma que más usan tus clientes.", "Publica la integración en su directorio.", "Documentación pública y clara: también es marketing."],
    applies: "web",
    when: (a) => has(a, "audience", "b2b") || has(a, "audience", "dev"),
  },
  {
    id: "hits",
    stage: "iterate",
    title: "Duplica tus videos ganadores",
    why: "El 10% de los videos trae el 74% de las vistas. Lo que ya funcionó es tu mejor apuesta.",
    how: ["Cada semana mira qué videos superan 10× tu mediana.", "Haz 5 variantes de cada uno cambiando solo el gancho.", "Deja de publicar los formatos que no generan descargas."],
    applies: "all",
    link: { view: "results", params: { vt: "videos" }, label: "Ver videos" },
  },
  {
    id: "ai-search",
    stage: "iterate",
    title: "Aparece cuando preguntan a ChatGPT",
    why: "El tráfico que llega desde ChatGPT o Perplexity convierte 2,5–4,7 veces más que el de Google.",
    how: ["Página “tu app vs. competidor” en tu web.", "Responde en Reddit donde se recomiendan apps de tu categoría.", "Pregunta a ChatGPT por tu categoría y anota quién aparece."],
    applies: "all",
  },
  {
    id: "reviews",
    stage: "iterate",
    title: "Responde a todas las reseñas",
    why: "Responder a una reseña negativa sube esa valoración +0,7 estrellas de media.",
    how: ["Agradece, explica la solución y pide que actualicen.", "Pide reseña justo después de un momento de éxito."],
    applies: "app",
    link: { view: "ideas", params: { mk: "reviews" }, label: "Ver reseñas" },
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

export function planFor(type: ProductType | null, answers: Answers): LaunchTask[] {
  return TASKS.filter((t) => appliesTo(t.applies, type) && (!t.when || t.when(answers)));
}
