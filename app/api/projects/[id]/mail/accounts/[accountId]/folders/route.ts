import { NextResponse } from "next/server";
import { getOwnedMailAccount } from "@/lib/mail/access";
import { createMailFolder, listCustomMailFolders } from "@/lib/mail/titan";

type Params = { params: Promise<{ id: string; accountId: string }> };

export const maxDuration = 60;

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId, accountId } = await params;
  const gate = await getOwnedMailAccount(projectId, accountId);
  if (!gate.ok) return gate.response;

  try {
    const folders = await listCustomMailFolders(gate.creds);
    return NextResponse.json({ folders });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudieron listar las carpetas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId, accountId } = await params;
  const gate = await getOwnedMailAccount(projectId, accountId);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }

  try {
    const folder = await createMailFolder(gate.creds, name);
    return NextResponse.json({ folder });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo crear la carpeta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
