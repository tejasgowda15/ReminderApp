const CACHE_NAME = "reminder-cache-v3"; // ⬅️ IMPORTANT: Increment this on every update to ensure new SW is installed
const OFFLINE_URL = "offline.html"; // You'll need to create this file

const urlsToCache = [
  "/",
  "index.html",
  "style.css",
  "script.js",
  "manifest.json",
  "icon.png",
  // Add your reminder sound to pre-cache as well if it's critical for offline
  "reminder.mp3",
  // Add other critical static assets here
  // OFFLINE_URL, // Uncomment this line if you create an offline.html
];

// Install: cache core assets during installation
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Add all core URLs to cache. If OFFLINE_URL is used, add it here too.
      await cache.addAll(urlsToCache);
      // Optional: If you want to cache specific runtime assets, you can add them here
      // try {
      //   await cache.add("https://fonts.gstatic.com/s/robotol/v20/example.woff2");
      // } catch (error) {
      //   console.warn("Failed to cache font:", error);
      // }
    })()
  );
  self.skipWaiting(); // Activates the new service worker immediately
});

// Activate: clean old caches and notify clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      );

      // Claim clients to ensure the new service worker controls all open pages immediately
      self.clients.claim();

      // Notify all open clients that a new version is available (as before)
      const clientsList = await clients.matchAll({ type: "window" });
      clientsList.forEach((client) => {
        client.postMessage({ type: "NEW_VERSION_AVAILABLE" });
      });
    })()
  );
});

// Fetch: Strategy for serving content (Stale-While-Revalidate & Cache-First)
self.addEventListener("fetch", (event) => {
  // Only handle GET requests for navigation and assets
  if (event.request.method === "GET" && event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      (async () => {
        try {
          // Try to get from network first for better freshness for non-HTML requests
          const networkResponse = await fetch(event.request);
          const cache = await caches.open(CACHE_NAME);

          // Put a copy of the response in the runtime cache
          // We must clone the response to send it to the browser as well as put it in the cache
          if (networkResponse.ok || networkResponse.type === 'opaque') { // Cache successful responses and opaque responses
            event.waitUntil(cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        } catch (error) {
          // Network failed, try to get from cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // If both cache and network fail for a navigation request, show offline page
          if (event.request.mode === 'navigate') {
            const offlineResponse = await caches.match(OFFLINE_URL);
            if (offlineResponse) {
              return offlineResponse;
            }
            // If offline.html is not cached, fallback to a basic offline message or browser's default
            return new Response("<h1>Offline</h1><p>You are offline. Please check your internet connection.</p>", {
              headers: { "Content-Type": "text/html" },
              status: 503,
              statusText: "Service Unavailable"
            });
          }

          // For non-navigation requests (e.g., images), if both fail, return a generic error response
          return new Response(null, { status: 503, statusText: 'Service Unavailable' });
        }
      })()
    );
  } else {
    // For requests not from your origin (e.g., third-party APIs, CDNs),
    // or non-GET requests, just let them go to the network directly.
    event.respondWith(fetch(event.request));
  }
});

// Helper for sending messages to clients (if needed for debugging or other features)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
