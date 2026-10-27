"use strict";
// Modal helper and grid / new / open dialogs

/* ---------- modal ---------- */
function modal(title,bodyHTML,onOk,okLabel='OK',onCancel){
  const bg=$('#modalBg'), m=$('#modal');
  m.innerHTML=`<h2>${title}</h2>${bodyHTML}<div class="btns"><button id="mCancel">Cancel</button><button class="primary" id="mOk">${okLabel}</button></div>`;
  bg.classList.add('show');
  const close=()=>{ bg.classList.remove('show'); m.innerHTML=''; };
  $('#mCancel').onclick=()=>{ close(); onCancel&&onCancel(); };
  $('#mOk').onclick=()=>{ const r=onOk(); if(r!==false) close(); };
  m.onkeydown=e=>{ if(e.key==='Enter'&&e.target.tagName!=='BUTTON'){ e.preventDefault(); $('#mOk').click(); } if(e.key==='Escape') $('#mCancel').click(); };
  const f=m.querySelector('input,select'); if(f) f.focus();
  return close;
}
const modalOpen = () => $('#modalBg').classList.contains('show');
function infoModal(title,html){ modal(title,html,()=>true,'Close'); $('#mCancel').style.display='none'; }

/* ---------- grid / new / open dialogs ---------- */
const PRESETS=[
  ['RPG Maker XP character (4×4, 32×48)',4,4,32,48],
  ['RPG Maker VX/Ace character (3×4, 32×32)',3,4,32,32],
  ['RPG Maker VX/Ace 8-up sheet (12×8, 32×32)',12,8,32,32],
  ['RPG Maker MV/MZ character (3×4, 48×48)',3,4,48,48],
  ['16×16 tiles, 8 across',8,4,16,16],
  ['Custom',0,0,0,0]
];
function gridDialog({mode,img,cols,rows,fw,fh,cands}){
  return new Promise(res=>{
    const isNew=mode==='new', isOpen=mode==='open', isResize=mode==='resize';
    const iw=img?img.width:DW(), ih=img?img.height:DH();
    cols=cols||S.cols; rows=rows||S.rows; fw=fw||S.fw; fh=fh||S.fh;
    const body=`<div class="grid2">
      ${isNew?`<span>Preset</span><select id="gPre">${PRESETS.map((p,i)=>`<option value="${i}">${p[0]}</option>`).join('')}</select>`:''}
      <span>Columns</span><input type="number" id="gC" min="1" max="256" value="${cols}">
      <span>Rows</span><input type="number" id="gR" min="1" max="256" value="${rows}">
      <span>Cell width</span><input type="number" id="gW" min="1" max="2048" value="${fw}">
      <span>Cell height</span><input type="number" id="gH" min="1" max="2048" value="${fh}">
      ${isResize?`<span>Anchor</span><span class="row"><select id="gAH"><option value="0">Left</option><option value="0.5" selected>Center</option><option value="1">Right</option></select><select id="gAV"><option value="0">Top</option><option value="0.5">Middle</option><option value="1" selected>Bottom</option></select></span>`:''}
    </div>${isOpen?'<div id="gChips" class="row" style="margin-top:10px"></div><canvas id="gPrev" width="300" height="200" style="display:block;margin:10px auto 0;width:300px;height:200px;image-rendering:pixelated;background:#14151a;border:1px solid var(--line);border-radius:6px"></canvas>':''}<div class="info" id="gInfo"></div>`;
    let done=false;
    const close=modal(isNew?'New sprite sheet':isOpen?'Set up the grid':'Grid and cell size',body,()=>{
      const v=read(); if(!v.ok) return false; done=true;
      v.ah=isResize?+$('#gAH').value:0; v.av=isResize?+$('#gAV').value:0; res(v); return true;
    },isNew?'Create':isOpen?'Open':'Apply',()=>{ if(!done) res(null); });
    const $c=$('#gC'),$r=$('#gR'),$w=$('#gW'),$h=$('#gH');
    function read(){ const v={cols:+$c.value|0,rows:+$r.value|0,fw:+$w.value|0,fh:+$h.value|0}; v.ok=v.cols>0&&v.rows>0&&v.fw>0&&v.fh>0&&v.cols*v.fw<=8192&&v.rows*v.fh<=8192; return v; }
    function info(){
      const v=read(), el=$('#gInfo'); el.classList.remove('warn');
      if(!v.ok){ el.textContent='Enter positive sizes (max 8192 px total).'; el.classList.add('warn'); return; }
      const tw=v.cols*v.fw, th=v.rows*v.fh;
      if(isOpen && (tw!==iw||th!==ih)){ el.textContent=`Image is ${iw}×${ih}; grid will be ${tw}×${th} (image placed top-left, cropped or padded).`; el.classList.add('warn'); }
      else el.textContent=`${v.cols*v.rows} cells · sheet ${tw}×${th}px`+(isOpen?' (matches image)':'');
      if(isOpen) drawPrev(v);
    }
    function drawPrev(v){
      const cv=$('#gPrev'), g=cv.getContext('2d'); g.clearRect(0,0,cv.width,cv.height);
      const sc=Math.min(cv.width/iw, cv.height/ih), w=iw*sc, h=ih*sc, ox=(cv.width-w)/2, oy=(cv.height-h)/2;
      g.imageSmoothingEnabled=false; g.drawImage(img,ox,oy,w,h);
      if(!v.ok) return; g.strokeStyle='rgba(255,157,46,.9)'; g.lineWidth=1; g.beginPath();
      for(let c=0;c<=v.cols;c++){ const x=Math.round(ox+c*v.fw*sc)+.5; g.moveTo(x,oy); g.lineTo(x,oy+h); }
      for(let r=0;r<=v.rows;r++){ const y=Math.round(oy+r*v.fh*sc)+.5; g.moveTo(ox,y); g.lineTo(ox+w,y); }
      g.stroke();
    }
    if(isOpen){
      const chips=$('#gChips'), seen=new Set();
      const add=(o,label)=>{ if(!o||seen.has(o.cols+'x'+o.rows)) return; if(iw%o.cols||ih%o.rows) return; seen.add(o.cols+'x'+o.rows);
        const b=document.createElement('button'); b.className='mini'; b.textContent=`${label?label+' ':''}${o.cols}×${o.rows} · ${iw/o.cols}×${ih/o.rows}px`;
        b.title='Use '+o.cols+' columns × '+o.rows+' rows'; if(label) b.classList.add('on');
        b.onclick=()=>{ $c.value=o.cols; $r.value=o.rows; $w.value=iw/o.cols; $h.value=ih/o.rows; info(); }; chips.appendChild(b); };
      (cands||[]).forEach((o,i)=>add(o,i===0?'Detected':''));
      [[1,1],[3,4],[4,4],[4,2],[12,8],[8,8],[2,2]].forEach(([c,r])=>add({cols:c,rows:r},''));
    }
    // when opening, keep sheet size == image size by deriving the other value
    if(isOpen){
      $c.oninput=()=>{ const c=+$c.value; if(c>0&&iw%c===0) $w.value=iw/c; info(); };
      $r.oninput=()=>{ const r=+$r.value; if(r>0&&ih%r===0) $h.value=ih/r; info(); };
      $w.oninput=()=>{ const w=+$w.value; if(w>0&&iw%w===0) $c.value=iw/w; info(); };
      $h.oninput=()=>{ const h=+$h.value; if(h>0&&ih%h===0) $r.value=ih/h; info(); };
    } else [$c,$r,$w,$h].forEach(el=>el.oninput=info);
    if(isNew){ $('#gPre').onchange=e=>{ const p=PRESETS[+e.target.value]; if(p[1]){ $c.value=p[1]; $r.value=p[2]; $w.value=p[3]; $h.value=p[4]; } info(); }; $('#gPre').value=0; $('#gPre').onchange({target:$('#gPre')}); }
    info();
  });
}
/* Find grids whose cell borders never slice through artwork. Returns best-first [{cols,rows,fw,fh}]. */
function detectGrid(img){
  const W=img.width, H=img.height, cv=mk(W,H), g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
  const d=g.getImageData(0,0,W,H).data;
  let hasAlpha=false; for(let i=3;i<d.length;i+=4) if(d[i]<250){ hasAlpha=true; break; }
  const solid=new Uint8Array(W*H); let any=false;
  for(let p=0;p<W*H;p++){ const i=p*4;
    solid[p]= hasAlpha ? (d[i+3]>=8 ? 1:0) : (Math.abs(d[i]-d[0])+Math.abs(d[i+1]-d[1])+Math.abs(d[i+2]-d[2])>24 ? 1:0);
    if(solid[p]) any=true; }
  if(!any) return [];
  const divs=N=>{ const a=[]; for(let n=1;n<=Math.min(64,N); n++) if(N%n===0 && (n===1 || N/n>=8)) a.push(n); return a; };
  const okCols=divs(W).filter(n=>{ const fw=W/n; let c=0; for(let k=1;k<n;k++){ const b=k*fw; for(let y=0;y<H;y++) if(solid[y*W+b-1]&&solid[y*W+b]) c++; } return c<=Math.floor(.01*H*(n-1)); });
  const okRows=divs(H).filter(n=>{ const fh=H/n; let c=0; for(let k=1;k<n;k++){ const b=k*fh; for(let x=0;x<W;x++) if(solid[(b-1)*W+x]&&solid[b*W+x]) c++; } return c<=Math.floor(.01*W*(n-1)); });
  const filled=(cols,rows)=>{ const fw=W/cols, fh=H/rows; let f=0;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){ let hit=false;
      for(let y=r*fh;y<(r+1)*fh&&!hit;y++) for(let x=c*fw;x<(c+1)*fw;x++) if(solid[y*W+x]){hit=true;break;}
      if(hit) f++; }
    return f/(cols*rows); };
  const out=[];
  for(const cols of okCols) for(const rows of okRows) out.push({cols,rows,fw:W/cols,fh:H/rows,n:cols*rows});
  out.sort((a,b)=>b.n-a.n);
  const good=out.filter(o=>o.n<=1024 && filled(o.cols,o.rows)>=.5);
  return (good.length?good:out).slice(0,6);
}
function applyLayout(v){
  const olds=layers, o={fw:S.fw,fh:S.fh,cols:S.cols,rows:S.rows}, nw=v.cols*v.fw, nh=v.rows*v.fh;
  const cw=Math.min(o.fw,v.fw), chh=Math.min(o.fh,v.fh);
  const sx=Math.floor((o.fw-cw)*(v.ah??0)), sy=Math.floor((o.fh-chh)*(v.av??0));
  const dx=Math.floor((v.fw-cw)*(v.ah??0)), dy=Math.floor((v.fh-chh)*(v.av??0));
  layers=olds.map(ol=>{ const L=newLayer(nw,nh,ol.name); L.visible=ol.visible; L.opacity=ol.opacity;
    for(let r=0;r<Math.min(o.rows,v.rows);r++) for(let c=0;c<Math.min(o.cols,v.cols);c++)
      L.ctx.drawImage(ol.cv, c*o.fw+sx, r*o.fh+sy, cw, chh, c*v.fw+dx, r*v.fh+dy, cw, chh);
    return L; });
  useLayer(activeL); sizeComp(nw,nh);
  S.fw=v.fw;S.fh=v.fh;S.cols=v.cols;S.rows=v.rows; S.sel=null; S.floating=null;
  S.cellSel=new Set([key(0,0)]); S.active={c:0,r:0};
}
$('#bGrid').onclick=async()=>{
  commitFloat();
  const v=await gridDialog({mode:'resize'}); if(!v) return;
  applyLayout(v); store.set('lastGrid',{cols:S.cols,rows:S.rows,fw:S.fw,fh:S.fh});
  commit('Change grid'); fitView();
};
async function newDoc(){
  if(!(await confirmDiscard())) return;
  const v=await gridDialog({mode:'new'}); if(!v) return;
  openTabSlot();
  S.fw=v.fw;S.fh=v.fh;S.cols=v.cols;S.rows=v.rows; setDoc(S.cols*S.fw,S.rows*S.fh);
  fresh('untitled.png',null);
}
function fresh(name,handle){
  S.name=name; S.handle=handle; S.projHandle=null; S.sel=null; S.floating=null; S.dirty=false;
  S.cellSel=new Set([key(0,0)]); S.active={c:0,r:0}; thumbStructure='';
  resetHistory('Open'); fitView(); changed(true); updateTitle();
}
function confirmDiscard(){ return Promise.resolve(true); } // projects open in their own tab now
function askClose(name){
  return new Promise(res=>{ let d=false; modal('Close without saving?','<div><b></b> has unsaved changes.</div>',()=>{d=true;res(true);return true;},'Close tab',()=>{ if(!d) res(false); }); $('#modal b').textContent=name; });
}
