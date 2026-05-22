## Problem

`width: max-content` fungerar inte på `<input>` — inputs har en intrinsisk bredd (baserad på `size`-attributet) och shrink-wrappar inte sitt textinnehåll som ett `<div>` gör. Därför stannar inputen kvar på `minWidth: 100%` (en cellbredd) även när texten är längre, och fokus visar bara en cell.

## Lösning

Mät den faktiska textbredden och sätt inputens `width` explicit när cellen är fokuserad.

### Ändringar i `src/pages/Index.tsx` (anteckningsrutnätet, ~rad 783–818)

1. **Lokal `focusedCell`-state** i komponenten: `{ r: number; c: number } | null`. Sätts på `onFocus`, nollas på `onBlur`.

2. **Mät textbredd via dolt span eller canvas**:
   - Skapa en hjälpfunktion `measureText(text: string)` som använder en återanvänd `CanvasRenderingContext2D` (`document.createElement("canvas").getContext("2d")`) med samma font som inputen (`text-sm font-mono` → t.ex. `13px "JetBrains Mono", monospace`).
   - Alternativ: dolt `<span>` med samma typografi som befintlig overlay-`div` och läs `offsetWidth` via en ref.

3. **Sätt inputens bredd dynamiskt**:
   - När `focusedCell` matchar `{r: rowIdx, c: colIdx}`, beräkna `desiredPx = measureText(cells[colIdx] || "") + paddingPx (≈ 12)`.
   - Inputens `style.width` blir `max(desiredPx, cellWidthPx)` capped till resterande gridbredd.
   - För att veta cell- och gridbredd i pixlar: håll en `ref` på rad-containern (`grid grid-cols-10`); läs `clientWidth` i en `useLayoutEffect` (eller `ResizeObserver`) → `cellWidthPx = rowWidth / 10`, `maxWidthPx = rowWidth - colIdx * cellWidthPx`.
   - När cellen INTE är fokuserad: behåll nuvarande `width: 100%` av cellen (overlay-`div` sköter visuell overflow).

4. **Uppdatera bredd även medan användaren skriver**: i `onChange`-handlern, efter state-uppdateringen, räkna om bredden (lättast: härled från `e.target.value` direkt i samma render eftersom `cells[colIdx]` kommer uppdateras nästa render — en `useEffect` på `sheet.notes` + `focusedCell` triggar omberäkning).

5. **Bevara z-index/bakgrund**: `focus-within:z-50` + `focus:bg-background` lämnas oförändrat så den expanderade inputen täcker tomma celler till höger.

### Tekniska detaljer

- Font för mätning: matcha exakt `text-sm` (14px om default, men `md:text-sm` på Input — här används `text-sm` direkt = 14px) och `font-mono` (Tailwind `ui-monospace, SFMono-Regular, ...`). Säkraste: läs `getComputedStyle(input)` på en monterad input vid första mätning och cacha font-strängen.
- Padding: `px-1` = 4px vänster + 4px höger = 8px, plus liten buffert för caret → använd 12px.
- Canvas-mätning är synkron och billig; ok att köra varje render för fokuserad cell.

### Filer

- `src/pages/Index.tsx` — lägg till `focusedCell`-state, mät-hjälpare, row-`ref`, och dynamisk `style.width` på inputen i anteckningsrutnätet. Inga andra filer.

Inga ändringar i datamodell eller Excel-export.
