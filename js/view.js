"use strict";
// Canvas view, rendering and drawing primitives

/* ---------- view ---------- */
const view = $('#view'), vctx = view.getContext('2d');
let vw=0, vh=0, dpr=1;
function resizeView(){
  const r = $('#stage').getBoundingClientRect(); dpr = window.devicePixelRatio||1;
  vw=r.width; vh=r.height; view.width=Math.round(vw*dpr); view.height=Math.round(vh*dpr); changed();
}
const ZOOMS=[.25,.5,1,2,3,4,5,6,8,10,12,16,20,24,32,48,64];
function setZoom(z, cx=vw/2, cy=vh/2){
  z = clamp(z, .25, 64);
  const ix=(cx-S.panX)/S.zoom, iy=(cy-S.panY)/S.zoom;
  S.zoom=z; S.panX=cx-ix*z; S.panY=cy-iy*z; changed(); updateStatus();
}
function stepZoom(dir, cx, cy){
  let i = ZOOMS.findIndex(z=>z>=S.zoom-1e-6);
  if(i<0) i=ZOOMS.length-1;
  if(dir>0){ if(Math.abs(ZOOMS[i]-S.zoom)<1e-6) i++; } else { i--; }
  setZoom(ZOOMS[clamp(i,0,ZOOMS.length-1)], cx, cy);
}
function fitView(){
  const z = Math.min((vw-40)/DW(), (vh-40)/DH());
  let best=ZOOMS[0]; for(const v of ZOOMS) if(v<=z) best=v;
  S.zoom=best; S.panX=Math.round((vw-DW()*best)/2); S.panY=Math.round((vh-DH()*best)/2); changed(); updateStatus();
}
const toImg = e => { const r=view.getBoundingClientRect(); const sx=e.clientX-r.left, sy=e.clientY-r.top;
  return {x:Math.floor((sx-S.panX)/S.zoom), y:Math.floor((sy-S.panY)/S.zoom), sx, sy}; };

const checkPat = (()=>{ const c=mk(16,16), g=c.getContext('2d'); g.fillStyle='#3a3d47'; g.fillRect(0,0,16,16); g.fillStyle='#2b2d35'; g.fillRect(0,0,8,8); g.fillRect(8,8,8,8); return c; })();
let preview = null; // {cv} shape preview layer in doc space

