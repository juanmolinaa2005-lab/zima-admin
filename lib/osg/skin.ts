import { OSG_TEMPLATE_LABELS } from "./template-labels";

export const OSG_PREFIX = "/osg";
export const OSG_UPSTREAM = "https://editor.openscrgen.app";

export const OSG_SKIN_CSS = `
html, body {
  background: #f7f7f8 !important;
  color-scheme: light !important;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif !important;
}
:root, .dark {
  --background: 240 5% 97%;
  --foreground: 220 18% 11%;
  --card: 0 0% 100%;
  --card-foreground: 220 18% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 220 18% 11%;
  --primary: 220 18% 11%;
  --primary-foreground: 0 0% 100%;
  --secondary: 240 5% 95%;
  --secondary-foreground: 220 18% 11%;
  --muted: 240 5% 95%;
  --muted-foreground: 220 9% 46%;
  --accent: 240 5% 95%;
  --accent-foreground: 220 18% 11%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --border: 240 6% 92%;
  --input: 240 6% 92%;
  --ring: 220 18% 11%;
  --radius: 0.95rem;
  --sidebar-background: 240 5% 97%;
  --sidebar-foreground: 220 18% 11%;
  --sidebar-primary: 220 18% 11%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 240 5% 93%;
  --sidebar-accent-foreground: 220 18% 11%;
  --sidebar-border: 240 6% 92%;
  --sidebar-ring: 220 18% 11%;
}
html.dark .artboard,
html.dark [data-artboard-surface] {
  color-scheme: light;
}
body > main.h-screen {
  background: #f7f7f8 !important;
}
[data-sidebar="sidebar"] {
  background: #f7f7f8 !important;
  color: #111827 !important;
  border-right: 1px solid #ebebef !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
[data-sidebar="header"],
[data-sidebar="footer"] {
  display: none !important;
}
[data-sidebar="content"] {
  padding: 10px 10px 12px !important;
  gap: 4px !important;
}
[data-sidebar="menu-button"] {
  border-radius: 12px !important;
  padding: 9px 10px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  letter-spacing: -0.01em !important;
  color: #111827 !important;
}
[data-sidebar="menu-button"][data-active="true"],
[data-sidebar="menu-button"][aria-current="page"] {
  background: #ececef !important;
  color: #111827 !important;
  box-shadow: none !important;
}
[data-sidebar="menu-button"][data-capturas-discover] {
  height: 46px !important;
  min-height: 46px !important;
  padding: 12px 16px !important;
  border: 0 !important;
  border-radius: 14px !important;
  background: #111827 !important;
  color: #ffffff !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
}
[data-sidebar="menu-button"][data-capturas-discover] svg {
  color: #ffffff !important;
  width: 18px !important;
  height: 18px !important;
}
[data-sidebar="menu-button"][data-capturas-discover]:hover {
  background: #030712 !important;
  color: #ffffff !important;
}
[data-capturas-profile] {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  width: 100% !important;
  height: 46px !important;
  min-height: 46px !important;
  margin: 0 0 8px !important;
  padding: 12px 16px !important;
  border: 0 !important;
  border-radius: 14px !important;
  background: #ececef !important;
  color: #111827 !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
  text-align: left !important;
  cursor: pointer !important;
}
[data-capturas-profile]:hover,
[data-capturas-profile][data-active="true"] {
  background: #e4e4e7 !important;
}
[data-capturas-profile] svg {
  width: 18px !important;
  height: 18px !important;
  flex-shrink: 0 !important;
}
[role="dialog"] button.bg-gradient-to-r,
html[data-capturas-open="projects"] [role="dialog"] .overflow-y-auto,
html[data-capturas-open="projects"] [role="dialog"] [role="tablist"],
html[data-capturas-open="projects"] [role="dialog"] input,
[data-capturas-view="projects"] .overflow-y-auto,
[data-capturas-view="projects"] [role="tablist"],
[data-capturas-view="projects"] input,
[data-capturas-view="projects"] .border-t > .grid.min-h-\\[20vh\\],
[data-capturas-view="discover"] .border-t > .min-w-0 {
  display: none !important;
}
[data-capturas-view="projects"] .border-t {
  border-top: 0 !important;
  display: block !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow: auto !important;
}
[data-capturas-view="projects"] .border-t > .min-w-0 {
  width: 100% !important;
}
[data-capturas-view="projects"] h2 + p,
[data-capturas-view="projects"] h1 + p {
  display: none !important;
}
[data-sidebar="menu"] {
  gap: 2px !important;
}
main.min-h-svh.flex-1 {
  margin: 0 !important;
  border-radius: 0 !important;
  overflow: hidden !important;
  background: #f7f7f8 !important;
  border: 0 !important;
  box-shadow: none !important;
}
button, [role="button"], input, select, textarea {
  border-radius: 12px !important;
}
[role="tablist"] {
  align-items: center !important;
  gap: 4px !important;
}
[role="tab"] {
  border-radius: 999px !important;
  border: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  color: #6b7280 !important;
  padding: 6px 10px !important;
  font-weight: 500 !important;
}
[role="tab"][data-state="active"],
[role="tab"][aria-selected="true"] {
  background: #ececef !important;
  color: #111827 !important;
  font-weight: 600 !important;
  box-shadow: none !important;
}
[role="dialog"], [data-radix-dialog-content], [role="alertdialog"] {
  border-radius: 22px !important;
  border: 1px solid #ebebef !important;
  background: #fff !important;
  box-shadow: 0 16px 48px rgba(17,24,39,0.08) !important;
}
a[href*="github.com/dotnetdreamer"],
ins.adsbygoogle,
iframe[src*="googlesyndication"],
iframe[id^="google_ads"] {
  display: none !important;
}
[role="dialog"]:has([aria-label^="Tip "]),
[data-radix-dialog-content]:has([aria-label^="Tip "]) {
  display: none !important;
}
html.capturas-panning,
html.capturas-panning * {
  cursor: grabbing !important;
  user-select: none !important;
}
[data-radix-scroll-area-viewport] {
  --capturas-x: 0px;
  --capturas-y: 0px;
  --capturas-s: 1;
}
[data-radix-scroll-area-viewport] > :first-child {
  translate: var(--capturas-x) var(--capturas-y);
  scale: var(--capturas-s);
  transform-origin: 0 0;
}
.group.flex.cursor-pointer.flex-col .flex.min-w-0.items-center.gap-2:has(.rounded-full),
.group.flex.cursor-pointer.flex-col .mt-auto,
.group.flex.cursor-pointer.flex-col .pointer-events-none.absolute,
.group.flex.cursor-pointer.flex-col a[href*="openscreenshot"],
.group.flex.cursor-pointer.flex-col [class*="line-clamp"] + .flex.flex-wrap {
  display: none !important;
}
.capturas-tpl-name {
  font-size: 16px !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
  color: #111827 !important;
  line-height: 1.25 !important;
}
.capturas-tpl-desc {
  margin-top: 6px !important;
  font-size: 13px !important;
  line-height: 1.45 !important;
  color: #6b7280 !important;
}
`;

