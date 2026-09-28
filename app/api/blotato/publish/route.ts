import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { blotatoPublish, type BlotatoPlatform } from "@/lib/blotato/client";
import { getBlotatoApiKey } from "@/lib/blotato/user-key";

const PLATFORMS = new Set<BlotatoPlatform>(["tiktok"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const apiKey = await getBlotatoApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Connect Blotato in Settings → API first." },
      { status: 400 }
    );
  }

  let body: {
    accountId?: string;
    platform?: string;
    text?: string;
    mediaUrls?: string[];
    videoUrl?: string;
    privacyLevel?:
      | "SELF_ONLY"
      | "PUBLIC_TO_EVERYONE"
      | "MUTUAL_FOLLOW_FRIENDS"
      | "FOLLOWER_OF_CREATOR";
    isDraft?: boolean;
    title?: string;
    youtubePrivacy?: "private" | "public" | "unlisted";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = (body.accountId || "").trim();
  const platform = (body.platform || "tiktok") as BlotatoPlatform;
  const text = (body.text || "").trim();
  const mediaUrls = [
    ...(body.mediaUrls ?? []),
    ...(body.videoUrl ? [body.videoUrl.trim()] : []),
  ].filter(Boolean);

  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }
  if (!PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  if (mediaUrls.length === 0) {
    return NextResponse.json(
      { error: "At least one media URL is required." },
      { status: 400 }
    );
  }

  try {
    const result = await blotatoPublish(apiKey, {
      accountId,
      platform,
      text,
      mediaUrls,
      privacyLevel: body.privacyLevel,
      isDraft: body.isDraft,
      title: body.title || text,
      youtubePrivacy: body.youtubePrivacy,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Publish failed" },
      { status: 502 }
    );
  }
}
