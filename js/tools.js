"use strict";
// Toolbar and pointer interaction

/* ---------- tools ---------- */
const TOOLS = [
  ['pencil','Pencil (B)','<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'],
  ['eraser','Eraser (E)','<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>'],
  ['sep'],
  ['bucket','Fill (G) — Shift: replace everywhere','<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>'],
  ['gradient','Gradient fill (U) — drag from start to end; linear or radial','<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 16 16 8"/><path d="M6 12l6-6M12 18l6-6" opacity=".5"/>'],
  ['sep'],
  ['line','Line (L) — Shift: 45°','<path d="M5 19 19 5"/>'],
  ['rect','Rectangle (R) — Shift: square','<rect x="4" y="5" width="16" height="14" rx="1"/>'],
  ['ellipse','Ellipse (O) — Shift: circle','<ellipse cx="12" cy="12" rx="9" ry="6.5"/>'],
  ['sep'],
  ['picker','Eyedropper (I) — or Alt+click','<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>'],
  ['sep'],
  ['cell','Select cells (C) — Shift adds, Ctrl toggles, drag for a box','<rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'],
  ['marquee','Select region (M) — drag a box; hold Shift to add more regions','<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 3"/>'],
  ['wand','Magic wand (Y) — select similar colors; Shift adds, Ctrl subtracts','<path d="m14 4 1.2 2.8L18 8l-2.8 1.2L14 12l-1.2-2.8L10 8l2.8-1.2z"/><path d="m3 21 9.5-9.5"/><path d="M19 14v4M17 16h4"/>'],
  ['move','Move pixels (V) — drag a cell’s contents','<path d="M12 2v20M2 12h20m-14-7 4-3 4 3M8 19l4 3 4-3M5 8l-3 4 3 4M19 8l3 4-3 4"/>'],
  ['sep'],
  ['adjust','Adjust shape (T) — width, height, shear of the selected cells','<path d="M5 20 9 6h11l-4 14Z"/>'],
  ['rotate','Rotate / flip (Q)','<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'],
  ['noise','Add noise (N) — hue, saturation, lightness','<circle cx="6" cy="6" r="1"/><circle cx="12" cy="9" r="1"/><circle cx="18" cy="6" r="1"/><circle cx="8" cy="14" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="6" cy="19" r="1"/><circle cx="12" cy="20" r="1"/><circle cx="19" cy="19" r="1"/>'],
  ['colorize','Colorize (K) — hue, saturation, lightness shift','<path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 1.5-3.3 2 2 0 0 1 1.5-3.3H17a4 4 0 0 0 4-4C21 6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/>']
];
const keyTool = {b:'pencil',e:'eraser',g:'bucket',u:'gradient',l:'line',r:'rect',o:'ellipse',i:'picker',m:'marquee',v:'move',c:'cell',y:'wand',t:'adjust',q:'rotate',n:'noise',k:'colorize'};
function buildTools(){
  const box=$('#tools'); box.innerHTML='';
  for(const [id,tip,svg] of TOOLS){
    if(id==='sep'){ const d=document.createElement('div'); d.className='tsep'; box.appendChild(d); continue; }
    const b=document.createElement('button'); b.className='tool'; b.dataset.tool=id; b.title=tip;
    b.innerHTML=`<svg viewBox="0 0 24 24">${svg}</svg>`; b.onclick=()=>setTool(id); box.appendChild(b);
  }
}
function setTool(t){
  if(TP.tool && TP.dirty) tpApply();     // switching tools commits a pending adjustment
  tpHide();
  if(S.floating && t!=='marquee' && t!=='move') commitFloat();
  S.tool=t; document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  $('#oWand').style.display = t==='wand' ? 'flex' : 'none';
  view.style.cursor = t==='cell'||(PANEL_TOOLS.includes(t)&&t!=='gradient')?'pointer': t==='move'?'move':'crosshair';
  if(PANEL_TOOLS.includes(t)) tpOpen(t);
  changed();
}

