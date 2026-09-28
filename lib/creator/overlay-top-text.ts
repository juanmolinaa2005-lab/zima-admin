import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { existsSync } from "fs";
import ffmpegStatic from "ffmpeg-static";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import {
  normalizeCaptionStyle,
  normalizeOverlayPosition,
  overlayPositionFrac,
  type CaptionStyleId,
  type OverlayPosition,
} from "@/lib/creator/overlay-styles";
import { withBeautyFilter } from "@/lib/creator/beauty-filter";
import {
  AAC_IOS_AUDIO,
  H264_IOS_VIDEO,
  IOS_MP4_CONTAINER,
} from "@/lib/creator/ios-mp4";

export type OverlayY = "top" | "center" | "bottom";
export type OverlayTextStyle = "box" | "outline";

function wrapTitle(raw: string, maxChars = 34, maxLines = 3): string {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines).join("\n");
}

function imageExt(contentType?: string): string {
  const t = (contentType || "").toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  return "jpg";
}

function resolveFont(kind: "bold" | "script" = "bold"): string | null {
  const file = kind === "script" ? "Pacifico-Regular.ttf" : "Roboto-Bold.ttf";
  const fallback = kind === "script" ? "Roboto-Bold.ttf" : "";
  const names = fallback ? [file, fallback] : [file];
  for (const name of names) {
    const candidates = [
      path.join(process.cwd(), "lib/creator/fonts", name),
      path.join(process.cwd(), "fonts", name),
      path.resolve(__dirname, "fonts", name),
    ];
    const hit = candidates.find((p) => existsSync(p));
    if (hit) return hit;
  }
  return null;
}

let fontsReady = false;

function ensureFonts() {
  if (fontsReady) return;
  const bold = resolveFont("bold");
  const script = resolveFont("script");
  if (bold) GlobalFonts.registerFromPath(bold, "ZimaBold");
  if (script) GlobalFonts.registerFromPath(script, "ZimaScript");
  fontsReady = true;
}

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

