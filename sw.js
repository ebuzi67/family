// 인터넷이 끊겨도 대시보드가 열리도록 앱 파일을 저장해 둔다.
// 앱을 고치면 VERSION 숫자를 올린다.
const VERSION = 4;
const CACHE = `family-dash-v${VERSION}`;
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.json',
  'img/village.webp', 'img/icon-192.png', 'img/icon-512.png', 'img/icon-180.png',
  ...['polarbear', 'bear', 'bee'].flatMap((a) => [1, 2, 3].map((s) => `img/${a}-${s}.png`)),
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('family-dash-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // 날씨는 늘 새로 받는다 (실패하면 앱이 마지막 날씨를 보여 준다)
  if (url.hostname.endsWith('open-meteo.com')) return;
  // 글꼴은 한 번 받으면 저장해 두고 쓴다
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((res) => { c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // 앱 파일: 인터넷이 되면 새 것, 안 되면 저장해 둔 것
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
