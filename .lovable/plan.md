Rensa cellfärg vid manuell redigering

Problem
-------
Celler som fått gul bakgrund från Excel-import försvinner inte när användaren skriver om cellvärdet. Användaren vill att färgmarkeringen ska rensas när en cell redigeras manuellt, medan färgväljaren fortfarande ska fungera som vanligt.

Lösning
-------
1. Uppdatera `handleCellChange` i `src/pages/Index.tsx`.
   - Efter att arkets rader uppdaterats, kontrollera om den aktuella cellen (`rowIndex`, `colKey`) finns i `cellColorsMap` för aktuellt blad.
   - Om den finns, skapa ett nytt `cellColorsMap` och ta bort cellens färg så att bakgrunden återgår till standard.
2. Lämna `handleApplyColor` och färgväljaren oförändrad så att användaren fortfarande kan sätta färger manuellt.

Berörda filer
-------------
- `src/pages/Index.tsx`

Uppgift
-------
Modifiera `handleCellChange` så att redigering av en cell även rensar eventuell färgmarkering i `cellColorsMap` för just den cellen.
