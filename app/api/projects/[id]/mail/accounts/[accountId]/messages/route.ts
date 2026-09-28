import { after, NextResponse } from "next/server";
import { getOwnedMailAccount } from "@/lib/mail/access";
import {
  clearInboxCache,
  getInboxCacheEntry,
  setInboxCache,
} from "@/lib/mail/cache";
import { listMailbox, sendMail } from "@/lib/mail/titan";
import { parseMailBox } from "@/lib/mail/boxes";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string; accountId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: projectId, accountId } = await params;
  const gate = await getOwnedMailAccount(projectId, accountId);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";
  const box = parseMailBox(searchParams.get("box"));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || 25) || 25)
  );

  if (!force) {
    const cached = getInboxCacheEntry(accountId, box);
    if (cached) {
      if (!cached.fresh) {
        after(() => {
          void listMailbox(gate.creds, { limit, box })
            .then(({ messages }) => {
              setInboxCache(accountId, messages, box);
            })
            .catch(() => undefined);
        });
      }
      return NextResponse.json({
        messages: cached.messages,
        cached: true,
        stale: !cached.fresh,
        box,
      });
    }
  }

  try {
    const { messages, mailboxPath } = await listMailbox(gate.creds, {
      limit,
      box,
    });
    setInboxCache(accountId, messages, box);
    return NextResponse.json({
      messages,
      cached: false,
      box,
      mailboxPath,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo leer el buzón";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId, accountId } = await params;
  const gate = await getOwnedMailAccount(projectId, accountId);
  if (!gate.ok) return gate.response;

  let body: {
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    inReplyTo?: string;
    references?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const to = body.to?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const text = body.text ?? "";

  if (!to || !subject || !text.trim()) {
    return NextResponse.json(
      { error: "Para, asunto y mensaje son obligatorios" },
      { status: 400 }
    );
  }

  try {
    await sendMail(gate.creds, {
      to,
      subject,
      text,
      html: body.html,
      inReplyTo: body.inReplyTo,
      references: body.references,
    });
    clearInboxCache(accountId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo enviar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
