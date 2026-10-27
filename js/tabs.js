"use strict";
// Tabs (several projects at once)

/* ---------- tabs ---------- */
const TAB_KEYS=['fw','fh','cols','rows','zoom','panX','panY','cellSel','active','sel','extra','extraOf','name','handle','projHandle','dirty'];
const tabs=[{}]; let curTab=0;
function saveTab(t){ TAB_KEYS.forEach(k=>t[k]=S[k]); t.layers=layers; t.activeL=activeL; t.layerCount=layerCount; t.hist=HIST.list; t.hidx=HIST.idx; }
function loadTab(t){
  TAB_KEYS.forEach(k=>S[k]=t[k]); S.floating=null; layers=t.layers; layerCount=t.layerCount; useLayer(t.activeL);
  sizeComp(layers[0].cv.width,layers[0].cv.height); HIST.list=t.hist; HIST.idx=t.hidx;
  preview=null; drag=null; thumbStructure=''; changed(true); updateStatus(); updateAnimPattern(); renderTabs();
}
const tabDirty=i=>i===curTab?S.dirty:tabs[i].dirty;
const tabName=i=>i===curTab?S.name:tabs[i].name;
const anyDirty=()=>tabs.some((_,i)=>tabDirty(i));
const isPristine=()=>!S.dirty && S.name==='untitled.png' && !S.handle && HIST.list.length<=1;
function openTabSlot(){            // call right before a new document replaces the current state
  commitFloat();
  if(isPristine()) return;         // reuse an empty, untouched tab
  saveTab(tabs[curTab]); tabs.push({}); curTab=tabs.length-1; renderTabs();
}
function switchTab(i){
  if(i===curTab||!tabs[i]) return; commitFloat(); saveTab(tabs[curTab]); curTab=i; loadTab(tabs[i]);
}
async function closeTab(i){
  if(tabDirty(i) && !(await askClose(tabName(i)))) return;
  if(tabs.length===1){
    S.fw=32;S.fh=48;S.cols=4;S.rows=4; setDoc(128,192); fresh('untitled.png',null); return;
  }
  const wasCur=i===curTab; tabs.splice(i,1);
  if(wasCur){ curTab=Math.min(i,tabs.length-1); loadTab(tabs[curTab]); }
  else { if(i<curTab) curTab--; renderTabs(); }
}
function renderTabs(){
  const box=$('#tabs'); if(!box) return; box.innerHTML='';
  tabs.forEach((_,i)=>{
    const d=document.createElement('div'); d.className='tab'+(i===curTab?' act':''); d.title=tabName(i);
    d.innerHTML='<span class="tn"></span>'+(tabDirty(i)?'<span class="dot">●</span>':'')+'<span class="x" title="Close (middle-click)">✕</span>';
    d.querySelector('.tn').textContent=tabName(i)||'untitled.png';
    d.onclick=()=>switchTab(i);
    d.onauxclick=e=>{ if(e.button===1){ e.preventDefault(); closeTab(i); } };
    d.querySelector('.x').onclick=e=>{ e.stopPropagation(); closeTab(i); };
    box.appendChild(d);
  });
  const add=document.createElement('button'); add.className='tabadd'; add.textContent='+'; add.title='New project in a new tab (Ctrl+N)'; add.onclick=newDoc; box.appendChild(add);
  if(typeof sessionSave==='function') sessionSave();
}
