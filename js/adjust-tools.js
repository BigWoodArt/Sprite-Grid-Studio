"use strict";
// Adjustment tools (shape, rotate, noise, colorize) and gradient

/* ---------- adjustment tools and gradient ---------- */
const PANEL_TOOLS=['gradient','adjust','rotate','noise','colorize'];
const TP={tool:null,dirty:false,rects:[],orig:[],params:{}};
const TP_DEF={
  adjust:()=>({dw:0,dh:0,shh:0,shv:0,ah:.5,av:1}),
  rotate:()=>({angle:0}),
  noise:()=>({amt:20,hue:false,sat:true,lig:true,seed:1,scope:'sel'}),
  colorize:()=>({hue:0,sat:0,lig:0,scope:'sel'})
};
const TP_LABEL={adjust:'Adjust shape',rotate:'Rotate',noise:'Add noise',colorize:'Colorize'};
const TP_TITLE={adjust:'Adjust shape',rotate:'Rotate / flip',noise:'Add noise',colorize:'Colorize',gradient:'Gradient fill'};
const GR=Object.assign({type:'linear',area:'contig',bands:0,stops:[{p:0,c:'#ffd23f',a:255},{p:100,c:'#ee4266',a:255}]},store.get('gr',{}));

function rgb2hsl(r,g,b){ r/=255;g/=255;b/=255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2; let h=0,s=0;
  if(mx!==mn){ const d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn); h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4; h*=60; } return [h,s,l]; }
function hsl2rgb(h,s,l){ h=((h%360)+360)%360; const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2; let r=0,g=0,b=0;
  if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
  return [Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)]; }
