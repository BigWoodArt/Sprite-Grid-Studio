"use strict";
// Magic wand: select pixels of a similar color; Shift adds to the selection, Ctrl subtracts from it

S.tol=store.get('tol',20); S.wandContig=store.get('wandContig',true); S.wandAll=store.get('wandAll',false);
$('#oTol').value=S.tol; $('#oTolV').textContent=S.tol; $('#oContig').checked=S.wandContig; $('#oAllLayers').checked=S.wandAll;
$('#oTol').oninput=e=>{ S.tol=+e.target.value; $('#oTolV').textContent=S.tol; store.set('tol',S.tol); };
$('#oContig').onchange=e=>{ S.wandContig=e.target.checked; store.set('wandContig',S.wandContig); };
$('#oAllLayers').onchange=e=>{ S.wandAll=e.target.checked; store.set('wandAll',S.wandAll); };

// Turn a pixel mask into as few rectangles as possible (equal runs on consecutive rows are merged)
function maskToRects(mask,W,H){
  const out=[]; let open=new Map();
  for(let y=0;y<H;y++){
    const next=new Map(); let x=0;
    while(x<W){
      if(!mask[y*W+x]){ x++; continue; }
      let x1=x; while(x1<W&&mask[y*W+x1]) x1++;
      const key=x+','+x1, r=open.get(key);
      if(r){ r.h++; next.set(key,r); } else { const nr={x,y,w:x1-x,h:1}; out.push(nr); next.set(key,nr); }
      x=x1;
    }
    open=next;
  }
  return out;
}
function selMaskFull(W,H){
  const m=new Uint8Array(W*H);
  for(const r of selRects()) for(let y=Math.max(0,r.y);y<Math.min(H,r.y+r.h);y++) for(let x=Math.max(0,r.x);x<Math.min(W,r.x+r.w);x++) m[y*W+x]=1;
  return m;
}
function wandClick(e,p){
  if(!inDoc(p.x,p.y)) return;
  commitFloat();
  const W=DW(), H=DH(); let img;
  if(S.wandAll){ refreshComp(); img=cctx.getImageData(0,0,W,H); } else img=dctx.getImageData(0,0,W,H);
  const d=img.data, i0=(p.y*W+p.x)*4, tol=Math.round(S.tol*2.55);
  const match=i=>{ const o=i*4;
    if(d[o+3]===0&&d[i0+3]===0) return true;                                   // all transparent pixels look alike
    return Math.abs(d[o]-d[i0])<=tol&&Math.abs(d[o+1]-d[i0+1])<=tol&&Math.abs(d[o+2]-d[i0+2])<=tol&&Math.abs(d[o+3]-d[i0+3])<=tol; };
  let mask=new Uint8Array(W*H), count=0;
  if(S.wandContig){
    const stack=new Int32Array(W*H+1); let sp=0, s0=p.y*W+p.x; stack[sp++]=s0; mask[s0]=1; count=1;
    while(sp){ const i=stack[--sp], x=i%W, y=(i-x)/W;
      if(x>0&&!mask[i-1]&&match(i-1)){ mask[i-1]=1; count++; stack[sp++]=i-1; }
      if(x<W-1&&!mask[i+1]&&match(i+1)){ mask[i+1]=1; count++; stack[sp++]=i+1; }
      if(y>0&&!mask[i-W]&&match(i-W)){ mask[i-W]=1; count++; stack[sp++]=i-W; }
      if(y<H-1&&!mask[i+W]&&match(i+W)){ mask[i+W]=1; count++; stack[sp++]=i+W; } }
  } else for(let i=0;i<W*H;i++) if(match(i)){ mask[i]=1; count++; }
  const add=e.shiftKey, sub=e.ctrlKey||e.metaKey;
  if((add||sub)&&S.sel){
    const old=selMaskFull(W,H); count=0;
    for(let i=0;i<mask.length;i++){ mask[i]= sub ? (old[i]&&!mask[i]?1:0) : (old[i]||mask[i]?1:0); count+=mask[i]; }
  }
  const rects=maskToRects(mask,W,H);
  if(!rects.length){ S.sel=null; S.extra=null; S.extraOf=null; changed(); selHistory('Deselect'); toast('Nothing selected'); return; }
  S.sel=rects[rects.length-1]; S.extra=rects.slice(0,-1); S.extraOf=S.sel;
  changed(); selHistory(sub?'Wand subtract':add?'Wand add':'Magic wand'); toast(count+' pixel'+(count===1?'':'s')+' selected'+(rects.length>1?' ('+rects.length+' pieces)':''));
}

// ▲▼ steppers next to Brush and Tolerance: one step per click, and they repeat while held
document.querySelectorAll('[data-spin]').forEach(b=>{
  const step=()=>{ const el=$('#'+b.dataset.spin), v=clamp((+el.value)+(+b.dataset.d),+el.min,+el.max); if(v!==+el.value){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); } };
  let t1=0,t2=0; const stop=()=>{ clearTimeout(t1); clearInterval(t2); };
  b.addEventListener('pointerdown',e=>{ e.preventDefault(); step(); stop(); t1=setTimeout(()=>{ t2=setInterval(step,70); },400); });
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stop));
});
