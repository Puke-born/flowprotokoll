## Plan: Byt namn till "FLOVVK - LFP" och uppdatera logotyp/ikoner

### 1. Ladda upp logotyp och ikon som assets
- Ladda upp `user-uploads://Flovvk_-_logo-no_BG.png` som `src/assets/flovvk-logo.png.asset.json` via `lovable-assets create` (CDN-hostad, transparent bakgrund).
- Kopiera `user-uploads://Flovvk_-_icon.png` till `/tmp` och generera PWA-ikoner + favicon lokalt:
  - `public/icon-192.png` (192×192, från icon)
  - `public/icon-512.png` (512×512, från icon)
  - `public/favicon.png` (från icon)
- Ta bort gamla `public/favicon.ico`.

### 2. index.html
- `<title>Flowprotokoll>` → `FLOVVK - LFP`
- `og:title` och `twitter:title` → `FLOVVK - LFP`
- Byt `<link rel="icon">` till `/favicon.png` (type `image/png`).

### 3. vite.config.ts (PWA-manifest)
- `name: "FLOVVK - LFP"`
- `short_name: "FLOVVK - LFP"`
- Behåll `icon-192.png` / `icon-512.png` (nu regenererade från nya loggan).

### 4. src/pages/Index.tsx (header)
- Ersätt `<AirVent />` + `<h1>LFP</h1>` med den nya logotypen (`<img src={flovvkLogo.url} alt="FLOVVK - LFP" className="h-8 w-auto" />`) som klickbar knapp. Behåll klick = reload-bekräftelse.

### 5. Sök/ersätt övriga texter
- Inget annat träffar "Flowprotokoll" i src/ (verifierat via rg). Ingen ytterligare textändring behövs.

### Verifiering
- `rg "Flowprotokoll"` ska returnera tomt efter ändringen.
- Ny logga visas i headern; favicon och PWA-ikoner uppdaterade.
