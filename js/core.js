"use strict";
// Shared helpers, app state and undo history

/* ---------- helpers ---------- */
const APP_VERSION = '0.1.2';
const $ = s => document.querySelector(s);
const mk = (w,h) => { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const store = {
  get(k,d){ try{ const v=localStorage.getItem('sgs.'+k); return v==null?d:JSON.parse(v);}catch(e){return d;} },
  set(k,v){ try{ localStorage.setItem('sgs.'+k, JSON.stringify(v)); }catch(e){} }
};
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200); }
const hex2 = n => n.toString(16).padStart(2,'0');
const toHex = c => '#'+hex2(c.r)+hex2(c.g)+hex2(c.b);
const rgba = c => `rgba(${c.r},${c.g},${c.b},${c.a/255})`;

/* ---------- state ---------- */
const DEFAULT_PAL = '000000 222034 45283c 663931 8f563b df7126 d9a066 eec39a fbf236 99e550 6abe30 37946e 4b692f 524b24 323c39 3f3f74 306082 5b6ee1 639bff 5fcde4 cbdbfc ffffff 9badb7 847e87 696a6a 595652 76428a ac3232 d95763 d77bba 8f974a 8a6f30'.split(' ').map(h=>'#'+h);
const S = {
  fw:32, fh:48, cols:4, rows:4,
  zoom:8, panX:20, panY:20,
  tool:'pencil', size:1, fill:false, lock:true, mx:false, my:false,
  fg:{r:0,g:0,b:0,a:255}, bg:{r:255,g:255,b:255,a:255},
  showGrid:true, pgrid:true, onion:false, bgMode:'checker',
  cellSel:new Set(), active:{c:0,r:0},
  sel:null, floating:null, clip:null,
  name:'untitled.png', handle:null, dirty:false, hover:null,
  layerFull: store.get('layerFull', false), autoCell: store.get('autoCell', true), fade: store.get('fade', false), keepDrafts: store.get('keepDrafts', true), openMode: store.get('openMode', 'smart'), palette: store.get('palette', DEFAULT_PAL), recent: store.get('recent', [])
};
const key = (c,r) => c+','+r;
let doc, dctx, layers=[], activeL=0, layerCount=1, comp=mk(1,1), cctx, compDirty=true;
function newLayer(w,h,name){ const cv=mk(w,h), ctx=cv.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingEnabled=false; return {name,cv,ctx,visible:true,opacity:255}; }
function useLayer(i){ activeL=clamp(i,0,layers.length-1); doc=layers[activeL].cv; dctx=layers[activeL].ctx; }
function sizeComp(w,h){ comp=mk(w,h); cctx=comp.getContext('2d',{willReadFrequently:true}); compDirty=true; }
function setDoc(w,h){ layers=[newLayer(w,h,'Layer 1')]; layerCount=1; useLayer(0); sizeComp(w,h); }
function refreshComp(){
  if(!compDirty) return; compDirty=false;
  cctx.clearRect(0,0,comp.width,comp.height);
  for(const l of layers){ if(!l.visible||l.opacity<=0) continue; cctx.globalAlpha=l.opacity/255; cctx.drawImage(l.cv,0,0); }
  cctx.globalAlpha=1;
}
setDoc(S.cols*S.fw, S.rows*S.fh);
const DW = () => doc.width, DH = () => doc.height;
const cellRect = (c,r) => ({x:c*S.fw, y:r*S.fh, w:S.fw, h:S.fh});
const cellAt = (x,y) => ({c:clamp(Math.floor(x/S.fw),0,S.cols-1), r:clamp(Math.floor(y/S.fh),0,S.rows-1)});
const inDoc = (x,y) => x>=0 && y>=0 && x<DW() && y<DH();

/* ---------- history ---------- */
const HIST = {list:[], idx:-1};
function histMax(){ return clamp(Math.floor(160e6/(DW()*DH()*4*layers.length)), 12, 100); }
const cloneRects=rs=>rs.map(r=>({x:r.x,y:r.y,w:r.w,h:r.h}));
const selSig=rs=>(rs||[]).map(r=>r.x+','+r.y+','+r.w+','+r.h).join(';');
// opts.share: a selection-only step. It reuses the previous step's pixel data instead of copying every layer again.
function snapshot(label,opts={}){
  const cur=HIST.list[HIST.idx];
  HIST.list.length = HIST.idx+1;
  const lay = (opts.share&&cur) ? cur.layers
    : layers.map(l=>({name:l.name,visible:l.visible,opacity:l.opacity,data:l.ctx.getImageData(0,0,DW(),DH())}));
  HIST.list.push({label, active:activeL, layers:lay, sel:opts.sel||cloneRects(selRects()), m:{fw:S.fw,fh:S.fh,cols:S.cols,rows:S.rows}});
  // only steps that own pixel data count against the memory budget
  while(HIST.list.length>1 && (new Set(HIST.list.map(x=>x.layers)).size>histMax() || HIST.list.length>histMax()*4)) HIST.list.shift();
  HIST.idx = HIST.list.length-1;
}
function commit(label){ snapshot(label); S.dirty=true; changed(true); }
// Record a change of the region selection so Ctrl+Z / Ctrl+Y can step through selections too
function selHistory(label){
  const rs=cloneRects(selRects()), cur=HIST.list[HIST.idx];
  if(cur && selSig(cur.sel)===selSig(rs)) return;
  snapshot(label,{share:true,sel:rs}); changed(true);
}
function restoreHist(i){
  const e = HIST.list[i]; if(!e) return;
  const prev = HIST.list[HIST.idx], samePixels = !!prev && prev.layers===e.layers;
  HIST.idx = i; TP.dirty=false; S.floating=null;
  const rs=e.sel||[];
  if(rs.length){ S.sel={...rs[rs.length-1]}; S.extra=cloneRects(rs.slice(0,-1)); S.extraOf=S.sel; } else { S.sel=null; S.extra=null; S.extraOf=null; }
  if(!samePixels){                       // selection-only steps leave the layers alone (and don't mark the file as changed)
    const w=e.layers[0].data.width, h=e.layers[0].data.height;
    layers=e.layers.map(l=>{ const L=newLayer(w,h,l.name); L.visible=l.visible; L.opacity=l.opacity; L.ctx.putImageData(l.data,0,0); return L; });
    useLayer(e.active); sizeComp(w,h);
    Object.assign(S, e.m);
    S.cellSel = new Set([...S.cellSel].filter(k=>{const [c,r]=k.split(',').map(Number);return c<S.cols&&r<S.rows;}));
    S.active.c=clamp(S.active.c,0,S.cols-1); S.active.r=clamp(S.active.r,0,S.rows-1);
    S.dirty=true;
  }
  changed(true); if(TP.tool&&TP.tool!=='gradient') tpCapture();
}
function undo(){ commitFloat(); if(HIST.idx>0) restoreHist(HIST.idx-1); }
function redo(){ commitFloat(); if(HIST.idx<HIST.list.length-1) restoreHist(HIST.idx+1); }
function resetHistory(label){ HIST.list=[]; HIST.idx=-1; snapshot(label); }

/* ---------- refresh scheduling ---------- */
let dirtyDoc=false, rq=false, thumbStructure='';
function changed(docChanged){ compDirty=true; if(docChanged) dirtyDoc=true; if(!rq){ rq=true; requestAnimationFrame(frame);} }
function frame(){
  rq=false;
  render();
  if(dirtyDoc){ dirtyDoc=false; buildThumbs(); drawThumbs(); renderHist(); renderLayers(); updateUI(); }
}
