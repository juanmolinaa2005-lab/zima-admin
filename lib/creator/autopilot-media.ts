import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { concatVerticalClipsWithBedAudio } from "@/lib/creator/concat-videos";
import {
  GALLERY_ASSET_SELECT,
  mapGalleryAsset,
  normalizeHashtag,
  type GalleryAsset,
} from "@/lib/gallery/asset";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient, getServiceRoleAccess } from "@/lib/supabase/admin";
import { uploadStorageObject } from "@/lib/supabase/storage-binary";
import { downloadBinary } from "@/lib/download-binary";

type Db =
  | Awaited<ReturnType<typeof createClient>>
  | Awaited<ReturnType<typeof createAdminClient>>;

const MAX_STILL_BYTES = 40 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-800) || `ffmpeg exited ${code}`));
    });
  });
}

const WIDTH = 1080;
const HEIGHT = 1920;
const FACE_MAX_Y = Math.round(HEIGHT * 0.22);

export type AutopilotProductMedia = {
  image: GalleryAsset | null;
  video: GalleryAsset | null;
};

const EXCLUDE_PRODUCT =
  /(portrait|retrato|shot|shots|final|finale|influencer|face-front|talking|broll|identity|autopilot-)/i;
const EVIDENCE_PRODUCT =
  /(screenshot|captura|app-demo|ui|screen|demo|recording|grabaci[oó]n)/i;

export function isExcludedProductAsset(asset: GalleryAsset): boolean {
  return EXCLUDE_PRODUCT.test(asset.name);
}

export function hasProductCaptureEvidence(asset: GalleryAsset): boolean {
  if (isExcludedProductAsset(asset)) return false;
  const n = asset.name.toLowerCase();
  if (n.includes("app-demo-moun")) return true;
  return EVIDENCE_PRODUCT.test(asset.name);
}

export function scoreProductAsset(asset: GalleryAsset): number {
  const n = asset.name.toLowerCase();
  let score = 0;
  if (!hasProductCaptureEvidence(asset)) return -1000;
  if (n === "app-demo-moun.mp4" || n.startsWith("app-demo-moun.")) score += 100;
  else if (n.includes("app-demo-moun")) score += 80;
  if (/(screenshot|captura)/i.test(n)) score += 12;
  if (/app-demo/i.test(n)) score += 10;
  if (asset.kind === "video") score += 8;
  if (asset.kind === "image") score += 2;
  if (/(ui|screen|demo)/i.test(n)) score += 4;
  return score;
}

export async function loadAutopilotProductMedia(
  supabase: Db,
  projectId: string
): Promise<AutopilotProductMedia> {
  const { data, error } = await supabase
    .from("project_gallery_assets")
    .select(GALLERY_ASSET_SELECT)
    .eq("project_id", projectId)
    .in("kind", ["image", "video"])
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  const assets = (data ?? [])
    .map(mapGalleryAsset)
    .filter(hasProductCaptureEvidence);
  const images = assets
    .filter((a) => a.kind === "image")
    .sort((a, b) => scoreProductAsset(b) - scoreProductAsset(a));
  const videos = assets
    .filter((a) => a.kind === "video")
    .sort((a, b) => scoreProductAsset(b) - scoreProductAsset(a));
  const bestVideo = videos[0] ?? null;
  const bestImage = images[0] ?? null;
  if (bestVideo && (!bestImage || scoreProductAsset(bestVideo) >= scoreProductAsset(bestImage))) {
    return { image: null, video: bestVideo };
  }
  return { image: bestImage, video: bestVideo };
}

export function missingProductError(media: AutopilotProductMedia): string | null {
  if (media.image || media.video) return null;
  return "Falta una captura o demo real del producto en la galería (por ejemplo app-demo-moun.mp4). No uso retratos, shots ni videos finales.";
}

export async function downloadGalleryAsset(
  supabase: Db,
  asset: GalleryAsset,
  maxBytes: number
): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from("gallery")
    .download(asset.storagePath);
  if (error || !data) {
    throw new Error(error?.message || `No se pudo leer ${asset.name}`);
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.byteLength) throw new Error(`${asset.name} está vacío.`);
  if (buffer.byteLength > maxBytes) {
    throw new Error(`${asset.name} supera el tamaño máximo permitido.`);
  }
  return buffer;
}

