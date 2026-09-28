import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { ensureIosMp4, isIosPlayableMp4, probeMedia } from "./ios-mp4";

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
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

async function main() {
  const bin = ffmpegStatic;
  assert(bin, "ffmpeg-static");
  const dir = await mkdtemp(path.join(tmpdir(), "zima-ios-check-"));
  const src = path.join(dir, "src.mp4");
  const outFile = path.join(dir, "out.mp4");
  try {
    const made = await run(bin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=320x240:d=1",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=stereo",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      src,
    ]);
    assert(made.code === 0, made.stderr.slice(-400));
    const converted = await ensureIosMp4(await readFile(src));
    await writeFile(outFile, converted);
    const probe = await probeMedia(bin, outFile);
    assert(isIosPlayableMp4(probe), `not ios playable: ${probe.slice(-500)}`);
    assert(/Video:\s*h264/i.test(probe), "expected h264");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
