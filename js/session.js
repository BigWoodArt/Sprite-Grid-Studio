"use strict";
// Session memory: what is reopened after the page is reloaded.
//  - tabs that came from a file and have no unsaved changes are reopened from that file (needs the saved file handle)
//  - tabs with unsaved work (or that never had a file) are kept as drafts: every layer plus the full undo history,
//    autosaved a moment after each change in IndexedDB, so an accidental reload loses nothing

let sessionLock=true, sessionT=0, sessionPending=false, sessionFailed=false, sessionWriting=false, sessionAgain=false;

// The "leave this page?" warning only appears when work could actually be lost
function needsWarning(){ return anyDirty() && (!S.keepDrafts || sessionLock || sessionPending || sessionFailed || !window.indexedDB); }

function sessionSave(){
  if(sessionLock) return;
  sessionPending=true; clearTimeout(sessionT); sessionT=setTimeout(sessionWrite,S.keepDrafts?1200:400);
}

/* ---- lossless layer storage (raw RGBA, gzip when the browser supports it) ---- */
const _lcache=new WeakMap();
async function packLayer(l){
  let p=_lcache.get(l); if(p) return p;
  p=(async()=>{
    const raw=new Uint8Array(l.data.data.buffer,l.data.data.byteOffset,l.data.data.byteLength);
    let blob, z=false;
    if(typeof CompressionStream!=='undefined'){ blob=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); z=true; }
    else blob=new Blob([raw]);
    return {name:l.name,visible:l.visible,opacity:l.opacity,w:l.data.width,h:l.data.height,z,blob};
  })();
  _lcache.set(l,p); return p;
}
async function unpackLayer(r){
  let buf; if(r.z) buf=await new Response(r.blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); else buf=await r.blob.arrayBuffer();
  return {name:r.name,visible:r.visible,opacity:r.opacity,data:new ImageData(new Uint8ClampedArray(buf),r.w,r.h)};
}
async function encodeDraft(st,hist,hidx,layerCount){
  const setIdx=new Map(), sets=[], entries=[];
  for(const e of hist){
    let si=setIdx.get(e.layers);                           // steps that share pixel data (selection steps) share one stored set
    if(si===undefined){ si=sets.length; setIdx.set(e.layers,si); sets.push(await Promise.all(e.layers.map(packLayer))); }
    entries.push({label:e.label,active:e.active,sel:e.sel,m:e.m,set:si});
  }
  return {type:'draft',name:st.name,handle:st.handle||null,projHandle:st.projHandle||null,dirty:!!st.dirty,zoom:st.zoom,panX:st.panX,panY:st.panY,
    cellSel:[...st.cellSel],active:st.active,layerCount,hist:entries,sets,hidx};
}
async function decodeDraft(d){
  const sets=await Promise.all(d.sets.map(set=>Promise.all(set.map(unpackLayer))));
  return {hist:d.hist.map(e=>({label:e.label,active:e.active,sel:e.sel,m:e.m,layers:sets[e.set]})),hidx:d.hidx};
}

async function sessionWrite(){
  if(sessionWriting){ sessionAgain=true; return; }
  sessionWriting=true; sessionAgain=false; sessionPending=false;
  try{
    const out=[]; let active=-1;
    for(let i=0;i<tabs.length;i++){
      const cur=i===curTab, st=cur?S:tabs[i], hist=cur?HIST.list:st.hist, hidx=cur?HIST.idx:st.hidx;
      const proj=!!st.projHandle, handle=proj?st.projHandle:st.handle;
      const blank=!st.dirty && st.name==='untitled.png' && !handle && (hist||[]).length<=1;
      if(blank) continue;
      if(cur) active=out.length;
      if(handle && !st.dirty){ out.push({type:'file',kind:proj?'proj':'png',handle,name:st.name,grid:{cols:st.cols,rows:st.rows,fw:st.fw,fh:st.fh}}); continue; }
      if(!S.keepDrafts) continue;
      out.push(await encodeDraft(st,hist.slice(),hidx,cur?layerCount:st.layerCount));
    }
    const ok=await kvSet('session',{tabs:out,active});
    sessionFailed=!ok;
  }catch(e){ console.warn('session write failed',e); sessionFailed=true; }
  sessionWriting=false;
  if(sessionAgain||sessionPending){ sessionAgain=false; clearTimeout(sessionT); sessionT=setTimeout(sessionWrite,300); }
}

