const CACHE_NAME = 'gallery-app-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './about.html',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// تثبيت Service Worker وحفظ الملفات
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// استرجاع الملفات من الذاكرة عند انقطاع الإنترنت
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});