function hash01(i,k){ let t=(i+Math.imul(k,0x9E3779B1))|0; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function opNoise(img,P,base){
  const d=img.data, a=P.amt/100;
  for(let i=0,q=0;i<d.length;i+=4,q++){ if(!d[i+3]) continue;
    let [h,sa,l]=rgb2hsl(d[i],d[i+1],d[i+2]); const n=base+q;
    if(P.hue) h+=(hash01(n,P.seed*3)*2-1)*a*60;
    if(P.sat) sa=clamp(sa+(hash01(n,P.seed*3+1)*2-1)*a*.6,0,1);
    if(P.lig) l=clamp(l+(hash01(n,P.seed*3+2)*2-1)*a*.4,0,1);
    const c=hsl2rgb(h,sa,l); d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; }
}
function opColorize(img,P){
  const d=img.data;
  for(let i=0;i<d.length;i+=4){ if(!d[i+3]) continue;
    let [h,sa,l]=rgb2hsl(d[i],d[i+1],d[i+2]); h+=P.hue; sa=clamp(sa+P.sat/100,0,1); l=clamp(l+P.lig/100,0,1);
    const c=hsl2rgb(h,sa,l); d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; }
}
const tpNeutral=(tool,P)=> tool==='adjust'?(!P.dw&&!P.dh&&!P.shh&&!P.shv) : tool==='rotate'?!P.angle : tool==='noise'?(P.amt===0||!(P.hue||P.sat||P.lig)) : (!P.hue&&!P.sat&&!P.lig);
function tpTargets(){
  const P=TP.params[TP.tool]; let rs;
  if(P&&P.scope==='layer') rs=[{x:0,y:0,w:DW(),h:DH()}];
  else if(S.sel) rs=selRects();
  else { const cs=selCells(); if(!cs.length) cs.push({...S.active}); rs=cs.map(o=>cellRect(o.c,o.r)); }
  return rs.map(r=>{ const x=clamp(r.x,0,DW()),y=clamp(r.y,0,DH()),x2=clamp(r.x+r.w,0,DW()),y2=clamp(r.y+r.h,0,DH()); return {x,y,w:x2-x,h:y2-y}; }).filter(r=>r.w>0&&r.h>0);
}
function tpCapture(){
  if(!TP.tool||TP.tool==='gradient') return;
  TP.rects=tpTargets(); TP.orig=TP.rects.map(r=>dctx.getImageData(r.x,r.y,r.w,r.h));
  const el=$('#tpInfo'); if(el){ const P=TP.params[TP.tool];
    el.textContent = P.scope==='layer' ? 'Whole layer' : S.sel ? (selRects().length>1?`${selRects().length} regions`:`Selection ${S.sel.w}×${S.sel.h}`) : `${TP.rects.length} cell${TP.rects.length===1?'':'s'} selected`; }
}
// Whole-pixel resampling: every output pixel is a straight copy of one source pixel (no smoothing, no blending).
function resample(tool,P,orig){
  const w=orig.width, h=orig.height, src=new Uint32Array(orig.data.buffer), out=new ImageData(w,h), dst=new Uint32Array(out.data.buffer);
  if(tool==='adjust'){
    const nw=Math.max(1,w+P.dw), nh=Math.max(1,h+P.dh), sxs=nw/w, sys=nh/h, ax=w*P.ah, ay=h*P.av;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const ux=x-Math.round(P.shh*((y+.5)-ay)/h), uy=y-Math.round(P.shv*((x+.5)-ax)/w);      // whole-pixel shear
      const sx=Math.floor(ax+(ux+.5-ax)/sxs), sy=Math.floor(ay+(uy+.5-ay)/sys);              // nearest source pixel centre
      if(sx>=0&&sy>=0&&sx<w&&sy<h) dst[y*w+x]=src[sy*w+sx];
    }
  } else {
    const a=P.angle*Math.PI/180, c=Math.cos(a), sn=Math.sin(a), cx=w/2, cy=h/2;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const dx=x+.5-cx, dy=y+.5-cy, sx=Math.floor(c*dx+sn*dy+cx), sy=Math.floor(-sn*dx+c*dy+cy);
      if(sx>=0&&sy>=0&&sx<w&&sy<h) dst[y*w+x]=src[sy*w+sx];
    }
  }
  return out;
}
function tpApplyOne(tool,P,r,orig,idx){
  if(tool==='noise'||tool==='colorize'){
    const img=new ImageData(new Uint8ClampedArray(orig.data),orig.width,orig.height);
    if(tool==='noise') opNoise(img,P,idx*100003); else opColorize(img,P);
    dctx.putImageData(img,r.x,r.y); return;
  }
  dctx.putImageData(resample(tool,P,orig),r.x,r.y);
}
function tpRender(){
  const tool=TP.tool; if(!tool||tool==='gradient') return; const P=TP.params[tool];
  if(!TP.dirty) tpCapture();
  TP.rects.forEach((r,i)=>dctx.putImageData(TP.orig[i],r.x,r.y));
  if(tpNeutral(tool,P)){ TP.dirty=false; changed(true); return; }
  TP.rects.forEach((r,i)=>tpApplyOne(tool,P,r,TP.orig[i],i));
  TP.dirty=true; changed(true);
}
function tpCancelLive(){ if(!TP.dirty) return; TP.rects.forEach((r,i)=>dctx.putImageData(TP.orig[i],r.x,r.y)); TP.dirty=false; changed(true); }
function tpApply(){ if(!TP.tool||!TP.dirty) return; const tool=TP.tool; TP.dirty=false; commit(TP_LABEL[tool]); TP.params[tool]=TP_DEF[tool](); tpBuild(); tpCapture(); }
function tpCancel(){ tpCancelLive(); TP.params[TP.tool]=TP_DEF[TP.tool](); tpBuild(); tpCapture(); }
function tpOpen(tool){ commitFloat(); TP.tool=tool; TP.dirty=false; if(tool!=='gradient') TP.params[tool]=TP.params[tool]||TP_DEF[tool](); tpBuild(); tpCapture(); }
function tpHide(){ TP.tool=null; TP.dirty=false; $('#tp').style.display='none'; }
function tpInstant(label,fn){
  tpCancelLive(); tpCapture(); if(!TP.rects.length) return;
  TP.rects.forEach(fn); commit(label); tpCapture();
}
function rotCenter(r,deg){
  const t=grab(r); dctx.clearRect(r.x,r.y,r.w,r.h); dctx.save(); dctx.beginPath(); dctx.rect(r.x,r.y,r.w,r.h); dctx.clip();
  dctx.translate(r.x+r.w/2,r.y+r.h/2); dctx.rotate(deg*Math.PI/180); dctx.translate(-r.w/2,-r.h/2); dctx.drawImage(t,0,0); dctx.restore();
}
function rotCCW(r){ const t=grab(r); dctx.clearRect(r.x,r.y,r.w,r.h); dctx.save(); dctx.setTransform(0,-1,1,0,r.x,r.y+r.h); dctx.drawImage(t,0,0); dctx.restore(); }
function rot90(r,dir){
  if(r.w===r.h){ if(dir>0) rotRect(r); else rotCCW(r); }
  else { rotCenter(r,dir>0?90:-90); toast('Not square: rotated around the center and cropped to fit'); }
}