/* ---- restore ---- */
async function restoreDraft(d){
  const dec=await decodeDraft(d), e=dec.hist[dec.hidx], W=e.layers[0].data.width, H=e.layers[0].data.height;
  const L=e.layers.map(l=>{ const x=newLayer(W,H,l.name); x.visible=l.visible; x.opacity=l.opacity; x.ctx.putImageData(l.data,0,0); return x; });
  openTabSlot();
  const rs=e.sel||[];
  const t={...e.m, zoom:d.zoom, panX:d.panX, panY:d.panY, cellSel:new Set(d.cellSel&&d.cellSel.length?d.cellSel:['0,0']), active:d.active||{c:0,r:0},
    sel:null, extra:null, extraOf:null, name:d.name, handle:d.handle||null, projHandle:d.projHandle||null, dirty:!!d.dirty,
    layers:L, activeL:clamp(e.active,0,L.length-1), layerCount:Math.max(d.layerCount||0,L.length), hist:dec.hist, hidx:dec.hidx};
  if(rs.length){ t.sel={...rs[rs.length-1]}; t.extra=rs.slice(0,-1).map(r=>({...r})); t.extraOf=t.sel; }
  loadTab(t); if(!d.zoom) fitView();
}
async function openRememberedFile(r,ask){
  if(ask && (await r.handle.requestPermission({mode:'read'}))!=='granted') return false;
  const file=await r.handle.getFile();
  if(r.kind==='proj') await openProject(file,r.handle);
  else if(!(await openImageWithGrid(file,r.handle,r.grid))) await openFile(file,r.handle);
  return true;
}
async function sessionRestore(){
  let s=null; try{ s=await kvGet('session'); }catch(e){}
  const list=(s&&(s.tabs||(s.recs||[]).map(r=>({type:'file',...r}))))||[];
  if(!list.length){ sessionLock=false; sessionSave(); return; }
  let needAsk=false;
  for(const r of list) if(r.type==='file'){ try{ if((await r.handle.queryPermission({mode:'read'}))!=='granted') needAsk=true; }catch(e){ needAsk=true; } }
  const where=[]; let drafts=0, files=0;
  const open=async(i,ask)=>{
    const r=list[i];
    try{
      if(r.type==='draft'){ await restoreDraft(r); drafts++; where[i]=curTab; return; }
      if(await openRememberedFile(r,ask)){ files++; where[i]=curTab; }
    }catch(e){ console.warn('Could not reopen',r.name,e); }
  };
  for(let i=0;i<list.length;i++) if(list[i].type==='draft' || !needAsk) await open(i,false);   // drafts never need permission
  const finish=()=>{
    if(s.active>=0 && where[s.active]!==undefined) switchTab(where[s.active]);
    sessionLock=false; sessionSave();
    const bits=[]; if(drafts) bits.push(drafts+' unsaved tab'+(drafts===1?'':'s')+' restored'); if(files) bits.push(files+' file'+(files===1?'':'s')+' reopened');
    if(bits.length) toast(bits.join(' · '));
  };
  const pending=list.map((r,i)=>i).filter(i=>list[i].type==='file' && where[i]===undefined);
  if(!pending.length||!needAsk){ finish(); return; }
  $('#rbN').textContent=pending.length; $('#rbS').style.display=pending.length===1?'none':'';
  $('#restoreBar').classList.add('show');
  $('#rbYes').onclick=async()=>{ $('#restoreBar').classList.remove('show'); for(const i of pending) await open(i,true); finish(); };   // the click lets the browser ask for file access again
  $('#rbNo').onclick=()=>{ $('#restoreBar').classList.remove('show'); finish(); };
}
