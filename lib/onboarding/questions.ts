export type BuildType = "app" | "web";

export type Answers = Record<string, string | string[]>;

export type Question = {
  id: string;
  title: string;
  hint?: string;
  kind: "single" | "multi" | "text" | "appstore";
  options?: { id: string; label: string; hint?: string }[];
  placeholder?: string;
  optional?: boolean;
};

export const TYPE_QUESTION: Question = {
  id: "type",
  title: "¿Qué has construido?",
  hint: "Es lo que más cambia cómo se crece: una app y una web no se venden igual.",
  kind: "single",
  options: [
    { id: "app", label: "Una app móvil", hint: "Como Cal AI" },
    { id: "web", label: "Una web o SaaS", hint: "Como Shopify o RevenueCat" },
  ],
};

const STAGE: Question = {
  id: "stage",
  title: "¿En qué punto estás?",
  kind: "single",
  options: [
    { id: "zero", label: "Aún sin usuarios" },
    { id: "early", label: "Primeros usuarios" },
    { id: "revenue", label: "Ya facturo" },
  ],
};

const APP_STORE: Question = {
  id: "appstore",
  title: "Busca tu app en la App Store",
  hint: "Escribe su nombre o pega el enlace de su ficha. Así sabremos exactamente qué hace.",
  kind: "appstore",
  placeholder: "Nombre de tu app o apps.apple.com/…",
};

const APP_PITCH: Question = {
  id: "pitch",
  title: "¿Qué hace tu app, en una frase?",
  hint: "La usaremos en tu página y en los guiones de tus videos.",
  kind: "text",
  placeholder: "Cuenta calorías con una foto",
};

const APP_QUESTIONS: Question[] = [
  {
    id: "stores",
    title: "¿Dónde está tu app?",
    kind: "multi",
    options: [
      { id: "ios", label: "App Store" },
      { id: "android", label: "Google Play" },
      { id: "none", label: "Aún no está publicada" },
    ],
  },
  {
    id: "monetization",
    title: "¿Cómo cobras?",
    kind: "single",
    options: [
      { id: "subscription", label: "Suscripción con paywall" },
      { id: "one-time", label: "Pago único" },
      { id: "iap", label: "Gratis con compras dentro" },
      { id: "none", label: "Aún no cobro" },
    ],
  },
  STAGE,
  {
    id: "platforms",
    title: "¿Dónde quieres publicar videos?",
    hint: "Las apps que más crecen publican en las tres a la vez.",
    kind: "multi",
    options: [
      { id: "tiktok", label: "TikTok" },
      { id: "instagram", label: "Instagram Reels" },
      { id: "youtube", label: "YouTube Shorts" },
    ],
  },
  {
    id: "face",
    title: "¿Quién sale en tus videos?",
    kind: "single",
    options: [
      { id: "ai", label: "Un influencer creado con IA" },
      { id: "creators", label: "Creadores a los que pago" },
      { id: "me", label: "Yo mismo" },
      { id: "unsure", label: "Aún no lo sé" },
    ],
  },
];

const WEB_QUESTIONS: Question[] = [
  {
    id: "pitch",
    title: "¿Qué hace tu producto, en una frase?",
    hint: "La usaremos en tu página y en tu contenido.",
    kind: "text",
    placeholder: "Gestiona las suscripciones de tu app",
  },
  {
    id: "url",
    title: "¿Cuál es tu web?",
    kind: "text",
    placeholder: "tuproducto.com",
    optional: true,
  },
  {
    id: "audience",
    title: "¿A quién le vendes?",
    kind: "single",
    options: [
      { id: "b2c", label: "A personas" },
      { id: "b2b", label: "A empresas" },
      { id: "dev", label: "A desarrolladores" },
    ],
  },
  {
    id: "monetization",
    title: "¿Cómo cobras?",
    kind: "single",
    options: [
      { id: "subscription", label: "Suscripción mensual" },
      { id: "usage", label: "Pago por uso" },
      { id: "freemium", label: "Plan gratis y planes de pago" },
      { id: "none", label: "Aún no cobro" },
    ],
  },
  STAGE,
  {
    id: "platforms",
    title: "¿Dónde quieres publicar?",
    hint: "Para empresas funcionan LinkedIn y X; para personas, video corto.",
    kind: "multi",
    options: [
      { id: "linkedin", label: "LinkedIn" },
      { id: "x", label: "X" },
      { id: "tiktok", label: "TikTok" },
      { id: "instagram", label: "Instagram" },
      { id: "youtube", label: "YouTube" },
    ],
  },
];

export function questionsFor(type: BuildType | null, answers: Answers = {}): Question[] {
  if (!type) return [TYPE_QUESTION];
  if (type === "web") return [TYPE_QUESTION, ...WEB_QUESTIONS];
  const unpublished = answers.appId === NO_APP;
  return [TYPE_QUESTION, APP_STORE, ...(unpublished ? [APP_PITCH] : []), ...APP_QUESTIONS];
}

export const NO_APP = "none";

export const APP_FIELDS = ["appId", "appName", "appIcon", "appUrl", "appGenre", "appSeller", "appCountry"] as const;

export function parseAppStoreUrl(raw: string): { id: string; country: string } | null {
  const match = raw.match(/apps\.apple\.com\/(?:([a-z]{2})\/)?(?:app\/)?(?:[^/?#]*\/)?id(\d{5,})/i);
  if (match) return { id: match[2], country: (match[1] || "us").toLowerCase() };
  const bare = raw.trim().match(/^id?(\d{6,})$/i);
  return bare ? { id: bare[1], country: "us" } : null;
}

export function pitchFromDescription(description: string): string {
  const firstLine =
    description
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => l.length >= 30 && /[a-záéíóúñ]/.test(l) && !l.endsWith(":") && !/^(\d+[).]|[-•*–])/.test(l)) ?? "";
  const sentence = firstLine.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? firstLine;
  return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence;
}

export function cleanAnswers(type: BuildType, raw: unknown): Answers {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Answers = {};
  for (const q of questionsFor(type, input as Answers)) {
    if (q.id === "type" || q.id === "pitch" || q.kind === "appstore") continue;
    const value = input[q.id];
    const allowed = new Set(q.options?.map((o) => o.id));
    if (q.kind === "text" && typeof value === "string" && value.trim()) out[q.id] = value.trim().slice(0, 200);
    if (q.kind === "single" && typeof value === "string" && allowed.has(value)) out[q.id] = value;
    if (q.kind === "multi" && Array.isArray(value)) {
      const picked = value.filter((v): v is string => typeof v === "string" && allowed.has(v));
      if (picked.length) out[q.id] = picked;
    }
  }
  return out;
}

export function has(answers: Answers, id: string, value: string): boolean {
  const v = answers[id];
  return Array.isArray(v) ? v.includes(value) : v === value;
}
