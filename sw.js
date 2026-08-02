const CACHE = 'juybakery-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then(r => r || fetch(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// ── NOTIFICATION from Service Worker ──────────────────
// รับ message จาก main thread เพื่อ schedule notification
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIF') {
    const { order, msUntil, repeatMs } = e.data;
    const itemsText = (order.items || [])
      .map(it => `${it.prodName} ${it.qty} ${it.unit}`).join(', ');

    const showNotif = () => {
      self.registration.showNotification('🔔 ถึงเวลาทำออเดอร์!', {
        body: `ลูกค้า: ${order.cname}\n${itemsText}\nเวลาส่ง ${order.delivTime} น.`,
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-96x96.png',
        tag: 'order-' + order.id,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { orderId: order.id, url: './' }
      });
    };

    // Fire after delay
    setTimeout(() => {
      showNotif();
      // Repeat if needed
      if (repeatMs > 0) {
        const iv = setInterval(() => {
          showNotif();
        }, repeatMs);
        // Store interval id (limited — SW may restart)
        setTimeout(() => clearInterval(iv), 4 * 60 * 60 * 1000); // max 4hr
      }
    }, Math.max(0, msUntil));
  }

  if (e.data && e.data.type === 'TEST_NOTIF') {
    self.registration.showNotification('🔔 ทดสอบการแจ้งเตือน', {
      body: 'แจ้งเตือนทำงานได้ปกติแล้ว! ✅',
      icon: 'icons/icon-192x192.png',
      tag: 'test-notif'
    });
  }
});

// Click on notification → open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes('juybakery') || c.url.includes('localhost'));
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data?.url || './');
    })
  );
});
