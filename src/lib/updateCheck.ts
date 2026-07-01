// Lightweight update checker: compares the hashed main asset URL in / against
// the one embedded in the currently loaded page. When the deployed build
// changes, notify the caller so it can prompt the user to reload.

let currentAsset: string | null = null;

function extractMainAsset(html: string): string | null {
  // Matches `<script type="module" src="/assets/index-XXXX.js">`
  const m = html.match(/<script[^>]+src="([^"]*assets\/[^"]+\.js)"/i);
  return m?.[1] ?? null;
}

async function fetchLatestAsset(): Promise<string | null> {
  try {
    const res = await fetch("/?_uc=" + Date.now(), {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractMainAsset(html);
  } catch {
    return null;
  }
}

function readCurrentAssetFromDom(): string | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'));
  for (const s of scripts) {
    if (/assets\/.+\.js/.test(s.src)) return new URL(s.src, location.origin).pathname;
  }
  return null;
}

export function initUpdateCheck(
  onUpdate: () => void,
  intervalMs = 60 * 60 * 1000, // 60 min
) {
  currentAsset = readCurrentAssetFromDom();
  // If we're in dev (no /assets/ hashed bundle), skip silently.
  if (!currentAsset) return () => {};

  let stopped = false;
  const check = async () => {
    if (stopped) return;
    const latest = await fetchLatestAsset();
    if (latest && currentAsset && latest !== currentAsset) {
      onUpdate();
    }
  };

  const id = window.setInterval(check, intervalMs);
  const onFocus = () => check();
  window.addEventListener("focus", onFocus);

  // First check shortly after boot so users get near-instant notice.
  const kick = window.setTimeout(check, 15_000);

  return () => {
    stopped = true;
    window.clearInterval(id);
    window.clearTimeout(kick);
    window.removeEventListener("focus", onFocus);
  };
}

export function forceHardReload() {
  // Bust caches then reload. Service worker (if any) is unregistered elsewhere.
  if ("caches" in window) {
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).finally(() => {
      window.location.replace(window.location.pathname + "?_r=" + Date.now());
    });
  } else {
    window.location.replace(window.location.pathname + "?_r=" + Date.now());
  }
}