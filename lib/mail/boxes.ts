export const SYSTEM_MAIL_BOXES = [
  "inbox",
  "starred",
  "sent",
  "spam",
  "archive",
  "trash",
  "scheduled",
  "drafts",
] as const;

export type SystemMailBox = (typeof SYSTEM_MAIL_BOXES)[number];
export type MailBox = SystemMailBox | `folder:${string}`;

export const MAIL_BOX_LABELS: Record<SystemMailBox, string> = {
  inbox: "Bandeja de entrada",
  starred: "Marcado como favorito",
  sent: "Enviado",
  spam: "Spam",
  archive: "Archivar",
  trash: "Papelera",
  scheduled: "Programado",
  drafts: "Borradores",
};

export function isSystemMailBox(v: string): v is SystemMailBox {
  return (SYSTEM_MAIL_BOXES as readonly string[]).includes(v);
}

export function parseMailBox(raw: string | null | undefined): MailBox {
  const v = (raw || "").trim();
  if (!v) return "inbox";
  if (isSystemMailBox(v)) return v;
  if (v.startsWith("folder:")) {
    const path = v.slice("folder:".length).trim();
    return path ? (`folder:${path}` as MailBox) : "inbox";
  }
  return "inbox";
}

export function mailBoxLabel(box: MailBox) {
  if (isSystemMailBox(box)) return MAIL_BOX_LABELS[box];
  return box.slice("folder:".length).split(/[./]/).pop() || "Carpeta";
}

export function customFolderBox(path: string): MailBox {
  return `folder:${path}`;
}

export function customFolderPath(box: MailBox): string | null {
  return box.startsWith("folder:") ? box.slice("folder:".length) : null;
}
