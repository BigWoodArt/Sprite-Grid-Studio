"use strict";
// Start-up

/* ---------- boot ---------- */
new ResizeObserver(resizeView).observe($('#stage'));
$('#ver').textContent='v'+APP_VERSION;
buildTools(); setTool('pencil'); renderPalettes(); syncColorUI();
anim.fps=store.get('fps',6); $('#aFps').value=anim.fps; $('#aFpsV').textContent=anim.fps;
setDoc(S.cols*S.fw, S.rows*S.fh);
S.cellSel=new Set([key(0,0)]);
resizeView(); fitView(); resetHistory('New'); changed(true); updateAnimPattern(); renderTabs();
requestAnimationFrame(animLoop);
sessionRestore();
window.SGS = {S, doc:()=>doc, dctx:()=>dctx, HIST}; // handy for debugging
