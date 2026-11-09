/** Warm the lesson cache while online so offline practice works. */

export async function warmLessonCache(urls: string[]): Promise<void> {
  if (!("caches" in window)) return;
  const cache = await caches.open("dotline-lessons-v1");
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
        if (response.ok) await cache.put(url, response.clone());
      } catch {
        // Ignore individual warm failures.
      }
    }),
  );
}
