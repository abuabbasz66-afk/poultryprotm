// Live calendar-day ticker.
//
// Bird age is always derived from the flock's anchor date, but a React tree
// only recomputes it when it re-renders. This hook re-renders subscribers at
// local midnight so ages roll over (day, and therefore week) automatically
// without the farmer reloading the page.
import { useEffect, useState } from "react";

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function useToday(): Date {
  const [day, setDay] = useState(() => startOfDay());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const check = () => {
      const now = startOfDay();
      setDay((prev) => (prev.getTime() === now.getTime() ? prev : now));
      // Re-check just after the next local midnight (capped so long-lived
      // tabs and device sleep/wake still recover quickly).
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      const wait = Math.min(Math.max(next - Date.now() + 1000, 1000), 60 * 60 * 1000);
      timer = setTimeout(check, wait);
    };

    check();
    const onFocus = () => setDay((prev) => {
      const now = startOfDay();
      return prev.getTime() === now.getTime() ? prev : now;
    });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return day;
}
