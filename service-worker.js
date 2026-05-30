const CACHE_NAME = 'cinema-finder-v3';
const ASSETS = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './movies_data.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// インストール時に静的ファイルをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチ処理
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // データファイル (movies_data.json) はネットワーク優先でキャッシュ更新
  if (url.pathname.includes('movies_data.json')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, resClone);
          });
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // 静的ファイルはキャッシュ優先＋バックグラウンド更新
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          // バックグラウンドで更新
          fetch(e.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(e.request);
      })
    );
  }
});
