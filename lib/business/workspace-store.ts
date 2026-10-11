export type TaskStatus = "todo" | "doing" | "done";
export type ContractStatus = "draft" | "active" | "expired";
export type DocumentKind = "note" | "link" | "file";
export type TeamRole = "admin" | "member";

export type BusinessTask = {
  id: string;
  title: string;
  status: TaskStatus;
  due: string | null;
  createdAt: string;
};

export type BusinessDocument = {
  id: string;
  title: string;
  kind: DocumentKind;
  url: string;
  notes: string;
  createdAt: string;
  file?: { path: string; name: string; size: number; type: string };
};

export type BusinessContract = {
  id: string;
  title: string;
  party: string;
  status: ContractStatus;
  amount: string;
  start: string;
  end: string;
  createdAt: string;
};

export type BusinessMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  createdAt: string;
};

export type BusinessWorkspace = {
  tasks: BusinessTask[];
  documents: BusinessDocument[];
  contracts: BusinessContract[];
  team: BusinessMember[];
};

export const emptyWorkspace = (): BusinessWorkspace => ({
  tasks: [],
  documents: [],
  contracts: [],
  team: [],
});

function storageKey(userKey: string) {
  return `zima:business:${userKey}`;
}

export function loadWorkspace(userKey: string): BusinessWorkspace {
  if (typeof window === "undefined") return emptyWorkspace();
  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) return emptyWorkspace();
    const parsed = JSON.parse(raw) as Partial<BusinessWorkspace>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      contracts: Array.isArray(parsed.contracts) ? parsed.contracts : [],
      team: Array.isArray(parsed.team) ? parsed.team : [],
    };
  } catch {
    return emptyWorkspace();
  }
}

export function saveWorkspace(userKey: string, data: BusinessWorkspace) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userKey), JSON.stringify(data));
  } catch {
    // quota / private mode
  }
}

export function newId() {
  return crypto.randomUUID();
}
