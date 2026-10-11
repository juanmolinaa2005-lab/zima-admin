export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  supabase_project_ref: string | null;
  created_at: string;
};

export type ProjectTool = {
  id: string;
  project_id: string;
  name: string;
  url: string;
  sort_order: number;
  direct_access: boolean;
  icon_url: string | null;
  tool_kind: "app" | "social";
  created_at: string;
};

export type ProjectToolRow = ProjectTool;

export type ToolKind =
  | "home"
  | "miapp"
  | "launch"
  | "apps"
  | "clients"
  | "emails"
  | "analytics"
  | "use" // legacy alias of analytics
  | "marketing"
  | "estudio"
  | "gallery"
  | "redes"
  | "viewtracker"
  | "market"
  | "monetization"
  | "link"
  | "social";

export type MailAccountPublic = {
  id: string;
  email: string;
  display_name: string | null;
  imap_host: string;
  smtp_host: string;
  created_at: string;
};

export type MailListItem = {
  uid: number;
  subject: string;
  from: string;
  to?: string;
  date: string | null;
  seen: boolean;
  snippet: string;
  mailboxPath?: string;
};

export type MailMessage = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string | null;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
};

export type WorkspaceTool = {
  id: string;
  name: string;
  kind: ToolKind;
  url?: string;
  directAccess?: boolean;
  iconUrl?: string | null;
};

export type OpenTab = {
  id: string;
  toolId: string;
  title: string;
  kind: ToolKind;
  url?: string;
};

export type SupabaseRemoteProject = {
  id: string;
  name: string;
  region: string;
};

export type AuthClientUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  phone: string | null;
  email_confirmed_at: string | null;
};

export function createTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function builtInTools(): WorkspaceTool[] {
  return [
    { id: "miapp", name: "Mi app", kind: "miapp" },
    { id: "launch", name: "Lanzamiento", kind: "launch" },
    { id: "home", name: "Overview", kind: "home" },
    { id: "apps", name: "Accesos directos", kind: "apps" },
    { id: "clients", name: "Clients", kind: "clients" },
    { id: "emails", name: "Emails", kind: "emails" },
    { id: "analytics", name: "Analytics", kind: "analytics" },
    { id: "viewtracker", name: "Marketing", kind: "viewtracker" },
    { id: "market", name: "Market", kind: "market" },
    { id: "monetization", name: "Monetization", kind: "monetization" },
    { id: "marketing", name: "Creator Studio", kind: "marketing" },
    { id: "gallery", name: "Galería", kind: "gallery" },
    { id: "redes", name: "Redes", kind: "redes" },
  ];
}

export function toWorkspaceTools(dbTools: ProjectTool[]): WorkspaceTool[] {
  return [
    ...builtInTools(),
    ...dbTools.map((t) => ({
      id: t.id,
      name: t.name,
      kind: (t.tool_kind === "social" ? "social" : "link") as ToolKind,
      url: t.url,
      directAccess: true,
      iconUrl: t.icon_url,
    })),
  ];
}