// Optional: everything outside the selection is covered by slowly drifting diagonal stripes (view only, never saved)
let _fadeT=0, _fadeCv=null, _stripe=null;
function drawFade(g,ox,oy,W,H,z){
  if(!_stripe){
    const t=mk(16,16), x=t.getContext('2d'); x.fillStyle='rgba(18,19,24,.50)'; x.fillRect(0,0,16,16);
    x.strokeStyle='rgba(18,19,24,.82)'; x.lineWidth=6; x.beginPath();
    for(const o of [-16,0,16]){ x.moveTo(o-4,16+4); x.lineTo(o+16+4,-4); } x.stroke(); _stripe=t;
  }
  if(!_fadeCv||_fadeCv.width!==view.width||_fadeCv.height!==view.height) _fadeCv=mk(view.width,view.height);
  const o=_fadeCv.getContext('2d'); o.setTransform(dpr,0,0,dpr,0,0); o.globalCompositeOperation='source-over'; o.clearRect(0,0,vw,vh);
  const pat=o.createPattern(_stripe,'repeat'); pat.setTransform(new DOMMatrix().translate((performance.now()/45)%16,0));
  o.fillStyle=pat; o.fillRect(ox,oy,W*z,H*z);
  o.globalCompositeOperation='destination-out'; o.fillStyle='#000';
  for(const r of selRects()) o.fillRect(ox+r.x*z,oy+r.y*z,r.w*z,r.h*z);
  g.save(); g.setTransform(1,0,0,1,0,0); g.drawImage(_fadeCv,0,0); g.restore();
}
function render(){
  const g=vctx; g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,vw,vh);
  refreshComp();
  if(!S.sel){ const w=$('#selWarn'); if(w&&w.classList.contains('show')) w.classList.remove('show'); }
  { const tip=S.sel?'Edits are limited to the selection Â· Ctrl+D clears it':''; const el=$('#sTip'); if(el&&el.textContent!==tip) el.textContent=tip; }
  const z=S.zoom, ox=Math.round(S.panX), oy=Math.round(S.panY), W=DW(), H=DH();
  g.save(); g.beginPath(); g.rect(ox,oy,W*z,H*z); g.clip();
  if(S.bgMode==='checker'){ g.fillStyle=g.createPattern(checkPat,'repeat'); } else g.fillStyle=S.bgMode;
  g.fillRect(ox,oy,W*z,H*z);
  g.imageSmoothingEnabled=false;
  // Selected cells are tinted *under* the artwork, so the tint only shows through transparent pixels and never changes your colors
  g.fillStyle='rgba(255,157,46,.16)';
  for(const k of S.cellSel){ const [c,r]=k.split(',').map(Number); const a=cellRect(c,r); g.fillRect(ox+a.x*z,oy+a.y*z,a.w*z,a.h*z); }
  g.drawImage(comp,ox,oy,W*z,H*z);
  if(S.onion && S.active.c>0){
    const a=cellRect(S.active.c,S.active.r), p=cellRect(S.active.c-1,S.active.r);
    g.globalAlpha=.35; g.drawImage(comp,p.x,p.y,p.w,p.h,ox+a.x*z,oy+a.y*z,a.w*z,a.h*z); g.globalAlpha=1;
  }
  if(preview) g.drawImage(preview,ox,oy,W*z,H*z);
  const f=S.floating;
  if(f){
    g.save();
    if(f.clip){ g.beginPath(); g.rect(ox+f.clip.x*z,oy+f.clip.y*z,f.clip.w*z,f.clip.h*z); g.clip(); }
    g.drawImage(f.cv,ox+f.x*z,oy+f.y*z,f.cv.width*z,f.cv.height*z);
    g.restore();
  }
  g.restore();
  if(S.fade && S.sel){ drawFade(g,ox,oy,W,H,z); if(!_fadeT) _fadeT=setTimeout(()=>{ _fadeT=0; changed(); },45); }   // keeps the stripes moving while a selection exists

  // pixel grid
  if(S.pgrid && z>=6){
    g.strokeStyle='rgba(128,128,128,.28)'; g.lineWidth=1; g.beginPath();
    const x0=Math.max(0,Math.floor(-S.panX/z)), x1=Math.min(W,Math.ceil((vw-S.panX)/z));
    const y0=Math.max(0,Math.floor(-S.panY/z)), y1=Math.min(H,Math.ceil((vh-S.panY)/z));
    for(let x=x0;x<=x1;x++){ const sx=ox+x*z+.5; g.moveTo(sx,Math.max(oy,0)); g.lineTo(sx,Math.min(oy+H*z,vh)); }
    for(let y=y0;y<=y1;y++){ const sy=oy+y*z+.5; g.moveTo(Math.max(ox,0),sy); g.lineTo(Math.min(ox+W*z,vw),sy); }
    g.stroke();
  }
  // cell grid
  if(S.showGrid){
    g.strokeStyle='rgba(255,157,46,.75)'; g.lineWidth=1; g.beginPath();
    for(let c=0;c<=S.cols;c++){ const sx=ox+c*S.fw*z+.5; g.moveTo(sx,oy); g.lineTo(sx,oy+H*z); }
    for(let r=0;r<=S.rows;r++){ const sy=oy+r*S.fh*z+.5; g.moveTo(ox,sy); g.lineTo(ox+W*z,sy); }
    g.stroke();
  } else { g.strokeStyle='rgba(255,255,255,.2)'; g.strokeRect(ox+.5,oy+.5,W*z,H*z); }
  // several cells selected: one outline around the whole group (only the outer edges), so it shows even where the cells are full of artwork
  if(S.cellSel.size>1){
    const has=(c,r)=>S.cellSel.has(key(c,r)); g.beginPath();
    for(const k of S.cellSel){
      const [c,r]=k.split(',').map(Number), x0=ox+c*S.fw*z, y0=oy+r*S.fh*z, x1=x0+S.fw*z, y1=y0+S.fh*z;
      if(!has(c,r-1)){ g.moveTo(x0,y0); g.lineTo(x1,y0); } if(!has(c,r+1)){ g.moveTo(x0,y1); g.lineTo(x1,y1); }
      if(!has(c-1,r)){ g.moveTo(x0,y0); g.lineTo(x0,y1); } if(!has(c+1,r)){ g.moveTo(x1,y0); g.lineTo(x1,y1); }
    }
    g.lineCap='square'; g.lineWidth=5; g.strokeStyle='rgba(0,0,0,.55)'; g.stroke(); g.lineWidth=3; g.strokeStyle='#4aa3ff'; g.stroke(); g.lineCap='butt';
  }
  { const a=cellRect(S.active.c,S.active.r); g.strokeStyle='#fff'; g.lineWidth=2;
    g.strokeRect(ox+a.x*z+1,oy+a.y*z+1,a.w*z-2,a.h*z-2); }
  // selection marquee
  if(S.sel){
    g.lineWidth=1; g.beginPath();
    for(const [x0,y0,x1,y1] of selOutline()){ g.moveTo(ox+x0*z+.5,oy+y0*z+.5); g.lineTo(ox+x1*z+.5,oy+y1*z+.5); }
    g.strokeStyle='#000'; g.setLineDash([]); g.stroke();
    g.strokeStyle='#fff'; g.setLineDash([4,4]); g.stroke(); g.setLineDash([]);
  }
  if(drag&&drag.kind==='grad'){
    const a=drag.start,b=drag.cur, ax=ox+(a.x+.5)*z, ay=oy+(a.y+.5)*z, bx=ox+(b.x+.5)*z, by=oy+(b.y+.5)*z;
    g.lineWidth=3; g.strokeStyle='#000'; g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke();
    g.lineWidth=1.5; g.strokeStyle='#fff'; g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke();
    if(GR.type==='radial'){ g.beginPath(); g.arc(ax,ay,Math.hypot(bx-ax,by-ay),0,7); g.setLineDash([4,4]); g.stroke(); g.setLineDash([]); }
    for(const [x,y] of [[ax,ay],[bx,by]]){ g.fillStyle='#fff'; g.strokeStyle='#000'; g.beginPath(); g.arc(x,y,4,0,7); g.fill(); g.stroke(); }
  }
  // brush cursor
  if(S.hover && ['pencil','eraser','line','rect','ellipse'].includes(S.tool) && !drag){
    const n=S.size, o=Math.floor((n-1)/2), h=S.hover;
    g.strokeStyle='#fff'; g.lineWidth=1; g.strokeRect(ox+(h.x-o)*z+.5,oy+(h.y-o)*z+.5,n*z-1,n*z-1);
    g.strokeStyle='#000'; g.strokeRect(ox+(h.x-o)*z-.5,oy+(h.y-o)*z-.5,n*z+1,n*z+1);
  }
}

