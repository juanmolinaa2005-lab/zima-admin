import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import {
  AAC_IOS_AUDIO,
  H264_IOS_VIDEO,
  IOS_MP4_CONTAINER,
  ensureIosMp4,
} from "@/lib/creator/ios-mp4";

const WIDTH = 1080;
const HEIGHT = 1920;

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
      else reject(new Error(stderr.slice(-900) || `ffmpeg exited ${code}`));
    });
  });
}

function scaleFilter(labelIn: string, labelOut: string) {
  return `${labelIn}scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS${labelOut}`;
}

function concatListLine(filePath: string) {
  return `file '${filePath.replace(/'/g, "'\\''")}'`;
}

async function transcodeClip(
  bin: string,
  input: string,
  output: string,
  audio: "input" | "silent",
  durationSec?: number | null
) {
  const trim =
    typeof durationSec === "number" &&
    Number.isFinite(durationSec) &&
    durationSec > 0
      ? ["-t", String(durationSec)]
      : [];

  if (audio === "silent") {
    await runFfmpeg(bin, [
      "-y",
      "-i",
      input,
      ...trim,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-filter_complex",
      scaleFilter("[0:v]", "[v]"),
      "-map",
      "[v]",
      "-map",
      "1:a",
      "-shortest",
      ...H264_IOS_VIDEO,
      ...AAC_IOS_AUDIO,
      ...IOS_MP4_CONTAINER,
      output,
    ]);
    return;
  }

  await runFfmpeg(bin, [
    "-y",
    "-i",
    input,
    ...trim,
    "-filter_complex",
    `${scaleFilter("[0:v]", "[v]")};[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,aresample=44100,asetpts=PTS-STARTPTS[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    ...H264_IOS_VIDEO,
    ...AAC_IOS_AUDIO,
    ...IOS_MP4_CONTAINER,
    output,
  ]);
}

export type VerticalClipSpec = {
  buffer: Buffer;
  audio: "input" | "silent";
  durationSec?: number | null;
};

/** N clips 9:16. Each may keep audio or be silent, and may be trimmed. */
export async function concatVerticalClips(
  clips: VerticalClipSpec[]
): Promise<Buffer> {
  if (!clips.length) throw new Error("No hay clips para unir.");
  const bin = ffmpegStatic;
  if (!bin) throw new Error("Falta ffmpeg para unir los videos.");

  const dir = await mkdtemp(path.join(tmpdir(), "zima-montage-"));
  const outFile = path.join(dir, "out.mp4");

  try {
    const prepared: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]!;
      if (!clip.buffer.byteLength) {
        throw new Error(`El clip ${i + 1} está vacío.`);
      }
      const input = path.join(dir, `in-${i}.bin`);
      const output = path.join(dir, `clip-${i}.mp4`);
      await writeFile(input, clip.buffer);
      try {
        await transcodeClip(bin, input, output, clip.audio, clip.durationSec);
      } catch (e) {
        if (clip.audio === "input") {
          await transcodeClip(bin, input, output, "silent", clip.durationSec);
        } else {
          throw e;
        }
      }
      prepared.push(output);
    }

    if (prepared.length === 1) {
      const out = await readFile(prepared[0]!);
      if (!out.byteLength) throw new Error("El video unido quedó vacío.");
      return ensureIosMp4(out);
    }

    const listFile = path.join(dir, "list.txt");
    await writeFile(
      listFile,
      prepared.map(concatListLine).join("\n") + "\n"
    );

    try {
      await runFfmpeg(bin, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        ...H264_IOS_VIDEO,
        ...AAC_IOS_AUDIO,
        ...IOS_MP4_CONTAINER,
        outFile,
      ]);
    } catch {
      await runFfmpeg(bin, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        ...H264_IOS_VIDEO,
        "-an",
        ...IOS_MP4_CONTAINER,
        outFile,
      ]);
    }

    const out = await readFile(outFile);
    if (!out.byteLength) throw new Error("El video unido quedó vacío.");
    return ensureIosMp4(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Talking-head (with audio) then silent app demo, both 9:16. */
export async function concatTalkingAndDemo(
  talking: Buffer,
  demo: Buffer
): Promise<Buffer> {
  return concatVerticalClips([
    { buffer: talking, audio: "input" },
    { buffer: demo, audio: "silent" },
  ]);
}

/**
 * Concatenate visual clips and lay one continuous audio bed underneath.
 * Does not insert silent audio between cuts.
 */
export async function concatVerticalClipsWithBedAudio(opts: {
  clips: { buffer: Buffer; durationSec: number; startSec?: number }[];
  audio: Buffer;
}): Promise<Buffer> {
  if (!opts.clips.length || !opts.audio.byteLength) throw new Error("Faltan tomas o narración para montar el video.");
  if (!ffmpegStatic) throw new Error("Falta el motor de montaje.");
  const dir = await mkdtemp(path.join(tmpdir(), "zima-quality-edit-"));
  try {
    const args = ["-y"], filters: string[] = [];
    let duration = 0;
    for (let i = 0; i < opts.clips.length; i++) {
      const clip = opts.clips[i], start = clip.startSec ?? 0;
      if (!clip.buffer.length || !Number.isFinite(clip.durationSec) || clip.durationSec <= 0 || !Number.isFinite(start) || start < 0) throw new Error("Toma o duración inválida.");
      const file = path.join(dir, `shot-${i}.mp4`); await writeFile(file, clip.buffer);
      args.push("-i", file); duration += clip.durationSec;
      filters.push(`[${i}:v]trim=start=${start}:duration=${clip.durationSec},setpts=PTS-STARTPTS,scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p[v${i}]`);
    }
    const audio = path.join(dir, "narration.mp4"), out = path.join(dir, "out.mp4");
    await writeFile(audio, opts.audio); args.push("-i", audio);
    filters.push(`${opts.clips.map((_,i)=>`[v${i}]`).join("")}concat=n=${opts.clips.length}:v=1:a=0[v]`);
    filters.push(`[${opts.clips.length}:a]atrim=duration=${duration},asetpts=PTS-STARTPTS[a]`);
    await runFfmpeg(ffmpegStatic, [...args, "-filter_complex_threads", "2", "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", "-t", String(duration), ...H264_IOS_VIDEO, ...AAC_IOS_AUDIO, ...IOS_MP4_CONTAINER, out]);
    return ensureIosMp4(await readFile(out));
  } finally { await rm(dir, {recursive:true, force:true}); }
}
