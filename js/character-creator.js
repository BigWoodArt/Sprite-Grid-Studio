"use strict";
// Character Creator

/* ---------- character creator ---------- */
const CC={name:'',dirHandle:null,groups:new Map(),gkey:null,json:null,open:false,stale:false,pieces:[],anim:{row:0,fps:6,f:0,acc:0,last:0}};
const CC_ORDER=['body','skin','face','eyes','outfit','clothes','clothing','top','hair','accessory','headwear','hat','helmet','weapon'];
const CC_OPTIONAL=/accessor|headwear|hat|helm|weapon|glass|beard|mask|extra|item|prop/i;
const IMG_RE=/\.(png|gif|webp|jpe?g)$/i;
const prettify=t=>t.replace(/[-_]+/g,' ').trim().replace(/\b\w/g,m=>m.toUpperCase());
const ccG=()=>CC.groups.get(CC.gkey);
function idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open('sgs',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function kvSet(k,v){ try{ const db=await idb(); await new Promise((res,rej)=>{ const t=db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); t.oncomplete=res; t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); }); return true; }catch(e){ console.warn('kvSet failed',e); return false; } }
async function kvGet(k){ try{ const db=await idb(); return await new Promise((res,rej)=>{ const r=db.transaction('kv').objectStore('kv').get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }catch(e){ return null; } }

async function ccShow(){
  CC.open=true; $('#cc').classList.add('show');
  const last=await kvGet('ccDir');
  const b=$('#ccLast'); if(last&&last.name&&window.showDirectoryPicker&&(!CC.dirHandle||CC.dirHandle.name!==last.name)){ b.style.display=''; b.textContent='Reopen "'+last.name+'"'; b.onclick=async()=>{ try{ if((await last.requestPermission({mode:'readwrite'}))!=='granted') return; await ccLoadDir(last); }catch(e){ toast('Could not reopen that folder'); } }; } else b.style.display='none';
  if(CC.dirHandle && CC.stale){ CC.stale=false; await ccReload(); }
  ccRender(); requestAnimationFrame(ccLoop);
}
function ccHide(){ CC.open=false; $('#cc').classList.remove('show'); changed(); }
async function ccPick(){
  if(window.showDirectoryPicker){
    try{ const dh=await showDirectoryPicker({mode:'readwrite'}); kvSet('ccDir',dh); await ccLoadDir(dh); }
    catch(e){ if(e&&e.name!=='AbortError'){ console.warn(e); toast('Could not open that folder'); } }
  } else $('#ccDirIn').click();
}
async function walkDir(dh,prefix,out,depth=0){
  if(depth>8) return;
  for await (const [name,h] of dh.entries()){
    if(name.startsWith('.')) continue;
    if(h.kind==='directory') await walkDir(h,prefix+name+'/',out,depth+1);
    else out.push({rel:prefix+name,handle:h,getFile:()=>h.getFile()});
  }
}
async function ccLoadDir(dh){
  CC.dirHandle=dh; CC.name=dh.name; $('#ccInfo').textContent='Scanning…';
  const out=[]; await walkDir(dh,'',out); await ccLoadEntries(out);
}
$('#ccDirIn').onchange=async e=>{
  const files=[...e.target.files]; e.target.value=''; if(!files.length) return;
  CC.dirHandle=null; CC.name=files[0].webkitRelativePath.split('/')[0];
  await ccLoadEntries(files.map(f=>({rel:f.webkitRelativePath.split('/').slice(1).join('/'),handle:null,getFile:async()=>f})));
};
async function ccReload(){ if(CC.dirHandle){ const prev=ccSelMap(); const out=[]; await walkDir(CC.dirHandle,'',out); await ccLoadEntries(out,prev); } }
function ccSelMap(){ const m={}; for(const g of CC.groups.values()) for(const c of g.cats) if(c.sel>=0&&c.pieces[c.sel]) m[c.id]=c.pieces[c.sel].rel; return m; }
async function ccLoadEntries(entries,prevSel){
  prevSel=prevSel||{};
  CC.json=null; const je=entries.find(e=>e.rel.toLowerCase()==='layers.json');
  if(je){ try{ CC.json=JSON.parse(await (await je.getFile()).text()); }catch(e){} }
  const imgs=entries.filter(e=>IMG_RE.test(e.rel));
  const pieces=[];
  await Promise.all(imgs.map(async e=>{
    try{ const f=await e.getFile(); const img=await loadImage(f); const parts=e.rel.split('/');
      pieces.push({rel:e.rel,handle:e.handle,getFile:e.getFile,img,w:img.width,h:img.height,folder:parts.length>1?parts[0]:'',base:parts[parts.length-1].replace(/\.[^.]+$/,'')}); }catch(err){ console.warn('skip',e.rel,err); }
  }));
  pieces.sort((a,b)=>a.rel.localeCompare(b.rel,undefined,{numeric:true}));
  CC.pieces=pieces;
  if(!pieces.length){ toast('No images found in that folder'); $('#ccInfo').textContent=''; return; }
  ccBuild(pieces,prevSel); ccRender();
}
function ccBuild(pieces,prevSel){
  CC.groups=new Map(); const saved=store.get('cc:'+CC.name,{})||{}, J=CC.json;
  const bySize=new Map();
  for(const p of pieces){ const k=p.w+'x'+p.h; if(!bySize.has(k)) bySize.set(k,[]); bySize.get(k).push(p); }
  const keys=[...bySize.keys()].sort((a,b)=>bySize.get(b).length-bySize.get(a).length);
  const jnames=J&&Array.isArray(J.categories)?J.categories.map(c=>String(c.name||'').toLowerCase()):[];
  for(const k of keys){
    const ps=bySize.get(k), g={key:k,w:ps[0].w,h:ps[0].h,cats:[],cols:0,rows:0,count:ps.length};
    const sg=store.get('ccgrid:'+CC.name+':'+k,null);
    if(sg){ g.cols=sg.cols; g.rows=sg.rows; }
    else if(J){
      const tryG=(fs,c,r)=>{ if(fs&&c&&r&&g.w===c*fs&&g.h===r*fs){ g.cols=c; g.rows=r; return true; } return false; };
      if(!tryG(J.frameSize,J.columns,J.rows)){
        if(J.battler) tryG(J.battler.frameSize||J.frameSize,J.battler.columns,J.battler.rows);
        if(!g.cols&&J.idleClimb&&J.frameSize&&g.w===J.columns*J.frameSize&&g.h===J.rows*J.frameSize*3){ g.cols=J.columns; g.rows=J.rows*3; }
      }
    }
    const byFolder=new Map(); for(const p of ps){ if(!byFolder.has(p.folder)) byFolder.set(p.folder,[]); byFolder.get(p.folder).push(p); }
    const cats=[];
    for(const [folder,fp] of byFolder){
      const pref=new Map();
      for(const p of fp){ const m=p.base.match(/^([^-_ ]+)[-_ ]./); const pf=m?m[1].toLowerCase():''; if(!pref.has(pf)) pref.set(pf,[]); pref.get(pf).push(p); }
      const split=pref.size>=2 && !pref.has('') && (pref.size>=3 || [...pref.keys()].some(x=>CC_ORDER.includes(x)));
      const groups=split?[...pref.entries()].map(([pf,arr])=>({label:(folder?folder+' / ':'')+pf,base:pf,arr})):[{label:folder||'Root',base:(folder||'root').toLowerCase(),arr:fp}];
      for(const gr of groups){
        const id=k+'|'+gr.label, sc=saved[id]||{}, jidx=jnames.indexOf(gr.base.toLowerCase());
        let jcat=jidx>=0?J.categories[jidx]:null;
        const di=CC_ORDER.indexOf(gr.base.toLowerCase());
        cats.push({id,label:gr.label,base:gr.base,pieces:gr.arr,include:sc.include??true,
          optional:sc.optional??(jcat&&typeof jcat.required==='boolean'?!jcat.required:CC_OPTIONAL.test(gr.base)),
          locked:false,sel:-1,ord:jidx>=0?jidx:(di>=0?100+di:1000)});
      }
    }
    cats.sort((a,b)=>a.ord-b.ord||a.label.localeCompare(b.label));
    if(saved.order){ const idx=id=>{ const i=saved.order.indexOf(id); return i<0?999:i; }; cats.sort((a,b)=>idx(a.id)-idx(b.id)); }
    for(const c of cats){ const want=prevSel[c.id]; const i=want?c.pieces.findIndex(p=>p.rel===want):-1; c.sel=i; }
    g.cats=cats; CC.groups.set(k,g);
  }
  if(!CC.groups.has(CC.gkey)) CC.gkey=[...CC.groups.values()].sort((a,b)=>a.w*a.h-b.w*b.h)[0].key;
  for(const g of CC.groups.values()) for(const c of g.cats) if(c.sel<0 && !(prevSel[c.id]==='')) ccRollCat(c);
  $('#ccInfo').textContent=`${CC.name} · ${pieces.length} images · ${CC.groups.size} sheet size${CC.groups.size>1?'s':''}`+(CC.json?' · layers.json found':'');
}
function ccRollCat(c){
  const n=c.pieces.length; if(!n){ c.sel=-1; return; }
  c.sel = (c.optional && Math.random()<1/(n+1)) ? -1 : Math.floor(Math.random()*n);
}
function ccRandomize(){ const g=ccG(); if(!g) return; for(const c of g.cats) if(!c.locked) ccRollCat(c); ccRenderList(); ccDraw(); }
function ccSave(){ const out={}; const order=[];
  for(const g of CC.groups.values()) for(const c of g.cats){ out[c.id]={include:c.include,optional:c.optional}; order.push(c.id); }
  out.order=order; store.set('cc:'+CC.name,out); }
function optName(c,p){
  const re=new RegExp('^'+c.base.replace(/[^a-z0-9]/gi,'')+'[-_ ]','i'); let b=p.base.replace(re,'');
  return prettify(b||p.base);
}
function ccRender(){
  if(!CC.groups.size){ $('#ccEmpty').style.display=''; $('#ccBody').style.display='none'; return; }
  $('#ccEmpty').style.display='none'; $('#ccBody').style.display='flex';
  const sel=$('#ccGroup'); sel.innerHTML='';
  for(const g of CC.groups.values()){ const o=document.createElement('option'); o.value=g.key; o.textContent=`${g.w}×${g.h}  ·  ${g.cats.length} parts, ${g.count} images`; sel.appendChild(o); }
  sel.value=CC.gkey;
  ccRenderList(); ccDraw();
}
function ccRenderList(){
  const g=ccG(); if(!g) return; const box=$('#ccList'); const keep=box.scrollTop; box.innerHTML='';
  for(let i=g.cats.length-1;i>=0;i--){
    const c=g.cats[i], p=c.sel>=0?c.pieces[c.sel]:null, d=document.createElement('div');
    d.className='ccrow'+(c.include?'':' off'); d.dataset.i=i;
    d.innerHTML=`<div class="ccr1"><input type="checkbox" data-a="inc" ${c.include?'checked':''} title="Use this part"><b></b><span class="dim">${c.pieces.length}</span>
      <label title="Allow “None” when randomizing"><input type="checkbox" data-a="opt" ${c.optional?'checked':''}>optional</label>
      <button data-a="up" title="Move up the stack">▲</button><button data-a="dn" title="Move down the stack">▼</button></div>
      <div class="ccr2"><button data-a="prev">◀</button><span class="nm"></span><button data-a="next">▶</button>
      <button data-a="lock" class="${c.locked?'on':''}" title="Keep this choice when randomizing">${c.locked?'🔒':'🔓'}</button>
      <button data-a="edit" title="Edit this piece in the pixel editor"${p?'':' disabled'}>✎</button></div>`;
    d.querySelector('b').textContent=c.label; d.querySelector('.nm').textContent=p?optName(c,p):'— None —';
    box.appendChild(d);
  }
  box.scrollTop=keep;
  const rs=$('#ccRowSel'), rows=g.rows||1; if(rs.options.length!==rows){ rs.innerHTML=''; for(let r=0;r<rows;r++){ const o=document.createElement('option'); o.value=r; o.textContent=r+1; rs.appendChild(o); } }
  CC.anim.row=Math.min(CC.anim.row,rows-1); rs.value=CC.anim.row;
  $('#ccCols').value=g.cols||''; $('#ccRows').value=g.rows||'';
}
$('#ccList').addEventListener('click',e=>{
  const b=e.target.closest('[data-a]'); if(!b||b.tagName==='INPUT') return;
  const g=ccG(), i=+b.closest('.ccrow').dataset.i, c=g.cats[i], a=b.dataset.a;
  if(a==='up'&&i<g.cats.length-1){ [g.cats[i],g.cats[i+1]]=[g.cats[i+1],g.cats[i]]; ccSave(); }
  else if(a==='dn'&&i>0){ [g.cats[i],g.cats[i-1]]=[g.cats[i-1],g.cats[i]]; ccSave(); }
  else if(a==='prev'||a==='next'){ const lo=c.optional?-1:0, n=c.pieces.length; let v=c.sel+(a==='next'?1:-1); if(v>=n) v=lo; if(v<lo) v=n-1; c.sel=v; }
  else if(a==='lock') c.locked=!c.locked;
  else if(a==='edit') ccEdit(c);
  ccRenderList(); ccDraw();
});
$('#ccList').addEventListener('change',e=>{
  const b=e.target.closest('[data-a]'); if(!b) return; const g=ccG(), c=g.cats[+b.closest('.ccrow').dataset.i];
  if(b.dataset.a==='inc') c.include=b.checked; else if(b.dataset.a==='opt'){ c.optional=b.checked; if(!c.optional&&c.sel<0) ccRollCat(c); }
  ccSave(); ccRenderList(); ccDraw();
});
$('#ccGroup').onchange=e=>{ CC.gkey=e.target.value; CC.anim.row=0; ccRender(); };
function ccGridChange(){
  const g=ccG(), c=+$('#ccCols').value|0, r=+$('#ccRows').value|0;
  if(c>0&&r>0&&g.w%c===0&&g.h%r===0){ g.cols=c; g.rows=r; store.set('ccgrid:'+CC.name+':'+g.key,{cols:c,rows:r}); ccRenderList(); ccDraw(); }
  else toast(`Sheet is ${g.w}×${g.h}: columns and rows must divide it evenly`);
}
$('#ccCols').onchange=ccGridChange; $('#ccRows').onchange=ccGridChange;
$('#ccRowSel').onchange=e=>{ CC.anim.row=+e.target.value; CC.anim.f=0; ccDrawMain(); };
$('#ccFps').oninput=e=>CC.anim.fps=+e.target.value;
$('#ccGridChk').onchange=ccDrawMain;
function ccCompose(g){
  const cv=mk(g.w,g.h), x=cv.getContext('2d'); x.imageSmoothingEnabled=false;
  for(const c of g.cats) if(c.include&&c.sel>=0&&c.pieces[c.sel]) x.drawImage(c.pieces[c.sel].img,0,0);
  return cv;
}
function ccDraw(){
  const g=ccG(); if(!g) return; const cv=ccCompose(g); g.last=cv;
  if(!g.cols){ let cands=[]; try{ cands=detectGrid(cv); }catch(e){} g.cols=cands[0]?cands[0].cols:1; g.rows=cands[0]?cands[0].rows:1; ccRenderList(); }
  ccDrawMain();
  CC.anim.drawn=null;
  const used=g.cats.filter(c=>c.include&&c.sel>=0).length;
  $('#ccHint').textContent=`${used} layer${used===1?'':'s'} stacked. Combinations in this set: ${ccCombos(g).toLocaleString()}.`;
}
function ccDrawMain(){
  const g=ccG(); if(!g||!g.last||!g.cols) return;
  const s=Math.max(1,Math.floor(Math.min(460/g.w,620/g.h))), m=$('#ccMain'); if(m.width!==g.w*s||m.height!==g.h*s){ m.width=g.w*s; m.height=g.h*s; }
  const x=m.getContext('2d'), A=CC.anim, cw=m.width/g.cols, ch=m.height/g.rows; x.imageSmoothingEnabled=false; x.clearRect(0,0,m.width,m.height);
  x.drawImage(g.last,0,0,m.width,m.height);
  if($('#ccGridChk').checked){ x.strokeStyle='rgba(255,157,46,.6)'; x.lineWidth=1; x.beginPath();
    for(let c=1;c<g.cols;c++){ const px=Math.round(c*cw)+.5; x.moveTo(px,0); x.lineTo(px,m.height); }
    for(let r=1;r<g.rows;r++){ const py=Math.round(r*ch)+.5; x.moveTo(0,py); x.lineTo(m.width,py); }
    x.stroke(); }
  x.fillStyle='rgba(255,157,46,.12)'; x.fillRect(0,A.row*ch,m.width,ch);
  x.strokeStyle='#ff9d2e'; x.lineWidth=2; x.strokeRect(1,A.row*ch+1,m.width-2,ch-2);
  if(A.cur){ x.strokeStyle='#5fd38d'; x.lineWidth=3; x.strokeRect(A.cur.c*cw+2,A.cur.r*ch+2,cw-4,ch-4); }
}
function ccCombos(g){ let n=1; for(const c of g.cats){ if(!c.include) continue; n*=c.pieces.length+(c.optional?1:0)||1; } return n; }
function ccLoop(ts){
  if(!CC.open) return;
  const g=ccG(), A=CC.anim;
  if(g&&g.last&&g.cols){
    const fw=g.w/g.cols, fh=g.h/g.rows, s=Math.max(1,Math.floor(Math.min(220/fw,260/fh))), a=$('#ccAnim');
    if(a.width!==fw*s||a.height!==fh*s){ a.width=fw*s; a.height=fh*s; }
    const x=a.getContext('2d'); x.imageSmoothingEnabled=false; x.clearRect(0,0,a.width,a.height);
    const ord=ccOrder(g), col=ord[A.f%ord.length]; A.cur={c:col,r:A.row};
    x.drawImage(g.last,col*fw,A.row*fh,fw,fh,0,0,a.width,a.height);
    if(A.drawn!==col+':'+A.row+':'+g.last.width){ A.drawn=col+':'+A.row+':'+g.last.width; ccDrawMain(); }
    A.acc+=ts-(A.last||ts); A.last=ts; const per=1000/A.fps; while(A.acc>=per){ A.acc-=per; A.f++; }
  }
  requestAnimationFrame(ccLoop);
}
const ccOrder=g=>g.cols===3?[0,1,2,1]:[...Array(g.cols).keys()];
$('#ccMain').addEventListener('click',e=>{
  const g=ccG(), m=$('#ccMain'); if(!g||!g.rows) return; const r=m.getBoundingClientRect();
  const row=Math.floor((e.clientY-r.top)/r.height*g.rows); if(row<0||row>=g.rows) return;
  CC.anim.row=row; CC.anim.f=0; $('#ccRowSel').value=row; ccDrawMain();
});
async function ccEdit(c){
  const p=c.sel>=0?c.pieces[c.sel]:null; if(!p) return;
  const g=ccG(); const f=await p.getFile();
  if(g.cols&&g.rows) store.set('grid:'+f.name+':'+p.w+'x'+p.h,{fw:p.w/g.cols,fh:p.h/g.rows});
  CC.stale=true; ccHide(); openFile(f,p.handle);
}
async function ccToEditor(){
  const g=ccG(); const cats=g.cats.filter(c=>c.include&&c.sel>=0&&c.pieces[c.sel]);
  if(!cats.length){ toast('Nothing to open — no parts are selected'); return; }
  if(!(await confirmDiscard())) return;
  const cols=g.cols||1, rows=g.rows||1;
  openTabSlot();
  S.cols=cols; S.rows=rows; S.fw=g.w/cols; S.fh=g.h/rows;
  setDoc(g.w,g.h);
  layers=cats.map(c=>{ const L=newLayer(g.w,g.h,c.label); L.ctx.drawImage(c.pieces[c.sel].img,0,0); return L; });
  layerCount=layers.length; useLayer(layers.length-1);
  fresh('character.png',null); ccHide(); toast('Opened as '+layers.length+' layers');
}
$('#bCC').onclick=ccShow; $('#ccClose').onclick=ccHide;
$('#ccPick').onclick=ccPick; $('#ccPick2').onclick=ccPick;
$('#ccReload').onclick=async()=>{ if(!CC.dirHandle){ toast('Choose a folder first'); return; } await ccReload(); ccRender(); toast('Reloaded'); };
$('#ccRand').onclick=ccRandomize; $('#ccToEd').onclick=ccToEditor;
$('#ccPng').onclick=()=>{ const g=ccG(); if(g&&g.last) g.last.toBlob(b=>download(b,'character.png')); };
