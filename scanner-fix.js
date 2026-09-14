// Barcode scanner compatibility fix: html5-qrcode expects format restrictions in the
// Html5Qrcode constructor, not in the camera start configuration.

async function startScanner() {
  if (!window.Html5Qrcode) {
    els.status.textContent = 'Scanner library did not load. Reload while online.';
    return;
  }
  try {
    els.reader.classList.remove('hidden');
    els.startScan.disabled = true;
    els.stopScan.disabled = false;
    els.status.textContent = 'Starting camera…';

    scanner = new Html5Qrcode('reader', {
      formatsToSupport: scanFormats(),
      verbose: false
    });

    await scanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 280, height: 160 } },
      decodedText => {
        const now = Date.now();
        if (decodedText === lastScan.value && now - lastScan.time < 1500) return;
        lastScan = { value: decodedText, time: now };
        addCode(decodedText);
      }
    );

    els.status.textContent = 'Scanner running. Hold the barcode steady inside the box.';
  } catch (err) {
    els.status.textContent = `Camera error: ${err}`;
    els.startScan.disabled = false;
    els.stopScan.disabled = true;
    els.reader.classList.add('hidden');
    scanner = null;
  }
}

async function startInventoryScanner() {
  if (!window.Html5Qrcode) {
    els.inventoryStatus.textContent = 'Scanner library did not load. Reload while online.';
    return;
  }
  try {
    els.inventoryReader.classList.remove('hidden');
    els.inventoryScan.disabled = true;
    els.inventoryStop.disabled = false;
    els.inventoryStatus.textContent = 'Starting camera…';

    inventoryScanner = new Html5Qrcode('inventory-reader', {
      formatsToSupport: scanFormats(),
      verbose: false
    });

    await inventoryScanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 280, height: 160 } },
      async decodedText => {
        const code = normalize(decodedText);
        const now = Date.now();
        if (code === lastScan.value && now - lastScan.time < 1500) return;
        lastScan = { value: code, time: now };

        const existing = findItem(code);
        if (existing.item) {
          els.inventoryStatus.textContent = `Already in inventory: ${existing.item.partNumber} — ${existing.item.description}`;
          if (navigator.vibrate) navigator.vibrate([50, 40, 50]);
          return;
        }

        await stopInventoryScanner(false);
        openNewItemForm(code);
        if (navigator.vibrate) navigator.vibrate(80);
      }
    );

    els.inventoryStatus.textContent = 'Scanner is live — hold a UPC/EAN/Code 128/39 or QR barcode inside the box.';
  } catch (err) {
    els.inventoryStatus.textContent = `Camera error: ${err}`;
    els.inventoryScan.disabled = false;
    els.inventoryStop.disabled = true;
    els.inventoryReader.classList.add('hidden');
    inventoryScanner = null;
  }
}
