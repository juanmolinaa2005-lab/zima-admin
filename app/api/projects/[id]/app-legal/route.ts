import { NextResponse } from "next/server";
import {
  bundleReady,
  defaultBundle,
  hostedLegalUrl,
  legalPublicSlug,
  LEGAL_DOCS,
  normalizeDomain,
  parseBundle,
  parseHistory,
  parseNotice,
  parsePublication,
  type LegalBundle,
  type LegalNotice,
  type LegalState,
} from "@/lib/creator/app-legal";
import { getOwnedMailAccount, requireProjectOwner } from "@/lib/mail/access";
import { sendMail } from "@/lib/mail/titan";
import { listAuthUsers } from "@/lib/supabase/management";
import { getCurrentUserSupabaseAccessToken } from "@/lib/supabase/user-token";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const NOTICE_CAP = 120;

function originFrom(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "https://vantko.com";
}

function cleanDomain(bundle: LegalBundle) {
  const raw = bundle.profile.domain.trim();
  if (!raw) {
    bundle.profile.domain = "";
    return null;
  }
  const domain = normalizeDomain(raw);
  if (!domain) return "Escribe el dominio sin ruta, por ejemplo app.tudominio.com";
  bundle.profile.domain = domain;
  return null;
}

type OwnerClient = Extract<
  Awaited<ReturnType<typeof requireProjectOwner>>,
  { ok: true }
>["supabase"];

