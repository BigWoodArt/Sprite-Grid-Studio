"use strict";
// GIF encoder and export

/* ---------- GIF encoder ---------- */
function lzw(indices,minBits){
  const clear=1<<minBits, eoi=clear+1; let size=minBits+1, next=eoi+1, dict=new Map(), out=[], cur=0, nb=0;
  const emit=c=>{ cur|=c<<nb; nb+=size; while(nb>=8){ out.push(cur&255); cur>>>=8; nb-=8; } };
  emit(clear); let prefix=indices[0];
  for(let i=1;i<indices.length;i++){
    const k=indices[i], kk=(prefix<<8)|k, f=dict.get(kk);
    if(f!==undefined){ prefix=f; continue; }
    emit(prefix);
    if(next===4096){ emit(clear); dict=new Map(); size=minBits+1; next=eoi+1; }
    else { dict.set(kk,next++); if(next>(1<<size)) size++; }
    prefix=k;
  }
  emit(prefix); emit(eoi); if(nb>0) out.push(cur&255);
  const blocks=[]; for(let i=0;i<out.length;i+=255){ const ch=out.slice(i,i+255); blocks.push(ch.length,...ch); } blocks.push(0);
  return blocks;
}
function encodeGif(frames,w,h,fps){
  // frames: array of Uint8ClampedArray RGBA
  const counts=new Map(); let hasTrans=false;
  for(const f of frames) for(let i=0;i<f.length;i+=4){ if(f[i+3]<128){hasTrans=true;continue;} const k=(f[i]<<16)|(f[i+1]<<8)|f[i+2]; counts.set(k,(counts.get(k)||0)+1); }
  const base=hasTrans?1:0, maxC=256-base;
  let colors=[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
  const keep=colors.slice(0,maxC), idx=new Map(); keep.forEach((k,i)=>idx.set(k,i+base));
  const nearest=k=>{ if(idx.has(k)) return idx.get(k); const r=k>>16,g=(k>>8)&255,b=k&255; let best=0,bd=1e9;
    keep.forEach((q,i)=>{ const dr=(q>>16)-r,dg=((q>>8)&255)-g,db=(q&255)-b,d=dr*dr+dg*dg+db*db; if(d<bd){bd=d;best=i+base;} }); idx.set(k,best); return best; };
  const pal=new Uint8Array(768); keep.forEach((k,i)=>{ pal[(i+base)*3]=k>>16; pal[(i+base)*3+1]=(k>>8)&255; pal[(i+base)*3+2]=k&255; });
  const o=[]; const w16=v=>o.push(v&255,(v>>8)&255); const str=s=>{for(const c of s)o.push(c.charCodeAt(0));};
  str('GIF89a'); w16(w); w16(h); o.push(0xF7,0,0); for(const v of pal) o.push(v);
  o.push(0x21,0xFF,11); str('NETSCAPE2.0'); o.push(3,1,0,0,0);
  const delay=Math.max(2,Math.round(100/fps));
  for(const f of frames){
    o.push(0x21,0xF9,4,(2<<2)|(hasTrans?1:0)); w16(delay); o.push(0,0);
    o.push(0x2C); w16(0); w16(0); w16(w); w16(h); o.push(0);
    const ix=new Uint8Array(w*h);
    for(let i=0,p=0;i<f.length;i+=4,p++){ ix[p]= f[i+3]<128 ? 0 : nearest((f[i]<<16)|(f[i+1]<<8)|f[i+2]); }
    o.push(8); const data=lzw(ix,8); for(const b of data) o.push(b);
  }
  o.push(0x3B); return new Uint8Array(o);
}
function exportGifDialog(){
  const seqs=currentSeqs(), n=Math.max(...seqs.map(s=>s.length));
  const defScale=clamp(Math.ceil(192/Math.max(S.fw*animLayout(seqs,1).per,S.fh*animLayout(seqs,1).linesN)),1,8);
  modal('Export animation as GIF',`
    <div class="grid2"><span>Scale</span><input type="number" id="gScale" min="1" max="16" value="${defScale}">
    <span>FPS</span><input type="number" id="gFps" min="1" max="50" value="${anim.fps}">
    <span>Background</span><select id="gBg"><option value="">Transparent</option><option value="#ffffff">White</option><option value="#000000">Black</option><option value="#808080">Grey</option></select></div>
    <div class="info">${n} frame${n>1?'s':''} · uses the current Play settings (mode, order, ping-pong)</div>`,
    ()=>{
      const sc=clamp(+$('#gScale').value||1,1,16), fps=clamp(+$('#gFps').value||6,1,50), bg=$('#gBg').value;
      const L=animLayout(seqs,sc), cv=mk(L.W,L.H), g=cv.getContext('2d',{willReadFrequently:true}), frames=[];
      for(let i=0;i<n;i++){ g.clearRect(0,0,L.W,L.H); if(bg){g.fillStyle=bg;g.fillRect(0,0,L.W,L.H);} composeFrame(seqs,i,sc,g); frames.push(g.getImageData(0,0,L.W,L.H).data); }
      const bytes=encodeGif(frames,L.W,L.H,fps);
      download(new Blob([bytes],{type:'image/gif'}), baseName()+'.gif'); toast('Saved GIF ('+Math.round(bytes.length/1024)+' KB)');
      return true;
    }, 'Export');
}
