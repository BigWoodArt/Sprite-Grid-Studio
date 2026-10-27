"use strict";
// Opening and saving files and projects

/* ---------- file I/O ---------- */
const baseName = () => S.name.replace(/\.[^.]+$/,'');
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }
const blobOf = () => { refreshComp(); return new Promise(r=>comp.toBlob(r,'image/png')); };
function loadImage(blob){ return new Promise((res,rej)=>{ const u=URL.createObjectURL(blob), im=new Image(); im.onload=()=>{URL.revokeObjectURL(u);res(im);}; im.onerror=rej; im.src=u; }); }
async function openFile(file,handle){
  if(!file) return;
  if(/\.gchproj$/i.test(file.name)) return openProject(file,handle);
  if(!(await confirmDiscard())) return;
  let img; try{ img=await loadImage(file); }catch(e){ toast('Could not read that image'); return; }
  const memo=store.get('grid:'+file.name+':'+img.width+'x'+img.height,null);
  let g=memo; if(g && (img.width%g.fw||img.height%g.fh)) g=null;
  let cands=[]; try{ cands=detectGrid(img); }catch(e){ console.warn('grid detect failed',e); }
  if(!g && cands.length) g=cands[0];
  if(!g){ const lg=store.get('lastGrid',null); if(lg && img.width%lg.fw===0 && img.height%lg.fh===0) g=lg; }
  const v=await gridDialog({mode:'open',img,cands,cols:g?img.width/g.fw:1,rows:g?img.height/g.fh:1,fw:g?g.fw:img.width,fh:g?g.fh:img.height});
  if(!v) return;
  openTabSlot();
  S.fw=v.fw;S.fh=v.fh;S.cols=v.cols;S.rows=v.rows; setDoc(S.cols*S.fw,S.rows*S.fh); dctx.drawImage(img,0,0);
  store.set('grid:'+file.name+':'+img.width+'x'+img.height,{fw:v.fw,fh:v.fh}); store.set('lastGrid',{cols:v.cols,rows:v.rows,fw:v.fw,fh:v.fh});
  fresh(file.name,handle||null);
}
async function openDialog(){
  if(window.showOpenFilePicker){
    try{ const [h]=await showOpenFilePicker({types:[{description:'Images and projects',accept:{'image/*':['.png','.gif','.webp','.jpg','.jpeg'],'application/json':['.gchproj']}}]}); return openFile(await h.getFile(),h); }
    catch(e){ if(e&&e.name==='AbortError') return; }
  }
  $('#fileIn').click();
}
$('#fileIn').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; openFile(f,null); };
async function save(as){
  commitFloat();
  if(!as && S.projHandle) return saveProject(false);   // a project opened from / saved to a .gchproj saves back to it
  const blob=await blobOf();
  if(window.showSaveFilePicker){
    try{
      let h=S.handle; if(!h||as) h=await showSaveFilePicker({suggestedName:baseName()+'.png',types:[{description:'PNG image',accept:{'image/png':['.png']}}]});
      const w=await h.createWritable(); await w.write(blob); await w.close();
      S.handle=h; S.name=h.name; S.dirty=false; updateTitle(); toast('Saved '+h.name); return;
    }catch(e){ if(e&&e.name==='AbortError') return; }
  }
  download(blob,S.name.replace(/\.[^.]+$/,'')+'.png'); S.dirty=false; updateTitle(); toast('Downloaded PNG');
}
const PROJ_TYPE={description:'Game Character Hub project',accept:{'application/json':['.gchproj']}};
async function saveProject(as){
  commitFloat();
  const data={format:'gch-project',version:1,frame:{w:S.fw,h:S.fh,cols:S.cols,rows:S.rows},active:activeL,
    layers:layers.map(l=>({name:l.name,visible:l.visible,opacity:l.opacity,png:l.cv.toDataURL('image/png')}))};
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  if(window.showSaveFilePicker){
    try{
      let h=S.projHandle; if(!h||as) h=await showSaveFilePicker({suggestedName:baseName()+'.gchproj',types:[PROJ_TYPE]});
      const w=await h.createWritable(); await w.write(blob); await w.close();
      S.projHandle=h; S.name=h.name; S.dirty=false; updateTitle(); toast('Saved project '+h.name); return;
    }catch(e){ if(e&&e.name==='AbortError') return; }
  }
  download(blob,baseName()+'.gchproj'); S.dirty=false; updateTitle(); toast('Downloaded project file');
}
// Open an image with an already-known grid and no dialog (used when reopening the last session)
async function openImageWithGrid(file,handle,g){
  let img; try{ img=await loadImage(file); }catch(e){ return false; }
  if(!g||img.width!==g.cols*g.fw||img.height!==g.rows*g.fh) return false;        // file changed on disk: caller falls back to the normal dialog
  openTabSlot(); S.fw=g.fw; S.fh=g.fh; S.cols=g.cols; S.rows=g.rows; setDoc(img.width,img.height); dctx.drawImage(img,0,0);
  fresh(file.name,handle||null); return true;
}
async function openProject(file,handle){
  let data; try{ data=JSON.parse(await file.text()); }catch(e){ toast('That is not a readable project file'); return; }
  if(!data||data.format!=='gch-project'||!Array.isArray(data.layers)||!data.layers.length||!data.frame){ toast('That is not a Game Character Hub project'); return; }
  let imgs; try{ imgs=await Promise.all(data.layers.map(l=>new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=l.png; }))); }
  catch(e){ toast('A layer in that project could not be read'); return; }
  openTabSlot();
  const f=data.frame, w=f.w*f.cols, h=f.h*f.rows; S.fw=f.w; S.fh=f.h; S.cols=f.cols; S.rows=f.rows; setDoc(w,h);
  layers=data.layers.map((l,i)=>{ const L=newLayer(w,h,l.name||('Layer '+(i+1))); L.visible=l.visible!==false; L.opacity=l.opacity??255; L.ctx.drawImage(imgs[i],0,0); return L; });
  layerCount=layers.length; useLayer(clamp(data.active??layers.length-1,0,layers.length-1));
  fresh(file.name,null); S.projHandle=handle||null; updateTitle();
}
$('#bSaveProj').onclick=e=>saveProject(e.shiftKey);
$('#selWarnClear').onclick=()=>{ commitFloat(); S.sel=null; selHistory('Deselect'); $('#selWarn').classList.remove('show'); changed(true); toast('Selection cleared'); };
$('#selWarnOk').onclick=()=>$('#selWarn').classList.remove('show');
$('#bNew').onclick=newDoc; $('#bOpen').onclick=openDialog; $('#bSave').onclick=()=>save(false); $('#bSaveAs').onclick=()=>save(true);
$('#bUndo').onclick=undo; $('#bRedo').onclick=redo;
window.addEventListener('beforeunload',e=>{ if(needsWarning()){ e.preventDefault(); e.returnValue=''; } });
// drag & drop files / paste images
let dragDepth=0;
window.addEventListener('dragenter',e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){ dragDepth++; $('#dropHint').classList.add('show'); } });
window.addEventListener('dragleave',()=>{ dragDepth=Math.max(0,dragDepth-1); if(!dragDepth) $('#dropHint').classList.remove('show'); });
window.addEventListener('dragover',e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop',async e=>{
  dragDepth=0; $('#dropHint').classList.remove('show');
  const f=e.dataTransfer&&e.dataTransfer.files[0]; if(!f) return; e.preventDefault();
  let h=null; try{ const it=e.dataTransfer.items[0]; if(it&&it.getAsFileSystemHandle) h=await it.getAsFileSystemHandle(); }catch(_){}
  openFile(f,h&&h.kind==='file'?h:null);
});
window.addEventListener('paste',async e=>{
  if(modalOpen()||/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const it=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));
  if(it){ e.preventDefault(); const im=await loadImage(it.getAsFile()); const cv=mk(im.width,im.height); cv.getContext('2d').drawImage(im,0,0);
    commitFloat(); startFloat(cv,S.active.c*S.fw,S.active.r*S.fh,'Paste image'); setTool('move'); }
});
