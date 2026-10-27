"use strict";
// UI sync, options and keyboard shortcuts

/* ---------- UI sync ---------- */
function updateTitle(){ renderTabs(); $('#fname').textContent=S.name+(S.dirty?' •':''); document.title=(S.dirty?'• ':'')+S.name+' — Sprite Grid Studio'; }
function updateUI(){
  updateTitle();
  $('#bUndo').disabled=HIST.idx<=0; $('#bRedo').disabled=HIST.idx>=HIST.list.length-1;
  $('#sDoc').textContent=`${DW()}×${DH()}  ·  ${S.cols}×${S.rows} cells of ${S.fw}×${S.fh}`;
}
function updateStatus(p){
  p=p||S.hover;
  if(p&&inDoc(p.x,p.y)){ const {c,r}=cellAt(p.x,p.y); $('#sPos').textContent=`x ${p.x}  y ${p.y}`; $('#sCell').textContent=`cell ${c+1},${r+1}  (local ${p.x-c*S.fw},${p.y-r*S.fh})`; }
  else { $('#sPos').textContent='–'; $('#sCell').textContent=`active cell ${S.active.c+1},${S.active.r+1}`; }
  $('#sZoom').textContent=Math.round(S.zoom*100)+'%';
}
function renderHist(){
  const el=$('#hist'); el.innerHTML='';
  HIST.list.forEach((h,i)=>{ const d=document.createElement('div'); d.textContent=(i+1)+'. '+h.label; if(i===HIST.idx) d.className='cur'; else if(i>HIST.idx) d.className='redo';
    d.onclick=()=>{ commitFloat(); restoreHist(i); }; el.appendChild(d); });
  const cur=el.querySelector('.cur'); if(cur) el.scrollTop=cur.offsetTop-el.clientHeight+cur.offsetHeight+4;
}
// options
$('#oSize').oninput=e=>{ S.size=+e.target.value; $('#oSizeV').textContent=S.size; changed(); };
$('#oFill').onchange=e=>S.fill=e.target.checked;
$('#oLock').onchange=e=>S.lock=e.target.checked;
$('#oMX').onchange=e=>S.mx=e.target.checked;
$('#oMY').onchange=e=>S.my=e.target.checked;
$('#oGrid').onchange=e=>{ S.showGrid=e.target.checked; changed(); };
$('#oPGrid').onchange=e=>{ S.pgrid=e.target.checked; changed(); };
$('#oOnion').onchange=e=>{ S.onion=e.target.checked; changed(); };
$('#oBg').onchange=e=>{ S.bgMode=e.target.value; changed(); };
$('#zIn').onclick=()=>stepZoom(1); $('#zOut').onclick=()=>stepZoom(-1); $('#zFit').onclick=fitView;
$('#bHelp').onclick=showHelp;
$('#bSettings').onclick=()=>{ modal('Settings',`
  <div class="grid2"><span>Layer previews</span>
  <label style="color:var(--text)"><input type="checkbox" id="stFull"> Show the full sheet (default: just the top-left cell)</label>
  <span>Tools</span>
  <label style="color:var(--text)"><input type="checkbox" id="stAuto"> Right-click with any tool except Pencil switches back to Select Cells</label>
  <span>Reloading</span>
  <label style="color:var(--text)"><input type="checkbox" id="stDraft"> Keep unsaved edits (with undo history) when the page is reloaded</label>
  <span>Selection</span>
  <label style="color:var(--text)"><input type="checkbox" id="stFade"> Fade out everything outside a selection with moving stripes</label></div>`,
  ()=>{ S.layerFull=$('#stFull').checked; store.set('layerFull',S.layerFull); S.autoCell=$('#stAuto').checked; store.set('autoCell',S.autoCell); S.fade=$('#stFade').checked; store.set('fade',S.fade); S.keepDrafts=$('#stDraft').checked; store.set('keepDrafts',S.keepDrafts); sessionSave(); renderLayers(); changed(); return true; },'Save');
  $('#stFull').checked=S.layerFull; $('#stAuto').checked=S.autoCell; $('#stFade').checked=S.fade; $('#stDraft').checked=S.keepDrafts; };