async function loadState(
  supabase: OwnerClient,
  projectId: string,
  projectName: string
): Promise<LegalState> {
  const { data, error } = await supabase
    .from("project_app_legal")
    .select("draft, published, version, history, last_notice, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const draft = data?.draft
    ? parseBundle(data.draft, projectName)
    : defaultBundle(projectName);
  if (!draft.profile.appName) draft.profile.appName = projectName;
  return {
    projectName,
    draft,
    published: parsePublication(data?.published),
    version: Number(data?.version) || 0,
    history: parseHistory(data?.history),
    lastNotice: parseNotice(data?.last_notice),
    updatedAt: data?.updated_at ? String(data.updated_at) : null,
  };
}

export async function GET(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;
  const { data: project, error } = await gate.supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    const state = await loadState(gate.supabase, projectId, project?.name || "");
    return NextResponse.json({
      ...state,
      origin: originFrom(request),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cargar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    draft?: unknown;
    accountId?: string;
    subject?: string;
    note?: string;
  } | null;
  const action = body?.action || "";
  const { data: project } = await gate.supabase
    .from("projects")
    .select("name, supabase_project_ref")
    .eq("id", projectId)
    .maybeSingle();
  const projectName = project?.name || "";

  if (action === "save") {
    const draft = parseBundle(body?.draft, projectName);
    const domainError = cleanDomain(draft);
    if (domainError) {
      return NextResponse.json({ error: domainError }, { status: 400 });
    }
    const { error } = await gate.supabase.from("project_app_legal").upsert(
      {
        project_id: projectId,
        draft,
        slug: legalPublicSlug(draft.profile) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const state = await loadState(gate.supabase, projectId, projectName);
    return NextResponse.json({ ...state, origin: originFrom(request) });
  }

  if (action === "publish") {
    let current: LegalState;
    try {
      current = await loadState(gate.supabase, projectId, projectName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo publicar";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    const draft = current.draft;
    const domainError = cleanDomain(draft);
    if (domainError) {
      return NextResponse.json({ error: domainError }, { status: 400 });
    }
    if (!bundleReady(draft)) {
      return NextResponse.json(
        { error: "Pon el nombre de la app y un correo de contacto antes de publicar." },
        { status: 400 }
      );
    }
    const version = (current.version || 0) + 1;
    const publishedAt = new Date().toISOString();
    const history = [{ version, publishedAt }, ...current.history].slice(0, 12);
    const { error } = await gate.supabase.from("project_app_legal").upsert(
      {
        project_id: projectId,
        draft,
        slug: legalPublicSlug(draft.profile) || null,
        published: { ...draft, version, publishedAt },
        version,
        history,
        updated_at: publishedAt,
      },
      { onConflict: "project_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const state = await loadState(gate.supabase, projectId, projectName);
    return NextResponse.json({ ...state, origin: originFrom(request) });
  }

  if (action === "notify") {
    const accountId = (body?.accountId || "").trim();
    if (!accountId) {
      return NextResponse.json({ error: "Elige la cuenta de correo" }, { status: 400 });
    }
    let current: LegalState;
    try {
      current = await loadState(gate.supabase, projectId, projectName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo avisar";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    if (!current.published) {
      return NextResponse.json(
        { error: "Publica los documentos antes de avisar." },
        { status: 400 }
      );
    }
    const owned = await getOwnedMailAccount(projectId, accountId);
    if (!owned.ok) return owned.response;

    const accessToken = await getCurrentUserSupabaseAccessToken();
    const ref = project?.supabase_project_ref || "";
    if (!accessToken || !ref) {
      return NextResponse.json(
        {
          error:
            "Conecta el Supabase de la app en Clients para leer los correos de tus usuarios.",
        },
        { status: 400 }
      );
    }

    let emails: string[] = [];
    try {
      const listed = await listAuthUsers(accessToken, ref);
      emails = Array.from(
        new Set(
          listed.users
            .map((user) => (user.email || "").trim().toLowerCase())
            .filter((email) => email.includes("@"))
        )
      ).slice(0, NOTICE_CAP);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron leer los usuarios";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    if (!emails.length) {
      return NextResponse.json(
        { error: "No hay usuarios con correo en la app." },
        { status: 400 }
      );
    }

    const origin = originFrom(request);
    const published = current.published;
    const appName = published.profile.appName || projectName || "la app";
    const subject =
      (body?.subject || "").trim().slice(0, 180) ||
      `Actualizamos los documentos legales de ${appName}`;
    const note = (body?.note || "").trim().slice(0, 500);
    const links = LEGAL_DOCS.map((doc) => ({
      label: doc.title,
      url: hostedLegalUrl(origin, published.profile, doc.id),
    }));
    const date = new Date(published.publishedAt).toLocaleDateString("es", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const text = [
      note || `Hemos actualizado los documentos legales de ${appName}.`,
      "",
      `Versión ${published.version}, vigente desde el ${date}.`,
      "Los enlaces no cambian: siempre muestran la versión publicada.",
      "",
      ...links.map((link) => `${link.label}: ${link.url}`),
      "",
      `Si sigues usando ${appName}, estos documentos actualizados se aplican a tu cuenta.`,
      "",
      published.profile.legalName || appName,
      published.profile.contactEmail,
    ].join("\n");
    const html = `<div style="font-family:Georgia,serif;color:#111827;line-height:1.55;font-size:16px">
<p>${escapeHtml(note || `Hemos actualizado los documentos legales de ${appName}.`)}</p>
<p>Versión ${published.version}, vigente desde el ${escapeHtml(date)}. Los enlaces no cambian: siempre muestran la versión publicada.</p>
<ul>${links
      .map(
        (link) =>
          `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`
      )
      .join("")}</ul>
<p>Si sigues usando ${escapeHtml(appName)}, estos documentos actualizados se aplican a tu cuenta.</p>
<p>${escapeHtml(published.profile.legalName || appName)}<br>${escapeHtml(published.profile.contactEmail)}</p>
</div>`;

    let sent = 0;
    let failed = 0;
    for (const email of emails) {
      try {
        await sendMail(owned.creds, { to: email, subject, text, html });
        sent += 1;
      } catch {
        failed += 1;
      }
    }
    const lastNotice: LegalNotice = {
      at: new Date().toISOString(),
      version: published.version,
      sent,
      failed,
      subject,
      from: owned.creds.email,
    };
    await gate.supabase
      .from("project_app_legal")
      .update({ last_notice: lastNotice, updated_at: lastNotice.at })
      .eq("project_id", projectId);
    return NextResponse.json({ ok: true, lastNotice, recipients: emails.length });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
