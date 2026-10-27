"use strict";
// Cells panel (thumbnails, drag and drop)

/* ---------- cells panel ---------- */
let thumbs=[];
function buildThumbs(){
  const sig=[S.cols,S.rows,S.fw,S.fh].join('x');
  if(sig===thumbStructure) return; thumbStructure=sig;
  const box=$('#cells'); box.innerHTML=''; thumbs=[];
  const avail=262, hdW=18, tw=clamp(Math.floor((avail-hdW-(S.cols)*3)/S.cols),20,72);
  const sc=Math.min(tw/S.fw, 72/S.fh), cw=Math.max(8,Math.floor(S.fw*sc)), ch=Math.max(8,Math.floor(S.fh*sc));
  box.style.gridTemplateColumns=`${hdW}px repeat(${S.cols}, ${cw+4}px)`;
  const corner=document.createElement('div'); box.appendChild(corner);
  for(let c=0;c<S.cols;c++){ const h=document.createElement('div'); h.className='hd'; h.textContent='C'+(c+1); h.title='Select column '+(c+1);
    h.onclick=e=>selectCol(c,e.ctrlKey||e.shiftKey); box.appendChild(h); }
  for(let r=0;r<S.rows;r++){
    const h=document.createElement('div'); h.className='hd'; h.textContent='R'+(r+1); h.title='Select row '+(r+1);
    h.onclick=e=>selectRow(r,e.ctrlKey||e.shiftKey); box.appendChild(h);
    for(let c=0;c<S.cols;c++){
      const b=document.createElement('div'); b.className='th'; b.draggable=true; b.dataset.c=c; b.dataset.r=r;
      const cv=mk(S.fw,S.fh); cv.style.width=cw+'px'; cv.style.height=ch+'px'; b.appendChild(cv);
      b.onclick=e=>selectCell(c,r,{ctrl:e.ctrlKey||e.metaKey,shift:e.shiftKey});
      b.ondblclick=()=>centerOnCell(c,r);
      b.ondragstart=e=>{ e.dataTransfer.setData('text/plain',c+','+r); e.dataTransfer.effectAllowed='copyMove'; dragCell={c,r}; dragShift=e.shiftKey; };
      b.ondragover=e=>{ e.preventDefault(); dragShift=dragShift||e.shiftKey; e.dataTransfer.dropEffect=dragShift?'move':'copy'; b.classList.add('over'); b.classList.toggle('swap',dragShift); };
      b.ondragleave=()=>b.classList.remove('over','swap');
      b.ondrop=e=>{ e.preventDefault(); b.classList.remove('over','swap'); if(dragCell) dropCell(dragCell,{c,r},dragShift||e.shiftKey); dragCell=null; dragShift=false; };
      b.ondragend=()=>{ dragCell=null; dragShift=false; };
      box.appendChild(b); thumbs.push({c,r,el:b,cv});
    }
  }
  updateThumbClasses();
}
setupFold('cellsSec','cellsFold','cellsFold');   // the Cells header folds the whole panel
let dragCell=null, dragShift=false;   // dragShift stays true once Shift has been seen anywhere during the drag
function dropCell(src,dst,swap){
  commitFloat();
  if(src.c===dst.c&&src.r===dst.r) return;
  if(swap){
    const a=grabCells([src]), b=grabCells([dst]);
    placeCells(a,dst.c,dst.r); placeCells(b,src.c,src.r); commit('Swap cells');
  } else {
    const list = S.cellSel.has(key(src.c,src.r)) ? selCells() : [src];
    const cl = grabCells(list);
    const mc=Math.min(...list.map(o=>o.c)), mr=Math.min(...list.map(o=>o.r));
    placeCells(cl, dst.c-(src.c-mc), dst.r-(src.r-mr)); commit('Copy cells');
  }
}
function drawThumbs(){ refreshComp(); for(const t of thumbs){ const g=t.cv.getContext('2d'); g.clearRect(0,0,t.cv.width,t.cv.height); g.drawImage(comp,t.c*S.fw,t.r*S.fh,S.fw,S.fh,0,0,S.fw,S.fh); } }
function updateThumbClasses(){
  for(const t of thumbs){
    t.el.classList.toggle('sel',S.cellSel.has(key(t.c,t.r)));
    t.el.classList.toggle('act',t.c===S.active.c&&t.r===S.active.r);
  }
  $('#cellInfo').textContent=`${S.cellSel.size||1} selected`;
}
function centerOnCell(c,r){
  const a=cellRect(c,r); S.panX=vw/2-(a.x+a.w/2)*S.zoom; S.panY=vh/2-(a.y+a.h/2)*S.zoom; changed();
}
document.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{ const [dx,dy]=b.dataset.n.split(',').map(Number); nudge(dx,dy,$('#nWrap').checked); });
function nudge(dx,dy,wrap){
  if(S.floating||S.sel){
    if(!S.floating) liftSel(null);
    S.floating.x+=dx; S.floating.y+=dy; S.sel={x:S.floating.x,y:S.floating.y,w:S.floating.cv.width,h:S.floating.cv.height}; changed(); return;
  }
  withRects('Nudge', r=>nudgeRect(r,dx,dy,wrap));
}
$('#cCopy').onclick=copySel; $('#cPaste').onclick=pasteClip; $('#cClear').onclick=clearTargets;
$('#cFH').onclick=()=>withRects('Flip H',r=>flipRect(r,true,false));
$('#cFV').onclick=()=>withRects('Flip V',r=>flipRect(r,false,true));
$('#cRot').onclick=()=>{ let ok=true; withRects('Rotate',r=>{ if(!rotRect(r)) ok=false; }); if(!ok) toast('Rotate needs square cells/selection'); };
$('#cSwap').onclick=()=>{
  commitFloat(); const cs=selCells();
  if(cs.length!==2){ toast('Select exactly two cells to swap'); return; }
  dropCell(cs[0],cs[1],true);
};
$('#cDup').onclick=()=>{
  commitFloat(); const cs=selCells(); if(!cs.length) cs.push({...S.active});
  const cl=grabCells(cs); const mc=Math.min(...cs.map(o=>o.c)), mr=Math.min(...cs.map(o=>o.r));
  placeCells(cl, mc+cl.w, mr); commit('Duplicate cells');
  const nc=Math.min(S.cols-1,S.active.c+cl.w); selectCell(nc,S.active.r);
};