const tpRow=(label,p,min,max,val,unit='')=>`<div class="tpr"><span>${label}</span><input type="range" data-p="${p}" min="${min}" max="${max}" value="${val}"><output data-o="${p}" data-u="${unit}">${val}${unit}</output></div>`;
const tpChk=(label,p,v)=>`<label class="tpc"><input type="checkbox" data-p="${p}" ${v?'checked':''}>&nbsp;${label}</label>`;
const tpSel=(label,p,opts,v)=>`<div class="tpr"><span>${label}</span><select data-p="${p}" style="grid-column:2/4">${opts.map(([val,t])=>`<option value="${val}" ${String(val)===String(v)?'selected':''}>${t}</option>`).join('')}</select></div>`;
const tpScope=v=>tpSel('Applies to','scope',[['sel','Selected cells / selection'],['layer','Whole layer']],v);
const tpFoot=()=>`<div class="tpf"><span class="info" id="tpInfo"></span><span class="sp"></span><button data-act="reset">Reset</button><button class="pri" data-act="apply">Apply</button></div>`;
function tpBuild(){
  const box=$('#tp'), tool=TP.tool; if(!tool){ box.style.display='none'; return; }
  const P=TP.params[tool]; let h=`<h4>${TP_TITLE[tool]}</h4>`;
  if(tool==='adjust') h+=tpRow('Width ±','dw',-64,64,P.dw,' px')+tpRow('Height ±','dh',-64,64,P.dh,' px')+tpRow('Shear ↔','shh',-64,64,P.shh,' px')+tpRow('Shear ↕','shv',-64,64,P.shv,' px')
    +`<div class="dim" style="font-size:11px;margin:2px 0 6px">Pixel-exact: width and height add or drop whole rows and columns; shear shifts whole rows. No blurring, no half pixels.</div>`
    +tpSel('Anchor ↔','ah',[[0,'Left'],[.5,'Center'],[1,'Right']],P.ah)+tpSel('Anchor ↕','av',[[0,'Top'],[.5,'Middle'],[1,'Bottom']],P.av)+tpFoot();
  else if(tool==='rotate') h+=tpRow('Angle','angle',-180,180,P.angle,'°')
    +`<div class="tpb"><button data-act="ccw" title="Rotate 90° counter-clockwise">⟲ 90°</button><button data-act="cw" title="Rotate 90° clockwise">⟳ 90°</button><button data-act="r180">180°</button><button data-act="fh">Flip ↔</button><button data-act="fv">Flip ↕</button></div>`
    +`<div class="dim" style="font-size:11px;margin-top:6px">The buttons apply at once. The slider previews, then Apply.</div>`+tpFoot();
  else if(tool==='noise') h+=tpRow('Amount','amt',0,100,P.amt)+`<div style="margin:6px 0 2px;color:var(--dim)">Noise affects</div>`+tpChk('Hue','hue',P.hue)+tpChk('Saturation','sat',P.sat)+tpChk('Lightness','lig',P.lig)
    +tpScope(P.scope)+`<div class="tpb"><button data-act="reroll">🎲 New pattern</button></div>`+tpFoot();
  else if(tool==='colorize') h+=tpRow('Hue','hue',-180,180,P.hue,'°')+tpRow('Saturation','sat',-100,100,P.sat)+tpRow('Lightness','lig',-100,100,P.lig)+tpScope(P.scope)+tpFoot();
  else if(tool==='gradient'){
    h+=tpSel('Type','g:type',[['linear','Linear'],['radial','Radial']],GR.type)
      +tpSel('Fills','g:area',[['contig','Region (like the bucket)'],['global','Every matching pixel'],['cell','Whole cell / selection']],GR.area)
      +`<div class="tpr"><span>Bands</span><input type="number" min="0" max="32" data-p="g:bands" value="${GR.bands}" title="0 = smooth. 4–8 gives a pixel-art stepped look."><span style="grid-column:3;color:var(--dim);font-size:11px">0=smooth</span></div>`
      +`<div id="tpBar"><i></i></div><div id="tpStops"></div>`
      +`<div class="tpb"><button data-act="gadd">+ Stop</button><button data-act="grev">⇄ Reverse</button><button data-act="gfb">Fg → Bg</button></div>`
      +`<div class="dim" style="font-size:11px;margin-top:8px">Drag on the canvas from the start to the end of the gradient. Radial: start is the center, the drag length is the radius.</div>`;
  }
  box.innerHTML=h; box.style.display='block';
  if(tool==='gradient') tpStops();
}
function gradSorted(){ return [...GR.stops].sort((a,b)=>a.p-b.p); }
function tpStops(){
  const el=$('#tpStops'); if(!el) return; el.innerHTML='';
  GR.stops.forEach((st,i)=>{ const d=document.createElement('div'); d.className='gs';
    d.innerHTML=`<input type="color" data-gs="${i}" data-k="c" value="${st.c}"><input type="number" data-gs="${i}" data-k="p" min="0" max="100" value="${st.p}" title="Position %"><input type="number" data-gs="${i}" data-k="a" min="0" max="255" value="${st.a}" title="Opacity 0–255"><button class="mini" data-act="gdel" data-i="${i}" title="Remove stop" ${GR.stops.length<=2?'disabled':''}>✕</button>`;
    el.appendChild(d); });
  gradBar();
}
function gradBar(){ const b=$('#tpBar i'); if(!b) return; b.style.background='linear-gradient(to right,'+gradSorted().map(s=>{ const c=hexToColor(s.c,s.a); return `rgba(${c.r},${c.g},${c.b},${s.a/255}) ${s.p}%`; }).join(',')+')'; }
function gradLUT(){
  const st=gradSorted().map(s=>({p:s.p/100,...hexToColor(s.c,s.a)})), lut=new Uint8ClampedArray(256*4);
  for(let i=0;i<256;i++){
    let t=i/255; if(GR.bands>1){ const k=Math.min(GR.bands-1,Math.floor(t*GR.bands)); t=k/(GR.bands-1); }
    let a=st[0], b=st[st.length-1];
    if(t<=st[0].p) b=a; else if(t>=b.p) a=b; else for(let j=0;j<st.length-1;j++) if(t>=st[j].p&&t<=st[j+1].p){ a=st[j]; b=st[j+1]; break; }
    const span=b.p-a.p, f=span>0?(t-a.p)/span:0;
    lut[i*4]=a.r+(b.r-a.r)*f; lut[i*4+1]=a.g+(b.g-a.g)*f; lut[i*4+2]=a.b+(b.b-a.b)*f; lut[i*4+3]=a.a+(b.a-a.a)*f;
  }
  return lut;
}
function regionMask(x,y,L,mode,allow){
  const n=L.w*L.h, mask=new Uint8Array(n), ok=i=>!allow||allow[i];
  if(mode==='cell'){ if(allow) mask.set(allow); else mask.fill(1); return mask; }
  const img=dctx.getImageData(L.x,L.y,L.w,L.h), px=new Uint32Array(img.data.buffer), norm=v=>(v>>>24)===0?0:v, start=(y-L.y)*L.w+(x-L.x), target=norm(px[start]);
  if(mode==='global'){ for(let i=0;i<n;i++) if(ok(i)&&norm(px[i])===target) mask[i]=1; return mask; }
  const stack=new Int32Array(n+1); let sp=0; stack[sp++]=start; mask[start]=1;
  while(sp){ const i=stack[--sp], cx=i%L.w, cy=(i-cx)/L.w;
    if(cx>0&&!mask[i-1]&&ok(i-1)&&norm(px[i-1])===target){ mask[i-1]=1; stack[sp++]=i-1; }
    if(cx<L.w-1&&!mask[i+1]&&ok(i+1)&&norm(px[i+1])===target){ mask[i+1]=1; stack[sp++]=i+1; }
    if(cy>0&&!mask[i-L.w]&&ok(i-L.w)&&norm(px[i-L.w])===target){ mask[i-L.w]=1; stack[sp++]=i-L.w; }
    if(cy<L.h-1&&!mask[i+L.w]&&ok(i+L.w)&&norm(px[i+L.w])===target){ mask[i+L.w]=1; stack[sp++]=i+L.w; } }
  return mask;
}
function gradPixels(d,img){
  const lut=gradLUT(), L=d.L, out=img.data, sx=d.start.x, sy=d.start.y, vx=d.cur.x-sx, vy=d.cur.y-sy, len2=vx*vx+vy*vy, rad=Math.sqrt(len2), radial=GR.type==='radial';
  for(let i=0;i<d.mask.length;i++){ if(!d.mask[i]) continue;
    const x=L.x+i%L.w, y=L.y+Math.floor(i/L.w), dx=x-sx, dy=y-sy; let t;
    if(radial) t=rad>0?Math.hypot(dx,dy)/rad:0; else t=len2>0?(dx*vx+dy*vy)/len2:0;
    const k=Math.max(0,Math.min(255,Math.round(t*255)))*4, o=i*4;
    out[o]=lut[k]; out[o+1]=lut[k+1]; out[o+2]=lut[k+2]; out[o+3]=lut[k+3]; }
}
function updateGradPreview(){
  const d=drag, pg=preview.getContext('2d'); pg.clearRect(0,0,preview.width,preview.height);
  const img=new ImageData(d.L.w,d.L.h); gradPixels(d,img); pg.putImageData(img,d.L.x,d.L.y); changed();
}
$('#tp').addEventListener('input',e=>{
  const el=e.target; let p=el.dataset.p;
  if(el.dataset.gs!==undefined){            // gradient stop editing
    const st=GR.stops[+el.dataset.gs], k=el.dataset.k; if(!st) return;
    st[k]= k==='c'?el.value:clamp(Math.round(+el.value||0),0,k==='p'?100:255); store.set('gr',GR); gradBar(); return;
  }
  if(!p) return;
  if(p.startsWith('g:')){ p=p.slice(2); GR[p]=el.type==='number'?clamp(Math.round(+el.value||0),0,32):el.value; store.set('gr',GR); return; }
  const P=TP.params[TP.tool]; if(!P) return;
  P[p]= el.type==='checkbox'?el.checked : el.tagName==='SELECT'?(p==='scope'?el.value:parseFloat(el.value)) : Number(el.value);
  const o=$('#tp output[data-o="'+p+'"]'); if(o) o.textContent=el.value+(o.dataset.u||'');
  tpRender();
});
$('#tp').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act, P=TP.params[TP.tool];
  if(a==='apply') tpApply();
  else if(a==='reset') tpCancel();
  else if(a==='reroll'){ P.seed++; tpRender(); }
  else if(a==='cw') tpInstant('Rotate 90° CW',r=>rot90(r,1));
  else if(a==='ccw') tpInstant('Rotate 90° CCW',r=>rot90(r,-1));
  else if(a==='r180') tpInstant('Rotate 180°',r=>flipRect(r,true,true));
  else if(a==='fh') tpInstant('Flip H',r=>flipRect(r,true,false));
  else if(a==='fv') tpInstant('Flip V',r=>flipRect(r,false,true));
  else if(a==='gadd'){ const lut=gradLUT(), c=hexToColor('#000000'); GR.stops.push({p:50,c:'#'+[lut[512],lut[513],lut[514]].map(v=>hex2(Math.round(v))).join(''),a:255}); store.set('gr',GR); tpStops(); }
  else if(a==='gdel'){ if(GR.stops.length>2){ GR.stops.splice(+b.dataset.i,1); store.set('gr',GR); tpStops(); } }
  else if(a==='grev'){ GR.stops.forEach(s=>s.p=100-s.p); store.set('gr',GR); tpStops(); }
  else if(a==='gfb'){ GR.stops=[{p:0,c:toHex(S.fg),a:S.fg.a},{p:100,c:toHex(S.bg),a:S.bg.a}]; store.set('gr',GR); tpStops(); }
});
