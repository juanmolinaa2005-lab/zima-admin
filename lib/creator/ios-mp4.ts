import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";

/** H.264 Main 4.0 + AAC + faststart. Safari, Chrome e iOS Photos lo reproducen. */
export const H264_IOS_VIDEO = [
  "-c:v",
  "libx264",
  "-profile:v",
  "main",
  "-level",
  "4.0",
  "-pix_fmt",
  "yuv420p",
  "-preset",
  "veryfast",
  "-crf",
  "20",
  "-tag:v",
  "avc1",
] as const;

export const AAC_IOS_AUDIO = [
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-ac",
  "2",
  "-ar",
  "44100",
] as const;

export const IOS_MP4_CONTAINER = [
  "-movflags",
  "+faststart",
  "-brand",
  "mp42",
] as const;

function run(
  bin: string,
  args: string[]
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stderr });
    });
  });
}

export async function probeMedia(bin: string, file: string): Promise<string> {
  const { stderr } = await run(bin, ["-hide_banner", "-i", file]);
  return stderr;
}

export function isIosPlayableMp4(probe: string): boolean {
  const h264 = /Video:\s*h264\b/i.test(probe);
  const incompatibleVideo =
    /Video:\s*(hevc|h265|hev1|hvc1|vp9|vp8|av1|mpeg4)\b/i.test(probe);
  const tenBit = /yuv420p10|yuv422|yuv444|p10le|10\s*bits?/i.test(probe);
  const audio = /Audio:/i.test(probe);
  const aacOk = !audio || /Audio:\s*aac\b/i.test(probe);
  const badAudio = /Audio:\s*(opus|vorbis|flac|pcm_|ac3|eac3|mp3)\b/i.test(
    probe
  );
  return h264 && !incompatibleVideo && !tenBit && aacOk && !badAudio;
}

/**
 * Returns an MP4 that Safari / iOS / Chrome can play.
 * Kling and fal often ship HEVC (`hev1`) which neither Chrome nor iOS Photos open.
 */
export async function prepareIosMp4(
  input: Buffer
): Promise<{ buffer: Buffer; transcoded: boolean }> {
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg para preparar el video.");
  if (!input.byteLength) throw new Error("El video está vacío.");

  const dir = await mkdtemp(path.join(tmpdir(), "zima-ios-"));
  const inFile = path.join(dir, "in.bin");
  const outFile = path.join(dir, "out.mp4");
  try {
    await writeFile(inFile, input);
    const probe = await probeMedia(bin, inFile);

    if (isIosPlayableMp4(probe)) {
      const remux = await run(bin, [
        "-y",
        "-i",
        inFile,
        "-c",
        "copy",
        ...IOS_MP4_CONTAINER,
        outFile,
      ]);
      if (remux.code === 0) {
        const out = await readFile(outFile);
        if (out.byteLength) return { buffer: out, transcoded: false };
      }
    }

    const scale =
      "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p,setsar=1";
    const withAudio = await run(bin, [
      "-y",
      "-i",
      inFile,
      "-vf",
      scale,
      ...H264_IOS_VIDEO,
      ...AAC_IOS_AUDIO,
      "-shortest",
      ...IOS_MP4_CONTAINER,
      outFile,
    ]);
    if (withAudio.code !== 0) {
      const silent = await run(bin, [
        "-y",
        "-i",
        inFile,
        "-vf",
        scale,
        ...H264_IOS_VIDEO,
        "-an",
        ...IOS_MP4_CONTAINER,
        outFile,
      ]);
      if (silent.code !== 0) {
        throw new Error(
          silent.stderr.slice(-800) ||
            withAudio.stderr.slice(-800) ||
            "No se pudo convertir el video para iPhone."
        );
      }
    }
    const out = await readFile(outFile);
    if (!out.byteLength) throw new Error("El video convertido quedó vacío.");
    return { buffer: out, transcoded: true };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function ensureIosMp4(input: Buffer): Promise<Buffer> {
  return (await prepareIosMp4(input)).buffer;
}
