let inventory = [];
let baseInventory = [];
let customInventory = [];
let counts = {};
let scanner = null;
let inventoryScanner = null;
let lastScan = { value: null, time: 0 };
const els = {};

window.addEventListener('DOMContentLoaded', async () => {
  Object.assign(els, {
    jobMode: document.getElementById('job-mode'), inventoryMode: document.getElementById('inventory-mode'),
    jobModeBtn: document.getElementById('job-mode-btn'), inventoryModeBtn: document.getElementById('inventory-mode-btn'),
    jobName: document.getElementById('job-name'), startScan: document.getElementById('start-scan-btn'), stopScan: document.getElementById('stop-scan-btn'),
    reader: document.getElementById('reader'), status: document.getElementById('scan-status'), manualCode: document.getElementById('manual-code'),
    manualAdd: document.getElementById('manual-add-btn'), materialList: document.getElementById('material-list'), emptyState: document.getElementById('empty-state'),
    badge: document.getElementById('item-count-badge'), summary: document.getElementById('summary-output'), copySummary: document.getElementById('copy-summary-btn'),
    clearJob: document.getElementById('clear-job-btn'), newJob: document.getElementById('new-job-btn'),
    inventoryScan: document.getElementById('inventory-scan-btn'), inventoryStop: document.getElementById('inventory-stop-btn'),
    inventoryReader: document.getElementById('inventory-reader'), inventoryStatus: document.getElementById('inventory-status'), newItemForm: document.getElementById('new-item-form'),
    newBarcode: document.getElementById('new-barcode'), newPartNumber: document.getElementById('new-part-number'), newDescription: document.getElementById('new-description'),
    newKanbanQty: document.getElementById('new-kanban-qty'), newCategory: document.getElementById('new-category'), saveItem: document.getElementById('save-item-btn'),
    cancelItem: document.getElementById('cancel-item-btn'), inventoryList: document.getElementById('inventory-list'), inventoryCountBadge: document.getElementById('inventory-count-badge'),
    inventorySearch: document.getElementById('inventory-search')
  });

  baseInventory = await fetch('inventory.json').then(r => r.json());
  loadCustomInventory();
  rebuildInventory();
  loadState();
  render();
  renderInventory();

  els.jobModeBtn.addEventListener('click', () => switchMode('job'));
  els.inventoryModeBtn.addEventListener('click', () => switchMode('inventory'));
  els.startScan.addEventListener('click', startScanner);
  els.stopScan.addEventListener('click', stopScanner);
  els.manualAdd.addEventListener('click', () => addCode(els.manualCode.value));
  els.manualCode.addEventListener('keydown', e => { if (e.key === 'Enter') addCode(els.manualCode.value); });
  els.jobName.addEventListener('input', saveState);
  els.copySummary.addEventListener('click', copySummary);
  els.clearJob.addEventListener('click', clearJob);
  els.newJob.addEventListener('click', newJob);
  els.inventoryScan.addEventListener('click', startInventoryScanner);
  els.inventoryStop.addEventListener('click', stopInventoryScanner);
  els.saveItem.addEventListener('click', saveNewInventoryItem);
  els.cancelItem.addEventListener('click', resetNewItemForm);
  els.inventorySearch.addEventListener('input', renderInventory);
});

function rebuildInventory() { inventory = [...baseInventory, ...customInventory]; }
function normalize(raw) { return String(raw || '').trim().toUpperCase(); }
function itemBarcodes(item) { return Array.isArray(item.barcodes) ? item.barcodes.map(normalize) : []; }

function findItem(rawCode) {
  const code = normalize(rawCode);
  const kanbanMatch = code.match(/^KANBAN:(KB\d{3})$/);
  const id = kanbanMatch ? kanbanMatch[1] : code;
  const byId = inventory.find(i => normalize(i.id) === id);
  if (byId) return { item: byId };
  const byBarcode = inventory.find(i => itemBarcodes(i).includes(code));
  if (byBarcode) return { item: byBarcode };
  const partMatches = inventory.filter(i => normalize(i.partNumber) === code);
  if (partMatches.length === 1) return { item: partMatches[0] };
  if (partMatches.length > 1) return { duplicate: partMatches };
  return {};
}

function addCode(rawCode) {
  const code = normalize(rawCode); if (!code) return;
  const result = findItem(code);
  if (result.item) {
    counts[result.item.id] = (counts[result.item.id] || 0) + 1;
    els.status.textContent = `Added ${result.item.description} (${result.item.partNumber}).`;
    els.manualCode.value = ''; saveState(); render(); if (navigator.vibrate) navigator.vibrate(60); return;
  }
  if (result.duplicate) { els.status.textContent = `Part ${code} appears more than once. Scan its unique QR/barcode instead.`; return; }
  els.status.textContent = `Code not recognized: ${code}. Add it under Inventory Setup.`;
}

const scanFormats = () => [Html5QrcodeSupportedFormats.QR_CODE,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8];