/* ---------- drawing primitives ---------- */
function lockRectAt(x,y){
  if(!S.lock) return null;
  const {c,r}=cellAt(x,y); return cellRect(c,r);
}
function stampPixel(ctx,x,y,col,erase,lock){
  // brush footprint with mirroring
  const n=S.size, o=Math.floor((n-1)/2);
  const put=(px,py)=>{
    if(lock && (px<lock.x||py<lock.y||px>=lock.x+lock.w||py>=lock.y+lock.h)) return;
    if(S.sel && !selOK(px,py)) return;
    ctx.clearRect(px,py,1,1); if(!erase){ ctx.fillStyle=col; ctx.fillRect(px,py,1,1); }
  };
  const cr = lock || (inDoc(x,y)? cellRect(cellAt(x,y).c,cellAt(x,y).r) : null);
  for(let j=0;j<n;j++) for(let i=0;i<n;i++){
    const px=x-o+i, py=y-o+j;
    put(px,py);
    if(cr){
      if(S.mx) put(cr.x*2+cr.w-1-px, py);
      if(S.my) put(px, cr.y*2+cr.h-1-py);
      if(S.mx&&S.my) put(cr.x*2+cr.w-1-px, cr.y*2+cr.h-1-py);
    }
  }
}
function linePts(x0,y0,x1,y1){
  const pts=[]; let dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx+dy;
  for(;;){ pts.push([x0,y0]); if(x0===x1&&y0===y1) break; const e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;} }
  return pts;
}
function rectPts(x0,y0,x1,y1,fill){
  const a=Math.min(x0,x1), b=Math.max(x0,x1), c=Math.min(y0,y1), d=Math.max(y0,y1), pts=[];
  for(let y=c;y<=d;y++) for(let x=a;x<=b;x++) if(fill||x===a||x===b||y===c||y===d) pts.push([x,y]);
  return pts;
}
function ellipsePts(x0,y0,x1,y1,fill){
  const a=Math.min(x0,x1), b=Math.max(x0,x1), c=Math.min(y0,y1), d=Math.max(y0,y1);
  const w=b-a+1, h=d-c+1, cx=(w-1)/2, cy=(h-1)/2, rx=w/2, ry=h/2;
  const inside=(i,j)=>{ if(i<0||j<0||i>=w||j>=h) return false; const nx=(i-cx)/rx, ny=(j-cy)/ry; return nx*nx+ny*ny<=1.0001; };
  const pts=[];
  for(let j=0;j<h;j++) for(let i=0;i<w;i++) if(inside(i,j)){
    if(fill || !(inside(i-1,j)&&inside(i+1,j)&&inside(i,j-1)&&inside(i,j+1))) pts.push([a+i,c+j]);
  }
  return pts;
}
function floodFill(x,y,col,lock,global){
  const L=lock||{x:0,y:0,w:DW(),h:DH()};
  if(x<L.x||y<L.y||x>=L.x+L.w||y>=L.y+L.h) return false;
  const allow=selMaskFor(L); if(allow&&!allow[(y-L.y)*L.w+(x-L.x)]) return false;     // start outside the selection: nothing happens
  const img=dctx.getImageData(L.x,L.y,L.w,L.h), px=new Uint32Array(img.data.buffer);
  const norm=v=>(v>>>24)===0?0:v, fillV=((col.a<<24)|(col.b<<16)|(col.g<<8)|col.r)>>>0, target=norm(px[(y-L.y)*L.w+(x-L.x)]);
  if(target===norm(fillV)) return false;
  const mask=regionMask(x,y,L,global?'global':'contig',allow);
  for(let i=0;i<mask.length;i++) if(mask[i]) px[i]=fillV;
  dctx.putImageData(img,L.x,L.y); return true;
}
