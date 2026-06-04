## Mål

Lägg till ett alltid synligt "formelfält" (likt Excel) direkt under knappraden, som visar och låter dig redigera värdet i den markerade cellen. Flytta cellfärg-knappen till höger om formelfältet så den följer med när man scrollar.

## UI

Ny sticky rad direkt under den befintliga sticky-headern i `src/pages/Index.tsx`:

```text
[ fx ▸ ]  [ cellref ]  [ ───────── värde i markerad cell ───────── ]  [ 🎨 ]
```

- Vänster: liten kollaps-knapp (ChevronUp/ChevronDown-ikon) som döljer/visar fältet. När dolt: bara en smal knapp kvar att fälla ut igen.
- Cellreferens-chip: kort etikett som visar vilken cell som är markerad, t.ex. `B14` för luftflödesrutnätet (kolumnbokstav A–J + radnummer 14–49) eller `N R2C5` för anteckningsrutnätet.
- Input: full bredd, läser/skriver värdet i den markerade cellen i realtid. Enter flyttar fokus tillbaka till cellen i rutnätet.
- Höger: befintliga `Popover` med färgknappen flyttas hit från `flex items-center gap-2 flex-wrap`-raden längre ned. Färgknappen agerar fortfarande mot `selectedCell` (luftflödesrutnätet) precis som idag.

Sticky-beteende: wrappa formelraden i en `sticky top-[Npx]` direkt efter `<header>` så den ligger kvar synligt vid scroll, ihop med toppmenyn.

## Datakoppling

- Ny state `activeCell` av typen `{ source: "grid"; row: number; col: string } | { source: "notes"; r: number; c: number } | null`.
- Sätts via `onCellSelect` i `AirflowGrid` (befintlig callback) och via `onFocus` i anteckningsrutnätet (där `focusedNoteCell` redan sätts).
- För synk med befintliga features: när `activeCell.source === "grid"` sätts även `selectedCell` (så färgknappen fungerar). När `activeCell.source === "notes"` sätts även `focusedNoteCell`.
- Formelfältets värde:
  - grid: `sheets[activeSheet].rows[row][col]`
  - notes: cell `(r,c)` extraherad ur `sheet.notes` (samma `split("\n")` / `split("\t")`-logik som idag).
- Ändring i formelfältet skriver tillbaka via `handleCellChange` resp. samma notes-uppdaterings-funktion som inputarna i anteckningsrutnätet.
- Tomt fält när inget är markerat; placeholdern säger "Markera en cell".

## Flytt av färgknappen

- Ta bort `<div className="ml-auto"> ... Popover ... </div>` från bladhanterings-raden (rad ~758–784).
- Återanvänd samma `Popover` + `COLOR_PALETTE`-markup i formelradens högerkant.
- Beteendet (`handleApplyColor`, `lastColor`) lämnas oförändrat.

## Kollaps-toggle

- Ny state `formulaBarOpen` (default `true`, persistera ev. i localStorage under nyckel `lfp-formula-bar-open` — valfritt, lägger till om enkelt).
- När `false`: visa bara en tunn rad med chevron-knapp som öppnar igen. Färgknappen följer också med och göms (alternativt: visa alltid färgknappen även när fältet är kollapsat — föreslår att gömma den med fältet eftersom användaren bad om "ligger till höger om formelfältet").

## Filer som ändras

- `src/pages/Index.tsx` — ny formelrad, ny `activeCell`-state, flytt av Popover, små justeringar i `onCellSelect`/notes-`onFocus`.

Inga ändringar i `AirflowGrid.tsx`, datamodell, import eller export.