/* ---------- pointer interaction ---------- */
let drag=null, spaceDown=false;
const PAN_OFF=['pencil','eraser','move']; // clicking outside the image with these tools drags the view
function pickColor(p,btn){
  if(!inDoc(p.x,p.y)) return;
  refreshComp(); const d=cctx.getImageData(p.x,p.y,1,1).data; const c={r:d[0],g:d[1],b:d[2],a:d[3]};
  if(btn===2) setBg(c); else setFg(c);
}
function ensureCell(p){
  if(!inDoc(p.x,p.y)) return;
  const {c,r}=cellAt(p.x,p.y); S.active={c,r};
  if(!S.cellSel.has(key(c,r))) S.cellSel=new Set([key(c,r)]);
  updateThumbClasses(); updateStatus(); updateAnimPattern();
}
view.addEventListener('contextmenu',e=>e.preventDefault());
view.addEventListener('pointerdown',e=>{
  view.setPointerCapture(e.pointerId);
  const p=toImg(e);
  if(e.button===1 || spaceDown){ drag={kind:'pan', sx:e.clientX, sy:e.clientY, px:S.panX, py:S.panY}; view.style.cursor='grabbing'; return; }
  if(e.button!==0 && e.button!==2) return;
  const btn=e.button;
  if(e.altKey){ pickColor(p,btn); return; }
  // right-click with any tool except Pencil jumps back to Select Cells (and selects the cell under the cursor)
  if(btn===2 && S.autoCell && !['pencil','cell'].includes(S.tool)){
    setTool('cell'); if(inDoc(p.x,p.y)){ const {c,r}=cellAt(p.x,p.y); selectCell(c,r,{ctrl:e.ctrlKey||e.metaKey,shift:e.shiftKey}); } return;
  }
  const col = rgba(btn===2?S.bg:S.fg);
  const t=S.tool;
  if(PAN_OFF.includes(t) && !inDoc(p.x,p.y) && !(t==='move'&&S.floating)){ drag={kind:'pan', sx:e.clientX, sy:e.clientY, px:S.panX, py:S.panY}; view.style.cursor='grabbing'; return; }
  if(t!=='marquee' && t!=='move' && S.floating) commitFloat();

  if(t==='picker'){ pickColor(p,btn); return; }
  if(t==='wand'){ wandClick(e,p); return; }
  if(t==='cell'){
    if(!inDoc(p.x,p.y)) return; const {c,r}=cellAt(p.x,p.y);
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey){ selectCell(c,r,{ctrl:true}); return; }
    const base=e.shiftKey?new Set(S.cellSel):new Set();      // Shift keeps the current selection and adds to it
    S.cellSel=new Set([...base,key(c,r)]); S.active={c,r}; drag={kind:'cells',start:{c,r},base}; syncCellUI(); return;
  }
  if(PANEL_TOOLS.includes(t)&&t!=='gradient'){      // adjustment tools: click a cell to pick what they apply to
    if(inDoc(p.x,p.y)){ if(TP.dirty) tpApply(); S.sel=null; const {c,r}=cellAt(p.x,p.y); selectCell(c,r,{ctrl:e.ctrlKey||e.metaKey,shift:e.shiftKey}); tpCapture(); }
    return;
  }
  if(!layers[activeL].visible){ toast('The active layer is hidden — show it to edit'); return; }
  if(S.sel && ['pencil','eraser','bucket','line','rect','ellipse','gradient'].includes(t) && !selOK(p.x,p.y)){ selWarn(); return; }
  if(t==='gradient'){
    if(!inDoc(p.x,p.y)) return; ensureCell(p);
    let L=lockRectAt(p.x,p.y)||{x:0,y:0,w:DW(),h:DH()};
    const allow=selMaskFor(L); if(allow&&!allow[(p.y-L.y)*L.w+(p.x-L.x)]){ toast('Start inside the selection'); return; }
    if(L.w<=0||L.h<=0||p.x<L.x||p.y<L.y||p.x>=L.x+L.w||p.y>=L.y+L.h){ toast('Start inside the area you want to fill'); return; }
    drag={kind:'grad',start:p,cur:p,L,mask:regionMask(p.x,p.y,L,GR.area,allow)}; preview=mk(DW(),DH()); updateGradPreview(); return;
  }
  if(t==='pencil'||t==='eraser'){
    ensureCell(p);
    drag={kind:'free', erase:t==='eraser'||btn===2&&false, col, lock:lockRectAt(p.x,p.y), last:p};
    stampPixel(dctx,p.x,p.y,col,drag.erase,drag.lock); changed(); return;
  }
  if(t==='bucket'){
    ensureCell(p);
    if(floodFill(p.x,p.y,btn===2?S.bg:S.fg,lockRectAt(p.x,p.y),e.shiftKey)) commit('Fill');
    return;
  }
  if(t==='line'||t==='rect'||t==='ellipse'){
    ensureCell(p);
    drag={kind:'shape', shape:t, col, start:p, lock:lockRectAt(p.x,p.y), cur:p, erase:false};
    preview=mk(DW(),DH()); updateShapePreview(e); return;
  }
  if(t==='marquee'||t==='move'){
    const f=S.floating;
    if(f){
      const inside = p.x>=f.x&&p.y>=f.y&&p.x<f.x+f.cv.width&&p.y<f.y+f.cv.height;
      if(t==='move'){ drag={kind:'fmove', start:p, fx:f.x, fy:f.y}; return; }
      commitFloat();
    }
    if(t==='move'){
      if(!S.sel){ if(!inDoc(p.x,p.y)) return; const {c,r}=cellAt(p.x,p.y); ensureCell(p); S.sel=cellRect(c,r); liftSel(S.lock?cellRect(c,r):null); S.floating.auto=true; }
      else liftSel(S.lock?lockRectAt(S.sel.x,S.sel.y):null);
      drag={kind:'fmove', start:p, fx:S.floating.x, fy:S.floating.y}; return;
    }
    const base=e.shiftKey?selRects():[];                // Shift keeps the current regions and adds another
    if(!e.shiftKey) S.sel=null;
    drag={kind:'marq', base, start:{x:clamp(p.x,0,DW()-1),y:clamp(p.y,0,DH()-1)}}; changed(); return;
  }
});
view.addEventListener('pointermove',e=>{
  const p=toImg(e); S.hover=p; updateStatus(p);
  if(!drag){ if(!spaceDown) view.style.cursor = PAN_OFF.includes(S.tool)&&!inDoc(p.x,p.y)&&!(S.tool==='move'&&S.floating) ? 'grab' : S.tool==='cell'?'pointer':S.tool==='move'?'move':'crosshair'; changed(); return; }
  if(drag.kind==='pan'){ S.panX=drag.px+(e.clientX-drag.sx); S.panY=drag.py+(e.clientY-drag.sy); changed(); return; }
  if(drag.kind==='free'){
    for(const [x,y] of linePts(drag.last.x,drag.last.y,p.x,p.y)) stampPixel(dctx,x,y,drag.col,drag.erase,drag.lock);
    drag.last=p; changed(); return;
  }
  if(drag.kind==='shape'){ drag.cur=p; updateShapePreview(e); return; }
  if(drag.kind==='cells'){
    const q={c:clamp(Math.floor(p.x/S.fw),0,S.cols-1),r:clamp(Math.floor(p.y/S.fh),0,S.rows-1)}, a=drag.start;
    const set=new Set(drag.base);
    for(let rr=Math.min(a.r,q.r);rr<=Math.max(a.r,q.r);rr++) for(let cc=Math.min(a.c,q.c);cc<=Math.max(a.c,q.c);cc++) set.add(key(cc,rr));
    S.cellSel=set; syncCellUI(); return;
  }
  if(drag.kind==='grad'){ drag.cur=p; updateGradPreview(); return; }
  if(drag.kind==='fmove'){
    S.floating.x=drag.fx+(p.x-drag.start.x); S.floating.y=drag.fy+(p.y-drag.start.y);
    S.sel={x:S.floating.x,y:S.floating.y,w:S.floating.cv.width,h:S.floating.cv.height}; changed(); return;
  }
  if(drag.kind==='marq'){
    const a=drag.start, b={x:clamp(p.x,0,DW()-1),y:clamp(p.y,0,DH()-1)};
    S.sel={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x)+1,h:Math.abs(a.y-b.y)+1};
    if(drag.base&&drag.base.length){ S.extra=drag.base; S.extraOf=S.sel; }
    changed();
  }
});
view.addEventListener('pointerleave',()=>{ S.hover=null; changed(); });
function endDrag(e){
  if(!drag) return;
  const d=drag; drag=null; view.style.cursor = S.tool==='cell'?'pointer':S.tool==='move'?'move':'crosshair';
  if(d.kind==='free'){ commit(d.erase?'Erase':'Draw'); addRecent(); }
  else if(d.kind==='shape'){
    const pts=shapePts(d,e);
    for(const [x,y] of pts) stampPixel(dctx,x,y,d.col,false,d.lock);
    preview=null; commit(d.shape[0].toUpperCase()+d.shape.slice(1)); addRecent();
  } else if(d.kind==='fmove'){ changed(); }
  else if(d.kind==='grad'){ const img=dctx.getImageData(d.L.x,d.L.y,d.L.w,d.L.h); gradPixels(d,img); dctx.putImageData(img,d.L.x,d.L.y); preview=null; commit('Gradient'); }
  else if(d.kind==='marq'){ if(S.sel && S.sel.w===1 && S.sel.h===1 && d.start.x===S.sel.x && d.start.y===S.sel.y){ const q=toImg(e); if(q.x===d.start.x&&q.y===d.start.y) S.sel=null; } changed(); selHistory(S.sel?'Select region':'Deselect'); }
}
view.addEventListener('pointerup',endDrag);
view.addEventListener('pointercancel',endDrag);
function shapePts(d,e){
  let {x:x0,y:y0}=d.start, {x:x1,y:y1}=d.cur;
  const cl=(v,m)=>clamp(v,0,m-1);
  x0=cl(x0,DW());x1=cl(x1,DW());y0=cl(y0,DH());y1=cl(y1,DH());
  if(e && e.shiftKey){
    if(d.shape==='line'){ const dx=x1-x0, dy=y1-y0, ax=Math.abs(dx), ay=Math.abs(dy);
      if(ax>ay*2) y1=y0; else if(ay>ax*2) x1=x0; else { const m=Math.max(ax,ay); x1=x0+Math.sign(dx)*m; y1=y0+Math.sign(dy)*m; } }
    else { const m=Math.max(Math.abs(x1-x0),Math.abs(y1-y0)); x1=x0+(x1>=x0?1:-1)*m; y1=y0+(y1>=y0?1:-1)*m; }
  }
  if(d.shape==='line') return linePts(x0,y0,x1,y1);
  if(d.shape==='rect') return rectPts(x0,y0,x1,y1,S.fill);
  return ellipsePts(x0,y0,x1,y1,S.fill);
}
function updateShapePreview(e){
  const pg=preview.getContext('2d'); pg.clearRect(0,0,preview.width,preview.height);
  for(const [x,y] of shapePts(drag,e)) stampPixel(pg,x,y,drag.col,false,drag.lock);
  changed();
}
view.addEventListener('wheel',e=>{
  e.preventDefault();
  const r=view.getBoundingClientRect();
  if(e.ctrlKey||e.metaKey||true) stepZoom(e.deltaY<0?1:-1, e.clientX-r.left, e.clientY-r.top);
},{passive:false});
