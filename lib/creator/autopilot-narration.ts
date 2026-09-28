import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";

function ff(args: string[]): Promise<Buffer> {
  return new Promise((resolve,reject)=>{
    if(!ffmpegStatic)return reject(new Error("Falta el motor de audio."));
    const child=spawn(ffmpegStatic,["-hide_banner","-loglevel","error",...args]);
    const chunks:Buffer[]=[];let error="",bytes=0;
    const timer=setTimeout(()=>child.kill("SIGKILL"),30_000);
    child.stdout.on("data",(b:Buffer)=>{bytes+=b.length;if(bytes>8e6)child.kill("SIGKILL");else chunks.push(b);});
    child.stderr.on("data",b=>{error=(error+b.toString()).slice(-900);});
    child.on("error",e=>{clearTimeout(timer);reject(e);});
    child.on("close",code=>{clearTimeout(timer);if(code===0)resolve(Buffer.concat(chunks));else reject(new Error(error||"No se pudo preparar la narración."));});
  });
}

export class NarrationDurationError extends Error {}

/** Local duration measurement and modest tempo adjustment; never transcribes audio. */
export async function fitNarration(audio: Buffer, targetSec = 15): Promise<Buffer> {
  if(!Number.isFinite(targetSec)||targetSec<9||targetSec>24)throw new Error("Duración de narración inválida.");
  const dir=await mkdtemp(path.join(tmpdir(),"zima-narration-"));
  try {
    const input=path.join(dir,"voice.mp3"),output=path.join(dir,"voice-fit.mp3");await writeFile(input,audio);
    const pcm=await ff(["-i",input,"-vn","-ac","1","-ar","16000","-f","s16le","pipe:1"]);
    const duration=pcm.length/(16000*2),speed=Math.max(0.85,duration/(targetSec-0.2));
    if(duration<targetSec*.65||speed>1.2)throw new NarrationDurationError("La narración no encaja de forma natural en la duración. El guion necesita ajustarse.");
    await ff(["-y","-i",input,"-af",`atempo=${speed.toFixed(6)},apad,atrim=duration=${targetSec}`,"-c:a","libmp3lame","-b:a","192k",output]);
    return await readFile(output);
  } finally {await rm(dir,{recursive:true,force:true});}
}

export async function narrationDuration(audio: Buffer): Promise<number> {
  const dir=await mkdtemp(path.join(tmpdir(),"zima-voice-duration-"));
  try {
    const input=path.join(dir,"voice.mp3");await writeFile(input,audio);
    const pcm=await ff(["-i",input,"-vn","-ac","1","-ar","16000","-f","s16le","pipe:1"]);
    return pcm.length/32000;
  } finally {await rm(dir,{recursive:true,force:true});}
}
