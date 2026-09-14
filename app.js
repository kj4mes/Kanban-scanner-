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
    saveNextItem: document.getElementById('save-next-item-btn'), cancelItem: document.getElementById('cancel-item-btn'), inventoryList: document.getElementById('inventory-list'),
    inventoryCountBadge: document.getElementById('inventory-count-badge'), customCountBadge: document.getElementById('custom-count-badge'), inventorySearch: document.getElementById('inventory-search'),
    manualBarcodeBtn: document.getElementById('manual-barcode-btn'), manualBarcodePanel: document.getElementById('manual-barcode-panel'), manualNewBarcode: document.getElementById('manual-new-barcode'),
    useManualBarcodeBtn: document.getElementById('use-manual-barcode-btn'), exportJsonBtn: document.getElementById('export-json-btn'), exportCsvBtn: document.getElementById('export-csv-btn'),
    importBtn: document.getElementById('import-btn'), importFile: document.getElementById('import-file')
  });

  baseInventory = await fetch('inventory.json').then(r => r.json());
  loadCustomInventory(); rebuildInventory(); loadState(); render(); renderInventory();

  els.jobModeBtn.addEventListener('click', () => switchMode('job'));
  els.inventoryModeBtn.addEventListener('click', () => switchMode('inventory'));
  els.startScan.addEventListener('click', startScanner); els.stopScan.addEventListener('click', stopScanner);
  els.manualAdd.addEventListener('click', () => addCode(els.manualCode.value));
  els.manualCode.addEventListener('keydown', e => { if (e.key === 'Enter') addCode(els.manualCode.value); });
  els.jobName.addEventListener('input', saveState); els.copySummary.addEventListener('click', copySummary); els.clearJob.addEventListener('click', clearJob); els.newJob.addEventListener('click', newJob);
  els.inventoryScan.addEventListener('click', startInventoryScanner); els.inventoryStop.addEventListener('click', stopInventoryScanner);
  els.saveItem.addEventListener('click', () => saveNewInventoryItem(false)); els.saveNextItem.addEventListener('click', () => saveNewInventoryItem(true)); els.cancelItem.addEventListener('click', resetNewItemForm);
  els.inventorySearch.addEventListener('input', renderInventory);
  els.manualBarcodeBtn.addEventListener('click', toggleManualBarcodePanel); els.useManualBarcodeBtn.addEventListener('click', useManualBarcode);
  els.manualNewBarcode.addEventListener('keydown', e => { if (e.key === 'Enter') useManualBarcode(); });
  els.exportJsonBtn.addEventListener('click', exportInventoryJson); els.exportCsvBtn.addEventListener('click', exportInventoryCsv);
  els.importBtn.addEventListener('click', () => els.importFile.click()); els.importFile.addEventListener('change', importInventoryJson);
});

