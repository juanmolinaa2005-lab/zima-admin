import { NextResponse } from "next/server";
import { pickBlitzCarousels } from "@/lib/creator/blitz-pick";
import {
  activeBlitzRoutes,
  destFolderForSource,
  normalizeBlitzSettings,
  type BlitzCarousel,
  type BlitzGenSettings,
} from "@/lib/creator/estudio-v1";
import { GALLERY_ASSET_SELECT, mapGalleryAsset } from "@/lib/gallery/asset";
import { requireProjectOwner } from "@/lib/mail/access";
import { openaiChatJson } from "@/lib/openai/chat";
import { getOpenAIApiKey } from "@/lib/openai/user-key";

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  kind?: string | null;
};

function folderPath(folders: FolderRow[], id: string | null): string {
  if (!id) return "Galería";
  const map = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur = map.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  return parts.join(" / ") || "Galería";
}

function looksLikeHashtag(overlay: string, hashtag: string | null): boolean {
  const o = overlay.trim().toLowerCase();
  const h = (hashtag || "").trim().toLowerCase();
  if (!o) return true;
  if (!h) return false;
  if (o === h) return true;
  if (h.length > 24 && o.includes(h.slice(0, 40))) return true;
  if (o.length > 24 && h.includes(o)) return true;
  const oWords = new Set(o.split(/[^a-z0-9áéíóúñü]+/i).filter((w) => w.length > 4));
  const hWords = h.split(/[^a-z0-9áéíóúñü]+/i).filter((w) => w.length > 4);
  if (hWords.length < 4) return false;
  const hit = hWords.filter((w) => oWords.has(w)).length;
  return hit / hWords.length >= 0.45;
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    settings?: Partial<BlitzGenSettings>;
    productContext?: string;
    baseIdea?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const settings = normalizeBlitzSettings(body.settings);
  const routes = activeBlitzRoutes(settings);
  if (!routes.length) {
    return NextResponse.json(
      {
        error:
          "En ajustes, elige de qué carpeta salen las fotos y en cuál se guarda cada una.",
      },
      { status: 400 }
    );
  }
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Conecta OpenAI API en Ajustes para generar con ChatGPT.",
      },
      { status: 400 }
    );
  }

  const [foldersRes, assetsRes] = await Promise.all([
    supabase
      .from("project_gallery_folders")
      .select("id, name, parent_id, kind")
      .eq("project_id", projectId)
      .eq("user_id", user.id),
    supabase
      .from("project_gallery_assets")
      .select(GALLERY_ASSET_SELECT)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("kind", "image")
      .order("created_at", { ascending: false })
      .limit(800),
  ]);

  if (foldersRes.error) {
    return NextResponse.json({ error: foldersRes.error.message }, { status: 500 });
  }
  if (assetsRes.error) {
    return NextResponse.json({ error: assetsRes.error.message }, { status: 500 });
  }

  const folders = (foldersRes.data ?? []) as FolderRow[];
  const folderKind = new Map(
    folders.map((f) => [f.id, f.kind === "carousel" ? "carousel" : "folder"])
  );
  const sourceFilter = new Set(routes.map((r) => r.sourceId));
  const assets = (assetsRes.data ?? [])
    .map(mapGalleryAsset)
    .filter((a) => {
      if (!a.publicUrl || !a.folderId) return false;
      if (folderKind.get(a.folderId) === "carousel") return false;
      return sourceFilter.has(a.folderId);
    })
    .map((a) => ({
      id: a.id,
      publicUrl: a.publicUrl,
      hashtag: a.hashtag,
      name: a.name,
      folderId: a.folderId || "",
      folderName: folderPath(folders, a.folderId),
    }))
    .filter((a) => a.folderId);

  if (assets.length < 2) {
    return NextResponse.json(
      {
        error:
          "No hay suficientes fotos en las carpetas de origen. Sube imágenes o elige otras carpetas.",
      },
      { status: 400 }
    );
  }

  const picked = pickBlitzCarousels(assets, {
    count: settings.carouselsPerGeneration,
    photosMin: settings.photosMin,
    photosMax: settings.photosMax,
  });

  if (!picked.length) {
    return NextResponse.json(
      {
        error:
          "Ninguna carpeta de origen tiene al menos 2 imágenes para armar un carrusel.",
      },
      { status: 400 }
    );
  }

  const product = (body.productContext || "").trim();
  const idea = (body.baseIdea || "").trim();

  if (!product) {
    return NextResponse.json(
      {
        error:
          "Falta el contexto del producto. Ábrelo en Producto (arriba de Blitz) y pega los detalles de la app.",
      },
      { status: 400 }
    );
  }

  type GptOut = {
    carousels?: Array<{
      index?: number;
      format?: string;
      angle?: string;
      why?: string;
      overlays?: string[];
    }>;
  };

  let gpt: GptOut = {};
  try {
    const mentionRule = settings.mentionApp
      ? "MENTION THE APP: The product brief already has the real app name and details. Use that name naturally in the first overlay and the last overlay of every carousel. Never invent a different product."
      : "DO NOT name the app, brand, or product. Still write from the product brief (pain, audience, promise) without saying the name.";

    const carouselPayload = picked.map((c, index) => ({
      index,
      slideCount: c.slides.length,
    }));

    gpt = await openaiChatJson<GptOut>(apiKey, {
      model: "gpt-4o",
      temperature: 0.75,
      maxTokens: 8000,
      system:
        "You are a performance creative copywriter for TikTok/Reels photo carousels. Write overlay captions using marketing techniques: pattern-interrupt hook, PAS or AIDA, open loop, specific pain, benefit payoff, native UGC voice. The PRODUCT BRIEF is the only source for claims, audience, tone, offer, and app name. Images are already chosen — do not describe them, do not quote image prompts, do not paste hashtags, filenames, or photo metadata into captions. Reply with JSON only: {\"carousels\":[{\"index\":0,\"format\":\"Slideshow\",\"angle\":\"short marketing angle from the brief\",\"why\":\"why this angle converts\",\"overlays\":[\"caption 1\"]}]} Each overlay: 8-16 spoken words, one idea, no hashtags, no emoji spam. Same language as the product brief. overlays.length MUST equal slideCount. Slide 1 = hook. Middle = story/agitation. Last = payoff.",
      user: [
        "PRODUCT BRIEF (source of truth for every caption):",
        product,
        "",
        idea ? `BASE IDEA / REMIX ANGLE:\n${idea}` : "",
        "",
        mentionRule,
        "",
        "Write one scripted carousel per item. slideCount = how many overlays you must return.",
        JSON.stringify(carouselPayload),
      ]
        .filter((line) => line !== "")
        .join("\n"),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo generar el texto con ChatGPT",
      },
      { status: 502 }
    );
  }

  const gptMap = new Map(
    (gpt.carousels ?? [])
      .filter((c) => typeof c.index === "number")
      .map((c) => [c.index as number, c])
  );

  const carousels: BlitzCarousel[] = picked.flatMap((c, index) => {
    const meta = gptMap.get(index);
    const overlays = Array.isArray(meta?.overlays) ? meta.overlays : [];
    const destFolderId = destFolderForSource(c.folderId, routes);
    if (!destFolderId) return [];
    return [
      {
        id: crypto.randomUUID(),
        folderId: c.folderId,
        folderName: c.folderName,
        destFolderId,
        format: (meta?.format || "Slideshow").trim() || "Slideshow",
        angle: (meta?.angle || c.folderName).trim() || c.folderName,
        why:
          (meta?.why || `Carrusel armado con fotos de ${c.folderName}.`).trim(),
        slides: c.slides.map((s, i) => {
          const fromGpt = (overlays[i] || "").trim();
          const overlay =
            fromGpt && !looksLikeHashtag(fromGpt, s.hashtag) ? fromGpt : "";
          return {
            assetId: s.id,
            imageUrl: s.publicUrl,
            overlay: overlay || `Slide ${i + 1}`,
            hashtag: s.hashtag,
          };
        }),
      },
    ];
  });

  return NextResponse.json({ carousels });
}
