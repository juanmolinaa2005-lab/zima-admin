import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { once } from "events";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { detectScreenMatte } from "./autopilot-phone-matte";
import type { ScreenQuad } from "./autopilot-phone";

const W = 1080, H = 1920, SW = 540, SH = 960, FPS = 25;

type Process = { child: ChildProcessWithoutNullStreams; done: Promise<void> };
function process(args: string[]): Process {
  if (!ffmpegStatic) throw new Error("Falta el motor de composición de video.");
  const child = spawn(ffmpegStatic, ["-hide_banner", "-loglevel", "error", ...args]);
  let error = "";
  child.stderr.on("data", b => { error = (error + b.toString()).slice(-1500); });
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(error || "Falló la composición de video.")));
  });
  void done.catch(() => {});
  return { child, done };
}

async function* frames(child: ChildProcessWithoutNullStreams, bytes: number) {
  let frame = Buffer.alloc(bytes), used = 0;
  for await (const value of child.stdout) {
    const chunk = value as Buffer;
    let at = 0;
    while (at < chunk.length) {
      const count = Math.min(bytes - used, chunk.length - at);
      chunk.copy(frame, used, at, at + count); used += count; at += count;
      if (used === bytes) { yield frame; frame = Buffer.alloc(bytes); used = 0; }
    }
  }
  if (used) throw new Error("La toma contiene un fotograma incompleto.");
}

/** Solve destination pixel -> source normalized coordinates for a perspective quad. */
export function screenTransform(q: ScreenQuad): number[] {
  const points = [q.tl, q.tr, q.br, q.bl], uv = [[0,0],[1,0],[1,1],[0,1]];
  const rows: number[][] = [];
  points.forEach(({x,y}, i) => {
    const [u,v] = uv[i];
    rows.push([x,y,1,0,0,0,-u*x,-u*y,u], [0,0,0,x,y,1,-v*x,-v*y,v]);
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    if (Math.abs(divisor) < 1e-9) throw new Error("La perspectiva del teléfono no es válida.");
    for (let j = col; j <= 8; j++) rows[col][j] /= divisor;
    for (let r = 0; r < 8; r++) if (r !== col) {
      const factor = rows[r][col];
      for (let j = col; j <= 8; j++) rows[r][j] -= factor * rows[col][j];
    }
  }
  return rows.map(r => r[8]);
}

type ScreenSilhouette = {top: number[]; bottom: number[]};

/** Calibrate the physical display outline once, including rounded corners and notch. */
function screenSilhouette(plate: Buffer, q: ScreenQuad, width: number, height: number): ScreenSilhouette {
  const m=screenTransform(q), columns=200, rows=400;
  const top=Array<number>(columns).fill(1),bottom=Array<number>(columns).fill(0);
  for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){
    const u=(col+.5)/columns,v=(row+.5)/rows;
    const a=m[0]-u*m[6],b=m[1]-u*m[7],c=u-m[2],d=m[3]-v*m[6],e=m[4]-v*m[7],f=v-m[5],det=a*e-b*d;
    if(Math.abs(det)<1e-9)continue;
    const x=Math.round((c*e-b*f)/det),y=Math.round((a*f-c*d)/det);
    if(x<0||x>=width||y<0||y>=height)continue;
    const at=(y*width+x)*3,r=plate[at],g=plate[at+1],blue=plate[at+2];
    if(r>g+25&&blue>g+25){top[col]=Math.min(top[col],v);bottom[col]=Math.max(bottom[col],v);}
  }
  if(top.filter((v,i)=>v<.12&&bottom[i]>.85).length<columns*.9)throw new Error("No se pudo medir el contorno completo de la pantalla.");
  // Reflections can hide chroma inside the display. They must not become holes
  // in the persistent outline; only the shallow physical notch/corners remain.
  for(let col=0;col<columns;col++){
    const u=(col+.5)/columns;
    top[col]=Math.min(top[col],u>.25&&u<.8?.065:.018);
    bottom[col]=Math.max(bottom[col],.982);
  }
  return {top,bottom};
}

