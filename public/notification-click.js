/* Handles taps on PoultryPro farm alert notifications. Imported by the generated service worker. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client) await client.navigate(target);
            return;
          } catch {
            /* fall through to openWindow */
          }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