async function startScanner() {
  if (!window.Html5Qrcode) return els.status.textContent = 'Scanner library did not load. Reload while online.';
  try {
    els.reader.classList.remove('hidden'); els.startScan.disabled = true; els.stopScan.disabled = false; els.status.textContent = 'Starting camera…';
    scanner = new Html5Qrcode('reader');
    await scanner.start({ facingMode:'environment' }, { fps:10, qrbox:{width:250,height:180}, formatsToSupport:scanFormats() }, decodedText => {
      const now=Date.now(); if(decodedText===lastScan.value && now-lastScan.time<1500)return; lastScan={value:decodedText,time:now}; addCode(decodedText);
    });
    els.status.textContent = 'Scanner running. Point at a QR code or barcode.';
  } catch(err) { els.status.textContent=`Camera error: ${err}`; els.startScan.disabled=false; els.stopScan.disabled=true; els.reader.classList.add('hidden'); scanner=null; }
}

async function stopScanner() { if(!scanner)return; try{await scanner.stop();await scanner.clear();}catch(_){} scanner=null; els.reader.classList.add('hidden'); els.startScan.disabled=false; els.stopScan.disabled=true; els.status.textContent='Scanner stopped.'; }

async function startInventoryScanner() {
  if (!window.Html5Qrcode) return els.inventoryStatus.textContent='Scanner library did not load. Reload while online.';
  try {
    els.inventoryReader.classList.remove('hidden'); els.inventoryScan.disabled=true; els.inventoryStop.disabled=false; els.inventoryStatus.textContent='Starting camera…';
    inventoryScanner = new Html5Qrcode('inventory-reader');
    await inventoryScanner.start({ facingMode:'environment' }, { fps:10, qrbox:{width:250,height:180}, formatsToSupport:scanFormats() }, async decodedText => {
      const code=normalize(decodedText); const now=Date.now(); if(code===lastScan.value && now-lastScan.time<1500)return; lastScan={value:code,time:now};
      const existing=findItem(code);
      if(existing.item){ els.inventoryStatus.textContent=`Already in inventory: ${existing.item.partNumber} — ${existing.item.description}`; if(navigator.vibrate)navigator.vibrate([50,40,50]); return; }
      await stopInventoryScanner(false); openNewItemForm(code); if(navigator.vibrate)navigator.vibrate(80);
    });
    els.inventoryStatus.textContent='Scan the manufacturer barcode on the item.';
  } catch(err) { els.inventoryStatus.textContent=`Camera error: ${err}`; els.inventoryScan.disabled=false; els.inventoryStop.disabled=true; els.inventoryReader.classList.add('hidden'); inventoryScanner=null; }
}

async function stopInventoryScanner(updateStatus=true) { if(inventoryScanner){try{await inventoryScanner.stop();await inventoryScanner.clear();}catch(_){} inventoryScanner=null;} els.inventoryReader.classList.add('hidden'); els.inventoryScan.disabled=false; els.inventoryStop.disabled=true; if(updateStatus)els.inventoryStatus.textContent='Scanner stopped.'; }

function openNewItemForm(code) { els.newBarcode.value=code; els.newPartNumber.value=''; els.newDescription.value=''; els.newKanbanQty.value='1'; els.newCategory.value=''; els.newItemForm.classList.remove('hidden'); els.inventoryStatus.textContent=`New barcode found: ${code}. Enter the item details below.`; els.newPartNumber.focus(); }
function resetNewItemForm(){ els.newItemForm.classList.add('hidden'); els.newBarcode.value=''; els.inventoryStatus.textContent='Ready to build inventory.'; }

function nextLocalId(){ let n=1; const ids=new Set(customInventory.map(i=>i.id)); while(ids.has(`LOCAL${String(n).padStart(3,'0')}`))n++; return `LOCAL${String(n).padStart(3,'0')}`; }
function saveNewInventoryItem(){
  const barcode=normalize(els.newBarcode.value), partNumber=els.newPartNumber.value.trim(), description=els.newDescription.value.trim(), qty=Math.max(0,Number(els.newKanbanQty.value)||0), category=els.newCategory.value.trim();
  if(!barcode || !partNumber || !description){ els.inventoryStatus.textContent='Barcode, part number, and description are required.'; return; }
  const existing=findItem(barcode); if(existing.item){ els.inventoryStatus.textContent='That barcode is already assigned to an inventory item.'; return; }
  const item={id:nextLocalId(),partNumber,description,kanbanQty:qty,category,barcodes:[barcode],source:'local'};
  customInventory.push(item); saveCustomInventory(); rebuildInventory(); resetNewItemForm(); renderInventory(); els.inventoryStatus.textContent=`Saved ${partNumber} — ${description}. This barcode will now work in Job Scan.`;
}

function deleteCustomItem(id){
  const item=customInventory.find(i=>i.id===id); if(!item || !confirm(`Delete ${item.partNumber} — ${item.description}?`))return;
  customInventory=customInventory.filter(i=>i.id!==id); delete counts[id]; saveCustomInventory(); rebuildInventory(); saveState(); render(); renderInventory(); els.inventoryStatus.textContent='Inventory item deleted.';
}

