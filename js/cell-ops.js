"use strict";
// Cell operations (copy, flip, nudge) and cell selection

/* ---------- cell ops ---------- */
const grab = r => { const cv=mk(r.w,r.h); cv.getContext('2d').drawImage(doc,r.x,r.y,r.w,r.h,0,0,r.w,r.h); return cv; };
// Region selection can hold several rectangles: S.sel is the newest, S.extra the earlier ones (valid only while S.extraOf===S.sel)
let _sr={sel:null,extra:null,of:null,out:[]};
function selRects(){
  if(!S.sel) return [];
  if(_sr.sel===S.sel&&_sr.extra===S.extra&&_sr.of===S.extraOf) return _sr.out;
  const out=(S.extraOf===S.sel&&S.extra)?[...S.extra,S.sel]:[S.sel]; _sr={sel:S.sel,extra:S.extra,of:S.extraOf,out}; return out;
}
let selWarnT=0;
function selWarn(){ const el=$('#selWarn'); el.classList.add('show'); clearTimeout(selWarnT); selWarnT=setTimeout(()=>el.classList.remove('show'),6000); }
// Pixel mask of the selection (bounding box only), rebuilt when the selection changes
let _sm={rects:null,x:0,y:0,w:0,h:0,data:null};
function selMask(){
  const rs=selRects(); if(_sm.rects===rs) return _sm;
  const x0=Math.min(...rs.map(r=>r.x)), y0=Math.min(...rs.map(r=>r.y)), x1=Math.max(...rs.map(r=>r.x+r.w)), y1=Math.max(...rs.map(r=>r.y+r.h));
  const w=x1-x0, h=y1-y0, data=new Uint8Array(w*h);
  for(const r of rs) for(let y=r.y;y<r.y+r.h;y++){ const row=(y-y0)*w-x0; for(let x=r.x;x<r.x+r.w;x++) data[row+x]=1; }
  _sm={rects:rs,x:x0,y:y0,w,h,data}; return _sm;
}
function selOK(x,y){
  if(!S.sel) return true; const m=selMask(), dx=x-m.x, dy=y-m.y;
  return dx>=0&&dy>=0&&dx<m.w&&dy<m.h&&m.data[dy*m.w+dx]===1;
}
function selMaskFor(L){
  if(!S.sel) return null; const m=new Uint8Array(L.w*L.h);
  for(const r of selRects()){ const x0=Math.max(L.x,r.x), y0=Math.max(L.y,r.y), x1=Math.min(L.x+L.w,r.x+r.w), y1=Math.min(L.y+L.h,r.y+r.h);
    for(let y=y0;y<y1;y++){ const row=(y-L.y)*L.w-L.x; for(let x=x0;x<x1;x++) m[row+x]=1; } }
  return m;
}
// One outline around the merged shape of all regions (no lines inside or between overlapping regions)
let _ol={key:'',segs:[]};
function outlineFromMask(m){
  const {x:ox,y:oy,w,h,data}=m, at=(i,j)=>i>=0&&j>=0&&i<w&&j<h&&data[j*w+i]===1, segs=[];
  for(let j=0;j<=h;j++){ let st=-1; for(let i=0;i<=w;i++){ const e=i<w&&(at(i,j-1)!==at(i,j)); if(e&&st<0) st=i; if(!e&&st>=0){ segs.push([ox+st,oy+j,ox+i,oy+j]); st=-1; } } }
  for(let i=0;i<=w;i++){ let st=-1; for(let j=0;j<=h;j++){ const e=j<h&&(at(i-1,j)!==at(i,j)); if(e&&st<0) st=j; if(!e&&st>=0){ segs.push([ox+i,oy+st,ox+i,oy+j]); st=-1; } } }
  return segs;
}
function selOutline(){
  const rs=selRects(), key=rs.length+':'+rs.map(r=>r.x+','+r.y+','+r.w+','+r.h).join(';'); if(_ol.key===key) return _ol.segs;
  if(rs.length>8){ _ol={key,segs:outlineFromMask(selMask())}; return _ol.segs; }   // many pieces (e.g. a wand selection): scan pixels
  const xs=[...new Set(rs.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b), ys=[...new Set(rs.flatMap(r=>[r.y,r.y+r.h]))].sort((a,b)=>a-b);
  const inside=(i,j)=>{ if(i<0||j<0||i>=xs.length-1||j>=ys.length-1) return false; const cx=xs[i], cy=ys[j]; return rs.some(r=>cx>=r.x&&cx<r.x+r.w&&cy>=r.y&&cy<r.y+r.h); };
  const segs=[];
  for(let j=0;j<ys.length;j++){ let st=-1; for(let i=0;i<xs.length;i++){ const e=i<xs.length-1&&(inside(i,j-1)!==inside(i,j)); if(e&&st<0) st=i; if(!e&&st>=0){ segs.push([xs[st],ys[j],xs[i],ys[j]]); st=-1; } } }
  for(let i=0;i<xs.length;i++){ let st=-1; for(let j=0;j<ys.length;j++){ const e=j<ys.length-1&&(inside(i-1,j)!==inside(i,j)); if(e&&st<0) st=j; if(!e&&st>=0){ segs.push([xs[i],ys[st],xs[i],ys[j]]); st=-1; } } }
  _ol={key,segs}; return segs;
}
function selComposite(){
  const rs=selRects(), x0=Math.min(...rs.map(r=>r.x)), y0=Math.min(...rs.map(r=>r.y)), x1=Math.max(...rs.map(r=>r.x+r.w)), y1=Math.max(...rs.map(r=>r.y+r.h));
  const cv=mk(x1-x0,y1-y0), g=cv.getContext('2d'); for(const r of rs) g.drawImage(doc,r.x,r.y,r.w,r.h,r.x-x0,r.y-y0,r.w,r.h);
  return {cv,x:x0,y:y0,w:x1-x0,h:y1-y0};
}
const selCells = () => [...S.cellSel].map(k=>{const [c,r]=k.split(',').map(Number);return {c,r};}).sort((a,b)=>a.r-b.r||a.c-b.c);
function targetRects(){
  if(S.floating) commitFloat();
  if(S.sel) return selRects();
  const cs = selCells(); if(!cs.length) cs.push({...S.active});
  return cs.map(({c,r})=>cellRect(c,r));
}
function withRects(label, fn){
  const rs=targetRects(); for(const r of rs) fn(r); commit(label);
}
function flipRect(r,h,v){
  const t=grab(r); dctx.clearRect(r.x,r.y,r.w,r.h);
  dctx.save(); dctx.translate(r.x+(h?r.w:0), r.y+(v?r.h:0)); dctx.scale(h?-1:1, v?-1:1); dctx.drawImage(t,0,0); dctx.restore();
}
function rotRect(r){
  if(r.w!==r.h) return false;
  const t=grab(r); dctx.clearRect(r.x,r.y,r.w,r.h);
  dctx.save(); dctx.setTransform(0,1,-1,0,r.x+r.w,r.y); dctx.drawImage(t,0,0); dctx.restore(); return true;
}
function nudgeRect(r,dx,dy,wrap){
  const t=grab(r); dctx.clearRect(r.x,r.y,r.w,r.h);
  dctx.save(); dctx.beginPath(); dctx.rect(r.x,r.y,r.w,r.h); dctx.clip();
  const offs = wrap ? [-1,0,1] : [0];
  for(const a of offs) for(const b of offs) dctx.drawImage(t, r.x+dx+a*r.w, r.y+dy+b*r.h);
  dctx.restore();
}
function grabCells(list){
  if(!list.length) return null;
  const mc=Math.min(...list.map(o=>o.c)), mr=Math.min(...list.map(o=>o.r));
  return {type:'cells', items:list.map(o=>({dc:o.c-mc, dr:o.r-mr, cv:grab(cellRect(o.c,o.r))})), w:Math.max(...list.map(o=>o.c))-mc+1};
}
function placeCells(clip, ac, ar){
  for(const it of clip.items){
    const c=ac+it.dc, r=ar+it.dr; if(c<0||r<0||c>=S.cols||r>=S.rows) continue;
    const a=cellRect(c,r); dctx.clearRect(a.x,a.y,a.w,a.h); dctx.drawImage(it.cv,a.x,a.y);
  }
}
function copySel(){
  if(S.floating) commitFloat();
  if(S.sel){ S.clip={type:'pix', cv:selComposite().cv}; toast(selRects().length>1?'Copied '+selRects().length+' regions':'Copied selection'); }
  else { const cs=selCells(); if(!cs.length) cs.push({...S.active}); S.clip=grabCells(cs); toast('Copied '+cs.length+' cell'+(cs.length>1?'s':'')); }
  // also push an image to the system clipboard when possible
  try{ const cv = S.clip.type==='pix' ? S.clip.cv : S.clip.items[0].cv;
    cv.toBlob(b=>{ if(b && navigator.clipboard && window.ClipboardItem) navigator.clipboard.write([new ClipboardItem({'image/png':b})]).catch(()=>{}); }); }catch(e){}
}
function pasteClip(){
  commitFloat();
  const cl=S.clip; if(!cl){ toast('Nothing copied yet'); return; }
  if(cl.type==='cells'){
    const cs=selCells(); if(!cs.length) cs.push({...S.active});
    if(cl.items.length===1 && cs.length>=1){ for(const t of cs) placeCells(cl,t.c,t.r); }
    else { placeCells(cl, cs[0].c, cs[0].r); }
    commit('Paste cells');
  } else { startFloat(cl.cv, S.sel? S.sel.x : S.active.c*S.fw, S.sel? S.sel.y : S.active.r*S.fh, 'Paste'); setTool('move'); }
}
function cutSel(){ copySel(); if(S.sel){ for(const r of selRects()) dctx.clearRect(r.x,r.y,r.w,r.h); commit('Cut'); } else { clearTargets(); } }
function clearTargets(){ withRects('Clear', r=>dctx.clearRect(r.x,r.y,r.w,r.h)); }
function startFloat(cv,x,y,label){
  S.floating={cv,x,y,clip:null,label}; S.sel={x,y,w:cv.width,h:cv.height}; changed();
}
function liftSel(clip){
  const rs=selRects(), c=selComposite();            // several regions lift together as one piece
  for(const r of rs) dctx.clearRect(r.x,r.y,r.w,r.h);
  S.floating={cv:c.cv,x:c.x,y:c.y,clip,label:'Move'}; S.sel={x:c.x,y:c.y,w:c.w,h:c.h}; changed();
}
function commitFloat(){
  if(TP.tool && TP.dirty) tpApply();
  const f=S.floating; if(!f) return;
  dctx.save(); if(f.clip){ dctx.beginPath(); dctx.rect(f.clip.x,f.clip.y,f.clip.w,f.clip.h); dctx.clip(); }
  dctx.drawImage(f.cv,f.x,f.y); dctx.restore();
  S.floating=null; S.sel=f.auto?null:{x:f.x,y:f.y,w:f.cv.width,h:f.cv.height}; commit(f.label||'Move');
}
function cancelFloat(){ if(S.floating){ restoreHist(HIST.idx); } }

/* ---------- selection of cells ---------- */
function selectCell(c,r,{ctrl,shift}={}){
  if(shift&&ctrl){            // Ctrl+Shift: add the whole box from the active cell
    const a=S.active, c0=Math.min(a.c,c), c1=Math.max(a.c,c), r0=Math.min(a.r,r), r1=Math.max(a.r,r);
    for(let rr=r0;rr<=r1;rr++) for(let cc=c0;cc<=c1;cc++) S.cellSel.add(key(cc,rr));
  } else if(shift){ S.cellSel.add(key(c,r)); S.active={c,r}; }          // Shift: add
  else if(ctrl){ const k=key(c,r); if(S.cellSel.has(k)&&S.cellSel.size>1) S.cellSel.delete(k); else S.cellSel.add(k); S.active={c,r}; } // Ctrl: toggle
  else { S.cellSel=new Set([key(c,r)]); S.active={c,r}; }
  syncCellUI();
}
function selectRow(r,add){ if(!add) S.cellSel.clear(); for(let c=0;c<S.cols;c++) S.cellSel.add(key(c,r)); S.active={c:S.active.c,r}; syncCellUI(); }
function selectCol(c,add){ if(!add) S.cellSel.clear(); for(let r=0;r<S.rows;r++) S.cellSel.add(key(c,r)); S.active={c,r:S.active.r}; syncCellUI(); }
function syncCellUI(){ changed(); updateThumbClasses(); updateStatus(); updateAnimPattern(); }
