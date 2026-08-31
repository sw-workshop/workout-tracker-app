/* global caches, fetch, Response, self, URL */

const cachePrefix = "workout-tracker-app-";
const cacheName = `${cachePrefix}v1`;
const scopeUrl = new URL(self.registration.scope);
const appShellFiles = [
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

function appUrl(path) {
  return new URL(path, scopeUrl).toString();
}

async function cacheAppShell() {
  const cache = await caches.open(cacheName);
  const indexResponse = await fetch(appUrl("index.html"), { cache: "reload" });
  const indexText = await indexResponse.clone().text();
  const assetFiles = Array.from(indexText.matchAll(/(?:href|src)="([^"]+)"/g))
    .map((match) => match[1])
    .filter((path) => path.startsWith(`${scopeUrl.pathname}assets/`))
    .map((path) => new URL(path, scopeUrl.origin).toString());

  await Promise.all([
    cache.put(appUrl("./"), indexResponse.clone()),
    cache.put(appUrl("index.html"), indexResponse.clone()),
    cache.addAll([...appShellFiles.map(appUrl), ...new Set(assetFiles)]),
  ]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(
            (currentCacheName) =>
              currentCacheName.startsWith(cachePrefix) && currentCacheName !== cacheName,
          )
          .map((currentCacheName) => caches.delete(currentCacheName)),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseCopy = response.clone();
        caches.open(cacheName).then((cache) => {
          cache.put(request, responseCopy);
        });

        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse !== undefined) {
            return cachedResponse;
          }

          if (request.mode === "navigate") {
            return caches.match(appUrl("./"));
          }

          return Response.error();
        });
      }),
  );
});
