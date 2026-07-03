
## Mål

Fem prestanda- och arkitekturförbättringar i `src/pages/Index.tsx` utan att bryta befintlig funktionalitet. Särskilt bevaras:
- Piltangents- och Tab-navigering i anteckningsrutnätet (inkl. `atStart`/`atEnd`-logik och wraparound).
- Canvas-baserad textmätning för dynamisk inputbredd.
- Utskriftsstilarna (`@media print`) för `.notes-grid-wrapper`, `.notes-grid-row`, `.notes-grid-cell`.
- Formelfältets läsning/skrivning mot både grid- och notesceller.
- Overlay-beteendet (transparent input ovanpå synlig overlay när ofokuserad).

## Ändringar

### 1. Ny komponent: `src/components/NotesGrid.tsx`

Flytta ut hela anteckningsblocket (raderna ~967–1080 i `Index.tsx`).

Props:
```ts
interface NotesGridProps {
  notes: string;                       // sheet.notes
  onNotesCommit: (next: string) => void; // anropas vid onBlur / extern commit
  activeCell: ActiveCell;              // för att veta om formelfältet driver cellen
  onActiveCellChange: (c: ActiveCell) => void;
  // Kontrollerad override när formelfältet skriver till en note-cell:
  externalCellValue?: { r: number; c: number; value: string } | null;
}
```

Intern state som flyttas in i komponenten:
- `notesGridRef`, `notesRowWidth` + `ResizeObserver`.
- `focusedNoteCell`.
- `noteInputsRef` (5×10 matris).
- `measureCacheRef` + `measureNoteText`.
- Print-CSS `<style>`-blocket (flyttas in i komponenten så det följer med).

Navigering (ArrowUp/Down/Left/Right/Enter/Tab + shift-Tab wraparound) flyttas oförändrad in i komponenten.

### 2. Isolera state i NotesGrid för att slippa global omrendering per tangenttryck

Nuvarande beteende: varje `onChange` triggar `setSheets` på hela `Index`. På äldre surfplattor märks lagg när `AirflowGrid` (36 rader) re-renderas.

Ny modell inuti `NotesGrid`:
- Håll en lokal `localGrid: string[][]` (5×10) som initieras från `notes` via en parser (samma `split("\n")` + `split("\t")` som idag).
- `<input>` blir kontrollerad av `localGrid[r][c]`; `onChange` uppdaterar bara `localGrid` (via `useState` + `useCallback` som muterar en kopia).
- `onBlur` (och wraparound-navigering som byter fokus till en annan cell) → serialisera `localGrid` tillbaka till samma `"\n"`/`"\t"`-format och anropa `onNotesCommit(serialized)`. Skicka bara commit när innehållet faktiskt ändrats.
- Sync från förälder: `useEffect` som lyssnar på `notes`-propen och uppdaterar `localGrid` när propen ändras och **ingen cell är fokuserad** (undviker att skriva över användarens aktuella inmatning). Detta hanterar "Rensa blad", "byt aktivt blad", "Öppna projekt", och formelfält-skrivning till annan cell.
- Formelfältet: när användaren skriver i formelfältet mot en note-cell, tar `Index` fortfarande sin data från `sheet.notes` för display. Vi låter `Index` skicka en `externalCellValue`-prop **endast** för att synka just den fokuserade cellen — enklare alternativ: låt formelfältets `onChange` fortfarande gå via `writeNoteCell` (samma som idag), och lägg till en effekt i `NotesGrid` som synkar `localGrid[activeCell.r][activeCell.c]` från `notes` när `activeCell` är en notes-cell OCH källan är formelfältet (dvs. cellen är inte fokuserad i själva rutnätet). I praktiken: om `focusedNoteCell` är null använder vi propen; annars behåller vi lokalt värde.

Netto: skrivningar i rutnätet uppdaterar bara `NotesGrid` per tangent; `Index` uppdateras först vid blur/navigering.

### 3. Konsolidera localStorage-effekter i `Index.tsx`

Ersätt de tre separata `useEffect`-hookarna (raderna 231–252) med **en** debouncad effekt:

```ts
useEffect(() => {
  const id = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, activeSheet }));
    localStorage.setItem(IMPORTED_CELLS_KEY, serializeImportedCells(importedCellsMap));
    const obj: Record<string, Record<string, Record<string, string>>> = {};
    cellColorsMap.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(CELL_COLORS_KEY, JSON.stringify(obj));
  }, 400);
  return () => window.clearTimeout(id);
}, [sheets, activeSheet, importedCellsMap, cellColorsMap]);
```

En timer, en atomisk skrivning per debounce-fönster.

### 4. Typsäkra File System Access API

Lägg till modulnivå-deklaration överst i `Index.tsx` (eller i `src/vite-env.d.ts` om vi vill dela globalt — vi lägger den i `Index.tsx` för minimal påverkan):

```ts
declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  }
}
```

Ersätt `(window as any).showSaveFilePicker(...)` med `window.showSaveFilePicker!(...)` (guardad av `'showSaveFilePicker' in window`-checken som redan finns).

### 5. Höj mätcache-taket från 2000 → 5000

I `measureNoteText` (nu i `NotesGrid.tsx`):
```ts
if (cache.size > 5000) cache.clear();
```

## Verifieringschecklista efter implementation

- Skriv i en cell i anteckningsrutnätet: ingen `AirflowGrid`-rerender per tecken (React DevTools eller enkel `console.count` i AirflowGrid under test).
- Pil upp/ned/vänster/höger + Enter + Tab + Shift+Tab: fokus hoppar korrekt inkl. wraparound.
- ArrowLeft/Right respekterar `atStart`/`atEnd` (bara hoppar när caret är i kanten).
- Overlay visar rätt text när cellen inte är fokuserad; input växer dynamiskt vid fokus.
- Formelfält: markera en note-cell, skriv i formelfältet → cellen uppdateras.
- Byt aktivt blad → notes-rutnätet visar nya bladets värden.
- "Rensa" / "Öppna projekt" / "Nytt protokoll" → notes-rutnätet nollställs/uppdateras.
- Export till Excel: A51–J55 innehåller samma tab/newline-struktur som tidigare (commit sker senast vid blur; export-knappen ligger utanför inputs så onBlur triggas först).
- localStorage: kontrollera i DevTools att alla tre nycklar (`lfp-protocol-data`, `lfp-imported-cells`, `lfp-cell-colors`) uppdateras ~400 ms efter en ändring.
- Utskriftsförhandsvisning: radhöjd 21px, bredd 640px behålls.
- TypeScript-bygget: inga `any`-varningar för `showSaveFilePicker`.

## Filer som ändras

- **Ny:** `src/components/NotesGrid.tsx`
- **Ändrad:** `src/pages/Index.tsx` (importera NotesGrid, ta bort inline-anteckningsblock + mätlogik + fokusstate + print-style, konsolidera localStorage-effekter, deklarera `Window.showSaveFilePicker`, ta bort `as any`).

Inga ändringar i `AirflowGrid.tsx`, `exportExcel.ts`, `importExcel.ts` eller `ProtocolHeader.tsx`.
