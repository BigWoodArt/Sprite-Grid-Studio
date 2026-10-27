"use strict";
// Animation preview

/* ---------- animation ---------- */
const anim={playing:true, fps:6, ping:false, mode:'row', all:false, pat:'', bg:'checker', step:0, acc:0, last:0};
const ac=$('#anim'), actx=ac.getContext('2d');
function parseList(str,max){
  const out=[]; for(const part of str.split(/[\s,;]+/).filter(Boolean)){
    const m=part.match(/^(\d+)-(\d+)$/);
    if(m){ let a=+m[1], b=+m[2]; const dir=a<=b?1:-1; for(let i=a;i!==b+dir;i+=dir) if(i>=1&&i<=max) out.push(i-1); }
    else if(/^\d+$/.test(part)){ const v=+part; if(v>=1&&v<=max) out.push(v-1); }
  } return out;
}
function seqForRow(r){
  const cols=anim.pat.trim()? parseList(anim.pat,S.cols) : [...Array(S.cols).keys()];
  return cols.map(c=>({c,r}));
}
function currentSeqs(){
  let seqs;
  if(anim.mode==='row') seqs = anim.all ? [...Array(S.rows).keys()].map(seqForRow) : [seqForRow(S.active.r)];
  else if(anim.mode==='col'){
    const rows=anim.pat.trim()? parseList(anim.pat,S.rows):[...Array(S.rows).keys()];
    seqs=[rows.map(r=>({c:S.active.c,r}))];
  } else if(anim.mode==='sel'){ seqs=[selCells().length?selCells():[{...S.active}]]; }
  else { const n=S.cols*S.rows; seqs=[parseList(anim.pat,n).map(i=>({c:i%S.cols,r:Math.floor(i/S.cols)}))]; }
  seqs = seqs.map(s=>s.length?s:[{...S.active}]);
  if(anim.ping) seqs = seqs.map(s=>s.length>2? s.concat(s.slice(1,-1).reverse()) : s);
  return seqs;
}
function animLayout(seqs, scale){
  const per = seqs.length>1 ? Math.min(4,seqs.length) : 1;
  const linesN = Math.ceil(seqs.length/per);
  return {per, linesN, W:per*S.fw*scale, H:linesN*S.fh*scale};
}
function composeFrame(seqs, i, scale, ctx){
  refreshComp(); const L=animLayout(seqs,scale); ctx.imageSmoothingEnabled=false;
  seqs.forEach((s,k)=>{
    const cell=s[i%s.length], x=(k%L.per)*S.fw*scale, y=Math.floor(k/L.per)*S.fh*scale;
    ctx.drawImage(comp,cell.c*S.fw,cell.r*S.fh,S.fw,S.fh,x,y,S.fw*scale,S.fh*scale);
  });
}
function drawAnim(){
  const seqs=currentSeqs(), n=Math.max(...seqs.map(s=>s.length));
  const per = seqs.length>1?Math.min(4,seqs.length):1, lines=Math.ceil(seqs.length/per);
  const scale=Math.max(1,Math.floor(Math.min(250/(S.fw*per), 190/(S.fh*lines))));
  const L=animLayout(seqs,scale);
  if(ac.width!==L.W||ac.height!==L.H){ ac.width=L.W; ac.height=L.H; }
  ac.style.width=L.W+'px'; ac.style.height=L.H+'px';
  actx.clearRect(0,0,ac.width,ac.height);
  if(anim.bg!=='checker'){ actx.fillStyle=anim.bg; actx.fillRect(0,0,ac.width,ac.height); }
  composeFrame(seqs, anim.step%n, scale, actx);
  // highlight playing cell in the list
  const cur=seqs[0][anim.step%seqs[0].length];
  thumbs.forEach(t=>t.el.classList.toggle('play', anim.playing && seqs.length===1 && t.c===cur.c && t.r===cur.r));
  return n;
}
// The Animation section can be folded away; while it is hidden nothing is drawn or advanced
S.animFold=false;
setupFold('animSec','animFold','animFold',f=>{ S.animFold=f; if(f) thumbs.forEach(t=>t.el.classList.remove('play')); });
function animLoop(ts){
  if(S.animFold){ anim.last=0; requestAnimationFrame(animLoop); return; }
  const n=drawAnim();
  if(anim.playing){
    const dt=ts-(anim.last||ts); anim.last=ts; anim.acc+=dt;
    const per=1000/anim.fps; while(anim.acc>=per){ anim.acc-=per; anim.step=(anim.step+1)%Math.max(1,n); }
  } else anim.last=0;
  requestAnimationFrame(animLoop);
}
function updateAnimPattern(){
  const m=anim.mode; $('#aPatL').style.display=(m==='sel')?'none':'';
  $('#aPat').placeholder = m==='row'?'column order, e.g. 2,1,2,3 (blank = all)': m==='col'?'row order, e.g. 1-3 (blank = all)':'cell numbers, e.g. 1,2,3,2 (row-major)';
  $('#aAll').disabled = m!=='row';
}
$('#aPlay').onclick=()=>{ anim.playing=!anim.playing; $('#aPlay').textContent=anim.playing?'❚❚':'▶'; $('#aPlay').classList.toggle('on',anim.playing); };
$('#aFps').oninput=e=>{ anim.fps=+e.target.value; $('#aFpsV').textContent=anim.fps; store.set('fps',anim.fps); };
$('#aPing').onchange=e=>anim.ping=e.target.checked;
$('#aMode').onchange=e=>{ anim.mode=e.target.value; updateAnimPattern(); };
$('#aAll').onchange=e=>anim.all=e.target.checked;
$('#aPat').oninput=e=>anim.pat=e.target.value;
$('#aBg').onchange=e=>{ anim.bg=e.target.value; $('#animWrap').classList.toggle('chk',anim.bg==='checker'); };
$('#aGif').onclick=()=>exportGifDialog();
