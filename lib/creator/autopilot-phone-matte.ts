import type { ScreenQuad } from "./autopilot-phone";

/** A deliberately magenta display is a measurable compositing surface. */
export function detectScreenMatte(rgb: Buffer, width: number, height: number): {quad: ScreenQuad; mask: Buffer} | null {
  if (rgb.length !== width * height * 3) return null;
  const n=width*height, seen=new Uint8Array(n), candidates: number[][]=[];
  const pink=(i:number)=>{const j=i*3,r=rgb[j],g=rgb[j+1],b=rgb[j+2];return r>50&&b>45&&r>g+8&&b>g+8;};
  for(let i=0;i<n;i++) {
    if(seen[i]||!pink(i))continue;
    const cells=[i];seen[i]=1;
    for(let k=0;k<cells.length;k++) {
      const p=cells[k],x=p%width,y=Math.floor(p/width);
      for(const q of [x>0?p-1:-1,x<width-1?p+1:-1,y>0?p-width:-1,y<height-1?p+width:-1]) {
        if(q>=0&&!seen[q]&&pink(q)){seen[q]=1;cells.push(q);}
      }
    }
    if(cells.length>n*0.008&&cells.length<n*0.4)candidates.push(cells);
  }
  const valid=[];
  for(const cells of candidates){
    let tl=cells[0],tr=tl,br=tl,bl=tl;
    const sum=(i:number)=>(i%width)+Math.floor(i/width),diff=(i:number)=>(i%width)-Math.floor(i/width);
    for(const i of cells){if(sum(i)<sum(tl))tl=i;if(diff(i)>diff(tr))tr=i;if(sum(i)>sum(br))br=i;if(diff(i)<diff(bl))bl=i;}
    const point=(i:number)=>({x:i%width,y:Math.floor(i/width)});
    const measured=[point(tl),point(tr),point(br),point(bl)];
    const points=fitDisplayEdges(cells,width) || measured;
    let area=0,convex=true;
    for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];area+=a.x*b.y-b.x*a.y;if((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)<=0)convex=false;}
    area/=2;
    const length=(a:number,b:number)=>Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);
    const w=(length(0,1)+length(2,3))/2,h=(length(0,3)+length(1,2))/2;
    if(!convex||w<35||h/w<1.3||h/w>3.1||cells.length/area<0.85||cells.length/area>1.12)continue;
    const mask=Buffer.alloc(n);for(const i of cells)mask[i]=255;
    valid.push({quad:{tl:points[0],tr:points[1],br:points[2],bl:points[3]},mask});
  }
  // Multiple plausible magenta surfaces are ambiguous: never guess.
  return valid.length===1?valid[0]:null;
}

/** Fit the straight bezel edges, excluding rounded corners and the central notch. */
function fitDisplayEdges(cells: number[], width: number): {x:number;y:number}[] | null {
  const rows=new Map<number,[number,number]>(), cols=new Map<number,[number,number]>();
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const i of cells){const x=i%width,y=Math.floor(i/width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    const row=rows.get(y),col=cols.get(x);rows.set(y,row?[Math.min(row[0],x),Math.max(row[1],x)]:[x,x]);cols.set(x,col?[Math.min(col[0],y),Math.max(col[1],y)]:[y,y]);}
  const fit=(samples:[number,number][]):[number,number]|null=>{
    if(samples.length<10)return null;
    let selected=samples,answer:[number,number]=[0,0];
    for(let pass=0;pass<2;pass++){
      let a=0,b=0,aa=0,ab=0;for(const [x,y] of selected){a+=x;b+=y;aa+=x*x;ab+=x*y;}
      const n=selected.length,d=n*aa-a*a;if(Math.abs(d)<1e-6)return null;
      const slope=(n*ab-a*b)/d,offset=(b-slope*a)/n;answer=[slope,offset];
      selected=[...samples].sort((p,q)=>Math.abs(p[1]-slope*p[0]-offset)-Math.abs(q[1]-slope*q[0]-offset)).slice(0,Math.ceil(samples.length*.7));
    }
    return Math.abs(answer[0])<0.4?answer:null;
  };
  const vertical=[...rows].filter(([y])=>y>y0+(y1-y0)*.2&&y<y0+(y1-y0)*.8);
  const flanks=[...cols].filter(([x])=>{const u=(x-x0)/(x1-x0);return u>.12&&u<.3||u>.7&&u<.88;});
  const bottomSamples=[...cols].filter(([x])=>x>x0+(x1-x0)*.2&&x<x0+(x1-x0)*.8);
  const left=fit(vertical.map(([y,[x]])=>[y,x])),right=fit(vertical.map(([y,[,x]])=>[y,x]));
  const top=fit(flanks.map(([x,[y]])=>[x,y])),bottom=fit(bottomSamples.map(([x,[,y]])=>[x,y]));
  if(!left||!right||!top||!bottom)return null;
  const intersect=(v:[number,number],h:[number,number])=>{const y=(h[0]*v[1]+h[1])/(1-h[0]*v[0]);return{x:v[0]*y+v[1],y};};
  return [intersect(left,top),intersect(right,top),intersect(right,bottom),intersect(left,bottom)];
}
