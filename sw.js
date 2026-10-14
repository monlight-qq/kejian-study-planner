const CACHE = 'kejian-v11';
const FILES = ['./', './index.html', './styles.css', './theme.css', './ui.css', './motion.css', './motion.js', './day-transfer.js', './theme.js', './course-schedule.js', './timetable.js', './date-picker.js', './course-import.js', './app.js', './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable.png', './assets/ocr/tesseract.min.js', './assets/ocr/worker.min.js', './assets/ocr/tesseract-core-lstm.wasm.js', './assets/ocr/tesseract-core-simd-lstm.wasm.js', './assets/ocr/tesseract-core.wasm.js', './assets/ocr/tesseract-core-simd.wasm.js', './assets/ocr/chi_sim.traineddata.gz', './assets/ocr/eng.traineddata.gz'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('kejian-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic') { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('./index.html') : Response.error())));
});
