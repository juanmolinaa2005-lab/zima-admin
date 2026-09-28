import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { existsSync } from "fs";
import ffmpegStatic from "ffmpeg-static";
import {
  AAC_IOS_AUDIO,
  H264_IOS_VIDEO,
  IOS_MP4_CONTAINER,
} from "@/lib/creator/ios-mp4";

/** Subtle skin smooth, closer to a light TikTok beauty filter. */
export const INFLUENCER_BEAUTY_VF = [
  "bilateral=sigmaS=6:sigmaR=0.08",
  "hqdn3d=1.5:1:2.5:2",
  "eq=brightness=0.006:saturation=1.03:contrast=1.01",
  "unsharp=3:3:0.25:3:3:0",
].join(",");

export function withBeautyFilter(vf?: string | null): string {
  const rest = (vf || "").trim();
  return rest ? `${INFLUENCER_BEAUTY_VF},${rest}` : INFLUENCER_BEAUTY_VF;
}

function runFfmpeg(bin: string, args: string[], timeoutMs = 90_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("El filtro de piel tardó demasiado."));
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

export async function applyBeautyFilter(input: Buffer): Promise<Buffer> {
  const bin = ffmpegStatic;
  if (!bin || !existsSync(bin)) {
    throw new Error("Internal editor is missing ffmpeg.");
  }
  const dir = await mkdtemp(path.join(tmpdir(), "zima-beauty-"));
  const inFile = path.join(dir, "in.mp4");
  const outFile = path.join(dir, "out.mp4");
  try {
    await writeFile(inFile, input);
    const common = [
      "-y",
      "-i",
      inFile,
      "-vf",
      INFLUENCER_BEAUTY_VF,
      ...H264_IOS_VIDEO,
      ...IOS_MP4_CONTAINER,
    ];
    try {
      await runFfmpeg(bin, [...common, ...AAC_IOS_AUDIO, outFile]);
    } catch {
      await runFfmpeg(bin, [...common, "-an", outFile]);
    }
    const out = await readFile(outFile);
    if (!out.byteLength) throw new Error("El filtro de piel salió vacío.");
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
