// ZXing-based scanner engine for reliable UPC/EAN scanning on iPhone.
// Loaded after app.js so these functions replace the original html5-qrcode scanner functions.

let zxingJobReader = null;
let zxingInventoryReader = null;
let zxingJobVideo = null;
let zxingInventoryVideo = null;

function ensureZXing() {
  return window.ZXing && window.ZXing.BrowserMultiFormatReader;
}

function makeZXingReader() {
  const hints = new Map();
  if (window.ZXing.DecodeHintType && window.ZXing.BarcodeFormat) {
    hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      window.ZXing.BarcodeFormat.UPC_A,
      window.ZXing.BarcodeFormat.UPC_E,
      window.ZXing.BarcodeFormat.EAN_13,
      window.ZXing.BarcodeFormat.EAN_8,
      window.ZXing.BarcodeFormat.CODE_128,
      window.ZXing.BarcodeFormat.CODE_39,
      window.ZXing.BarcodeFormat.QR_CODE
    ]);
    hints.set(window.ZXing.DecodeHintType.TRY_HARDER, true);
  }
  return new window.ZXing.BrowserMultiFormatReader(hints, 120);
}

function makeVideo(container) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'zxing-wrap';
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');
  video.muted = true;
  video.className = 'zxing-video';
  const guide = document.createElement('div');
  guide.className = 'zxing-guide';
  guide.innerHTML = '<span>Center the full barcode here</span>';
  wrap.appendChild(video);
  wrap.appendChild(guide);
  container.appendChild(wrap);
  return video;
}

function zxingConstraints() {
  return {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };
}

function decodedTextFromResult(result) {
  if (!result) return '';
  if (typeof result.getText === 'function') return result.getText();
  return result.text || String(result || '');
}

function isExpectedZXingMiss(err) {
  if (!err) return true;
  const name = err.name || err.constructor?.name || '';
  return ['NotFoundException','ChecksumException','FormatException'].includes(name);
}

async function startScanner() {
  if (!ensureZXing()) {
    els.status.textContent = 'ZXing scanner did not load. Refresh the page while online.';
    return;
  }
  await stopScanner(false);
  try {
    els.reader.classList.remove('hidden');
    els.startScan.disabled = true;
    els.stopScan.disabled = false;
    els.status.textContent = 'Starting ZXing camera…';
    zxingJobVideo = makeVideo(els.reader);
    zxingJobReader = makeZXingReader();
    await zxingJobReader.decodeFromConstraints(zxingConstraints(), zxingJobVideo, (result, err) => {
      if (result) {
        const code = normalize(decodedTextFromResult(result));
        const now = Date.now();
        if (!code || (code === lastScan.value && now - lastScan.time < 1500)) return;
        lastScan = { value: code, time: now };
        addCode(code);
      } else if (err && !isExpectedZXingMiss(err)) {
        console.warn('ZXing job scan error', err);
      }
    });
    els.status.textContent = 'ZXing scanner running — hold the full barcode inside the box.';
  } catch (err) {
    console.error(err);
    els.status.textContent = `Camera/scanner error: ${err?.message || err}`;
    els.startScan.disabled = false;
    els.stopScan.disabled = true;
    els.reader.classList.add('hidden');
    zxingJobReader = null;
  }
}

async function stopScanner(updateStatus = true) {
  if (zxingJobReader) {
    try { zxingJobReader.reset(); } catch (_) {}
    zxingJobReader = null;
  }
  if (zxingJobVideo?.srcObject) {
    try { zxingJobVideo.srcObject.getTracks().forEach(t => t.stop()); } catch (_) {}
  }
  zxingJobVideo = null;
  if (els.reader) {
    els.reader.innerHTML = '';
    els.reader.classList.add('hidden');
  }
  if (els.startScan) els.startScan.disabled = false;
  if (els.stopScan) els.stopScan.disabled = true;
  if (updateStatus && els.status) els.status.textContent = 'Scanner stopped.';
}

async function startInventoryScanner() {
  if (!ensureZXing()) {
    els.inventoryStatus.textContent = 'ZXing scanner did not load. Refresh the page while online.';
    return;
  }
  await stopInventoryScanner(false);
  try {
    els.inventoryReader.classList.remove('hidden');
    els.inventoryScan.disabled = true;
    els.inventoryStop.disabled = false;
    els.inventoryStatus.textContent = 'Starting ZXing camera…';
    zxingInventoryVideo = makeVideo(els.inventoryReader);
    zxingInventoryReader = makeZXingReader();
    await zxingInventoryReader.decodeFromConstraints(zxingConstraints(), zxingInventoryVideo, async (result, err) => {
      if (result) {
        const code = normalize(decodedTextFromResult(result));
        const now = Date.now();
        if (!code || (code === lastScan.value && now - lastScan.time < 1500)) return;
        lastScan = { value: code, time: now };
        els.inventoryStatus.textContent = `Barcode captured: ${code}`;
        captureFeedback();
        const existing = findItem(code);
        if (existing.item) {
          els.inventoryStatus.textContent = `Captured ${code} — already in inventory: ${existing.item.partNumber} — ${existing.item.description}`;
          return;
        }
        await stopInventoryScanner(false);
        openNewItemForm(code);
      } else if (err && !isExpectedZXingMiss(err)) {
        console.warn('ZXing inventory scan error', err);
      }
    });
    els.inventoryStatus.textContent = 'ZXing scanner running — hold the entire UPC/EAN barcode inside the box.';
  } catch (err) {
    console.error(err);
    els.inventoryStatus.textContent = `Camera/scanner error: ${err?.message || err}`;
    els.inventoryScan.disabled = false;
    els.inventoryStop.disabled = true;
    els.inventoryReader.classList.add('hidden');
    zxingInventoryReader = null;
  }
}

async function stopInventoryScanner(updateStatus = true) {
  if (zxingInventoryReader) {
    try { zxingInventoryReader.reset(); } catch (_) {}
    zxingInventoryReader = null;
  }
  if (zxingInventoryVideo?.srcObject) {
    try { zxingInventoryVideo.srcObject.getTracks().forEach(t => t.stop()); } catch (_) {}
  }
  zxingInventoryVideo = null;
  if (els.inventoryReader) {
    els.inventoryReader.innerHTML = '';
    els.inventoryReader.classList.add('hidden');
  }
  if (els.inventoryScan) els.inventoryScan.disabled = false;
  if (els.inventoryStop) els.inventoryStop.disabled = true;
  if (updateStatus && els.inventoryStatus) els.inventoryStatus.textContent = 'Scanner stopped.';
}