export const OSG_BOOT_JS = `
(function(){
  var PREFIX=${JSON.stringify(OSG_PREFIX)};
  var TPL=${JSON.stringify(OSG_TEMPLATE_LABELS)};
  var HOSTS=["editor.openscrgen.app","www.openscrgen.app","openscrgen.app"];
  try {
    localStorage.setItem("open-screenshot-generator.theme","light");
    localStorage.setItem("open-screenshot-generator.show-startup-tips","0");
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme="light";
  } catch(e){}
  function wrap(url){
    if(typeof url!=="string"||!url) return url;
    try{
      var u=new URL(url, location.origin);
      if(HOSTS.indexOf(u.hostname)>=0){
        return PREFIX+u.pathname+u.search+u.hash;
      }
      if(u.origin===location.origin && u.pathname.indexOf(PREFIX+"/")!==0 && u.pathname!==PREFIX){
        if(/^\\/(_next|data|elements)\\//.test(u.pathname) ||
           u.pathname==="/favicon.ico" ||
           u.pathname.indexOf("/icon.svg")===0 ||
           u.pathname==="/logo.svg" ||
           u.pathname.indexOf("/splash")===0){
          return PREFIX+u.pathname+u.search+u.hash;
        }
      }
    }catch(e){}
    return url;
  }
  var fetchFn=window.fetch;
  window.fetch=function(input, init){
    if(typeof input==="string") return fetchFn(wrap(input), init);
    if(input instanceof Request) return fetchFn(new Request(wrap(input.url), input), init);
    return fetchFn(input, init);
  };
  var openFn=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method, url){
    var args=Array.prototype.slice.call(arguments);
    if(typeof url==="string") args[1]=wrap(url);
    return openFn.apply(this, args);
  };
  function patch(proto, prop){
    var d=Object.getOwnPropertyDescriptor(proto, prop);
    if(!d||!d.set) return;
    Object.defineProperty(proto, prop, {
      configurable:true,
      get:d.get,
      set:function(v){ d.set.call(this, wrap(String(v))); }
    });
  }
  patch(HTMLImageElement.prototype,"src");
  patch(HTMLScriptElement.prototype,"src");
  patch(HTMLLinkElement.prototype,"href");
  patch(HTMLIFrameElement.prototype,"src");
  var HIDE=/^(account|settings|about|ajustes|acerca de|cuenta)$/i;
  function hideChrome(root){
    var scope=root&&root.querySelectorAll?root:document;
    var header=document.querySelector('[data-sidebar="header"]');
    var footer=document.querySelector('[data-sidebar="footer"]');
    if(header) header.style.display="none";
    if(footer) footer.style.display="none";
    var nodes=scope.querySelectorAll?scope.querySelectorAll('[data-sidebar="menu-button"],button,a'):[];
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      var label=((el.getAttribute("aria-label")||"")+" "+(el.textContent||"")).replace(/\\s+/g," ").trim();
      if(HIDE.test(label)) {
        var item=el.closest('[data-sidebar="menu-item"]')||el;
        item.style.display="none";
      }
      if(/^discover$/i.test(label.replace(/^\\s+|\\s+$/g,""))) {
        el.setAttribute("data-capturas-discover","1");
      }
      if(el.closest&&el.closest('[role="dialog"]')&&/Start with the AI agent|Make social graphics|Drop your screenshots/i.test(label)){
        el.style.display="none";
      }
    }
    var dialogs=document.querySelectorAll('[role="dialog"],[data-radix-dialog-content]');
    for(var d=0;d<dialogs.length;d++){
      var text=(dialogs[d].innerText||"");
      if(/TIP\\s*\\d+\\s*OF|One project per store size|Show these tips when I open/i.test(text)){
        var closer=dialogs[d].querySelector('button[aria-label="Close"]');
        if(closer) closer.click();
        dialogs[d].style.display="none";
      }
    }
    ensureProfileButton();
    syncDialogView();
  }
  function setDialogView(view){
    document.documentElement.setAttribute("data-capturas-open", view||"");
    var dialog=document.querySelector('[role="dialog"]');
    if(!dialog) return;
    dialog.setAttribute("data-capturas-view", view||"");
    var heading=dialog.querySelector("h1,h2");
    if(heading){
      if(!heading.getAttribute("data-capturas-h")) heading.setAttribute("data-capturas-h", heading.textContent||"");
      heading.textContent=view==="projects"?"Proyectos":(heading.getAttribute("data-capturas-h")||heading.textContent);
    }
    var profile=document.querySelector("[data-capturas-profile]");
    if(profile) profile.setAttribute("data-active", view==="projects"?"true":"false");
  }
  function syncDialogView(){
    var dialog=document.querySelector('[role="dialog"]');
    var pending=document.documentElement.getAttribute("data-capturas-open");
    if(dialog && pending) setDialogView(pending);
    if(!dialog){
      var profile=document.querySelector("[data-capturas-profile]");
      if(profile) profile.setAttribute("data-active","false");
    }
  }
  function openStartDialog(view){
    setDialogView(view);
    var dialog=document.querySelector('[role="dialog"]');
    if(!dialog){
      var discover=document.querySelector("[data-capturas-discover]");
      if(discover) discover.click();
    }
    setTimeout(function(){ setDialogView(view); }, 40);
    setTimeout(function(){ setDialogView(view); }, 200);
  }
  function ensureProfileButton(){
    if(document.querySelector("[data-capturas-profile]")) return;
    var content=document.querySelector('[data-sidebar="content"]');
    if(!content) return;
    var first=content.querySelector('[data-sidebar="group"]');
    if(!first) return;
    var btn=document.createElement("button");
    btn.type="button";
    btn.setAttribute("data-capturas-profile","1");
    btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M5.2 18.4c1.2-3 3.6-4.5 6.8-4.5s5.6 1.5 6.8 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>Perfil</span>';
    btn.addEventListener("click",function(e){
      e.preventDefault();
      e.stopPropagation();
      openStartDialog("projects");
    });
    first.parentNode.insertBefore(btn, first);
    var discover=document.querySelector("[data-capturas-discover]");
    if(discover && !discover.getAttribute("data-capturas-bound")){
      discover.setAttribute("data-capturas-bound","1");
      discover.addEventListener("click",function(){
        setDialogView("discover");
        setTimeout(function(){ setDialogView("discover"); }, 40);
      });
    }
  }
  document.title="Editor";
  function canvasViewport(from){
    var all=document.querySelectorAll("[data-radix-scroll-area-viewport]");
    var canvas=null;
    for(var i=0;i<all.length;i++){
      if(all[i].querySelector(".artboard")){ canvas=all[i]; break; }
    }
    if(from&&from.nodeType===1){
      var node=from;
      while(node&&node!==document.body){
        if(node.getAttribute&&node.getAttribute("data-radix-scroll-area-viewport")!=null){
          if(node===canvas || node.querySelector&&node.querySelector(".artboard")) return node;
          break;
        }
        node=node.parentElement;
      }
    }
    if(canvas) return canvas;
    var main=document.querySelector("main.min-h-svh.flex-1")||document.querySelector("main");
    var list=(main||document).querySelectorAll("*");
    var best=null, bestArea=0;
    for(var i=0;i<list.length;i++){
      var el=list[i];
      var st=window.getComputedStyle(el);
      var scrollable=(st.overflowX==="auto"||st.overflowX==="scroll"||st.overflowY==="auto"||st.overflowY==="scroll");
      if(!scrollable) continue;
      if(el.scrollWidth<=el.clientWidth+8 && el.scrollHeight<=el.clientHeight+8) continue;
      var area=el.clientWidth*el.clientHeight;
      if(area>bestArea){ best=el; bestArea=area; }
    }
    return best;
  }
  function camOf(vp){
    return {
      x:parseFloat(vp.style.getPropertyValue("--capturas-x"))||0,
      y:parseFloat(vp.style.getPropertyValue("--capturas-y"))||0,
      s:parseFloat(vp.style.getPropertyValue("--capturas-s"))||1
    };
  }
  function setCam(vp,x,y,s){
    vp.style.setProperty("--capturas-x",x+"px");
    vp.style.setProperty("--capturas-y",y+"px");
    if(s!=null) vp.style.setProperty("--capturas-s",String(s));
  }
  function osgScale(){
    var vp=document.querySelector("[data-radix-scroll-area-viewport]");
    if(!vp) return 1;
    var nodes=vp.querySelectorAll("[style]");
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(el.classList&&el.classList.contains("artboard")) continue;
      var t=el.style.transform||"";
      if(t.indexOf("scale(")===-1) continue;
      if((el.style.transformOrigin||"").indexOf("left")!==0) continue;
      var m=/scale\\(([-\\d.]+)\\)/.exec(t);
      if(m) return parseFloat(m[1])||1;
    }
    return 1;
  }
  function zoomToward(vp, clientX, clientY, nextS){
    var cam=camOf(vp);
    var r=vp.getBoundingClientRect();
    var s=cam.s||1;
    nextS=Math.max(0.1, Math.min(8, nextS));
    if(Math.abs(nextS-s)<1e-4) return;
    var ratio=nextS/s;
    setCam(
      vp,
      (clientX-r.left)-(clientX-r.left-cam.x)*ratio,
      (clientY-r.top)-(clientY-r.top-cam.y)*ratio,
      nextS
    );
  }
  function keepCursorAfterOsgZoom(vp, clientX, clientY, s0, s1){
    if(!s0 || !s1 || Math.abs(s1-s0)<1e-4) return;
    var cam=camOf(vp);
    var r=vp.getBoundingClientRect();
    var ratio=s1/s0;
    setCam(
      vp,
      (clientX-r.left)-(clientX-r.left-cam.x)*ratio,
      (clientY-r.top)-(clientY-r.top-cam.y)*ratio,
      cam.s
    );
  }
  var lastCursor={x:0,y:0,ok:false};
  function enableCursorZoom(){
    document.addEventListener("pointermove",function(e){
      lastCursor={x:e.clientX,y:e.clientY,ok:true};
    },true);
    document.addEventListener("wheel",function(e){
      if(e.target&&e.target.closest&&e.target.closest("input,textarea,[role=dialog],[data-sidebar]")) return;
      var vp=canvasViewport(e.target);
      if(!vp||!vp.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      var factor=Math.exp(-(e.deltaY||0)*(e.ctrlKey||e.metaKey?0.01:0.0018));
      zoomToward(vp, e.clientX, e.clientY, camOf(vp).s*factor);
    },{capture:true,passive:false});
    document.addEventListener("click",function(e){
      var btn=e.target&&e.target.closest&&e.target.closest("button");
      if(!btn) return;
      var title=btn.getAttribute("title")||"";
      if(title!=="Zoom In" && title!=="Zoom Out" && title!=="Reset zoom to 100%") return;
      var vp=canvasViewport(document.body);
      if(!vp) return;
      var s0=osgScale();
      var r=vp.getBoundingClientRect();
      var x=lastCursor.ok?lastCursor.x:r.left+r.width/2;
      var y=lastCursor.ok?lastCursor.y:r.top+r.height/2;
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          keepCursorAfterOsgZoom(vp,x,y,s0,osgScale());
        });
      });
    },true);
  }
  function enableMiddlePan(){
    var pan=null;
    function endPan(){
      if(!pan) return;
      pan=null;
      document.documentElement.classList.remove("capturas-panning");
    }
    document.addEventListener("pointerdown",function(e){
      if(e.button!==1) return;
      if(e.target&&e.target.closest&&e.target.closest("input,textarea,[role=dialog],[data-sidebar]")) return;
      var vp=canvasViewport(e.target);
      if(!vp) return;
      e.preventDefault();
      e.stopPropagation();
      var cam=camOf(vp);
      pan={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,vp:vp};
      document.documentElement.classList.add("capturas-panning");
      try{ vp.setPointerCapture&&vp.setPointerCapture(e.pointerId); }catch(err){}
    },true);
    document.addEventListener("pointermove",function(e){
      if(!pan) return;
      e.preventDefault();
      setCam(pan.vp, pan.cx+(e.clientX-pan.x), pan.cy+(e.clientY-pan.y));
    },true);
    document.addEventListener("pointerup",endPan,true);
    document.addEventListener("pointercancel",endPan,true);
    document.addEventListener("auxclick",function(e){
      if(e.button===1){ e.preventDefault(); e.stopPropagation(); }
    },true);
    document.addEventListener("mousedown",function(e){
      if(e.button===1) e.preventDefault();
    },true);
  }
  function normTitle(raw){
    return String(raw||"").toLowerCase().replace(/store set/g," ").replace(/\\bcopy\\b/g," ").replace(/iphone[^a-z0-9]*.*$/g," ").replace(/[^a-z0-9]+/g," ").replace(/\\s+/g," ").trim();
  }
  function labelFor(raw){
    var key=normTitle(raw);
    if(TPL[key]) return TPL[key];
    var k;
    for(k in TPL){
      if(key&&(key.indexOf(k)>=0||k.indexOf(key)>=0)) return TPL[k];
    }
    if(/blank|canvas|lienzo/.test(key)) return TPL["blank canvas"];
    if(/capy/.test(key)) return TPL.mycapy;
    if(/ludo/.test(key)) return TPL["ludo wala"];
    var name=String(raw||"").replace(/\\s*store set\\s*/i,"").replace(/\\s*copy\\s*/i,"").replace(/\\s*iPhone.*$/i,"").trim();
    return {name:name||raw, desc:"Set de capturas listo para personalizar."};
  }
  function relabelTemplates(root){
    var scope=root&&root.querySelectorAll?root:document;
    var cards=scope.querySelectorAll?scope.querySelectorAll(".group.cursor-pointer"):[];
    for(var i=0;i<cards.length;i++){
      var card=cards[i];
      var title=card.querySelector("h3 button, h3");
      if(!title) continue;
      var raw=(title.getAttribute("data-capturas-raw")||title.textContent||"").trim();
      if(!raw) continue;
      if(!title.getAttribute("data-capturas-raw")) title.setAttribute("data-capturas-raw", raw);
      var meta=labelFor(title.getAttribute("data-capturas-raw"));
      if(card.getAttribute("data-capturas-tpl")===meta.name && title.textContent===meta.name) continue;
      card.setAttribute("data-capturas-tpl", meta.name);
      title.textContent=meta.name;
      title.classList.add("capturas-tpl-name");
      var box=title.closest(".min-w-0")||title.parentElement;
      var p=box&&box.querySelector("p");
      if(!p && box){
        p=document.createElement("p");
        box.appendChild(p);
      }
      if(p){
        p.textContent=meta.desc;
        p.className="capturas-tpl-desc";
      }
      var extras=card.querySelectorAll("button.underline, .flex.flex-wrap, [class*='badge']");
      for(var e=0;e<extras.length;e++){
        if(extras[e]===title) continue;
        extras[e].style.display="none";
      }
      var nodes=card.querySelectorAll("p,span,a,div");
      for(var n=0;n<nodes.length;n++){
        var tx=(nodes[n].textContent||"").trim();
        if(nodes[n].children.length===0 && (/^#/.test(tx) || /^use as template$/i.test(tx))) nodes[n].style.display="none";
      }
    }
  }
  function ready(){
    hideChrome(document);
    enableMiddlePan();
    enableCursorZoom();
    relabelTemplates(document);
    var obs=new MutationObserver(function(){
      hideChrome(document);
      relabelTemplates(document);
    });
    obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(function(){ relabelTemplates(document); }, 400);
    setTimeout(function(){ relabelTemplates(document); }, 1200);
    setTimeout(function(){ relabelTemplates(document); }, 2500);
  }
  if(document.body) ready();
  else document.addEventListener("DOMContentLoaded", ready);
})();
`;

