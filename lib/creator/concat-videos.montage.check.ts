import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { accessSync, constants } from "fs";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { concatVerticalClips } from "./concat-videos";

const USER_FIXTURES = path.join(
  "/Users/juanmolina/Documents/Codex/2026-09-05/er/work/montage-fixtures"
);

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
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

function readable(file: string): boolean {
  try {
    accessSync(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function parseProbe(stderr: string) {
  const size = stderr.match(/Video:.*?\s(\d{2,5})x(\d{2,5})/);
  const dur = stderr.match(/Duration:\s(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const hours = dur ? Number(dur[1]) : 0;
  const minutes = dur ? Number(dur[2]) : 0;
  const seconds = dur ? Number(dur[3]) : 0;
  return {
    width: size ? Number(size[1]) : 0,
    height: size ? Number(size[2]) : 0,
    durationSec: hours * 3600 + minutes * 60 + seconds,
    hasAudio: /Audio:/i.test(stderr),
  };
}

async function makeSynth(bin: string, dir: string) {
  const portrait = path.join(dir, "portrait-audio.mp4");
  const landscape = path.join(dir, "landscape-silent.mp4");
  const portraitRun = await run(bin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=1080x1920:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=44100",
    "-t",
    "4",
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    portrait,
  ]);
  assert(portraitRun.code === 0, portraitRun.stderr.slice(-400) || "portrait synth failed");
  const landRun = await run(bin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=1920x1080:rate=30",
    "-t",
    "3",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-c:v",
    "libx264",
    landscape,
  ]);
  assert(landRun.code === 0, landRun.stderr.slice(-400) || "landscape synth failed");
  return { portrait, landscape, source: "synthetic" as const };
}

async function main() {
  const bin = ffmpegStatic;
  assert(bin, "Falta ffmpeg-static");
  const dir = await mkdtemp(path.join(tmpdir(), "zima-montage-check-"));
  try {
    const userPortrait = path.join(USER_FIXTURES, "portrait-audio.mp4");
    const userLandscape = path.join(USER_FIXTURES, "landscape-silent.mp4");
    const fromUser = readable(userPortrait) && readable(userLandscape);
    const clips = fromUser
      ? {
          portrait: userPortrait,
          landscape: userLandscape,
          source: "user-fixtures" as const,
        }
      : await makeSynth(bin, dir);

    const talking = await readFile(clips.portrait);
    const broll = await readFile(clips.landscape);
    assert(talking.byteLength > 1000, "portrait clip vacío");
    assert(broll.byteLength > 1000, "landscape clip vacío");

    const out = await concatVerticalClips([
      { buffer: talking, audio: "input", durationSec: 2 },
      { buffer: broll, audio: "silent", durationSec: 2 },
    ]);
    assert(out.byteLength > 1000, "montaje vacío");
    const outFile = path.join(dir, "montage.mp4");
    await writeFile(outFile, out);
    const probed = await run(bin, ["-i", outFile]);
    const info = parseProbe(probed.stderr);
    assert(info.width === 1080 && info.height === 1920, `esperado 1080x1920, got ${info.width}x${info.height}`);
    assert(info.hasAudio, "el montaje debe tener pista de audio (presentadora + silencio)");
    assert(info.durationSec >= 3.5 && info.durationSec <= 5.5, `duración rara: ${info.durationSec}s`);

    console.log(
      `concat-videos montage ok (${clips.source}, ${info.width}x${info.height}, ${info.durationSec.toFixed(2)}s, audio=${info.hasAudio})`
    );
    if (!fromUser) {
      console.log(
        `fixtures locales no legibles en ${USER_FIXTURES} (TCC); se usaron clips sintéticos equivalentes portrait-audio + landscape-silent`
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

void main();
