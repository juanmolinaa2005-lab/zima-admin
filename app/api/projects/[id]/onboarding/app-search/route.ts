import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { appDetail, searchApps } from "@/lib/market/appstore";
import { parseAppStoreUrl } from "@/lib/onboarding/questions";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 200);
  if (q.length < 2) return NextResponse.json({ apps: [] });

  const link = parseAppStoreUrl(q);
  if (link) {
    const app = await appDetail(link.id, link.country);
    return NextResponse.json({ apps: app ? [{ ...app, country: link.country }] : [] });
  }

  const [us, es] = await Promise.all([searchApps(q, "us", 6), searchApps(q, "es", 6)]);
  const seen = new Set<string>();
  const apps = [...us.map((a) => ({ ...a, country: "us" })), ...es.map((a) => ({ ...a, country: "es" }))]
    .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
    .slice(0, 6);
  return NextResponse.json({ apps });
}
