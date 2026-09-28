import { spawn } from "child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { openaiChatJson, type OpenAIContentPart } from "@/lib/openai/chat";
import { getFalKlingDuration } from "@/lib/creator/fal-video-models";
import {
  KLING_VIDEO_MAX_PX,
  KLING_VIDEO_MIN_PX,
  klingReferenceScaleVf,
  MOTION_CLONE_MAX_SEC,
  MOTION_CLONE_MIN_SEC,
  MOTION_CLONE_TRIM_MIN_SEC,
} from "@/lib/creator/motion-control";

export type VideoDynamicDraft = {
  title: string;
  action: string;
  extra: string;
  duration: string;
};

export function ownGalleryPublicUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/storage/v1/object/public/gallery/`)) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return url;
}

export function projectGalleryVideoUrl(
  raw: unknown,
  projectId: string
): string | null {
  const url = ownGalleryPublicUrl(raw);
  if (!url || !url.includes(`/${projectId}/`)) return null;
  return url;
}

function runFfmpeg(
  bin: string,
  args: string[],
  timeoutMs = 90_000,
  timeoutMessage = "El video tardó demasiado en procesarse."
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-800) || `ffmpeg exited ${code}`));
    });
  });
}

async function extractReferenceFrames(videoUrl: string): Promise<Buffer[]> {
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg para leer el video.");
  const dir = await mkdtemp(path.join(tmpdir(), "zima-dynamic-"));
  try {
    await runFfmpeg(bin, [
      "-y",
      "-user_agent",
      "ZimaAdmin/1.0",
      "-t",
      "12",
      "-i",
      videoUrl,
      "-vf",
      "fps=1,scale=480:-2",
      "-frames:v",
      "10",
      "-q:v",
      "5",
      path.join(dir, "frame-%02d.jpg"),
    ]);
    const names = (await readdir(dir))
      .filter((name) => /^frame-\d+\.jpg$/.test(name))
      .sort();
    const frames: Buffer[] = [];
    for (const name of names) {
      const file = await readFile(path.join(dir, name));
      if (file.byteLength > 0) frames.push(file);
    }
    if (frames.length < 2) {
      throw new Error("El video es demasiado corto para sacar una dinámica.");
    }
    return frames.slice(0, 8);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractVideoStartFrames(videoUrl: string): Promise<Buffer[]> {
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg para leer el video.");
  const dir = await mkdtemp(path.join(tmpdir(), "zima-startframe-"));
  try {
    await runFfmpeg(bin, [
      "-y",
      "-user_agent",
      "ZimaAdmin/1.0",
      "-t",
      "1.2",
      "-i",
      videoUrl,
      "-vf",
      "fps=2,scale=720:-2",
      "-frames:v",
      "2",
      "-q:v",
      "3",
      path.join(dir, "still-%02d.jpg"),
    ]);
    const names = (await readdir(dir))
      .filter((name) => /^still-\d+\.jpg$/.test(name))
      .sort();
    const frames: Buffer[] = [];
    for (const name of names) {
      const file = await readFile(path.join(dir, name));
      if (file.byteLength > 0) frames.push(file);
    }
    if (!frames.length) {
      throw new Error("No se pudo sacar el primer fotograma del video de referencia.");
    }
    return frames.slice(0, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function parseVideoSize(stderr: string): { width: number; height: number } | null {
  const stream = stderr.match(/Stream #0:\d[^\n]*Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
  if (!stream) return null;
  let width = Number(stream[1]);
  let height = Number(stream[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    return null;
  }
  const matrix = stderr.match(/rotation of (-?[\d.]+) degrees/i);
  const rotateTag = stderr.match(/\brotate\s*:\s*(-?\d+)/i);
  const deg = Math.abs(Number(matrix?.[1] ?? rotateTag?.[1] ?? 0)) % 360;
  if (deg === 90 || deg === 270) {
    [width, height] = [height, width];
  }
  return { width, height };
}

function klingSizeOk(width: number, height: number): boolean {
  return (
    width >= KLING_VIDEO_MIN_PX &&
    width <= KLING_VIDEO_MAX_PX &&
    height >= KLING_VIDEO_MIN_PX &&
    height <= KLING_VIDEO_MAX_PX &&
    width % 2 === 0 &&
    height % 2 === 0
  );
}

async function probeMedia(
  bin: string,
  file: string
): Promise<{ durationSec: number; width: number | null; height: number | null }> {
  const inputArgs = /^https?:/i.test(file)
    ? ["-user_agent", "ZimaAdmin/1.0", "-i", file]
    : ["-i", file];
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["-hide_banner", ...inputArgs], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("No se pudo leer el video de referencia."));
    }, 15_000);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", () => {
      clearTimeout(timer);
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) {
        reject(new Error("No se pudo leer la duración del recorte."));
        return;
      }
      const size = parseVideoSize(stderr);
      resolve({
        durationSec: Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]),
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
    });
  });
}

export async function probeVideoDurationSec(videoUrl: string): Promise<number | null> {
  const bin = ffmpegStatic;
  if (!bin || !videoUrl.trim()) return null;
  const probed = await probeMedia(bin, videoUrl).catch(() => null);
  return probed?.durationSec ?? null;
}

async function probeMediaDuration(bin: string, file: string): Promise<number> {
  return (await probeMedia(bin, file)).durationSec;
}

function meanSsim(stderr: string): number | null {
  const scores = [...stderr.matchAll(/All:([0-9.]+)/g)].map((match) => Number(match[1]));
  if (!scores.length) return null;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return total / scores.length;
}

async function captureFfmpeg(bin: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg"));
    }, timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stderr);
      else reject(new Error(stderr.slice(-400) || `ffmpeg exited ${code}`));
    });
  });
}

/** If the file is the same clip played 2–4 times back to back, return one copy's length. */
async function repeatedTakeOnFile(
  bin: string,
  file: string,
  durationSec: number
): Promise<number | null> {
  for (const copies of [2, 3, 4]) {
    const part = durationSec / copies;
    if (part < MOTION_CLONE_TRIM_MIN_SEC) continue;
    const end = part * 2;
    if (end > durationSec + 0.08) continue;
    try {
      const stderr = await captureFfmpeg(
        bin,
        [
          "-i",
          file,
          "-filter_complex",
          `[0:v]trim=start=0:end=${part.toFixed(3)},setpts=PTS-STARTPTS[a];[0:v]trim=start=${part.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS[b];[a][b]ssim`,
          "-f",
          "null",
          "-",
        ],
        60_000
      );
      const score = meanSsim(stderr);
      if (score != null && score >= 0.97) return part;
    } catch {
      continue;
    }
  }
  return null;
}

export async function repeatedMotionTakeSec(videoUrl: string): Promise<number | null> {
  const bin = ffmpegStatic;
  if (!bin) return null;
  const probed = await probeMedia(bin, videoUrl).catch(() => null);
  if (!probed || probed.durationSec < MOTION_CLONE_TRIM_MIN_SEC * 2) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "zima-repeat-"));
  const file = path.join(dir, "in.mp4");
  try {
    await runFfmpeg(
      bin,
      ["-y", "-user_agent", "ZimaAdmin/1.0", "-i", videoUrl, "-an", "-c", "copy", file],
      100_000,
      "No se pudo leer el video de referencia."
    );
    const actual = await probeMediaDuration(bin, file);
    return repeatedTakeOnFile(bin, file, actual);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Repeat the clip as-is until Kling's minimum. Stream copy keeps the original quality. */
async function loopLocalClipToMin(
  bin: string,
  inputFile: string,
  outputFile: string,
  minSec: number
): Promise<{ durationSec: number; copies: number }> {
  const actual = await probeMediaDuration(bin, inputFile);
  if (actual >= minSec) return { durationSec: actual, copies: 1 };
  const copies = Math.min(
    24,
    Math.max(2, Math.ceil(minSec / Math.max(actual, MOTION_CLONE_TRIM_MIN_SEC)))
  );
  const listFile = path.join(path.dirname(outputFile), "concat.txt");
  const escaped = inputFile.replace(/'/g, "'\\''");
  await writeFile(
    listFile,
    Array.from({ length: copies }, () => `file '${escaped}'`).join("\n")
  );
  try {
    await runFfmpeg(
      bin,
      ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-an", "-c", "copy", outputFile],
      100_000,
      "No se pudo duplicar el recorte corto."
    );
  } catch {
    await runFfmpeg(
      bin,
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputFile,
      ],
      100_000,
      "No se pudo duplicar el recorte corto."
    );
  }
  const looped = await probeMediaDuration(bin, outputFile);
  if (looped < minSec) {
    throw new Error("No se pudo alargar el recorte a 3 segundos.");
  }
  return { durationSec: looped, copies };
}

export async function ensureKlingMinDuration(videoUrl: string): Promise<{
  looped: boolean;
  buffer?: Buffer;
  durationSec: number;
  /** Original length. The generated video is cut here, before the repeated copy. */
  keepSec?: number;
  /** How many times the short clip was repeated to reach 3 seconds. */
  copies?: number;
}> {
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg para preparar el video.");
  const ffmpegBin: string = bin;
  const probed = await probeMedia(ffmpegBin, videoUrl);
  const sizeKnown = probed.width != null && probed.height != null;
  const isLandscape = Boolean(
    probed.width && probed.height && probed.width > probed.height
  );
  const needsScale =
    isLandscape || !sizeKnown || !klingSizeOk(probed.width!, probed.height!);
  const needsLoop = probed.durationSec < MOTION_CLONE_MIN_SEC + 0.12;
  if (!needsScale && !needsLoop) {
    const keepSec = await repeatedMotionTakeSec(videoUrl);
    return {
      looped: false,
      durationSec: probed.durationSec,
      ...(keepSec ? { keepSec } : {}),
    };
  }
  const scaleVf = klingReferenceScaleVf(probed.width, probed.height);
  const dir = await mkdtemp(path.join(tmpdir(), "zima-loop-"));
  const source = path.join(dir, "source.mp4");
  const looped = path.join(dir, "looped.mp4");
  try {
    if (needsLoop && !needsScale) {
      try {
        await runFfmpeg(
          ffmpegBin,
          [
            "-y",
            "-user_agent",
            "ZimaAdmin/1.0",
            "-i",
            videoUrl,
            "-an",
            "-c",
            "copy",
            source,
          ],
          100_000,
          "No se pudo leer el video de referencia."
        );
        const padded = await loopLocalClipToMin(
          ffmpegBin,
          source,
          looped,
          MOTION_CLONE_MIN_SEC + 0.15
        );
        const buffer = await readFile(looped);
        if (buffer.byteLength) {
          return {
            looped: true,
            buffer,
            durationSec: padded.durationSec,
            keepSec: probed.durationSec,
            copies: padded.copies,
          };
        }
      } catch {
        /* fall through and re-encode once */
      }
    }
    await runFfmpeg(
      ffmpegBin,
      [
        "-y",
        "-user_agent",
        "ZimaAdmin/1.0",
        "-i",
        videoUrl,
        "-an",
        "-vf",
        scaleVf,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        source,
      ],
      100_000,
      "No se pudo leer el video de referencia."
    );
    if (!needsLoop) {
      const buffer = await readFile(source);
      if (!buffer.byteLength) throw new Error("El video reescalado salió vacío.");
      const actual = await probeMediaDuration(ffmpegBin, source);
      const keepSec = await repeatedTakeOnFile(ffmpegBin, source, actual);
      return {
        looped: true,
        buffer,
        durationSec: probed.durationSec,
        ...(keepSec ? { keepSec } : {}),
      };
    }
    const padded = await loopLocalClipToMin(
      ffmpegBin,
      source,
      looped,
      MOTION_CLONE_MIN_SEC + 0.15
    );
    const buffer = await readFile(looped);
    if (!buffer.byteLength) throw new Error("El video duplicado salió vacío.");
    return {
      looped: true,
      buffer,
      durationSec: padded.durationSec,
      keepSec: probed.durationSec,
      copies: padded.copies,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function clipReferenceVideo(
  videoUrl: string,
  startSec: number,
  endSec: number
): Promise<{ buffer: Buffer; durationSec: number }> {
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg para recortar el video.");
  const start = Math.max(0, startSec);
  const requested = Math.min(MOTION_CLONE_MAX_SEC, Math.max(0, endSec - start));
  if (requested < MOTION_CLONE_TRIM_MIN_SEC - 0.02) {
    throw new Error("El recorte es demasiado corto.");
  }
  const ffmpegBin: string = bin;
  const probed = await probeMedia(ffmpegBin, videoUrl).catch(() => ({
    durationSec: requested,
    width: null as number | null,
    height: null as number | null,
  }));
  const scaleVf = klingReferenceScaleVf(probed.width, probed.height);
  const dir = await mkdtemp(path.join(tmpdir(), "zima-clip-"));
  const outFile = path.join(dir, "clip.mp4");
  const preroll = Math.min(start, 2);
  async function encode(takeSec: number) {
    await runFfmpeg(
      ffmpegBin,
      [
        "-y",
        "-user_agent",
        "ZimaAdmin/1.0",
        "-ss",
        (start - preroll).toFixed(3),
        "-i",
        videoUrl,
        "-ss",
        preroll.toFixed(3),
        "-t",
        takeSec.toFixed(3),
        "-an",
        "-vf",
        scaleVf,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outFile,
      ],
      100_000,
      "El recorte tardó demasiado."
    );
  }
  try {
    await encode(Math.max(MOTION_CLONE_TRIM_MIN_SEC, requested + 0.05));
    const actual = await probeMediaDuration(ffmpegBin, outFile);
    if (actual < MOTION_CLONE_TRIM_MIN_SEC) {
      throw new Error("El recorte es demasiado corto.");
    }
    const out = await readFile(outFile);
    if (!out.byteLength) throw new Error("El recorte salió vacío.");
    return { buffer: out, durationSec: actual };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Cut a generated clip at the moment the reference was repeated. */
export async function trimGeneratedToKeepSec(
  videoUrl: string,
  keepSec: number
): Promise<Buffer | null> {
  if (!Number.isFinite(keepSec) || keepSec < MOTION_CLONE_TRIM_MIN_SEC) return null;
  const bin = ffmpegStatic;
  if (!bin) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "zima-keep-"));
  const outFile = path.join(dir, "keep.mp4");
  const take = keepSec.toFixed(3);
  const videoArgs = [
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "17",
    "-pix_fmt",
    "yuv420p",
  ];
  try {
    try {
      await runFfmpeg(
        bin,
        [
          "-y",
          "-user_agent",
          "ZimaAdmin/1.0",
          "-i",
          videoUrl,
          "-t",
          take,
          ...videoArgs,
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          outFile,
        ],
        100_000,
        "No se pudo recortar el video generado."
      );
    } catch {
      await runFfmpeg(
        bin,
        [
          "-y",
          "-user_agent",
          "ZimaAdmin/1.0",
          "-i",
          videoUrl,
          "-t",
          take,
          "-an",
          ...videoArgs,
          "-movflags",
          "+faststart",
          outFile,
        ],
        100_000,
        "No se pudo recortar el video generado."
      );
    }
    const out = await readFile(outFile);
    if (!out.byteLength) return null;
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Map the reference cut onto the generated clip when their lengths differ slightly. */
export async function alignKeepSecToGenerated(
  generatedUrl: string,
  referenceUrl: string,
  keepSec: number
): Promise<number> {
  const bin = ffmpegStatic;
  if (!bin || !referenceUrl) return keepSec;
  const [generated, reference] = await Promise.all([
    probeMedia(bin, generatedUrl).catch(() => null),
    probeMedia(bin, referenceUrl).catch(() => null),
  ]);
  if (!generated || !reference || reference.durationSec < MOTION_CLONE_TRIM_MIN_SEC) {
    return keepSec;
  }
  const ratio = generated.durationSec / reference.durationSec;
  if (ratio < 0.85 || ratio > 1.15) return keepSec;
  const scaled = keepSec * ratio;
  if (scaled < MOTION_CLONE_TRIM_MIN_SEC) return keepSec;
  if (scaled >= generated.durationSec - 0.05) return keepSec;
  return scaled;
}

function framePart(buffer: Buffer): OpenAIContentPart {
  return {
    type: "image_url",
    image_url: {
      url: `data:image/jpeg;base64,${buffer.toString("base64")}`,
      detail: "low",
    },
  };
}

export async function analyzeVideoDynamic(
  apiKey: string,
  videoUrl: string
): Promise<VideoDynamicDraft> {
  const frames = await extractReferenceFrames(videoUrl);
  const result = await openaiChatJson<{
    title?: string;
    action?: string;
    extra?: string;
    duration?: string | number;
  }>(apiKey, {
    temperature: 0.3,
    maxTokens: 900,
    system:
      "You extract a reusable VIDEO DYNAMIC (structure) from chronological stills of a UGC clip. Return JSON only.",
    user: [
      {
        type: "text",
        text: `These stills are chronological samples of a reference video. Ignore the person's identity, face, body, age, clothing, and any readable brand.
Extract a reusable structure another creator can perform:
- camera (distance, handheld, whether they face camera)
- pacing/energy (hook, middle, close)
- activity TYPE (walking while talking, showing a phone, cooking, etc.)
- setting TYPE and light
Do not name or describe the specific person. Write in Spanish.
Return {"title":"max 40 chars","action":"1-3 sentences of structure for camera/rhythm/beats","extra":"setting/light or empty","duration":"seconds 3-15 as a number string"}`,
      },
      ...frames.map(framePart),
    ],
  });
  const title = (result.title || "").trim().slice(0, 48);
  const action = (result.action || "").trim().slice(0, 600);
  if (!title || action.length < 12) {
    throw new Error("No se pudo sacar una dinámica clara de ese video.");
  }
  return {
    title,
    action,
    extra: (result.extra || "").trim().slice(0, 240),
    duration: getFalKlingDuration(result.duration),
  };
}