async function probeVideoSize(
  bin: string,
  file: string
): Promise<{ width: number; height: number }> {
  const stderr = await new Promise<string>((resolve, reject) => {
    const child = spawn(bin, ["-hide_banner", "-i", file], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", () => resolve(err));
  });
  const stream = stderr.match(
    /Stream #0:\d[^\n]*Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/
  );
  if (!stream) throw new Error("No se pudo leer el tamaño del video.");
  let width = Number(stream[1]);
  let height = Number(stream[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error("Tamaño de video inválido.");
  }
  const matrix = stderr.match(/rotation of (-?[\d.]+) degrees/i);
  const rotateTag = stderr.match(/\brotate\s*:\s*(-?\d+)/i);
  const deg = Math.abs(Number(matrix?.[1] ?? rotateTag?.[1] ?? 0)) % 360;
  if (deg === 90 || deg === 270) {
    [width, height] = [height, width];
  }
  return { width, height };
}

type CaptionLook = {
  fontSize: number;
  fill: string;
  stroke?: string;
  strokeWidth: number;
  font: "bold" | "script";
  maxChars: number;
  lineHeight: number;
  bar?: boolean;
  box?: boolean;
};

function captionLook(style: CaptionStyleId, height: number): CaptionLook {
  if (style === "snapchat") {
    return {
      fontSize: height / 36,
      fill: "#ffffff",
      strokeWidth: 0,
      font: "bold",
      maxChars: 34,
      lineHeight: height * 0.034,
      bar: true,
    };
  }
  if (style === "blitz") {
    return {
      fontSize: height / 28,
      fill: "#111827",
      strokeWidth: 0,
      font: "bold",
      maxChars: 28,
      lineHeight: height * 0.055,
      box: true,
    };
  }
  if (style === "impact") {
    return {
      fontSize: height / 16,
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: Math.max(6, height / 90),
      font: "bold",
      maxChars: 18,
      lineHeight: height * 0.08,
    };
  }
  if (style === "yellow") {
    return {
      fontSize: height / 24,
      fill: "#FFD400",
      stroke: "#000000",
      strokeWidth: Math.max(4, height / 140),
      font: "bold",
      maxChars: 26,
      lineHeight: height * 0.055,
    };
  }
  if (style === "karaoke") {
    return {
      fontSize: height / 32,
      fill: "#ffffff",
      strokeWidth: 0,
      font: "bold",
      maxChars: 32,
      lineHeight: height * 0.042,
    };
  }
  if (style === "script") {
    return {
      fontSize: height / 22,
      fill: "#ffffff",
      stroke: "rgba(0,0,0,0.55)",
      strokeWidth: Math.max(2, height / 220),
      font: "script",
      maxChars: 28,
      lineHeight: height * 0.06,
    };
  }
  return {
    fontSize: height / 28,
    fill: "#ffffff",
    stroke: "#000000",
    strokeWidth: Math.max(3, height / 160),
    font: "bold",
    maxChars: 26,
    lineHeight: height * 0.052,
  };
}

function drawCaption(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  opts: {
    width: number;
    height: number;
    lines: string[];
    look: CaptionLook;
    y0: number;
  }
) {
  const { width, height, lines, look, y0 } = opts;
  const family = look.font === "script" ? "ZimaScript" : "ZimaBold";
  ctx.font = `${Math.round(look.fontSize)}px "${family}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const metrics = lines.map((line) => ctx.measureText(line).width);
  const textW = Math.max(0, ...metrics);
  const textH = look.lineHeight * lines.length;

  if (look.bar) {
    const barH = Math.max(textH + height * 0.016, height * 0.042);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, y0, width, barH);
  } else if (look.box) {
    const padX = Math.max(14, width * 0.03);
    const padY = Math.max(10, height * 0.01);
    const boxW = Math.min(width * 0.86, textW + padX * 2);
    const boxH = textH + padY * 2;
    const x = (width - boxW) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.beginPath();
    ctx.roundRect(x, y0, boxW, boxH, 8);
    ctx.fill();
  }

  const textTop =
    look.bar ? y0 + height * 0.008 : look.box ? y0 + Math.max(10, height * 0.01) : y0;

  for (const [i, line] of lines.entries()) {
    const x = width / 2;
    const y = textTop + i * look.lineHeight;
    if (look.stroke && look.strokeWidth > 0) {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = look.stroke;
      ctx.lineWidth = look.strokeWidth;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = look.fill;
    ctx.fillText(line, x, y);
  }
}

async function renderCaptionPng(opts: {
  width: number;
  height: number;
  text: string;
  style?: CaptionStyleId | string | null;
  position?: OverlayPosition;
}): Promise<Buffer> {
  ensureFonts();
  const look = captionLook(
    normalizeCaptionStyle(opts.style),
    opts.height
  );
  const lines = wrapTitle(opts.text, look.maxChars, 3)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    const empty = createCanvas(opts.width, opts.height);
    return empty.toBuffer("image/png");
  }
  const canvas = createCanvas(opts.width, opts.height);
  const ctx = canvas.getContext("2d");
  const y0 = opts.height * overlayPositionFrac(normalizeOverlayPosition(opts.position));
  drawCaption(ctx, { width: opts.width, height: opts.height, lines, look, y0 });
  return canvas.toBuffer("image/png");
}

/** Burn a caption onto a video using overlay (ffmpeg-static has no drawtext). */
export async function burnTopText(
  input: Buffer,
  title: string,
  style?: CaptionStyleId | string | null,
  opts?: { beauty?: boolean; position?: OverlayPosition }
): Promise<Buffer> {
  const text = title.trim();
  if (!text) return input;

  const bin = ffmpegStatic;
  if (!bin || !existsSync(bin)) {
    throw new Error("Internal editor is missing ffmpeg.");
  }
  if (!resolveFont("bold")) {
    throw new Error("Internal editor is missing the overlay font.");
  }

  const dir = await mkdtemp(path.join(tmpdir(), "zima-toptext-"));
  const inFile = path.join(dir, "in.mp4");
  const pngFile = path.join(dir, "caption.png");
  const outFile = path.join(dir, "out.mp4");

  try {
    await writeFile(inFile, input);
    const size = await probeVideoSize(bin, inFile);
    const png = await renderCaptionPng({
      width: size.width,
      height: size.height,
      text,
      style,
      position: opts?.position,
    });
    await writeFile(pngFile, png);

    const overlay =
      opts?.beauty === true
        ? `[0:v]${withBeautyFilter()}[b];[b][1:v]overlay=0:0`
        : "[0:v][1:v]overlay=0:0";

    const common = [
      "-y",
      "-i",
      inFile,
      "-i",
      pngFile,
      "-filter_complex",
      overlay,
      ...H264_IOS_VIDEO,
      ...IOS_MP4_CONTAINER,
    ];
    try {
      await runFfmpeg(bin, [...common, ...AAC_IOS_AUDIO, "-shortest", outFile]);
    } catch {
      await runFfmpeg(bin, [...common, "-an", "-shortest", outFile]);
    }

    const out = await readFile(outFile);
    if (!out.byteLength) throw new Error("Overlay produced an empty video.");
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Burn overlay caption onto a still image (Blitz carousel slides). */
export async function burnImageOverlay(
  input: Buffer,
  title: string,
  opts: {
    overlayY?: OverlayY;
    textStyle?: OverlayTextStyle;
    contentType?: string;
  } = {}
): Promise<Buffer> {
  const text = title.trim();
  if (!text) return input;
  ensureFonts();
  if (!resolveFont("bold")) {
    throw new Error("Internal editor is missing the overlay font.");
  }

  const overlayY =
    opts.overlayY === "center" || opts.overlayY === "bottom"
      ? opts.overlayY
      : "top";
  const textStyle = opts.textStyle === "outline" ? "outline" : "box";
  const ext = imageExt(opts.contentType);
  const dir = await mkdtemp(path.join(tmpdir(), "zima-imgtext-"));
  const inFile = path.join(dir, `in.${ext}`);

  try {
    await writeFile(inFile, input);
    const image = await loadImage(inFile);
    const width = image.width;
    const height = image.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);

    const look: CaptionLook =
      textStyle === "outline"
        ? {
            fontSize: height / 36,
            fill: "#000000",
            stroke: "#ffffff",
            strokeWidth: Math.max(3, height / 160),
            font: "bold",
            maxChars: 18,
            lineHeight: height / 15,
          }
        : {
            fontSize: height / 26,
            fill: "#111827",
            strokeWidth: 0,
            font: "bold",
            maxChars: 18,
            lineHeight: height / 17,
            box: true,
          };
    const lines = wrapTitle(text, look.maxChars, 4)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return input;

    const frac = overlayY === "bottom" ? 0.78 : overlayY === "center" ? 0.26 : 0.12;
    drawCaption(ctx, {
      width,
      height,
      lines,
      look,
      y0: height * frac,
    });
    return canvas.toBuffer("image/jpeg", 0.92);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
