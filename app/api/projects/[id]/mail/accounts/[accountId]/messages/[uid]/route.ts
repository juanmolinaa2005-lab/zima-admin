import { NextResponse } from "next/server";
import { getOwnedMailAccount } from "@/lib/mail/access";
import { getMessageCache, setMessageCache } from "@/lib/mail/cache";
import { getMessage } from "@/lib/mail/titan";
import { parseMailBox } from "@/lib/mail/boxes";

export const maxDuration = 60;

type Params = {
  params: Promise<{ id: string; accountId: string; uid: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const { id: projectId, accountId, uid: uidRaw } = await params;
  const uid = Number(uidRaw);
  if (!Number.isFinite(uid) || uid <= 0) {
    return NextResponse.json({ error: "UID inválido" }, { status: 400 });
  }

  const gate = await getOwnedMailAccount(projectId, accountId);
  if (!gate.ok) return gate.response;

  const searchParams = new URL(request.url).searchParams;
  const box = parseMailBox(searchParams.get("box"));
  const folderPath = searchParams.get("path");
  const cacheBox = folderPath ? `${box}:${folderPath}` : box;

  const cached = getMessageCache(accountId, cacheBox, uid);
  if (cached) {
    return NextResponse.json({ message: cached, cached: true });
  }

  try {
    const message = await getMessage(gate.creds, uid, box, folderPath);
    if (!message) {
      return NextResponse.json(
        { error: "Mensaje no encontrado" },
        { status: 404 }
      );
    }
    setMessageCache(accountId, cacheBox, message);
    return NextResponse.json({ message });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo abrir el mensaje";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
