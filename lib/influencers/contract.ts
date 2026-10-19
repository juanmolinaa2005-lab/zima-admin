export type ContractStatus = "draft" | "sent" | "signed";

export type PaymentTerms = "upfront" | "split" | "on-publish";

export type ContractParams = {
  brandName: string;
  creatorName: string;
  creatorEmail: string;
  deliverables: string;
  fee: number;
  currency: string;
  paymentTerms: PaymentTerms;
  publishBy: string;
  usageDays: number;
  exclusivityDays: number;
  revisions: number;
  extraTerms: string;
};

export type Contract = {
  id: string;
  creatorId: string | null;
  creatorName: string;
  params: ContractParams;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
};

export const CONTRACT_STATUSES: { id: ContractStatus; label: string; color: string }[] = [
  { id: "draft", label: "Borrador", color: "#a1a1aa" },
  { id: "sent", label: "Enviado", color: "#f59e0b" },
  { id: "signed", label: "Firmado", color: "#16a34a" },
];

export const PAYMENT_TERMS: { id: PaymentTerms; label: string; clause: string }[] = [
  { id: "upfront", label: "100% por adelantado", clause: "el 100% del importe a la firma de este acuerdo" },
  { id: "split", label: "50% antes, 50% al publicar", clause: "el 50% del importe a la firma y el 50% restante en los 7 días siguientes a la publicación" },
  { id: "on-publish", label: "100% al publicar", clause: "el 100% del importe en los 7 días siguientes a la publicación del contenido" },
];

export const CURRENCIES = ["USD", "EUR", "MXN", "COP", "ARS", "CLP"];

export function isContractStatus(v: unknown): v is ContractStatus {
  return v === "draft" || v === "sent" || v === "signed";
}

export function defaultParams(partial: Partial<ContractParams> = {}): ContractParams {
  return {
    brandName: "",
    creatorName: "",
    creatorEmail: "",
    deliverables: "1 video de TikTok de 30–60 s mencionando la marca",
    fee: 0,
    currency: "USD",
    paymentTerms: "split",
    publishBy: "",
    usageDays: 30,
    exclusivityDays: 0,
    revisions: 1,
    extraTerms: "",
    ...partial,
  };
}

/** Coerces untrusted JSON into params, keeping only known fields. */
export function sanitizeParams(raw: unknown): ContractParams {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const num = (v: unknown, max: number) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
  };
  const terms = PAYMENT_TERMS.some((t) => t.id === r.paymentTerms) ? (r.paymentTerms as PaymentTerms) : "split";
  return {
    brandName: str(r.brandName, 120),
    creatorName: str(r.creatorName, 120),
    creatorEmail: str(r.creatorEmail, 200),
    deliverables: str(r.deliverables, 2000),
    fee: num(r.fee, 10_000_000),
    currency: CURRENCIES.includes(r.currency as string) ? (r.currency as string) : "USD",
    paymentTerms: terms,
    publishBy: /^\d{4}-\d{2}-\d{2}$/.test(String(r.publishBy)) ? String(r.publishBy) : "",
    usageDays: Math.round(num(r.usageDays, 3650)),
    exclusivityDays: Math.round(num(r.exclusivityDays, 3650)),
    revisions: Math.round(num(r.revisions, 20)),
    extraTerms: str(r.extraTerms, 4000),
  };
}

export function formatFee(p: Pick<ContractParams, "fee" | "currency">) {
  return new Intl.NumberFormat("es", { style: "currency", currency: p.currency, maximumFractionDigits: 2 }).format(p.fee);
}

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

/** The contract as titled clauses, ready to render or print. */
export function contractSections(p: ContractParams, today = new Date()): { title: string; body: string }[] {
  const brand = p.brandName.trim() || "La Marca";
  const creator = p.creatorName.trim() || "El Creador";
  const terms = PAYMENT_TERMS.find((t) => t.id === p.paymentTerms) ?? PAYMENT_TERMS[1];
  const sections = [
    {
      title: "Partes",
      body: `Este acuerdo se firma el ${today.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })} entre ${brand} ("la Marca") y ${creator}${
        p.creatorEmail.trim() ? ` (${p.creatorEmail.trim()})` : ""
      } ("el Creador").`,
    },
    {
      title: "Contenido",
      body: `El Creador producirá y publicará en sus redes: ${p.deliverables.trim() || "el contenido acordado entre las partes"}.${
        p.publishBy ? ` El contenido se publicará como tarde el ${longDate(p.publishBy)}.` : ""
      } Antes de publicar, la Marca podrá pedir hasta ${p.revisions} ${p.revisions === 1 ? "ronda" : "rondas"} de cambios.`,
    },
    {
      title: "Pago",
      body: `La Marca pagará al Creador ${formatFee(p)} en total: ${terms.clause}.`,
    },
    {
      title: "Uso del contenido",
      body: p.usageDays
        ? `La Marca podrá republicar el contenido en sus propios canales y usarlo en anuncios durante ${p.usageDays} días desde su publicación, citando al Creador.`
        : "La Marca podrá compartir la publicación original, pero no usar el contenido en anuncios ni en sus propios canales.",
    },
    {
      title: "Exclusividad",
      body: p.exclusivityDays
        ? `Durante ${p.exclusivityDays} días desde la publicación, el Creador no promocionará marcas competidoras directas.`
        : "No hay exclusividad: el Creador puede trabajar con otras marcas.",
    },
    {
      title: "Transparencia",
      body: "El Creador indicará que se trata de una colaboración pagada (por ejemplo #publicidad o la etiqueta de contenido de marca de cada red).",
    },
  ];
  if (p.extraTerms.trim()) sections.push({ title: "Otras condiciones", body: p.extraTerms.trim() });
  sections.push({
    title: "Cancelación",
    body: "Cualquiera de las partes puede cancelar el acuerdo por escrito antes de la publicación. Si la Marca cancela después de que el Creador haya empezado a producir, pagará el 50% del importe.",
  });
  return sections;
}

export function contractPlainText(p: ContractParams) {
  const brand = p.brandName.trim() || "La Marca";
  const creator = p.creatorName.trim() || "El Creador";
  const body = contractSections(p)
    .map((s, i) => `${i + 1}. ${s.title}\n${s.body}`)
    .join("\n\n");
  return `ACUERDO DE COLABORACIÓN\n\n${body}\n\nFirma de ${brand}: ____________________\n\nFirma de ${creator}: ____________________`;
}
