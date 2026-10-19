import { NextResponse } from "next/server";
import {
  APP_DEMO_MAX_SCREENS,
  sanitizeAppDemoSpec,
  type AppDemoCapture,
  type AppDemoKindHint,
} from "@/lib/creator/app-demo";
import { requireProjectOwner } from "@/lib/mail/access";
import { openaiChatJson, type OpenAIContentPart } from "@/lib/openai/chat";
import { getOpenAIApiKey } from "@/lib/openai/user-key";

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const SYSTEM = `You rebuild any mobile/web app as a playable mini-app from screenshots, for a Remotion demo video.

Return JSON only with this shape:
{
  "appName": string,
  "tagline": string,
  "cta": string,
  "accent": "#rrggbb",
  "background": "#09090b",
  "kind": "screens" | "functional",
  "summary": string,
  "startScreen": string,
  "tabs": [{"id": string, "label": string, "screen": string}],
  "state": { "key": string|number|boolean },
  "screens": [{
    "id": string,
    "name": string,
    "background": "#ffffff",
    "hotspots": [{"id": string, "x": 0-100, "y": 0-100, "w": 0-100, "h": 0-100, "label": string, "action": Action}],
    "nodes": [UiNode]
  }],
  "demo": [DemoStep]
}

Action = {"type":"navigate","screen":id} | {"type":"back"} | {"type":"set","key":string,"value":string|number|boolean} | {"type":"toggle","key":string} | {"type":"inc","key":string,"by":1} | {"type":"none"}

UiNode types:
- {"type":"navbar","id","title","back"?}
- {"type":"title","id","text","sub"?}
- {"type":"text","id","text"}
- {"type":"button","id","label","variant":"primary"|"secondary"|"ghost","action"}
- {"type":"input","id","bind","placeholder"}
- {"type":"toggle","id","bind","label"}
- {"type":"list","id","items":[{"id","title","sub"?,"action"?}]}
- {"type":"cards","id","items":[{"id","title","sub"?,"meta"?,"action"?}]}
- {"type":"tabs","id","bind","items":[{"id","label"}]}
- {"type":"stat","id","label","value","bind"?}
- {"type":"chip","id","text"}
- {"type":"spacer","id"}

DemoStep:
- {"op":"wait","ms":number,"caption"?}
- {"op":"tap","target": hotspot|node|item|tab id, "caption"?}
- {"op":"type","bind":string,"text":string,"caption"?}

Rules:
- Screen ids MUST be exactly the capture ids given (cap-1, etc).
- kind=screens: keep the real screenshots. Add hotspots on tappable UI (nav, buttons, tabs, cards). nodes may be empty. This is for gallery/onboarding/simple flows.
- kind=functional: REBUILD a simplified working UI with nodes (forms, toggles, lists, cart, tabs, stats). Infer missing logic from the screenshots + notes (login, add to cart, filters, settings). Still include hotspots as a fallback. Use state keys the demo can change.
- Prefer kind=functional if the app has real actions (auth, cart, feed, editor, settings). Prefer screens if it is mostly static marketing/screens.
- Language of copy: same as the screenshots (usually Spanish).
- demo: 6-14 steps that SHOW the app working. Tap real ids. Include type steps for inputs. Captions are short (what the user is doing).
- tabs: only if the app has a tab bar. Max 5.
- Max 10 hotspots and 16 nodes per screen.
- Do not invent extra screens beyond the captures.`;

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return url;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 32 || buf.byteLength > 7 * 1024 * 1024) return url;
  const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!mime.startsWith("image/")) return url;
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  let body: {
    screens?: AppDemoCapture[];
    notes?: string;
    appName?: string;
    tagline?: string;
    cta?: string;
    accent?: string;
    kindHint?: AppDemoKindHint;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const screens = (body.screens || [])
    .filter((s) => s && typeof s.url === "string" && s.url)
    .slice(0, APP_DEMO_MAX_SCREENS);
  if (screens.length < 1) {
    return NextResponse.json(
      { error: "Sube al menos una captura de la app." },
      { status: 400 }
    );
  }

  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "NOT_CONNECTED",
        message: "Conecta OpenAI en Supabase → Secrets para que ChatGPT arme la mini-app.",
      },
      { status: 403 }
    );
  }

  const kindHint = body.kindHint || "auto";
  const force =
    kindHint === "screens"
      ? "Force kind=screens."
      : kindHint === "functional"
        ? "Force kind=functional and rebuild working controls."
        : "Choose kind automatically.";

  const listing = screens
    .map(
      (s, i) =>
        `${i + 1}. id=${s.id} name="${(s.caption || `Pantalla ${i + 1}`).slice(0, 60)}"`
    )
    .join("\n");

  const parts: OpenAIContentPart[] = [
    {
      type: "text",
      text: `Build a mini-app from these screenshots.
App name hint: ${(body.appName || "").trim() || "(infer)"}
Tagline hint: ${(body.tagline || "").trim() || "(infer)"}
CTA hint: ${(body.cta || "").trim() || "Descarga la app"}
Accent hint: ${(body.accent || "").trim() || "(infer from UI)"}
${force}
User notes about functions / flows:
${(body.notes || "").trim() || "(none)"}

Capture ids (use these as screen ids):
${listing}`,
    },
  ];

  try {
    for (const screen of screens) {
      const url = await toDataUrl(screen.url);
      parts.push({
        type: "text",
        text: `Screenshot ${screen.id}: ${screen.caption || screen.id}`,
      });
      parts.push({
        type: "image_url",
        image_url: { url, detail: "high" },
      });
    }

    const raw = await openaiChatJson<unknown>(apiKey, {
      model: "gpt-4o",
      temperature: 0.3,
      maxTokens: 8000,
      system: SYSTEM,
      user: parts,
    });

    const spec = sanitizeAppDemoSpec(raw, screens, {
      appName: (body.appName || "").trim(),
      tagline: (body.tagline || "").trim(),
      cta: (body.cta || "").trim() || "Descarga la app",
      accent: (body.accent || "").trim() || "#6366f1",
    });

    if (kindHint === "screens") spec.kind = "screens";
    if (kindHint === "functional") spec.kind = "functional";

    if (!spec.screens.length) {
      return NextResponse.json(
        { error: "ChatGPT no pudo reconstruir pantallas." },
        { status: 502 }
      );
    }

    return NextResponse.json({ spec });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "No se pudo crear la mini-app",
      },
      { status: 502 }
    );
  }
}