/** Replaces only measured magenta pixels; black UI and foreground hands stay intact. */
export function replaceScreenPixels(plate: Buffer, screen: Buffer, q: ScreenQuad, width = W, height = H, sw = SW, sh = SH, silhouette?: ScreenSilhouette): Buffer {
  const m = screenTransform(q), points = Object.values(q);
  const displayWidth = (Math.hypot(q.tr.x-q.tl.x,q.tr.y-q.tl.y)+Math.hypot(q.br.x-q.bl.x,q.br.y-q.bl.y))/2;
  const displayHeight = (Math.hypot(q.bl.x-q.tl.x,q.bl.y-q.tl.y)+Math.hypot(q.br.x-q.tr.x,q.br.y-q.tr.y))/2;
  const contentWidth = Math.min(1, (sw/sh)/(displayWidth/displayHeight));
  const contentHeight = Math.min(1, (displayWidth/displayHeight)/(sw/sh));
  const spillMargin = Math.ceil(displayWidth * 0.12);
  const x0 = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))) - spillMargin);
  const x1 = Math.min(width - 1, Math.ceil(Math.max(...points.map(p => p.x))) + spillMargin);
  const y0 = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))) - spillMargin);
  const y1 = Math.min(height - 1, Math.ceil(Math.max(...points.map(p => p.y))) + spillMargin);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const at = (y * width + x) * 3, r = plate[at], g = plate[at+1], b = plate[at+2];
    const pink = r > 50 && b > 45 && r > g + 8 && b > g + 8;
    if (!silhouette && !pink) continue;
    const divisor = m[6]*x + m[7]*y + 1;
    const u = (m[0]*x + m[1]*y + m[2]) / divisor, v = (m[3]*x + m[4]*y + m[5]) / divisor;
    if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) {
      if(!pink)continue;
      // Remove chroma light reflected on the nearby bezel/skin, before inserting UI.
      if (r > b * 1.15) {plate[at+1]=plate[at+2]=Math.round((g+b)/2);}
      else {plate[at]=plate[at+2]=g;}
      continue;
    }
    if(silhouette){
      const column=Math.max(0,Math.min(silhouette.top.length-1,Math.floor(u*silhouette.top.length)));
      if((v<silhouette.top[column]||v>silhouette.bottom[column])&&!pink)continue;
      // Warm foreground skin is an occluder, not part of the replaceable display.
      if((u<.035||u>.965)&&!pink&&r>b*1.18&&r>g*1.12&&g>b*.9)continue;
    }
    const sourceU = (u-(1-contentWidth)/2)/contentWidth, sourceV = (v-(1-contentHeight)/2)/contentHeight;
    if(sourceU<0||sourceU>1||sourceV<0||sourceV>1){plate[at]=plate[at+1]=plate[at+2]=0;continue;}
    const sx = Math.max(0, Math.min(sw-1, sourceU*(sw-1))), sy = Math.max(0, Math.min(sh-1, sourceV*(sh-1)));
    const ix = Math.floor(sx), iy = Math.floor(sy), dx = sx-ix, dy = sy-iy;
    const a = (iy*sw+ix)*3, c = (Math.min(sh-1,iy+1)*sw+ix)*3;
    const next = ix === sw-1 ? 0 : 3;
    for (let k = 0; k < 3; k++) plate[at+k] = Math.round((screen[a+k]*(1-dx)+screen[a+next+k]*dx)*(1-dy)+(screen[c+k]*(1-dx)+screen[c+next+k]*dx)*dy);
  }
  return plate;
}

