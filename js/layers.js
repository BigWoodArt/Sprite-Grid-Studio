"use strict";
// Layers panel

/* ---------- layers ---------- */
function setActiveLayer(i){ commitFloat(); useLayer(i); changed(); renderLayers(); }
function renderLayers(){
  const box=$('#layers'), keep=box.scrollTop; box.innerHTML='';
  const full=S.layerFull, sw=full?DW():S.fw, sh=full?DH():S.fh, sc=Math.min(52/sw,52/sh), cw=Math.max(1,Math.round(sw*sc)), ch=Math.max(1,Math.round(sh*sc));
  for(let i=layers.length-1;i>=0;i--){
    const l=layers[i], d=document.createElement('div');
    d.className='ly'+(i===activeL?' act':'')+(l.visible?'':' hid');
    d.innerHTML=`<span class="eye" title="Show/hide">${l.visible?'👁':'⊘'}</span><span class="meta"><span class="nm"></span><span class="op">${Math.round(l.opacity/255*100)}%</span></span>`;
    const th=mk(sw,sh); th.style.width=cw+'px'; th.style.height=ch+'px';
    th.getContext('2d').drawImage(l.cv,0,0,sw,sh,0,0,sw,sh);
    d.insertBefore(th,d.querySelector('.meta'));
    d.querySelector('.nm').textContent=l.name; d.title=l.name+' — double-click to rename';
    d.querySelector('.eye').onclick=e=>{ e.stopPropagation(); commitFloat(); l.visible=!l.visible; commit(l.visible?'Show layer':'Hide layer'); };
    d.onclick=()=>setActiveLayer(i);
    d.ondblclick=()=>renameLayer(i);
    box.appendChild(d);
  }
  box.scrollTop=keep;
  const l=layers[activeL]; $('#lOp').value=l.opacity; $('#lOpV').textContent=l.opacity;
  $('#lMerge').disabled=activeL===0; $('#lUp').disabled=activeL>=layers.length-1; $('#lDn').disabled=activeL===0; $('#lDel').disabled=layers.length<2;
}
function renameLayer(i){
  const l=layers[i];
  modal('Layer name',`<input type="text" id="lName" style="width:100%" value="">`,()=>{ const n=$('#lName').value.trim()||l.name; if(n!==l.name){ l.name=n; commit('Rename layer'); } return true; },'OK');
  $('#lName').value=l.name; $('#lName').select();
}
function addLayer(){ commitFloat(); layers.splice(activeL+1,0,newLayer(DW(),DH(),'Layer '+(++layerCount))); useLayer(activeL+1); commit('Add layer'); }
function dupLayer(){ commitFloat(); const s=layers[activeL], L=newLayer(DW(),DH(),s.name+' copy'); L.ctx.drawImage(s.cv,0,0); L.visible=s.visible; L.opacity=s.opacity; layers.splice(activeL+1,0,L); useLayer(activeL+1); commit('Duplicate layer'); }
function delLayer(){ if(layers.length<2){ toast('Need at least one layer'); return; } commitFloat(); layers.splice(activeL,1); useLayer(Math.min(activeL,layers.length-1)); commit('Delete layer'); }
function mergeDown(){
  if(activeL===0){ toast('Nothing below to merge into'); return; } commitFloat();
  const top=layers[activeL], bot=layers[activeL-1];
  bot.ctx.globalAlpha=top.visible?top.opacity/255:0; bot.ctx.drawImage(top.cv,0,0); bot.ctx.globalAlpha=1;
  layers.splice(activeL,1); useLayer(activeL-1); commit('Merge layer down');
}
function moveLayer(d){
  const j=activeL+d; if(j<0||j>=layers.length) return; commitFloat();
  [layers[activeL],layers[j]]=[layers[j],layers[activeL]]; useLayer(j); commit('Move layer');
}
$('#lAdd').onclick=addLayer; $('#lDup').onclick=dupLayer; $('#lDel').onclick=delLayer; $('#lMerge').onclick=mergeDown;
$('#lUp').onclick=()=>moveLayer(1); $('#lDn').onclick=()=>moveLayer(-1);
$('#lOp').oninput=e=>{ layers[activeL].opacity=+e.target.value; $('#lOpV').textContent=e.target.value; changed(); };
$('#lOp').onchange=()=>commit('Layer opacity');
