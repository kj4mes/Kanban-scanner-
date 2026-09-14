let inventory = [];
let counts = {};
let scanner = null;
let lastScan = { value: null, time: 0 };

const els = {};

window.addEventListener('DOMContentLoaded', async () => {
  Object.assign(els, {
    jobName: document.getElementById('job-name'),
    startScan: document.getElementById('start-scan-btn'),
    stopScan: document.getElementById('stop-scan-btn'),
    reader: document.getElementById('reader'),
    status: document.getElementById('scan-status'),
    manualCode: document.getElementById('manual-code'),
    manualAdd: document.getElementById('manual-add-btn'),
    materialList: document.getElementById('material-list'),
    emptyState: document.getElementById('empty-state'),
    badge: document.getElementById('item-count-badge'),
    summary: document.getElementById('summary-output'),
    copySummary: document.getElementById('copy-summary-btn'),
    clearJob: document.getElementById('clear-job-btn'),
    newJob: document.getElementById('new-job-btn')
  });

  inventory = await fetch('inventory.json').then(r => r.json());
  loadState();
  render();

  els.startScan.addEventListener('click', startScanner);
  els.stopScan.addEventListener('click', stopScanner);
  els.manualAdd.addEventListener('click', () => addCode(els.manualCode.value));
  els.manualCode.addEventListener('keydown', e => {
    if (e.key === 'Enter') addCode(els.manualCode.value);
  });
  els.jobName.addEventListener('input', saveState);
  els.copySummary.addEventListener('click', copySummary);
  els.clearJob.addEventListener('click', clearJob);
  els.newJob.addEventListener('click', newJob);
});

function normalize(raw) {
  return String(raw || '').trim().toUpperCase();
}

function findItem(rawCode) {
  const code = normalize(rawCode);
  const kanbanMatch = code.match(/^KANBAN:(KB\d{3})$/);
  const id = kanbanMatch ? kanbanMatch[1] : code;

  const byId = inventory.find(i => i.id.toUpperCase() === id);
  if (byId) return { item: byId };

  const partMatches = inventory.filter(i => i.partNumber.toUpperCase() === code);
  if (partMatches.length === 1) return { item: partMatches[0] };
  if (partMatches.length > 1) return { duplicate: partMatches };

  return {};
}

function addCode(rawCode) {
  const code = normalize(rawCode);
  if (!code) return;

  const result = findItem(code);
  if (result.item) {
    const id = result.item.id;
    counts[id] = (counts[id] || 0) + 1;
    els.status.textContent = `Added ${result.item.description} (${result.item.partNumber}).`;
    els.manualCode.value = '';
    saveState();
    render();
    if (navigator.vibrate) navigator.vibrate(60);
    return;
  }

  if (result.duplicate) {
    els.status.textContent = `Part ${code} appears more than once in the source list. Scan its KANBAN:KBxxx QR code so the app knows which item you mean.`;
    return;
  }

  els.status.textContent = `Code not recognized: ${code}`;
}

async function startScanner() {
  if (!window.Html5Qrcode) {
    els.status.textContent = 'Scanner library did not load. Check your internet connection and reload.';
    return;
  }

  try {
    els.reader.classList.remove('hidden');
    els.startScan.disabled = true;
    els.stopScan.disabled = false;
    els.status.textContent = 'Starting camera…';

    scanner = new Html5Qrcode('reader');
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 180 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8
        ]
      },
      decodedText => {
        const now = Date.now();
        if (decodedText === lastScan.value && now - lastScan.time < 1500) return;
        lastScan = { value: decodedText, time: now };
        addCode(decodedText);
      }
    );
    els.status.textContent = 'Scanner running. Point the camera at a QR code or barcode.';
  } catch (err) {
    els.status.textContent = `Camera error: ${err}`;
    els.startScan.disabled = false;
    els.stopScan.disabled = true;
    els.reader.classList.add('hidden');
    scanner = null;
  }
}

async function stopScanner() {
  if (!scanner) return;
  try {
    await scanner.stop();
    await scanner.clear();
  } catch (_) {}
  scanner = null;
  els.reader.classList.add('hidden');
  els.startScan.disabled = false;
  els.stopScan.disabled = true;
  els.status.textContent = 'Scanner stopped.';
}

function adjust(id, delta) {
  const next = Math.max(0, (counts[id] || 0) + delta);
  if (next === 0) delete counts[id];
  else counts[id] = next;
  saveState();
  render();
}

function render() {
  const used = inventory.filter(i => counts[i.id] > 0);
  const total = used.reduce((sum, i) => sum + counts[i.id], 0);

  els.badge.textContent = `${total} ${total === 1 ? 'item' : 'items'}`;
  els.emptyState.style.display = used.length ? 'none' : 'block';
  els.materialList.innerHTML = '';

  used.forEach(item => {
    const row = document.createElement('div');
    row.className = 'material-row';
    row.innerHTML = `
      <div class="part-meta">
        <div class="part-number">${escapeHtml(item.partNumber)} · ${escapeHtml(item.id)}</div>
        <div class="part-name">${escapeHtml(item.description)}</div>
        <div class="part-stock">Kanban stock qty: ${item.kanbanQty}</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" aria-label="Subtract one">−</button>
        <span class="qty">${counts[item.id]}</span>
        <button class="qty-btn" aria-label="Add one">+</button>
      </div>`;
    const buttons = row.querySelectorAll('.qty-btn');
    buttons[0].addEventListener('click', () => adjust(item.id, -1));
    buttons[1].addEventListener('click', () => adjust(item.id, 1));
    els.materialList.appendChild(row);
  });

  els.summary.value = buildSummary();
}

function buildSummary() {
  const used = inventory.filter(i => counts[i.id] > 0);
  if (!used.length) return '';
  const title = els.jobName.value.trim() || 'Untitled Job';
  const lines = used.map(i => `${counts[i.id]} x ${i.partNumber} - ${i.description}`);
  return [`KANBAN SCANNER`, `Job: ${title}`, '', ...lines, '', `Total pieces/units: ${used.reduce((s, i) => s + counts[i.id], 0)}`].join('\n');
}

async function copySummary() {
  const text = buildSummary();
  if (!text) {
    els.status.textContent = 'Nothing to copy yet.';
    return;
  }
  els.summary.value = text;
  try {
    await navigator.clipboard.writeText(text);
    els.status.textContent = 'Job summary copied to clipboard.';
  } catch (_) {
    els.summary.focus();
    els.summary.select();
    document.execCommand('copy');
    els.status.textContent = 'Job summary copied.';
  }
}

function saveState() {
  localStorage.setItem('kanbanScannerState', JSON.stringify({
    jobName: els.jobName?.value || '',
    counts
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('kanbanScannerState') || '{}');
    counts = saved.counts || {};
    els.jobName.value = saved.jobName || '';
  } catch (_) {
    counts = {};
  }
}

function clearJob() {
  if (!confirm('Clear all scanned items from this job?')) return;
  counts = {};
  saveState();
  render();
  els.status.textContent = 'Job materials cleared.';
}

function newJob() {
  if (Object.keys(counts).length && !confirm('Start a new job and clear the current material list?')) return;
  counts = {};
  els.jobName.value = '';
  saveState();
  render();
  els.status.textContent = 'New job started.';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
