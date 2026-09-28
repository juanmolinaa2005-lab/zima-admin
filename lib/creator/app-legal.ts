export const LEGAL_DOCS = [
  {
    id: "privacy",
    label: "Privacidad",
    path: "privacy",
    title: "Política de privacidad",
  },
  {
    id: "terms",
    label: "Términos",
    path: "terms",
    title: "Términos y condiciones",
  },
  {
    id: "cookies",
    label: "Cookies",
    path: "cookies",
    title: "Política de cookies",
  },
  {
    id: "notice",
    label: "Aviso legal",
    path: "aviso",
    title: "Aviso legal",
  },
] as const;

export type LegalDocId = (typeof LEGAL_DOCS)[number]["id"];

export type LegalProfile = {
  appName: string;
  legalName: string;
  domain: string;
  contactEmail: string;
  address: string;
  region: string;
};

export type LegalDocument = {
  label: string;
  title: string;
  body: string;
};

export type LegalBundle = {
  profile: LegalProfile;
  docs: Record<LegalDocId, LegalDocument>;
};

export type LegalPublication = LegalBundle & {
  version: number;
  publishedAt: string;
};

export type LegalHistoryItem = {
  version: number;
  publishedAt: string;
};

export type LegalNotice = {
  at: string;
  version: number;
  sent: number;
  failed: number;
  subject: string;
  from: string;
};

export type LegalState = {
  projectName: string;
  draft: LegalBundle;
  published: LegalPublication | null;
  version: number;
  history: LegalHistoryItem[];
  lastNotice: LegalNotice | null;
  updatedAt: string | null;
};

const DOC_IDS = new Set<string>(LEGAL_DOCS.map((doc) => doc.id));

export function isLegalDocId(value: string): value is LegalDocId {
  return DOC_IDS.has(value);
}

export function legalDocMeta(id: LegalDocId) {
  return LEGAL_DOCS.find((doc) => doc.id === id) ?? LEGAL_DOCS[0];
}

export function emptyProfile(appName = ""): LegalProfile {
  return {
    appName,
    legalName: "",
    domain: "",
    contactEmail: "",
    address: "",
    region: "",
  };
}

function clip(value: unknown, max: number) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

export function normalizeDomain(value: string) {
  const raw = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!raw) return "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) return "";
  return raw;
}

export function defaultBundle(appName = ""): LegalBundle {
  const profile = emptyProfile(appName);
  return {
    profile,
    docs: {
      privacy: {
        label: "Privacidad",
        title: "Política de privacidad",
        body: privacyTemplate(),
      },
      terms: {
        label: "Términos",
        title: "Términos y condiciones",
        body: termsTemplate(),
      },
      cookies: {
        label: "Cookies",
        title: "Política de cookies",
        body: cookiesTemplate(),
      },
      notice: {
        label: "Aviso legal",
        title: "Aviso legal",
        body: noticeTemplate(),
      },
    },
  };
}

function privacyTemplate() {
  return `Esta política explica cómo {{app}} trata los datos de quienes usan la aplicación y el sitio {{dominio}}.

# Quién es responsable
El responsable es {{razon}}, con domicilio en {{direccion}} ({{region}}). Puedes escribir a {{email}}.

# Datos que tratamos
Cuenta (correo y identificador), datos que introduces en la app, datos técnicos del dispositivo y registros necesarios para que el servicio funcione y para prevenir abusos.

# Para qué los usamos
Prestar el servicio, mantener tu cuenta, responder soporte, mejorar la app y cumplir obligaciones legales. No vendemos tus datos.

# Cuánto tiempo los guardamos
Mientras tengas la cuenta y el tiempo necesario para reclamaciones o deberes legales. Después se borran o se anonimizan.

# Con quién se comparten
Con proveedores que alojan la app, envían correo o procesan pagos, solo para esas funciones y bajo contrato. También si una autoridad lo exige.

# Tus derechos
Puedes pedir acceso, rectificación, supresión, limitación, oposición y portabilidad escribiendo a {{email}}. Si estás en el Espacio Económico Europeo o en el Reino Unido, puedes reclamar ante la autoridad de protección de datos.

# Menores
{{app}} no está dirigida a menores de 16 años. Si crees que tenemos datos de un menor, escríbenos y los eliminaremos.

# Cambios
Cuando cambiemos esta política publicaremos la versión nueva en esta misma dirección. Si el cambio es relevante, avisaremos por correo a la cuenta de la app. La fecha de la versión vigente aparece al inicio de esta página.`;
}

