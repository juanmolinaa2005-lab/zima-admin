import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import {
  requireProjectOwner,
  toPublicAccount,
  type MailAccountRow,
} from "@/lib/mail/access";
import { MAIL_DEFAULTS } from "@/lib/mail/defaults";
import { verifyMailCredentials } from "@/lib/mail/titan";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_mail_accounts")
    .select(
      "id, email, display_name, imap_host, smtp_host, created_at, project_id, user_id, password_ciphertext, imap_port, smtp_port"
    )
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    accounts: ((data ?? []) as MailAccountRow[]).map(toPublicAccount),
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    email?: string;
    password?: string;
    displayName?: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() || null;
  const imapHost = body.imapHost?.trim() || MAIL_DEFAULTS.imapHost;
  const imapPort = Number(body.imapPort) || MAIL_DEFAULTS.imapPort;
  const smtpHost = body.smtpHost?.trim() || MAIL_DEFAULTS.smtpHost;
  const smtpPort = Number(body.smtpPort) || MAIL_DEFAULTS.smtpPort;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y contraseña son obligatorios" },
      { status: 400 }
    );
  }

  try {
    await verifyMailCredentials({
      email,
      password,
      imapHost,
      imapPort,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo conectar al servidor IMAP";
    return NextResponse.json(
      {
        error: `Conexión fallida: ${message}. Revisa email, contraseña y que IMAP esté habilitado (imap.hostinger.com:993).`,
      },
      { status: 400 }
    );
  }

  const ciphertext = encryptSecret(password);
  const { data, error } = await supabase
    .from("project_mail_accounts")
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        email,
        display_name: displayName,
        password_ciphertext: ciphertext,
        imap_host: imapHost,
        imap_port: imapPort,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,user_id,email" }
    )
    .select(
      "id, email, display_name, imap_host, smtp_host, created_at, project_id, user_id, password_ciphertext, imap_port, smtp_port"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    account: toPublicAccount(data as MailAccountRow),
  });
}
