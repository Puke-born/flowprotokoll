Rensa cellfärg vid första tangenttryckning

Problem
-------
Den gula importmarkeringen i celler försvinner först när cellvärdet faktiskt sparas vid `onBlur` (via `onCommit`). Om användaren skriver ett tecken och sedan tar bort det (t.ex. skriver "+" och suddar) så att slutvärdet är oförändrat, triggar inte `onCommit` en färgrensning. Användaren vill att markeringen ska försvinna redan vid första tangenttryckningen.

Lösning
-------
1. Lägg till en ny callback `onCellInput` i `AirflowGrid` som triggas vid `onChange` i `input`-fältet, alltså så fort användaren matar in något.
2. I `Index.tsx` implementera `handleCellInputChange` som raderar cellens färg från `cellColorsMap` för aktuellt blad.
3. Se till att `onFocus` endast används för att markera cellen (sätta `activeCell`), utan att rensa färg.
4. Behåll `onBlur` / `handleCellChange` för att committa värdet, utvärdera matematiska uttryck och rensa `importedCellsMap`.

Tekniska detaljer
-----------------
- `src/components/AirflowGrid.tsx`:
  - Utöka `AirflowGridProps` med `onCellInput?: (rowIndex: number, colKey: string) => void`.
  - Utöka `GridCellProps` med samma callback.
  - I `GridCell`, anropa `onCellInput?.(rowIdx, colKey)` inuti `onChange` på `input`.
  - Lämna `onFocus` och `onBlur` oförändrade (förutom ev. propagering av callback).
- `src/pages/Index.tsx`:
  - Skapa `handleCellInputChange` med `useCallback` som gör samma rensning av `cellColorsMap` som idag finns i `handleCellChange`.
  - Skicka `handleCellInputChange` som `onCellInput` prop till `AirflowGrid`.
  - Se till att `handleCellChange` fortfarande rensar `importedCellsMap` (och kan fortsätta rensa `cellColorsMap` som en fallback), men låt `handleCellInputChange` vara den primära vägen för att rensa vid inmatning.

Berörda filer
-------------
- `src/components/AirflowGrid.tsx`
- `src/pages/Index.tsx`