function renderInventory(){
  if(!els.inventoryList)return; const q=normalize(els.inventorySearch.value); const visible=inventory.filter(i=>!q || normalize(`${i.partNumber} ${i.description} ${i.category||''} ${itemBarcodes(i).join(' ')}`).includes(q));
  els.inventoryCountBadge.textContent=`${inventory.length} items`; els.inventoryList.innerHTML='';
  visible.forEach(item=>{ const row=document.createElement('div'); row.className='inventory-row'; const isCustom=customInventory.some(i=>i.id===item.id); row.innerHTML=`<div class="part-meta"><div class="part-number">${escapeHtml(item.partNumber)} · ${escapeHtml(item.id)}</div><div class="part-name">${escapeHtml(item.description)}</div><div class="part-stock">Kanban qty: ${item.kanbanQty ?? 0}${item.category ? ` · ${escapeHtml(item.category)}`:''}</div>${itemBarcodes(item).length?`<div class="barcode-line">Barcode: ${escapeHtml(itemBarcodes(item).join(', '))}</div>`:''}<div class="inventory-source">${isCustom?'Added on this phone':'Starter inventory'}</div></div>${isCustom?'<div class="inventory-actions"><button class="small-btn danger">Delete</button></div>':''}`; if(isCustom)row.querySelector('button').addEventListener('click',()=>deleteCustomItem(item.id)); els.inventoryList.appendChild(row); });
}

function switchMode(mode){ if(mode==='inventory'){ stopScanner(); els.jobMode.classList.add('hidden'); els.inventoryMode.classList.remove('hidden'); els.jobModeBtn.classList.remove('active'); els.inventoryModeBtn.classList.add('active'); renderInventory(); } else { stopInventoryScanner(); els.inventoryMode.classList.add('hidden'); els.jobMode.classList.remove('hidden'); els.inventoryModeBtn.classList.remove('active'); els.jobModeBtn.classList.add('active'); } }
function adjust(id,delta){const next=Math.max(0,(counts[id]||0)+delta);if(next===0)delete counts[id];else counts[id]=next;saveState();render();}
function render(){const used=inventory.filter(i=>counts[i.id]>0);const total=used.reduce((s,i)=>s+counts[i.id],0);els.badge.textContent=`${total} ${total===1?'item':'items'}`;els.emptyState.style.display=used.length?'none':'block';els.materialList.innerHTML='';used.forEach(item=>{const row=document.createElement('div');row.className='material-row';row.innerHTML=`<div class="part-meta"><div class="part-number">${escapeHtml(item.partNumber)} · ${escapeHtml(item.id)}</div><div class="part-name">${escapeHtml(item.description)}</div><div class="part-stock">Kanban stock qty: ${item.kanbanQty ?? 0}</div></div><div class="qty-controls"><button class="qty-btn">−</button><span class="qty">${counts[item.id]}</span><button class="qty-btn">+</button></div>`;const b=row.querySelectorAll('.qty-btn');b[0].addEventListener('click',()=>adjust(item.id,-1));b[1].addEventListener('click',()=>adjust(item.id,1));els.materialList.appendChild(row);});els.summary.value=buildSummary();}
function buildSummary(){const used=inventory.filter(i=>counts[i.id]>0);if(!used.length)return'';const title=els.jobName.value.trim()||'Untitled Job';const lines=used.map(i=>`${counts[i.id]} x ${i.partNumber} - ${i.description}`);return['KANBAN SCANNER',`Job: ${title}`,'',...lines,'',`Total pieces/units: ${used.reduce((s,i)=>s+counts[i.id],0)}`].join('\n');}
async function copySummary(){const text=buildSummary();if(!text)return els.status.textContent='Nothing to copy yet.';els.summary.value=text;try{await navigator.clipboard.writeText(text);els.status.textContent='Job summary copied to clipboard.';}catch(_){els.summary.focus();els.summary.select();document.execCommand('copy');els.status.textContent='Job summary copied.';}}
function saveState(){localStorage.setItem('kanbanScannerState',JSON.stringify({jobName:els.jobName?.value||'',counts}));}
function loadState(){try{const saved=JSON.parse(localStorage.getItem('kanbanScannerState')||'{}');counts=saved.counts||{};els.jobName.value=saved.jobName||'';}catch(_){counts={};}}
function saveCustomInventory(){localStorage.setItem('kanbanCustomInventory',JSON.stringify(customInventory));}
function loadCustomInventory(){try{customInventory=JSON.parse(localStorage.getItem('kanbanCustomInventory')||'[]');if(!Array.isArray(customInventory))customInventory=[];}catch(_){customInventory=[];}}
function clearJob(){if(!confirm('Clear all scanned items from this job?'))return;counts={};saveState();render();els.status.textContent='Job materials cleared.';}
function newJob(){if(Object.keys(counts).length&&!confirm('Start a new job and clear the current material list?'))return;counts={};els.jobName.value='';saveState();render();els.status.textContent='New job started.';}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
