## Mål

Bygg om importflödet så användaren kan:
1. Bocka i vilka blad som ska importeras (checkboxar, som idag).
2. Ange ett **cellområde för data** (t.ex. `A14:J49`).
3. Ange ett **cellområde för anteckningar** (t.ex. `A51:J55`).
4. Se en Excel-lik förhandsvisning av det valda bladet med kolumnbokstäver (A, B, C…) och radnummer, där båda cellområdena highlightas med var sin färg.
5. Klicka "Bekräfta import" → samma två cellområden extraheras från ALLA ibockade blad.

## Förändringar

### `src/lib/importExcel.ts`

- Lägg till `parseRange(range: string): { r1, c1, r2, c2 } | null` som tolkar `A1`-syntax (case-insensitive, max kolumn Z räcker; använd `XLSX.utils.decode_range` för robusthet). Returnerar `null` vid ogiltig syntax.
- Lägg till `readSheetPreview(file: ArrayBuffer, sheetName: string, maxRows = 100, maxCols = 26): string[][]` som returnerar en 2D-array med cellvärden (tomt om saknas) för förhandsvisning.
- Uppdatera signaturen:
  ```ts
  importSheets(
    file: ArrayBuffer,
    sheetNames: string[],
    dataRange: { r1, c1, r2, c2 },
    notesRange: { r1, c1, r2, c2 },
  ): ImportedSheet[]
  ```
  - Data: iterera `dataRange`, mappa kolumner i ordning mot `COL_KEYS` (max 10 kolumner; om området är bredare ignoreras överskott, om smalare lämnas resten tomt).
  - Anteckningar: iterera `notesRange` på samma sätt som idag (tab-separerade kolumner, radbrytning per rad, trimma trailing tomma rader).
  - Antal datarader = `r2 - r1 + 1` (varierar nu per fil, inte hårdkodat 36).

### `src/pages/Index.tsx`

Utöka befintlig import-dialog:

- Behåll bladlistan med checkboxar (alla ibockade som default).
- När dialogen öppnas: välj första bladet som "förhandsvisat blad" och anropa `readSheetPreview`. Lägg till en liten väljare (radioknappar eller `<Select>`) ovanför förhandsvisningen för att byta vilket blad som visas — alla blad importeras ändå baserat på checkboxarna.
- Två textfält:
  - "Cellområde för data" (default `A14:J49`)
  - "Cellområde för anteckningar" (default `A51:J55`)
  - Båda valideras via `parseRange`; röd kant + felmeddelande vid ogiltig syntax. "Bekräfta import" disablas om något är ogiltigt eller inga blad är ibockade.
- Förhandsvisning: scrollbar `<div class="max-h-[60vh] overflow-auto">` med en tabell:
  - Sticky top-rad med kolumnbokstäver (A–Z eller upp till `maxCols`).
  - Sticky vänsterkolumn med radnummer (1-indexerade).
  - Celler inom dataRange: `bg-primary/15 ring-1 ring-primary/40`.
  - Celler inom notesRange: `bg-amber-200/40 ring-1 ring-amber-500/50`.
  - Överlapp: hanteras genom att data-stil ritas först, notes-stil överskuggar.
- "Bekräfta import" anropar `importSheets(buffer, selectedSheetNames, dataRange, notesRange)` och ersätter `sheets`, `importedCellsMap` och `cellColorsMap` precis som idag.

## Filer som ändras

- `src/lib/importExcel.ts`
- `src/pages/Index.tsx`

Inga ändringar i datamodell, export, `AirflowGrid` eller övrig UI.
