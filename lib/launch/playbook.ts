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

export type LaunchPageId = "roadmap" | "channels" | "feedback" | "metrics" | "pricing";

export const STAGES: LaunchStage[] = [
  { id: "prepare", label: "Preparar", goal: "Que tu producto esté listo para que un desconocido lo use y confíe.", color: "#6366f1" },
  { id: "launch", label: "Lanzar", goal: "Que el mundo se entere el mismo día, en los sitios correctos.", color: "#0ea5e9" },
  { id: "traction", label: "Tracción", goal: "Un flujo constante de usuarios nuevos que no dependa de ti.", color: "#0d9488" },
  { id: "monetize", label: "Monetizar", goal: "Que los usuarios que obtienen valor paguen por él.", color: "#f2545b" },
  { id: "measure", label: "Medir", goal: "Decidir con datos y con lo que dicen tus usuarios.", color: "#f59e0b" },
  { id: "scale", label: "Escalar", goal: "Convertir el proyecto en una empresa que funciona sin ti al 100%.", color: "#7c3aed" },
];

export const TASKS: LaunchTask[] = [
  // Preparar
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
    id: "aso",
    stage: "prepare",
    title: "Investiga keywords y competidores",
    why: "Saber qué buscan y qué ya existe te dice cómo posicionarte.",
    how: ["Revisa las apps top de tu categoría.", "Lee sus reseñas de 1–3 estrellas: ahí está tu oportunidad.", "Elige 3–5 keywords para nombre y subtítulo."],
    applies: "all",
    link: { kind: "market", label: "Abrir Market" },
  },
  {
    id: "seo",
    stage: "prepare",
    title: "SEO básico y vista previa al compartir",
    why: "Cada enlace compartido es un anuncio gratis si se ve bien.",
    how: ["Título y meta descripción por página.", "Imagen Open Graph de 1200×630.", "sitemap.xml y Search Console."],
    applies: "web",
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
    id: "errors",
    stage: "prepare",
    title: "Monitoreo de errores y caídas",
    why: "Los usuarios no reportan bugs: simplemente se van.",
    how: ["Sentry o Crashlytics en producción.", "Alertas al correo cuando algo falla.", "Un monitor de uptime gratuito para tu web/API."],
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
    id: "onboarding",
    stage: "prepare",
    title: "Onboarding que llegue al valor en 2 minutos",
    why: "La mayoría de usuarios decide en la primera sesión si vuelve.",
    how: ["Quita pasos que no sean imprescindibles.", "Lleva al usuario a su primer resultado real.", "Pide permisos y datos solo cuando hagan falta."],
    applies: "all",
  },

  // Lanzar
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
    how: ["Marca los canales en la pestaña Canales.", "Prepara el texto de cada uno con antelación.", "Reparte los lanzamientos en 2 semanas."],
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
    id: "story",
    stage: "launch",
    title: "Cuenta la historia de por qué lo hiciste",
    why: "La gente apoya a personas, no a productos.",
    how: ["Post en X/LinkedIn: problema, intento, resultado.", "Incluye cifras reales y capturas.", "Responde a todos los comentarios el primer día."],
    applies: "all",
  },

  // Tracción
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
    id: "communities",
    stage: "traction",
    title: "Participa en 3 comunidades de tu cliente",
    why: "Aportar valor donde ya está tu cliente trae usuarios fieles.",
    how: ["Subreddits, grupos de Facebook, Discords o Slacks.", "Responde dudas sin venderte.", "Comparte tu producto solo cuando resuelva algo concreto."],
    applies: "all",
  },
  {
    id: "ads-test",
    stage: "traction",
    title: "Test pequeño de anuncios ($100)",
    why: "Te dice si el canal pagado es viable antes de invertir en serio.",
    how: ["Mira qué anuncios lleva meses activos tu competencia.", "3 creatividades, 1 audiencia, 5–7 días.", "Calcula el coste por usuario y por pago."],
    applies: "all",
    link: { kind: "market", label: "Ver anuncios de la competencia" },
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
    id: "referrals",
    stage: "traction",
    title: "Añade un motivo para invitar",
    why: "Cada usuario puede traer otro si se lo pones fácil.",
    how: ["Recompensa a ambos lados (mes gratis, créditos).", "Botón de compartir en el momento de éxito.", "Mide cuántos usuarios llegan por invitación."],
    applies: "all",
  },
  {
    id: "directories-seo",
    stage: "traction",
    title: "Directorios y comparativas para SEO",
    why: "Los enlaces desde directorios dan tráfico y autoridad durante años.",
    how: ["AlternativeTo, SaaSHub y similares.", "Páginas “alternativa a X” en tu web.", "Un artículo por problema que resuelves."],
    applies: "web",
    link: { page: "channels", label: "Ver directorios" },
  },

  // Monetizar
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
    link: { kind: "monetization", label: "Abrir Monetization" },
  },
  {
    id: "paywall",
    stage: "monetize",
    title: "Paywall con prueba gratuita",
    why: "El paywall es la pantalla que más dinero mueve de tu producto.",
    how: ["Muéstralo tras el onboarding, no al final.", "Beneficios en 3 líneas, plan anual preseleccionado.", "Prueba de 3–7 días con recordatorio."],
    applies: "all",
    link: { kind: "monetization", label: "Ver paywalls" },
  },
  {
    id: "lifecycle",
    stage: "monetize",
    title: "Emails de bienvenida, fin de prueba y recuperación",
    why: "Un buen email de fin de prueba sube la conversión sin tocar el producto.",
    how: ["Bienvenida con el primer paso concreto.", "Aviso 24h antes de que acabe la prueba.", "Recuperación a los 7 y 30 días de cancelar."],
    applies: "all",
    link: { kind: "emails", label: "Abrir Emails" },
  },

  // Medir
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
    id: "interviews",
    stage: "measure",
    title: "Habla con 10 usuarios",
    why: "10 conversaciones valen más que 1.000 respuestas de encuesta.",
    how: ["Pregunta qué intentaban hacer, no qué quieren.", "Graba (con permiso) y anota frases literales.", "Apunta cada petición en Feedback."],
    applies: "all",
    link: { page: "feedback", label: "Abrir Feedback" },
  },
  {
    id: "retention",
    stage: "measure",
    title: "Mide retención día 1, 7 y 30",
    why: "Sin retención, todo el marketing es llenar un cubo con agujeros.",
    how: ["Cohortes por semana de registro.", "Compara antes y después de cada cambio.", "Si D30 es casi 0, arregla producto antes de crecer."],
    applies: "all",
  },
  {
    id: "roadmap",
    stage: "measure",
    title: "Prioriza el roadmap por votos e impacto",
    why: "Construir lo que piden muchos clientes de pago es la apuesta más segura.",
    how: ["Agrupa peticiones parecidas y suma votos.", "Prioriza lo que afecta a retención o pago.", "Avisa a quien lo pidió cuando esté hecho."],
    applies: "all",
    link: { page: "feedback", label: "Ver feedback" },
  },
  {
    id: "costs",
    stage: "measure",
    title: "Vigila tus costes de APIs e infraestructura",
    why: "Un pico de uso puede comerse tu margen sin que te des cuenta.",
    how: ["Revisa el gasto semanal.", "Pon límites y alertas en cada proveedor.", "Calcula el coste por usuario activo."],
    applies: "all",
    link: { kind: "analytics", label: "Abrir Stats" },
  },

  // Escalar
  {
    id: "company",
    stage: "scale",
    title: "Formaliza la empresa y separa las finanzas",
    why: "Cobrar, firmar contratos y crecer exige una estructura legal.",
    how: ["Constituye la sociedad adecuada a tu país.", "Cuenta bancaria solo para el negocio.", "Guarda contratos y documentos en un sitio."],
    applies: "all",
  },
  {
    id: "automate",
    stage: "scale",
    title: "Automatiza lo que repites cada semana",
    why: "Tu tiempo es el recurso más escaso del proyecto.",
    how: ["Publicación programada de contenido.", "Respuestas guardadas para soporte.", "Reportes semanales automáticos."],
    applies: "all",
    link: { kind: "viewtracker", label: "Abrir Marketing" },
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
  {
    id: "first-hire",
    stage: "scale",
    title: "Delega tu primera tarea recurrente",
    why: "Crecer solo tiene un techo: tus horas.",
    how: ["Empieza por soporte o creación de contenido.", "Documenta el proceso antes de delegarlo.", "Freelance por proyecto antes de contratar fijo."],
    applies: "all",
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
  { id: "reddit-niche", name: "Subreddit de tu nicho", url: "https://www.reddit.com/subreddits/search", kind: "community", applies: "all", effort: "medio", tip: "Lee las reglas. Aporta valor semanas antes de mencionar tu producto." },
  { id: "indiehackers", name: "Indie Hackers", url: "https://www.indiehackers.com/", kind: "community", applies: "all", effort: "bajo", tip: "Publica cifras reales (usuarios, ingresos). La transparencia genera conversación." },
  { id: "x-bip", name: "X · Build in public", url: "https://x.com/", kind: "social", applies: "all", effort: "medio", tip: "Hilo con el antes/después, capturas y números. Etiqueta a quien te inspiró." },
  { id: "linkedin", name: "LinkedIn", url: "https://www.linkedin.com/", kind: "social", applies: "all", effort: "bajo", tip: "Funciona muy bien para B2B. Historia personal + captura del producto." },
  { id: "tiktok", name: "TikTok / Reels / Shorts", url: "https://www.tiktok.com/", kind: "social", applies: "all", effort: "alto", tip: "Varios videos cortos el mismo día. El gancho en los primeros 2 segundos." },
  { id: "betalist", name: "BetaList", url: "https://betalist.com/submit", kind: "directory", applies: "all", effort: "bajo", tip: "Ideal antes del lanzamiento oficial para captar early adopters." },
  { id: "uneed", name: "Uneed", url: "https://www.uneed.best/submit-a-tool", kind: "directory", applies: "all", effort: "bajo", tip: "Lanzamientos diarios con ranking; buena alternativa a Product Hunt." },
  { id: "peerlist", name: "Peerlist Launchpad", url: "https://peerlist.io/launchpad", kind: "directory", applies: "all", effort: "bajo", tip: "Comunidad de makers; lanzamientos semanales." },
  { id: "devhunt", name: "DevHunt", url: "https://devhunt.org/", kind: "directory", applies: "web", effort: "bajo", tip: "Perfecto si tu producto es para desarrolladores." },
  { id: "microlaunch", name: "Microlaunch", url: "https://microlaunch.net/", kind: "directory", applies: "all", effort: "bajo", tip: "Lanzamientos de un mes con feedback de la comunidad." },
  { id: "fazier", name: "Fazier", url: "https://fazier.com/", kind: "directory", applies: "all", effort: "bajo", tip: "Directorio de lanzamientos con badge para tu web." },
  { id: "alternativeto", name: "AlternativeTo", url: "https://alternativeto.net/", kind: "directory", applies: "all", effort: "bajo", tip: "Añádete como alternativa a los líderes de tu categoría." },
  { id: "saashub", name: "SaaSHub", url: "https://www.saashub.com/", kind: "directory", applies: "web", effort: "bajo", tip: "Buen enlace para SEO y tráfico de comparativas." },
  { id: "appstore-featuring", name: "App Store · Nominación para destacar", url: "https://developer.apple.com/contact/app-store/promote/", kind: "store", applies: "app", effort: "medio", tip: "Nomina tu app o actualización 2–3 semanas antes. Apple valora diseño y uso de funciones nativas." },
  { id: "play-featuring", name: "Google Play · Formulario de destacados", url: "https://play.google.com/console/about/programs/", kind: "store", applies: "app", effort: "medio", tip: "Revisa los programas de Play Console para apps independientes." },
  { id: "appsumo", name: "AppSumo", url: "https://sell.appsumo.com/", kind: "directory", applies: "web", effort: "alto", tip: "Lifetime deals: mucha caja y usuarios rápido, pero piensa bien en el soporte." },
  { id: "newsletters", name: "Newsletters de tu nicho", url: "https://www.google.com/search?q=newsletter+de+", kind: "press", applies: "all", effort: "medio", tip: "Escribe a 10 newsletters con un pitch de 3 líneas y un enlace a la demo." },
  { id: "podcasts", name: "Podcasts de emprendimiento", url: "https://www.google.com/search?q=podcast+indie+founders", kind: "press", applies: "all", effort: "alto", tip: "Ofrece tu historia y aprendizajes, no una demo del producto." },
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
