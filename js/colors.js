"use strict";
// Color picker and palettes

/* ---------- colors ---------- */
function hexToColor(h,a=255){ h=h.replace('#',''); if(h.length===3) h=h.split('').map(x=>x+x).join(''); if(!/^[0-9a-f]{6}$/i.test(h)) return null;
  return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a}; }
function setFg(c){ S.fg={...c}; syncColorUI(); }
function setBg(c){ S.bg={...c}; syncColorUI(); }
function syncColorUI(){
  $('#swFg i').style.background=rgba(S.fg); $('#swBg i').style.background=rgba(S.bg);
  $('#cFg').value=toHex(S.fg); $('#cBg').value=toHex(S.bg);
  if(document.activeElement!==$('#hex')) $('#hex').value=toHex(S.fg);
  $('#alpha').value=S.fg.a; $('#alphaV').textContent=S.fg.a;
}
function addRecent(){
  const h=toHex(S.fg); S.recent=[h,...S.recent.filter(x=>x!==h)].slice(0,14); store.set('recent',S.recent); renderPalettes();
}
function renderPalettes(){
  const mkPal=(el,arr)=>{ el.innerHTML=''; arr.forEach(h=>{ const b=document.createElement('b'); b.style.background=h; b.title=h;
    b.onclick=()=>{ const c=hexToColor(h,S.fg.a); setFg(c); };
    b.oncontextmenu=e=>{ e.preventDefault(); setBg(hexToColor(h)); }; el.appendChild(b); }); };
  mkPal($('#pal'),S.palette); mkPal($('#recent'),S.recent);
}
$('#cFg').oninput=e=>{ const c=hexToColor(e.target.value,S.fg.a); setFg(c); };
$('#cBg').oninput=e=>setBg(hexToColor(e.target.value));
$('#hex').onchange=e=>{ const c=hexToColor(e.target.value,S.fg.a); if(c) setFg(c); else syncColorUI(); };
$('#alpha').oninput=e=>{ S.fg.a=+e.target.value; syncColorUI(); };
$('#bSwap').onclick=swapColors;
function swapColors(){ const t=S.fg; S.fg=S.bg; S.bg=t; syncColorUI(); }
$('#bPalDef').onclick=()=>{ S.palette=[...DEFAULT_PAL]; store.set('palette',S.palette); renderPalettes(); };
$('#bPalImg').onclick=()=>{
  refreshComp(); const d=cctx.getImageData(0,0,DW(),DH()).data, cnt=new Map();
  for(let i=0;i<d.length;i+=4) if(d[i+3]>0){ const k=(d[i]<<16)|(d[i+1]<<8)|d[i+2]; cnt.set(k,(cnt.get(k)||0)+1); }
  const arr=[...cnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0,96).map(([k])=>'#'+k.toString(16).padStart(6,'0'));
  if(!arr.length){ toast('Image has no opaque pixels'); return; }
  S.palette=arr; store.set('palette',arr); renderPalettes(); toast('Palette: '+arr.length+' colors');
};