export async function extractVideoFrame(video: Buffer): Promise<Buffer> {
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg para extraer el fotograma del producto.");
  const dir = await mkdtemp(path.join(tmpdir(), "zima-autopilot-frame-"));
  const input = path.join(dir, "in.bin");
  const output = path.join(dir, "frame.jpg");
  try {
    await writeFile(input, video);
    await runFfmpeg(bin, [
      "-y",
      "-i",
      input,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      output,
    ]);
    const out = await readFile(output);
    if (!out.byteLength) throw new Error("No se pudo extraer un fotograma del vídeo del producto.");
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Leftover heuristic — autopilot no longer calls this. Dark blobs are not a verified phone/face locator. */
export async function overlayProductOnPhoneStill(
  person: Buffer,
  product: Buffer
): Promise<{ buffer: Buffer; method: "corners" } | null> {
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg para componer la pantalla real.");
  const quad = await detectPhoneScreenQuad(person);
  if (!quad || !verifyQuadAwayFromFace(quad)) return null;

  const dir = await mkdtemp(path.join(tmpdir(), "zima-autopilot-phone-"));
  const personFile = path.join(dir, "person.jpg");
  const productFile = path.join(dir, "product.jpg");
  const warpedFile = path.join(dir, "warped.png");
  const outFile = path.join(dir, "out.jpg");
  try {
    await writeFile(personFile, person);
    await writeFile(productFile, product);
    const { tl, tr, br, bl } = quad;
    const box = bboxOf(quad);
    const composeAxis = async () => {
      const w = Math.max(16, box.w - (box.w % 2));
      const h = Math.max(16, box.h - (box.h % 2));
      const x = Math.max(0, box.x0 - (box.x0 % 2));
      const y = Math.max(0, box.y0 - (box.y0 % 2));
      await runFfmpeg(bin, [
        "-y",
        "-i",
        personFile,
        "-i",
        productFile,
        "-filter_complex",
        [
          `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1[bg]`,
          `[1:v]scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1[scr]`,
          `[bg][scr]overlay=${x}:${y}`,
        ].join(";"),
        "-frames:v",
        "1",
        "-q:v",
        "3",
        outFile,
      ]);
    };
    try {
      await runFfmpeg(bin, [
        "-y",
        "-i",
        productFile,
        "-filter_complex",
        [
          `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=rgba`,
          `perspective=${tl.x}:${tl.y}:${tr.x}:${tr.y}:${bl.x}:${bl.y}:${br.x}:${br.y}:interpolation=linear:sense=destination`,
        ].join(","),
        warpedFile,
      ]);
      await runFfmpeg(bin, [
        "-y",
        "-i",
        personFile,
        "-i",
        warpedFile,
        "-filter_complex",
        [
          `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1[bg]`,
          "[1:v]format=rgba,colorkey=0x000000:0.12:0.08[scr]",
          "[bg][scr]overlay=0:0:format=auto",
        ].join(";"),
        "-frames:v",
        "1",
        "-q:v",
        "3",
        outFile,
      ]);
    } catch {
      await composeAxis();
    }
    let out = await readFile(outFile).catch(() => Buffer.alloc(0));
    if (!out.byteLength || !(await verifyOverlayKeepsFace(bin, personFile, outFile, quad))) {
      await composeAxis();
      out = await readFile(outFile);
    }
    if (!out.byteLength) return null;
    if (!(await verifyOverlayKeepsFace(bin, personFile, outFile, quad))) {
      return null;
    }
    return { buffer: out, method: "corners" };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type Point = { x: number; y: number };
export type PhoneScreenQuad = {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
};

function bboxOf(q: PhoneScreenQuad) {
  const xs = [q.tl.x, q.tr.x, q.br.x, q.bl.x];
  const ys = [q.tl.y, q.tr.y, q.br.y, q.bl.y];
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function verifyQuadAwayFromFace(q: PhoneScreenQuad): boolean {
  const b = bboxOf(q);
  if (b.w < 120 || b.h < 180) return false;
  const area = (b.w * b.h) / (WIDTH * HEIGHT);
  if (area < 0.03 || area > 0.28) return false;
  if (b.y0 < FACE_MAX_Y && (FACE_MAX_Y - b.y0) / b.h > 0.25) return false;
  if (b.x0 === 280 && b.y0 === 420) return false;
  return true;
}

async function grayRaw(person: Buffer): Promise<Buffer> {
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg");
  const dir = await mkdtemp(path.join(tmpdir(), "zima-autopilot-gray-"));
  const input = path.join(dir, "in.bin");
  const output = path.join(dir, "gray.raw");
  try {
    await writeFile(input, person);
    await runFfmpeg(bin, [
      "-y",
      "-i",
      input,
      "-vf",
      `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,format=gray`,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "gray",
      output,
    ]);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function detectPhoneScreenQuad(
  person: Buffer
): Promise<PhoneScreenQuad | null> {
  const gray = await grayRaw(person);
  if (gray.byteLength < WIDTH * HEIGHT) return null;
  const cell = 10;
  const gw = Math.floor(WIDTH / cell);
  const gh = Math.floor(HEIGHT / cell);
  const dark = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let n = 0;
      let c = 0;
      for (let y = gy * cell; y < gy * cell + cell; y++) {
        for (let x = gx * cell; x < gx * cell + cell; x++) {
          const v = gray[y * WIDTH + x] ?? 255;
          c += 1;
          if (v < 42) n += 1;
        }
      }
      dark[gy * gw + gx] = n / c > 0.62 ? 1 : 0;
    }
  }
  const minGy = Math.floor((FACE_MAX_Y + 20) / cell);
  const seen = new Uint8Array(gw * gh);
  let best: { cells: number[]; cy: number } | null = null;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let gy = minGy; gy < gh - 1; gy++) {
    for (let gx = 1; gx < gw - 1; gx++) {
      const i = gy * gw + gx;
      if (!dark[i] || seen[i]) continue;
      const stack = [i];
      seen[i] = 1;
      const cells: number[] = [];
      let sumY = 0;
      while (stack.length) {
        const cur = stack.pop()!;
        cells.push(cur);
        const y = Math.floor(cur / gw);
        const x = cur % gw;
        sumY += y;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 1 || ny < minGy || nx >= gw - 1 || ny >= gh - 1) continue;
          const ni = ny * gw + nx;
          if (!dark[ni] || seen[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (cells.length < 18) continue;
      const cand = { cells, cy: sumY / cells.length };
      if (!best || cand.cells.length > best.cells.length) best = cand;
    }
  }
  if (!best) return null;
  let minX = WIDTH;
  let minY = HEIGHT;
  let maxX = 0;
  let maxY = 0;
  const darkPts: Point[] = [];
  for (const ci of best.cells) {
    const gx = ci % gw;
    const gy = Math.floor(ci / gw);
    for (let y = gy * cell; y < gy * cell + cell; y++) {
      for (let x = gx * cell; x < gx * cell + cell; x++) {
        if ((gray[y * WIDTH + x] ?? 255) >= 42) continue;
        darkPts.push({ x, y });
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (darkPts.length < 80) return null;
  const score = (fn: (p: Point) => number) => {
    let bestPt = darkPts[0]!;
    let bestS = fn(bestPt);
    for (const p of darkPts) {
      const s = fn(p);
      if (s < bestS) {
        bestS = s;
        bestPt = p;
      }
    }
    return bestPt;
  };
  const tl = score((p) => p.x + p.y);
  const tr = score((p) => -p.x + p.y);
  const bl = score((p) => p.x - p.y);
  const br = score((p) => -p.x - p.y);
  const quad = { tl, tr, br, bl };
  return verifyQuadAwayFromFace(quad) ? quad : null;
}

async function verifyOverlayKeepsFace(
  bin: string,
  beforeFile: string,
  afterFile: string,
  quad: PhoneScreenQuad
): Promise<boolean> {
  if (!verifyQuadAwayFromFace(quad)) return false;
  const faceSample = await sampleMeanLuma(bin, beforeFile, 500, 60, 80, 80);
  const faceAfter = await sampleMeanLuma(bin, afterFile, 500, 60, 80, 80);
  if (faceSample == null || faceAfter == null) return true;
  return Math.abs(faceAfter - faceSample) <= 25;
}

async function sampleMeanLuma(
  bin: string,
  file: string,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<number | null> {
  if (w < 8 || h < 8) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "zima-autopilot-luma-"));
  const raw = path.join(dir, "s.raw");
  try {
    await runFfmpeg(bin, [
      "-y",
      "-i",
      file,
      "-vf",
      `crop=${Math.round(w)}:${Math.round(h)}:${Math.round(x)}:${Math.round(y)},format=gray,scale=1:1`,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "gray",
      raw,
    ]);
    const buf = await readFile(raw);
    return buf[0] ?? null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function resolveProductStill(
  supabase: Db,
  media: AutopilotProductMedia
): Promise<{ assetId: string; buffer: Buffer; videoAssetId: string | null }> {
  if (media.video) {
    const video = await downloadGalleryAsset(
      supabase,
      media.video,
      MAX_VIDEO_BYTES
    );
    const buffer = await extractVideoFrame(video);
    return {
      assetId: media.video.id,
      buffer,
      videoAssetId: media.video.id,
    };
  }
  if (media.image) {
    const buffer = await downloadGalleryAsset(
      supabase,
      media.image,
      MAX_STILL_BYTES
    );
    return {
      assetId: media.image.id,
      buffer,
      videoAssetId: null,
    };
  }
  throw new Error(missingProductError(media) || "Falta el producto.");
}

export async function persistAutopilotFile(opts: {
  projectId: string;
  userId: string;
  folderId: string;
  buffer: Buffer;
  contentType: string;
  name: string;
  kind: "image" | "video";
}): Promise<{ id: string; publicUrl: string }> {
  const admin = await createAdminClient();
  const access = await getServiceRoleAccess();
  const storagePath = `${opts.projectId}/${crypto.randomUUID()}-${opts.name}`;
  await uploadStorageObject({
    supabaseUrl: access.url,
    accessToken: access.serviceKey,
    anonKey: access.anonKey,
    bucket: "gallery",
    path: storagePath,
    body: opts.buffer,
    contentType: opts.contentType,
  });
  const { data: pub } = admin.storage.from("gallery").getPublicUrl(storagePath);
  const { data: last } = await admin
    .from("project_gallery_assets")
    .select("sort_order")
    .eq("project_id", opts.projectId)
    .eq("folder_id", opts.folderId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: row, error } = await admin
    .from("project_gallery_assets")
    .insert({
      project_id: opts.projectId,
      user_id: opts.userId,
      folder_id: opts.folderId,
      name: opts.name,
      mime_type: opts.contentType,
      size_bytes: opts.buffer.byteLength,
      kind: opts.kind,
      storage_path: storagePath,
      public_url: pub.publicUrl,
      hashtag: normalizeHashtag(opts.name.replace(/\.[^.]+$/, "")),
      sort_order: (Number(last?.sort_order) || 0) + 1,
    })
    .select("id, public_url")
    .single();
  if (error || !row) {
    throw new Error(error?.message || "No se pudo guardar el archivo en galería");
  }
  return { id: row.id as string, publicUrl: row.public_url as string };
}

export async function ensureAutopilotFolder(
  admin: Db,
  projectId: string,
  userId: string
): Promise<string> {
  const { data: existing } = await admin
    .from("project_gallery_folders")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("name", "Autopilot")
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: anyFolder } = await admin
    .from("project_gallery_folders")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (anyFolder?.id) return anyFolder.id as string;
  const { data: created, error } = await admin
    .from("project_gallery_folders")
    .insert({
      project_id: projectId,
      user_id: userId,
      name: "Autopilot",
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message || "No hay carpeta de galería para guardar el vídeo.");
  }
  return created.id as string;
}

export async function downloadUrl(url: string, maxBytes: number): Promise<Buffer> {
  const got = await downloadBinary(url, maxBytes);
  return got.buffer;
}

export async function montageWithContinuousAudio(opts: {
  talking: Buffer;
  broll: Buffer;
  demo: Buffer;
  talkingVisualSec: number;
  brollSec: number;
  demoSec: number;
  interleave?: boolean;
}): Promise<Buffer> {
  const openingSec = Math.min(3, Math.floor(opts.talkingVisualSec / 2));
  const firstDemoSec = Math.min(3, Math.floor(opts.demoSec / 2));
  return concatVerticalClipsWithBedAudio({
    clips: opts.interleave ? [
      { buffer: opts.talking, durationSec: openingSec, startSec: 0 },
      { buffer: opts.demo, durationSec: firstDemoSec, startSec: 0 },
      { buffer: opts.broll, durationSec: opts.brollSec, startSec: 0 },
      { buffer: opts.demo, durationSec: opts.demoSec - firstDemoSec, startSec: firstDemoSec },
      // Visible speech must use its original narration time on return to camera.
      { buffer: opts.talking, durationSec: opts.talkingVisualSec - openingSec, startSec: openingSec + opts.demoSec + opts.brollSec },
    ] : [
      { buffer: opts.talking, durationSec: opts.talkingVisualSec },
      { buffer: opts.broll, durationSec: opts.brollSec },
      { buffer: opts.demo, durationSec: opts.demoSec },
    ],
    audio: opts.talking,
  });
}

export { MAX_STILL_BYTES, MAX_VIDEO_BYTES };

export async function persistAutopilotAudio(projectId: string, buffer: Buffer): Promise<string> {
  const admin = await createAdminClient(), access = await getServiceRoleAccess();
  const storagePath = `${projectId}/${crypto.randomUUID()}-autopilot-narration.mp3`;
  await uploadStorageObject({supabaseUrl: access.url, accessToken: access.serviceKey, anonKey: access.anonKey, bucket: "gallery", path: storagePath, body: buffer, contentType: "audio/mpeg"});
  return admin.storage.from("gallery").getPublicUrl(storagePath).data.publicUrl;
}
