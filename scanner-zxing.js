// ZXing Browser scanner engine with live decode diagnostics.
let jobControls=null, inventoryControls=null, zxingJobVideo=null, zxingInventoryVideo=null;
let jobAttempts=0, inventoryAttempts=0, jobStartedAt=0, inventoryStartedAt=0;

function ensureZXing(){return window.ZXingBrowser && window.ZXingBrowser.BrowserMultiFormatReader;}
function makeVideo(container){container.innerHTML='';const wrap=document.createElement('div');wrap.className='zxing-wrap';const video=document.createElement('video');video.setAttribute('playsinline','');video.setAttribute('autoplay','');video.muted=true;video.className='zxing-video';const guide=document.createElement('div');guide.className='zxing-guide';guide.innerHTML='<span>Center the full barcode here</span>';wrap.append(video,guide);container.appendChild(wrap);return video;}
function constraints(){return {audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}};}
function codeText(result){return normalize(result?.getText?.()||result?.text||'');}
function reader(){return new window.ZXingBrowser.BrowserMultiFormatReader(undefined,{delayBetweenScanAttempts:80,delayBetweenScanSuccess:250});}
function elapsed(start){return ((Date.now()-start)/1000).toFixed(1);}

async function startScanner(){
  if(!ensureZXing()){els.status.textContent='Scanner engine did not load. Refresh this page.';return;}
  await stopScanner(false);
  try{
    jobAttempts=0;jobStartedAt=Date.now();
    els.reader.classList.remove('hidden');els.startScan.disabled=true;els.stopScan.disabled=false;
    els.status.textContent='Camera open — decoder starting…';
    zxingJobVideo=makeVideo(els.reader);
    const r=reader();
    jobControls=await r.decodeFromConstraints(constraints(),zxingJobVideo,(result,error)=>{
      jobAttempts++;
      if(result){
        const code=codeText(result),now=Date.now();
        if(!code||(code===lastScan.value&&now-lastScan.time<1500))return;
        lastScan={value:code,time:now};
        els.status.textContent=`BARCODE CAPTURED: ${code}`;
        captureFeedback();addCode(code);return;
      }
      if(jobAttempts===1 || jobAttempts%5===0){
        els.status.textContent=`Scanner ACTIVE — ${jobAttempts} decode attempts in ${elapsed(jobStartedAt)}s. No barcode decoded yet.`;
      }
    });
    els.status.textContent='Scanner ACTIVE — decoder is processing camera frames…';
  }catch(e){
    els.status.textContent=`Scanner error: ${e?.message||e}`;els.startScan.disabled=false;els.stopScan.disabled=true;
  }
}

async function stopScanner(update=true){
  try{jobControls?.stop();}catch(_){}jobControls=null;
  if(zxingJobVideo?.srcObject)try{zxingJobVideo.srcObject.getTracks().forEach(t=>t.stop());}catch(_){}
  zxingJobVideo=null;
  if(els.reader){els.reader.innerHTML='';els.reader.classList.add('hidden');}
  if(els.startScan)els.startScan.disabled=false;if(els.stopScan)els.stopScan.disabled=true;
  if(update&&els.status)els.status.textContent=`Scanner stopped. ${jobAttempts} decode attempts were made.`;
}

async function startInventoryScanner(){
  if(!ensureZXing()){els.inventoryStatus.textContent='Scanner engine did not load. Refresh this page.';return;}
  await stopInventoryScanner(false);
  try{
    inventoryAttempts=0;inventoryStartedAt=Date.now();
    els.inventoryReader.classList.remove('hidden');els.inventoryScan.disabled=true;els.inventoryStop.disabled=false;
    els.inventoryStatus.textContent='Camera open — decoder starting…';
    zxingInventoryVideo=makeVideo(els.inventoryReader);
    const r=reader();
    inventoryControls=await r.decodeFromConstraints(constraints(),zxingInventoryVideo,async(result,error)=>{
      inventoryAttempts++;
      if(result){
        const code=codeText(result),now=Date.now();
        if(!code||(code===lastScan.value&&now-lastScan.time<1500))return;
        lastScan={value:code,time:now};
        els.inventoryStatus.textContent=`BARCODE CAPTURED: ${code}`;
        captureFeedback();
        const existing=findItem(code);
        if(existing.item){els.inventoryStatus.textContent=`Captured ${code} — already in inventory: ${existing.item.partNumber} — ${existing.item.description}`;return;}
        await stopInventoryScanner(false);openNewItemForm(code);return;
      }
      if(inventoryAttempts===1 || inventoryAttempts%5===0){
        els.inventoryStatus.textContent=`Scanner ACTIVE — ${inventoryAttempts} decode attempts in ${elapsed(inventoryStartedAt)}s. No barcode decoded yet.`;
      }
    });
    els.inventoryStatus.textContent='Scanner ACTIVE — decoder is processing camera frames…';
  }catch(e){
    els.inventoryStatus.textContent=`Scanner error: ${e?.message||e}`;els.inventoryScan.disabled=false;els.inventoryStop.disabled=true;
  }
}

async function stopInventoryScanner(update=true){
  try{inventoryControls?.stop();}catch(_){}inventoryControls=null;
  if(zxingInventoryVideo?.srcObject)try{zxingInventoryVideo.srcObject.getTracks().forEach(t=>t.stop());}catch(_){}
  zxingInventoryVideo=null;
  if(els.inventoryReader){els.inventoryReader.innerHTML='';els.inventoryReader.classList.add('hidden');}
  if(els.inventoryScan)els.inventoryScan.disabled=false;if(els.inventoryStop)els.inventoryStop.disabled=true;
  if(update&&els.inventoryStatus)els.inventoryStatus.textContent=`Scanner stopped. ${inventoryAttempts} decode attempts were made.`;
}