function termsTemplate() {
  return `Estos términos regulan el uso de {{app}} ({{dominio}}), operada por {{razon}}.

# La cuenta
Eres responsable de la actividad de tu cuenta y de que los datos de registro sean ciertos. Debes tener al menos 16 años, o la edad mínima de tu país si es mayor.

# Uso permitido
Puedes usar {{app}} para lo que ofrece el servicio. No puedes usarla para actividades ilegales, interferir con el sistema, ni extraer datos de otras personas.

# El servicio
{{app}} se ofrece tal cual está disponible. Podemos cambiar funciones, suspender el acceso por abuso o cerrar el servicio avisando cuando sea razonable.

# Propiedad
La app, la marca y los contenidos propios de {{razon}} siguen siendo nuestros. Tú conservas los derechos sobre lo que subes y nos das permiso para alojarlo y mostrarlo dentro del servicio.

# Pagos
Si hay compras o suscripciones, el precio y la renovación se muestran antes de pagar. Las tiendas de aplicaciones pueden aplicar sus propias reglas de reembolso.

# Responsabilidad
En la medida que permita la ley, {{razon}} no responde por daños indirectos ni por un uso de la app distinto del previsto. Nada de esto limita derechos que no se puedan renunciar.

# Ley aplicable
Estos términos se interpretan según las leyes de {{region}}. Si una cláusula no es válida, el resto sigue en vigor.

# Contacto
{{razon}} · {{direccion}} · {{email}}`;
}

function cookiesTemplate() {
  return `{{app}} y {{dominio}} usan cookies y tecnologías parecidas.

# Necesarias
Sirven para iniciar sesión, recordar tu sesión y proteger la cuenta. No se pueden desactivar si quieres usar la app.

# De medición
Si las aceptas, nos ayudan a entender qué pantallas se usan para mejorar el producto. No las usamos para vender publicidad de terceros.

# Cómo gestionarlas
Puedes borrar o bloquear cookies en el navegador. En la app, el aviso de cookies guarda tu elección en el dispositivo.

# Cambios
Esta página muestra siempre la versión publicada. La fecha vigente aparece arriba.

# Contacto
{{email}}`;
}

function noticeTemplate() {
  return `{{razon}} es la titular de {{app}}.

# Datos de contacto
Dominio: {{dominio}}
Correo: {{email}}
Domicilio: {{direccion}}
Territorio: {{region}}

# Propiedad intelectual
Los textos, la marca y el diseño de {{app}} pertenecen a {{razon}} o a sus licenciantes. Queda prohibida su reproducción salvo permiso o uso personal permitido por la ley.

# Enlaces
Los enlaces a sitios de terceros no implican que {{razon}} controle esos sitios ni responda por su contenido.

# Documentos relacionados
La política de privacidad, los términos y la política de cookies se publican en este mismo sitio y se actualizan en su propia dirección.`;
}

export function parseProfile(raw: unknown, fallbackName = ""): LegalProfile {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const domainInput = clip(source.domain, 180);
  return {
    appName: clip(source.appName, 80) || fallbackName,
    legalName: clip(source.legalName, 160),
    domain: normalizeDomain(domainInput) || clip(domainInput, 180),
    contactEmail: clip(source.contactEmail, 160),
    address: clip(source.address, 240),
    region: clip(source.region, 80),
  };
}

