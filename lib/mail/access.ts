import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import type { MailAccountCreds } from "@/lib/mail/titan";

export type MailAccountRow = {
  id: string;
  project_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  password_ciphertext: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  created_at: string;
};

export type MailAccountPublic = {
  id: string;
  email: string;
  display_name: string | null;
  imap_host: string;
  smtp_host: string;
  created_at: string;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

export function toPublicAccount(row: MailAccountRow): MailAccountPublic {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    imap_host: row.imap_host,
    smtp_host: row.smtp_host,
    created_at: row.created_at,
  };
}

export async function requireProjectOwner(
  projectId: string
): Promise<
  | { ok: false; response: Response }
  | { ok: true; supabase: Supabase; user: User }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: Response.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!project || project.owner_id !== user.id) {
    return {
      ok: false,
      response: Response.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      ),
    };
  }

  return { ok: true, supabase, user };
}

export async function getOwnedMailAccount(
  projectId: string,
  accountId: string
): Promise<
  | { ok: false; response: Response }
  | {
      ok: true;
      supabase: Supabase;
      user: User;
      row: MailAccountRow;
      creds: MailAccountCreds;
    }
> {
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_mail_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: Response.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!data) {
    return {
      ok: false,
      response: Response.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      ),
    };
  }

  const row = data as MailAccountRow;
  return {
    ok: true,
    supabase,
    user,
    row,
    creds: {
      email: row.email,
      password: decryptSecret(row.password_ciphertext),
      imapHost: row.imap_host,
      imapPort: row.imap_port,
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
    },
  };
}
