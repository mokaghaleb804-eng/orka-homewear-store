/* ORKA Orders PWA worker — intentionally limited to the app shell. */
const APP_FILES = [
  "./orka-orders.html",
  "./orka-orders.webmanifest",
  "./orka-orders-icon.svg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isAppFile = APP_FILES.some(path => url.pathname.endsWith(path.replace("./", "")));
  if (!isAppFile) return;

  event.respondWith(
    fetch(request).catch(() => new Response(
      "ORKA Orders يحتاج اتصالًا بالإنترنت لقراءة الطلبات من Firebase.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    ))
  );
});
