import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Lättviktig uppdateringsnotis: pollar `/` (index.html) med jämna mellanrum
 * och visar en toast med "Ladda om"-knapp när byggets script-hash ändrats.
 * Kringgår behov av att lita på service worker-events i previewmiljö.
 */
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min

function isPreviewOrIframe(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith("lovableproject.com") ||
    h.endsWith("lovableproject-dev.com") ||
    h.endsWith("beta.lovable.dev") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

async function fetchVersionToken(): Promise<string | null> {
  try {
    const res = await fetch(`/?_uv=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Hämta alla bundlade asset-URL:er (Vite stoppar in hashar i filnamnen).
    const matches = html.match(/\/assets\/[A-Za-z0-9._-]+/g);
    if (matches && matches.length > 0) return matches.sort().join("|");
    // Fallback: hela längden + första 256 tecknen
    return `${html.length}:${html.slice(0, 256)}`;
  } catch {
    return null;
  }
}

export function useUpdateNotifier() {
  const baselineRef = useRef<string | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (isPreviewOrIframe()) return;

    let cancelled = false;
    let timer: number | undefined;

    const check = async () => {
      const token = await fetchVersionToken();
      if (cancelled || token == null) return;
      if (baselineRef.current == null) {
        baselineRef.current = token;
        return;
      }
      if (token !== baselineRef.current && !notifiedRef.current) {
        notifiedRef.current = true;
        toast("En ny version av appen är tillgänglig", {
          description: "Ladda om för att börja använda den.",
          duration: Infinity,
          action: {
            label: "Ladda om",
            onClick: () => window.location.reload(),
          },
        });
      }
    };

    // Kör en initial koll efter kort delay så vi inte tävlar med första renderingen
    const initial = window.setTimeout(check, 30 * 1000);
    timer = window.setInterval(check, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}