function showHelp(){
  const rows=[['B / E / G','Pencil / Eraser / Fill'],['L / R / O','Line / Rectangle / Ellipse (Shift = 45° / square / circle)'],['I or Alt+click','Eyedropper (right-click = secondary color)'],
    ['M / V / C / Y','Select region / Move cell contents / Select cells / Magic wand (Shift adds, Ctrl subtracts)'],['X','Swap primary/secondary colors'],['[  ]','Brush size − / +'],
    ['Wheel, + −, 0','Zoom at cursor, step zoom, fit'],['Space+drag / middle drag','Pan'],['Ctrl+C / X / V','Copy / cut / paste (cells when nothing is selected; pasting one cell fills every selected cell)'],
    ['Delete','Clear selection or selected cells'],['U / T / Q / N / K','Gradient / Adjust shape / Rotate-flip / Noise / Colorize'],['Shift+click or Shift+drag','Add to the selected cells (Select Cells) or add another region (Select region)'],['Ctrl+D','Clear selection (deselect)'],['H / Shift+H','Flip cells or selection horizontally / vertically'],['Arrows / WASD','Move the view (Shift = faster)'],['Alt+Arrows','Nudge selection or cell contents (Alt+Shift = wrap)'],['Drag outside the image','Pans the view with Pencil, Eraser or Move'],
    [', .','Previous / next cell'],['Ctrl+A','Select all cells'],['Esc','Deselect / cancel floating paste'],['Enter','Drop floating pixels'],
    ['P','Play/pause animation'],['G toggles?','Press <kbd>#</kbd> to toggle the cell grid'],['Ctrl+Z / Y','Undo / redo'],['Ctrl+N / O / S','New / Open / Save (Shift+S = Save as)']];
  infoModal('Shortcuts · v'+APP_VERSION,'<table>'+rows.map(r=>`<tr><td><kbd>${r[0]}</kbd></td><td>${r[1]}</td></tr>`).join('')+'</table>');
}