function rebuildInventory() { inventory = [...baseInventory, ...customInventory]; }
function normalize(raw) { return String(raw || '').trim().toUpperCase(); }
function itemBarcodes(item) { return Array.isArray(item.barcodes) ? item.barcodes.map(normalize) : []; }
function findItem(rawCode) {
  const code = normalize(rawCode); const kanbanMatch = code.match(/^KANBAN:(KB\d{3})$/); const id = kanbanMatch ? kanbanMatch[1] : code;
  const byId = inventory.find(i => normalize(i.id) === id); if (byId) return { item: byId };
  const byBarcode = inventory.find(i => itemBarcodes(i).includes(code)); if (byBarcode) return { item: byBarcode };
  const partMatches = inventory.filter(i => normalize(i.partNumber) === code); if (partMatches.length === 1) return { item: partMatches[0] }; if (partMatches.length > 1) return { duplicate: partMatches };
  return {};
}
function addCode(rawCode) {
  const code = normalize(rawCode); if (!code) return; const result = findItem(code);
  if (result.item) { counts[result.item.id] = (counts[result.item.id] || 0) + 1; els.status.textContent = `Captured — added ${result.item.description} (${result.item.partNumber}).`; els.manualCode.value = ''; saveState(); render(); captureFeedback(); return; }
  if (result.duplicate) { els.status.textContent = `Captured ${code}, but that part number appears more than once. Scan its unique QR/barcode instead.`; captureFeedback(); return; }
  els.status.textContent = `Captured ${code}, but it is not in inventory. Add it under Inventory Setup.`; captureFeedback();
}
const scanFormats = () => [Html5QrcodeSupportedFormats.QR_CODE,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8];
function makeScanner(elementId) { return new Html5Qrcode(elementId, { formatsToSupport: scanFormats(), verbose: false }); }
function scanConfig() { return { fps:15, qrbox:(w,h)=>({width:Math.max(220,Math.floor(Math.min(w*.92,430))),height:Math.max(90,Math.floor(Math.min(h*.28,130)))}), aspectRatio:1.777778, disableFlip:false }; }
function captureFeedback() { if (navigator.vibrate) navigator.vibrate([80,35,80]); }
async function startScanner() { if (!window.Html5Qrcode) return els.status.textContent='Scanner library did not load. Reload while online.'; try { els.reader.classList.remove('hidden'); els.startScan.disabled=true; els.stopScan.disabled=false; els.status.textContent='Starting camera…'; scanner=makeScanner('reader'); await scanner.start({facingMode:'environment'},scanConfig(),decodedText=>{const now=Date.now();if(decodedText===lastScan.value&&now-lastScan.time<1500)return;lastScan={value:decodedText,time:now};addCode(decodedText);}); els.status.textContent='Scanner running — center the entire barcode inside the wide box.'; } catch(err){els.status.textContent=`Camera error: ${err}`;els.startScan.disabled=false;els.stopScan.disabled=true;els.reader.classList.add('hidden');scanner=null;} }
async function stopScanner() { if(!scanner)return; try{await scanner.stop();await scanner.clear();}catch(_){} scanner=null; els.reader.classList.add('hidden'); els.startScan.disabled=false; els.stopScan.disabled=true; els.status.textContent='Scanner stopped.'; }
async function startInventoryScanner() { if (!window.Html5Qrcode) return els.inventoryStatus.textContent='Scanner library did not load. Reload while online.'; try { els.manualBarcodePanel.classList.add('hidden'); els.inventoryReader.classList.remove('hidden'); els.inventoryScan.disabled=true; els.inventoryStop.disabled=false; els.inventoryStatus.textContent='Starting camera…'; inventoryScanner=makeScanner('inventory-reader'); await inventoryScanner.start({facingMode:'environment'},scanConfig(),async decodedText=>{const code=normalize(decodedText),now=Date.now();if(code===lastScan.value&&now-lastScan.time<1500)return;lastScan={value:code,time:now};els.inventoryStatus.textContent=`Barcode captured: ${code}`;captureFeedback();const existing=findItem(code);if(existing.item){els.inventoryStatus.textContent=`Captured ${code} — already in inventory: ${existing.item.partNumber} — ${existing.item.description}`;return;}await stopInventoryScanner(false);openNewItemForm(code);}); els.inventoryStatus.textContent='Scanner running — center the full manufacturer barcode inside the wide box.'; } catch(err){els.inventoryStatus.textContent=`Camera error: ${err}`;els.inventoryScan.disabled=false;els.inventoryStop.disabled=true;els.inventoryReader.classList.add('hidden');inventoryScanner=null;} }
async function stopInventoryScanner(updateStatus=true){if(inventoryScanner){try{await inventoryScanner.stop();await inventoryScanner.clear();}catch(_){}inventoryScanner=null;}els.inventoryReader.classList.add('hidden');els.inventoryScan.disabled=false;els.inventoryStop.disabled=true;if(updateStatus)els.inventoryStatus.textContent='Scanner stopped.';}
function openNewItemForm(code){els.newBarcode.value=code;els.newPartNumber.value='';els.newDescription.value='';els.newKanbanQty.value='1';els.newCategory.value='';els.newItemForm.classList.remove('hidden');els.manualBarcodePanel.classList.add('hidden');els.inventoryStatus.textContent=`Barcode captured: ${code}. Enter the item details below.`;els.newPartNumber.focus();}
function resetNewItemForm(){els.newItemForm.classList.add('hidden');els.newBarcode.value='';els.inventoryStatus.textContent='Ready to build inventory.';}
function toggleManualBarcodePanel(){els.manualBarcodePanel.classList.toggle('hidden');if(!els.manualBarcodePanel.classList.contains('hidden')){stopInventoryScanner(false);els.manualNewBarcode.value='';els.manualNewBarcode.focus();}}
function useManualBarcode(){const code=normalize(els.manualNewBarcode.value);if(!code){els.inventoryStatus.textContent='Enter a barcode number first.';return;}const existing=findItem(code);if(existing.item){els.inventoryStatus.textContent=`That barcode is already assigned to ${existing.item.partNumber} — ${existing.item.description}.`;return;}openNewItemForm(code);}
function nextLocalId(){let n=1;const ids=new Set(customInventory.map(i=>i.id));while(ids.has(`LOCAL${String(n).padStart(3,'0')}`))n++;return `LOCAL${String(n).padStart(3,'0')}`;}
function saveNewInventoryItem(scanNext=false){const barcode=normalize(els.newBarcode.value),partNumber=els.newPartNumber.value.trim(),description=els.newDescription.value.trim(),qty=Math.max(0,Number(els.newKanbanQty.value)||0),category=els.newCategory.value.trim();if(!barcode||!partNumber||!description){els.inventoryStatus.textContent='Barcode, FieldEdge item number, and description are required.';return;}const existing=findItem(barcode);if(existing.item){els.inventoryStatus.textContent='That barcode is already assigned to an inventory item.';return;}const item={id:nextLocalId(),partNumber,description,kanbanQty:qty,category,barcodes:[barcode],source:'local',createdAt:new Date().toISOString()};customInventory.push(item);saveCustomInventory();rebuildInventory();els.newItemForm.classList.add('hidden');els.newBarcode.value='';renderInventory();els.inventoryStatus.textContent=`Saved ${partNumber} — ${description}.`;captureFeedback();if(scanNext){setTimeout(()=>startInventoryScanner(),250);}}
function deleteCustomItem(id){const item=customInventory.find(i=>i.id===id);if(!item||!confirm(`Delete ${item.partNumber} — ${item.description}?`))return;customInventory=customInventory.filter(i=>i.id!==id);delete counts[id];saveCustomInventory();rebuildInventory();saveState();render();renderInventory();els.inventoryStatus.textContent='Inventory item deleted.';}
function renderInventory(){if(!els.inventoryList)return;const q=normalize(els.inventorySearch.value),visible=inventory.filter(i=>!q||normalize(`${i.partNumber} ${i.description} ${i.category||''} ${itemBarcodes(i).join(' ')}`).includes(q));els.inventoryCountBadge.textContent=`${inventory.length} items`;if(els.customCountBadge)els.customCountBadge.textContent=`${customInventory.length} added`;els.inventoryList.innerHTML='';visible.forEach(item=>{const row=document.createElement('div');row.className='inventory-row';const isCustom=customInventory.some(i=>i.id===item.id);row.innerHTML=`<div class="part-meta"><div class="part-number">${escapeHtml(item.partNumber)} · ${escapeHtml(item.id)}</div><div class="part-name">${escapeHtml(item.description)}</div><div class="part-stock">Kanban qty: ${item.kanbanQty??0}${item.category?` · ${escapeHtml(item.category)}`:''}</div>${itemBarcodes(item).length?`<div class="barcode-line">Barcode: ${escapeHtml(itemBarcodes(item).join(', '))}</div>`:''}<div class="inventory-source">${isCustom?'Added on this phone':'Starter inventory'}</div></div>${isCustom?'<div class="inventory-actions"><button class="small-btn danger">Delete</button></div>':''}`;if(isCustom)row.querySelector('button').addEventListener('click',()=>deleteCustomItem(item.id));els.inventoryList.appendChild(row);});}
function downloadText(filename,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportInventoryJson(){const payload={format:'kanban-scanner-inventory',version:1,exportedAt:new Date().toISOString(),items:customInventory};downloadText(`kanban-inventory-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json');els.inventoryStatus.textContent=`Exported ${customInventory.length} locally-added inventory items.`;}
function csvEscape(value){const s=String(value??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
function exportInventoryCsv(){const rows=[['Item Number','Description','Kanban Qty','Category','Barcode','Local ID'],...customInventory.map(i=>[i.partNumber,i.description,i.kanbanQty??0,i.category||'',itemBarcodes(i).join('|'),i.id])];downloadText(`kanban-inventory-${new Date().toISOString().slice(0,10)}.csv`,rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv');els.inventoryStatus.textContent=`Exported ${customInventory.length} items as CSV.`;}
async function importInventoryJson(event){const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const incoming=Array.isArray(parsed)?parsed:parsed.items;if(!Array.isArray(incoming))throw new Error('No item list found');let added=0,skipped=0;for(const raw of incoming){const barcode=normalize((raw.barcodes||[])[0]||raw.barcode);if(!barcode||!raw.partNumber||!raw.description||findItem(barcode).item){skipped++;continue;}customInventory.push({id:nextLocalId(),partNumber:String(raw.partNumber),description:String(raw.description),kanbanQty:Math.max(0,Number(raw.kanbanQty)||0),category:String(raw.category||''),barcodes:[barcode],source:'local',createdAt:raw.createdAt||new Date().toISOString()});rebuildInventory();added++;}saveCustomInventory();renderInventory();els.inventoryStatus.textContent=`Import complete: ${added} added, ${skipped} skipped.`;}catch(err){els.inventoryStatus.textContent=`Import failed: ${err.message}`;}finally{event.target.value='';}}
function switchMode(mode){if(mode==='inventory'){stopScanner();els.jobMode.classList.add('hidden');els.inventoryMode.classList.remove('hidden');els.jobModeBtn.classList.remove('active');els.inventoryModeBtn.classList.add('active');renderInventory();}else{stopInventoryScanner();els.inventoryMode.classList.add('hidden');els.jobMode.classList.remove('hidden');els.inventoryModeBtn.classList.remove('active');els.jobModeBtn.classList.add('active');}}
function adjust(id,delta){const next=Math.max(0,(counts[id]||0)+delta);if(next===0)delete counts[id];else counts[id]=next;saveState();render();}
function render(){const used=inventory.filter(i=>counts[i.id]>0),total=used.reduce((s,i)=>s+counts[i.id],0);els.badge.textContent=`${total} ${total===1?'item':'items'}`;els.emptyState.style.display=used.length?'none':'block';els.materialList.innerHTML='';used.forEach(item=>{const row=document.createElement('div');row.className='material-row';row.innerHTML=`<div class="part-meta"><div class="part-number">${escapeHtml(item.partNumber)} · ${escapeHtml(item.id)}</div><div class="part-name">${escapeHtml(item.description)}</div><div class="part-stock">Kanban stock qty: ${item.kanbanQty??0}</div></div><div class="qty-controls"><button class="qty-btn">−</button><span class="qty">${counts[item.id]}</span><button class="qty-btn">+</button></div>`;const b=row.querySelectorAll('.qty-btn');b[0].addEventListener('click',()=>adjust(item.id,-1));b[1].addEventListener('click',()=>adjust(item.id,1));els.materialList.appendChild(row);});els.summary.value=buildSummary();}
function buildSummary(){const used=inventory.filter(i=>counts[i.id]>0);if(!used.length)return'';const title=els.jobName.value.trim()||'Untitled Job',lines=used.map(i=>`${counts[i.id]} x ${i.partNumber} - ${i.description}`);return['KANBAN SCANNER',`Job: ${title}`,'',...lines,'',`Total pieces/units: ${used.reduce((s,i)=>s+counts[i.id],0)}`].join('\n');}
async function copySummary(){const text=buildSummary();if(!text)return els.status.textContent='Nothing to copy yet.';els.summary.value=text;try{await navigator.clipboard.writeText(text);els.status.textContent='Job summary copied to clipboard.';}catch(_){els.summary.focus();els.summary.select();document.execCommand('copy');els.status.textContent='Job summary copied.';}}
function saveState(){localStorage.setItem('kanbanScannerState',JSON.stringify({jobName:els.jobName?.value||'',counts}));}
function loadState(){try{const saved=JSON.parse(localStorage.getItem('kanbanScannerState')||'{}');counts=saved.counts||{};els.jobName.value=saved.jobName||'';}catch(_){counts={};}}
function saveCustomInventory(){localStorage.setItem('kanbanCustomInventory',JSON.stringify(customInventory));}
function loadCustomInventory(){try{customInventory=JSON.parse(localStorage.getItem('kanbanCustomInventory')||'[]');if(!Array.isArray(customInventory))customInventory=[];}catch(_){customInventory=[];}}
function clearJob(){if(!confirm('Clear all scanned items from this job?'))return;counts={};saveState();render();els.status.textContent='Job materials cleared.';}
function newJob(){if(Object.keys(counts).length&&!confirm('Start a new job and clear the current material list?'))return;counts={};els.jobName.value='';saveState();render();els.status.textContent='New job started.';}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
