// Truck Count mode. Kept separate from app.js so the proven Job/Inventory scanner flow stays untouched.
let truckCountControls = null;
let truckCountVideo = null;
let truckCountSelectedItem = null;
let truckCounts = {};

window.addEventListener('DOMContentLoaded', () => {
  const countModeBtn = document.getElementById('count-mode-btn');
  const countMode = document.getElementById('count-mode');
  const countScanBtn = document.getElementById('count-scan-btn');
  const countStopBtn = document.getElementById('count-stop-btn');
  const countReader = document.getElementById('count-reader');
  const countStatus = document.getElementById('count-status');
  const countConfirm = document.getElementById('count-confirm');
  const countPartNumber = document.getElementById('count-part-number');
  const countDescription = document.getElementById('count-description');
  const countCurrent = document.getElementById('count-current');
  const countAddOneBtn = document.getElementById('count-add-one-btn');
  const countEnterQtyBtn = document.getElementById('count-enter-qty-btn');
  const countQtyPanel = document.getElementById('count-qty-panel');
  const countQtyInput = document.getElementById('count-qty-input');
  const countSaveQtyBtn = document.getElementById('count-save-qty-btn');
  const clearTruckCountBtn = document.getElementById('clear-truck-count-btn');
  const truckCountList = document.getElementById('truck-count-list');
  const truckCountBadge = document.getElementById('truck-count-badge');

  try { truckCounts = JSON.parse(localStorage.getItem('kanbanTruckCounts') || '{}') || {}; } catch (_) { truckCounts = {}; }

  function saveTruckCounts(){ localStorage.setItem('kanbanTruckCounts', JSON.stringify(truckCounts)); }

  function showCountMode(){
    try { stopScanner(false); } catch (_) {}
    try { stopInventoryScanner(false); } catch (_) {}
    document.getElementById('job-mode').classList.add('hidden');
    document.getElementById('inventory-mode').classList.add('hidden');
    countMode.classList.remove('hidden');
    document.getElementById('job-mode-btn').classList.remove('active');
    document.getElementById('inventory-mode-btn').classList.remove('active');
    countModeBtn.classList.add('active');
    renderTruckCount();
  }

  function leaveCountMode(){
    stopTruckCountScanner(false);
    countMode.classList.add('hidden');
    countModeBtn.classList.remove('active');
  }

  countModeBtn.addEventListener('click', showCountMode);
  document.getElementById('job-mode-btn').addEventListener('click', leaveCountMode);
  document.getElementById('inventory-mode-btn').addEventListener('click', leaveCountMode);

  function makeCountVideo(){
    countReader.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'zxing-wrap';
    const video = document.createElement('video'); video.setAttribute('playsinline',''); video.setAttribute('autoplay',''); video.muted = true; video.className = 'zxing-video';
    const guide = document.createElement('div'); guide.className = 'zxing-guide'; guide.innerHTML = '<span>Center the full barcode here</span>';
    wrap.append(video, guide); countReader.appendChild(wrap); return video;
  }

  async function startTruckCountScanner(){
    if (!(window.ZXingBrowser && window.ZXingBrowser.BrowserMultiFormatReader)) { countStatus.textContent = 'Scanner engine did not load. Refresh this page.'; return; }
    await stopTruckCountScanner(false);
    truckCountSelectedItem = null; countConfirm.classList.add('hidden'); countQtyPanel.classList.add('hidden');
    try {
      countReader.classList.remove('hidden'); countScanBtn.disabled = true; countStopBtn.disabled = false;
      countStatus.textContent = 'Scanner ACTIVE — point at an inventory barcode.';
      truckCountVideo = makeCountVideo();
      const reader = new window.ZXingBrowser.BrowserMultiFormatReader(undefined,{delayBetweenScanAttempts:80,delayBetweenScanSuccess:250});
      truckCountControls = await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}}, truckCountVideo, async result => {
        if (!result) return;
        const code = normalize(result?.getText?.() || result?.text || ''); if (!code) return;
        const found = findItem(code);
        if (!found.item) { countStatus.textContent = `Captured ${code}, but it is not in inventory.`; captureFeedback(); return; }
        truckCountSelectedItem = found.item;
        await stopTruckCountScanner(false);
        countPartNumber.textContent = `${found.item.partNumber} · ${found.item.id}`;
        countDescription.textContent = found.item.description;
        const current = Number(truckCounts[found.item.id] || 0);
        countCurrent.textContent = `Counted so far: ${current}`;
        countQtyInput.value = String(current || 1);
        countConfirm.classList.remove('hidden');
        countStatus.textContent = `Captured ${found.item.description}. Confirm the quantity below.`;
        captureFeedback();
      });
    } catch (e) {
      countStatus.textContent = `Scanner error: ${e?.message || e}`; countScanBtn.disabled = false; countStopBtn.disabled = true;
    }
  }

  async function stopTruckCountScanner(update=true){
    try { truckCountControls?.stop(); } catch (_) {}
    truckCountControls = null;
    if (truckCountVideo?.srcObject) { try { truckCountVideo.srcObject.getTracks().forEach(t=>t.stop()); } catch (_) {} }
    truckCountVideo = null; countReader.innerHTML = ''; countReader.classList.add('hidden'); countScanBtn.disabled = false; countStopBtn.disabled = true;
    if (update) countStatus.textContent = 'Scanner stopped.';
  }

  function commitQty(qty){
    if (!truckCountSelectedItem) return;
    qty = Math.max(0, Number(qty) || 0);
    if (qty === 0) delete truckCounts[truckCountSelectedItem.id]; else truckCounts[truckCountSelectedItem.id] = qty;
    saveTruckCounts(); renderTruckCount(); countCurrent.textContent = `Counted so far: ${qty}`; countQtyPanel.classList.add('hidden');
    countStatus.textContent = `Saved ${qty} × ${truckCountSelectedItem.description}.`;
  }

  countScanBtn.addEventListener('click', startTruckCountScanner);
  countStopBtn.addEventListener('click', () => stopTruckCountScanner(true));
  countAddOneBtn.addEventListener('click', () => { if (!truckCountSelectedItem) return; commitQty(Number(truckCounts[truckCountSelectedItem.id] || 0) + 1); });
  countEnterQtyBtn.addEventListener('click', () => { countQtyPanel.classList.toggle('hidden'); if (!countQtyPanel.classList.contains('hidden')) countQtyInput.focus(); });
  countSaveQtyBtn.addEventListener('click', () => commitQty(countQtyInput.value));
  countQtyInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitQty(countQtyInput.value); });
  clearTruckCountBtn.addEventListener('click', () => { if (!confirm('Clear the entire truck count?')) return; truckCounts = {}; saveTruckCounts(); renderTruckCount(); countConfirm.classList.add('hidden'); countStatus.textContent = 'Truck count cleared.'; });

  function renderTruckCount(){
    if (!truckCountList) return;
    const rows = inventory.filter(i => Number(truckCounts[i.id] || 0) > 0);
    const pieces = rows.reduce((sum,i)=>sum + Number(truckCounts[i.id]||0),0);
    truckCountBadge.textContent = `${rows.length} counted · ${pieces} pieces`;
    truckCountList.innerHTML = '';
    if (!rows.length) { truckCountList.innerHTML = '<div class="empty-state">No truck inventory counted yet.</div>'; return; }
    rows.forEach(item => {
      const row = document.createElement('div'); row.className = 'inventory-row';
      row.innerHTML = `<div class="part-meta"><div class="part-number">${escapeHtml(item.partNumber)} · ${escapeHtml(item.id)}</div><div class="part-name">${escapeHtml(item.description)}</div><div class="part-stock">Truck count: ${truckCounts[item.id]} · Kanban qty: ${item.kanbanQty ?? 0}</div></div><div class="qty-controls"><button class="qty-btn">−</button><span class="qty">${truckCounts[item.id]}</span><button class="qty-btn">+</button></div>`;
      const buttons = row.querySelectorAll('.qty-btn');
      buttons[0].addEventListener('click',()=>{ const n=Math.max(0,Number(truckCounts[item.id]||0)-1); if(n===0)delete truckCounts[item.id];else truckCounts[item.id]=n;saveTruckCounts();renderTruckCount(); });
      buttons[1].addEventListener('click',()=>{ truckCounts[item.id]=Number(truckCounts[item.id]||0)+1;saveTruckCounts();renderTruckCount(); });
      truckCountList.appendChild(row);
    });
  }

  renderTruckCount();
});