/* ---------- keyboard ---------- */
window.addEventListener('keyup',e=>{ panHeld.delete(e.code); if(e.code==='Space'){ spaceDown=false; view.style.cursor='crosshair'; } });
window.addEventListener('keydown',e=>{
  if(modalOpen()) return;
  if(CC.open){ if(e.key==='Escape') ccHide(); else if((e.key==='r'||e.key==='R')&&!e.ctrlKey&&!e.metaKey&&!/INPUT|SELECT/.test(document.activeElement.tagName)) ccRandomize(true); return; }
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.type!=='range' && document.activeElement.type!=='checkbox';
  const mod=e.ctrlKey||e.metaKey, k=e.key.toLowerCase();
  if(mod){
    if(typing && ['c','v','x','a','z','y'].includes(k)) return;
    if(k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); }
    else if(k==='y'){ e.preventDefault(); redo(); }
    else if(k==='s'){ e.preventDefault(); save(e.shiftKey); }
    else if(k==='o'){ e.preventDefault(); openDialog(); }
    else if(k==='n'){ e.preventDefault(); newDoc(); }
    else if(k==='c'){ e.preventDefault(); copySel(); }
    else if(k==='x'){ e.preventDefault(); cutSel(); }
    else if(k==='v'){ if(S.clip){ e.preventDefault(); pasteClip(); } }
    else if(k==='d'){ e.preventDefault(); commitFloat(); S.sel=null; selHistory('Deselect'); S.cellSel=new Set([key(S.active.c,S.active.r)]); syncCellUI(); toast('Selection cleared'); }
    else if(k==='a'){ e.preventDefault(); S.cellSel=new Set(); for(let r=0;r<S.rows;r++) for(let c=0;c<S.cols;c++) S.cellSel.add(key(c,r)); syncCellUI(); }
    return;
  }
  if(typing) return;
  if(e.code==='Space'){ e.preventDefault(); spaceDown=true; view.style.cursor='grab'; return; }
  if(keyTool[k] && !e.altKey){ setTool(keyTool[k]); return; }
  switch(e.key){
    case 'x': case 'X': swapColors(); break;
    case '[': S.size=clamp(S.size-1,1,16); $('#oSize').value=S.size; $('#oSizeV').textContent=S.size; changed(); break;
    case ']': S.size=clamp(S.size+1,1,16); $('#oSize').value=S.size; $('#oSizeV').textContent=S.size; changed(); break;
    case '+': case '=': stepZoom(1); break;
    case '-': case '_': stepZoom(-1); break;
    case '0': fitView(); break;
    case '#': S.showGrid=!S.showGrid; $('#oGrid').checked=S.showGrid; changed(); break;
    case 'Delete': case 'Backspace': e.preventDefault(); if(S.sel&&!S.floating){ for(const r of selRects()) dctx.clearRect(r.x,r.y,r.w,r.h); commit('Clear'); } else if(S.floating){ S.floating=null; S.sel=null; restoreHist(HIST.idx); } else clearTargets(); break;
    case 'Enter': commitFloat(); break;
    case 'Escape': if(TP.tool&&TP.dirty) tpCancel(); else if(S.floating) cancelFloat(); else { S.sel=null; selHistory('Deselect'); S.cellSel=new Set([key(S.active.c,S.active.r)]); syncCellUI(); } changed(); break;
    case 'h': case 'H': withRects(e.shiftKey?'Flip V':'Flip H', r=>flipRect(r,!e.shiftKey,e.shiftKey)); break;
    case 'p': case 'P': $('#aPlay').click(); break;
    case ',': case '<': stepCell(-1); break;
    case '.': case '>': stepCell(1); break;
    case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
      e.preventDefault(); const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0, dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
      if(e.altKey) nudge(dx,dy,e.shiftKey); else panPress(e); break; }
    case 'w': case 'W': case 's': case 'S': case 'a': case 'A': case 'd': case 'D': panPress(e); break;
    case '?': showHelp(); break;
  }
});
const PAN_DIRS={KeyW:[0,1],ArrowUp:[0,1],KeyS:[0,-1],ArrowDown:[0,-1],KeyA:[1,0],ArrowLeft:[1,0],KeyD:[-1,0],ArrowRight:[-1,0]};
const panHeld=new Map(); let panRaf=0, panLast=0, panFast=false;
function panPress(e){
  const d=PAN_DIRS[e.code]; if(!d) return; panFast=e.shiftKey;
  if(e.repeat) return;                       // we do our own repeat: no OS delay
  S.panX+=d[0]*(e.shiftKey?100:24); S.panY+=d[1]*(e.shiftKey?100:24); changed(); // one clean step per tap
  panHeld.set(e.code,performance.now());
  if(!panRaf){ panLast=performance.now(); panRaf=requestAnimationFrame(panTick); }
}
function panTick(ts){
  const dt=Math.min(.05,(ts-panLast)/1000); panLast=ts; let dx=0,dy=0;
  for(const [c,t0] of panHeld){ const age=ts-t0-140; if(age<=0) continue; const d=PAN_DIRS[c], ramp=Math.min(1,age/180); dx+=d[0]*ramp; dy+=d[1]*ramp; }   // starts after 140 ms, eases in
  if(dx||dy){ const sp=panFast?1800:560; S.panX+=dx*sp*dt; S.panY+=dy*sp*dt; changed(); }
  panRaf=panHeld.size?requestAnimationFrame(panTick):0;
}
window.addEventListener('blur',()=>panHeld.clear());
function stepCell(d){
  let i=S.active.r*S.cols+S.active.c+d; i=(i+S.cols*S.rows)%(S.cols*S.rows);
  selectCell(i%S.cols,Math.floor(i/S.cols));
}