/** Select a continuous interval with actual UI changes, instead of always taking the first frame. */
export async function selectDemoWindow(recording: Buffer, durationSec: number): Promise<number> {
  const dir = await mkdtemp(path.join(tmpdir(), "zima-demo-window-"));
  let decoder: Process | undefined;
  try {
    const input = path.join(dir, "recording.mp4"); await writeFile(input, recording);
    decoder = process(["-i", input, "-t", "120", "-vf", "fps=2,scale=54:96", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
    const changes: number[] = []; let previous: Buffer | undefined;
    for await (const f of frames(decoder.child, 54*96*3)) {
      let delta = 0;
      if (previous) for (let i = 0; i < f.length; i++) delta += Math.abs(f[i]-previous[i]);
      changes.push(delta / f.length); previous = f;
    }
    await decoder.done;
    const length = Math.ceil(durationSec*2);
    if (changes.length < length) throw new Error("La grabación de la app es demasiado corta para mostrar la acción completa.");
    let best = -1, start = 0;
    for (let i = 0; i <= changes.length-length; i++) {
      const score = changes.slice(i+1,i+length).reduce((a,b)=>a+b,0);
      if (score > best) { best = score; start = i/2; }
    }
    if (best < 1) throw new Error("La demo es estática. Hace falta una grabación que muestre el uso real de la app.");
    return start;
  } finally { decoder?.child.kill("SIGKILL"); decoder?.child.stdin.destroy(); decoder?.child.stdout.destroy(); await rm(dir, {recursive:true,force:true}); }
}

/** Bridge at most two missing samples using measured neighbors, never extrapolate. */
export function repairScreenTrack(input: (ScreenQuad | null)[]): ScreenQuad[] {
  const track=[...input];
  for(let i=0;i<track.length;i++){
    if(track[i])continue;
    const from=i;while(i<track.length&&!track[i])i++;
    const gap=i-from,previous=track[from-1],next=track[i];
    if(gap>2||!previous||!next)throw new Error("No se pudo seguir la pantalla durante toda la toma.");
    const width=Math.hypot(previous.tr.x-previous.tl.x,previous.tr.y-previous.tl.y);
    for(const k of Object.keys(previous) as (keyof ScreenQuad)[]) if(Math.hypot(next[k].x-previous[k].x,next[k].y-previous[k].y)>width*.12*(gap+1)) throw new Error("El movimiento del teléfono no permite recuperar la pantalla con precisión.");
    for(let j=0;j<gap;j++){
      const t=(j+1)/(gap+1);
      track[from+j]=Object.fromEntries(Object.keys(previous).map(key=>{const k=key as keyof ScreenQuad;return[k,{x:previous[k].x+(next[k].x-previous[k].x)*t,y:previous[k].y+(next[k].y-previous[k].y)*t}];})) as ScreenQuad;
    }
  }
  const result=track as ScreenQuad[];
  for(let i=1;i<result.length;i++){
    const q=result[i],p=result[i-1],width=Math.hypot(q.tr.x-q.tl.x,q.tr.y-q.tl.y);
    if(Object.keys(q).some(key=>{const k=key as keyof ScreenQuad;return Math.hypot(q[k].x-p[k].x,q[k].y-p[k].y)>width*.12;}))throw new Error("La pantalla cambió de forma bruscamente. La toma necesita regenerarse.");
  }
  return result;
}

/** Streaming composition: the video model never receives or redraws the app UI. */
export async function composePhoneVideo(opts: { plate: Buffer; recording: Buffer; durationSec: number; startSec: number }): Promise<Buffer> {
  if (!Number.isFinite(opts.durationSec) || opts.durationSec < 3 || opts.durationSec > 15 || !Number.isFinite(opts.startSec) || opts.startSec < 0) throw new Error("Duración de demo inválida.");
  const dir = await mkdtemp(path.join(tmpdir(), "zima-phone-video-"));
  const children: Process[] = [];
  const timeout = setTimeout(() => children.forEach(p => p.child.kill("SIGKILL")), 90_000);
  try {
    const plate = path.join(dir,"plate.mp4"), screen = path.join(dir,"screen.mp4"), out = path.join(dir,"out.mp4");
    await Promise.all([writeFile(plate, opts.plate), writeFile(screen, opts.recording)]);
    const count = Math.round(opts.durationSec*FPS);
    const tracking = process(["-i",plate,"-vf",`fps=${FPS},scale=${SW}:${SH}`,"-frames:v",String(count),"-f","rawvideo","-pix_fmt","rgb24","pipe:1"]);
    children.push(tracking);
    const samples: (ScreenQuad|null)[]=[];
    for await(const frame of frames(tracking.child,SW*SH*3))samples.push(detectScreenMatte(frame,SW,SH)?.quad || null);
    await tracking.done;
    if(samples.length!==count)throw new Error("El clip del teléfono no tiene la duración requerida.");
    const track=repairScreenTrack(samples);
    const p = process(["-i",plate,"-vf",`fps=${FPS},scale=${W}:${H}`,"-frames:v",String(count),"-f","rawvideo","-pix_fmt","rgb24","pipe:1"]);
    const s = process(["-ss",String(opts.startSec),"-i",screen,"-vf",`fps=${FPS},scale=${SW}:${SH}`,"-frames:v",String(count),"-f","rawvideo","-pix_fmt","rgb24","pipe:1"]);
    const enc = process(["-y","-f","rawvideo","-pix_fmt","rgb24","-s",`${W}x${H}`,"-r",String(FPS),"-i","pipe:0","-an","-c:v","libx264","-crf","18","-preset","fast","-pix_fmt","yuv420p","-movflags","+faststart",out]);
    children.push(p,s,enc);
    // A failed encoder must reject a pending write, never leave a drain wait hanging.
    enc.child.stdin.on("error", () => {});
    const screens = frames(s.child,SW*SH*3)[Symbol.asyncIterator]();
    let index = 0;
    let silhouette: ScreenSilhouette | undefined;
    for await (const frame of frames(p.child,W*H*3)) {
      const next = await screens.next();
      if (next.done) throw new Error("La grabación de la app termina antes que la toma del teléfono.");
      const q = Object.fromEntries(Object.entries(track[index]).map(([k,v])=>[k,{x:v.x*2,y:v.y*2}])) as ScreenQuad;
      const width = Math.hypot(q.tr.x-q.tl.x,q.tr.y-q.tl.y);
      if (width < 200) throw new Error("La pantalla es demasiado pequeña para leer la app.");
      silhouette ||= screenSilhouette(frame,q,W,H);
      const composed=replaceScreenPixels(frame,next.value,q,W,H,SW,SH,silhouette);
      if (!enc.child.stdin.write(composed)) await once(enc.child.stdin,"drain");
      index++;
    }
    if (index !== count) throw new Error("El clip del teléfono no tiene la duración requerida.");
    enc.child.stdin.end(); await Promise.all(children.map(c=>c.done));
    return await readFile(out);
  } finally { clearTimeout(timeout);children.forEach(p=>{p.child.kill("SIGKILL");p.child.stdin.destroy();p.child.stdout.destroy();});await rm(dir,{recursive:true,force:true}); }
}
