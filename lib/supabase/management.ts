import type { AuthClientUser, SupabaseRemoteProject } from "@/lib/types";
import { fingerprint } from "@/lib/hash";

const MANAGEMENT_API = "https://api.supabase.com/v1";

type Timed<T> = { value: T; expiresAt: number };

const remotesCache = new Map<string, Timed<SupabaseRemoteProject[]>>();
const serviceKeyCache = new Map<string, Timed<string>>();
const usersCache = new Map<
  string,
  Timed<{ users: AuthClientUser[]; fingerprint: string }>
>();

const REMOTES_TTL_MS = 10 * 60 * 1000;
const SERVICE_KEY_TTL_MS = 60 * 60 * 1000;
const USERS_TTL_MS = 5 * 60 * 1000;

function requireToken(accessToken: string) {
  const token = accessToken.trim();
  if (!token) {
    throw new Error(
      "Conecta tu cuenta de Supabase para ver y seleccionar proyectos."
    );
  }
  return token;
}

function cacheScope(accessToken: string) {
  return fingerprint(accessToken.trim());
}

function getFresh<T>(entry: Timed<T> | null | undefined): T | null {
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.value;
}

export async function validateSupabaseAccessToken(accessToken: string) {
  const token = requireToken(accessToken);
  const res = await fetch(`${MANAGEMENT_API}/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token inválido o sin acceso. Crea un Access Token en Supabase. (${res.status}) ${text}`
    );
  }
  return true;
}

export async function listRemoteSupabaseProjects(
  accessToken: string
): Promise<SupabaseRemoteProject[]> {
  const token = requireToken(accessToken);
  const scope = cacheScope(token);
  const cached = getFresh(remotesCache.get(scope));
  if (cached) return cached;

  const res = await fetch(`${MANAGEMENT_API}/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudieron listar proyectos Supabase: ${text}`);
  }

  const data = (await res.json()) as Array<{
    id: string;
    name: string;
    region: string;
  }>;

  const remotes = data
    .map((p) => ({ id: p.id, name: p.name, region: p.region }))
    .sort((a, b) => a.name.localeCompare(b.name));

  remotesCache.set(scope, {
    value: remotes,
    expiresAt: Date.now() + REMOTES_TTL_MS,
  });

  return remotes;
}

async function getServiceRoleKey(
  accessToken: string,
  projectRef: string
): Promise<string> {
  const token = requireToken(accessToken);
  const key = `${cacheScope(token)}:${projectRef}`;
  const cached = getFresh(serviceKeyCache.get(key));
  if (cached) return cached;

  const res = await fetch(`${MANAGEMENT_API}/projects/${projectRef}/api-keys`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudieron obtener API keys: ${text}`);
  }

  const keys = (await res.json()) as Array<{
    name: string;
    api_key: string;
  }>;

  const service = keys.find((k) => k.name === "service_role");
  if (!service?.api_key) {
    throw new Error("No se encontró service_role para ese proyecto.");
  }

  serviceKeyCache.set(key, {
    value: service.api_key,
    expiresAt: Date.now() + SERVICE_KEY_TTL_MS,
  });

  return service.api_key;
}

export async function listAuthUsers(
  accessToken: string,
  projectRef: string,
  options?: { force?: boolean; knownFingerprint?: string | null }
): Promise<{
  users: AuthClientUser[];
  fingerprint: string;
  unchanged: boolean;
  cached: boolean;
}> {
  const token = requireToken(accessToken);
  const cacheKey = `${cacheScope(token)}:${projectRef}`;

  if (!options?.force) {
    const cached = getFresh(usersCache.get(cacheKey));
    if (cached) {
      const unchanged =
        Boolean(options?.knownFingerprint) &&
        options?.knownFingerprint === cached.fingerprint;
      return {
        users: cached.users,
        fingerprint: cached.fingerprint,
        unchanged,
        cached: true,
      };
    }
  }

  const serviceKey = await getServiceRoleKey(token, projectRef);
  const url = `https://${projectRef}.supabase.co/auth/v1/admin/users?page=1&per_page=200`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudieron cargar usuarios: ${text}`);
  }

  const payload = (await res.json()) as {
    users?: Array<{
      id: string;
      email?: string;
      phone?: string;
      created_at: string;
      last_sign_in_at?: string;
      email_confirmed_at?: string;
    }>;
  };

  const users = (payload.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    phone: u.phone ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
  }));

  const fp = fingerprint(users);
  usersCache.set(cacheKey, {
    value: { users, fingerprint: fp },
    expiresAt: Date.now() + USERS_TTL_MS,
  });

  const unchanged =
    Boolean(options?.knownFingerprint) && options?.knownFingerprint === fp;

  return {
    users,
    fingerprint: fp,
    unchanged,
    cached: false,
  };
}