export function parseBundle(raw: unknown, fallbackName = ""): LegalBundle {
  const base = defaultBundle(fallbackName);
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const profile = parseProfile(source.profile, fallbackName);
  const docsRaw =
    source.docs && typeof source.docs === "object"
      ? (source.docs as Record<string, unknown>)
      : {};
  const docs = { ...base.docs };
  for (const meta of LEGAL_DOCS) {
    const item = docsRaw[meta.id];
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    docs[meta.id] = {
      label: clip(row.label, 40) || meta.label,
      title: clip(row.title, 120) || meta.title,
      body: clip(row.body, 40000) || base.docs[meta.id].body,
    };
  }
  return { profile, docs };
}

export function parsePublication(raw: unknown): LegalPublication | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const version = Number(source.version);
  const publishedAt = clip(source.publishedAt, 40);
  if (!Number.isFinite(version) || version < 1 || !publishedAt) return null;
  const bundle = parseBundle(source);
  return { ...bundle, version, publishedAt };
}

export function parseHistory(raw: unknown): LegalHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const version = Number(row.version);
      const publishedAt = clip(row.publishedAt, 40);
      if (!Number.isFinite(version) || !publishedAt) return null;
      return { version, publishedAt };
    })
    .filter((item): item is LegalHistoryItem => Boolean(item))
    .slice(0, 12);
}

export function parseNotice(raw: unknown): LegalNotice | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const at = clip(row.at, 40);
  if (!at) return null;
  return {
    at,
    version: Number(row.version) || 0,
    sent: Number(row.sent) || 0,
    failed: Number(row.failed) || 0,
    subject: clip(row.subject, 180),
    from: clip(row.from, 180),
  };
}

export function profileTokens(profile: LegalProfile, publishedAt?: string | null) {
  const domain = normalizeDomain(profile.domain) || profile.domain.trim() || "tu dominio";
  const date = publishedAt
    ? new Date(publishedAt).toLocaleDateString("es", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "la fecha de publicación";
  return {
    "{{app}}": profile.appName.trim() || "la aplicación",
    "{{razon}}": profile.legalName.trim() || profile.appName.trim() || "el titular",
    "{{dominio}}": domain,
    "{{email}}": profile.contactEmail.trim() || "el correo de soporte",
    "{{direccion}}": profile.address.trim() || "el domicilio indicado en el aviso legal",
    "{{region}}": profile.region.trim() || "el territorio indicado",
    "{{fecha}}": date,
  };
}

export function fillLegalText(
  text: string,
  profile: LegalProfile,
  publishedAt?: string | null
) {
  const tokens = profileTokens(profile, publishedAt);
  return Object.entries(tokens).reduce(
    (current, [token, value]) => current.split(token).join(value),
    text
  );
}

const RESERVED_LEGAL_SLUGS = new Set([
  "api",
  "auth",
  "docs",
  "legal",
  "login",
  "osg",
  "projects",
]);

export function legalPublicSlug(profile: LegalProfile) {
  const domain = normalizeDomain(profile.domain);
  const source = domain || profile.appName.trim();
  const slug = source
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 40);
  if (!slug || RESERVED_LEGAL_SLUGS.has(slug)) return "";
  return slug;
}

export function hostedLegalUrl(origin: string, profile: LegalProfile, doc: LegalDocId) {
  const base = origin.replace(/\/$/, "");
  const slug = legalPublicSlug(profile);
  return `${base}/${slug}/${legalDocMeta(doc).path}`;
}

export function domainRedirects(profile: LegalProfile, origin: string) {
  const domain = normalizeDomain(profile.domain);
  if (!domain) return [];
  return LEGAL_DOCS.map((doc) => ({
    from: `https://${domain}/${doc.path}`,
    to: hostedLegalUrl(origin, profile, doc.id),
    label: doc.label,
  }));
}

export function bundleReady(bundle: LegalBundle) {
  return Boolean(bundle.profile.appName.trim() && bundle.profile.contactEmail.includes("@"));
}