export function rewriteAssetPaths(source: string) {
  return source
    .replaceAll(OSG_UPSTREAM, "")
    .replaceAll("https://www.openscrgen.app", "")
    .replace(/(["'`])\/_next\//g, `$1${OSG_PREFIX}/_next/`)
    .replace(/(["'`])\/data\//g, `$1${OSG_PREFIX}/data/`)
    .replace(/(["'`])\/elements\//g, `$1${OSG_PREFIX}/elements/`)
    .replace(/(["'`])\/favicon\.ico/g, `$1${OSG_PREFIX}/favicon.ico`)
    .replace(/(["'`])\/icon\.svg/g, `$1${OSG_PREFIX}/icon.svg`)
    .replace(/(["'`])\/logo\.svg/g, `$1${OSG_PREFIX}/logo.svg`)
    .replace(/,"p":""/g, `,"p":"${OSG_PREFIX}"`)
    .replace(/\\"p\\":\\""/g, `\\"p\\":\\"${OSG_PREFIX}\\"`);
}

export function injectSkin(html: string) {
  const snippet = `<!-- capturas-skin:profile --><script>${OSG_BOOT_JS}</script><style id="capturas-skin">${OSG_SKIN_CSS}</style>`;
  let next = rewriteAssetPaths(html);
  next = next.replace(
    /Open Screenshot Generator - Design &amp; Translate App Store Graphics/g,
    "Editor"
  );
  if (next.includes("</head>")) {
    next = next.replace("</head>", `${snippet}</head>`);
  } else {
    next = snippet + next;
  }
  return next;
}
