## Mål

Få anteckningsrutnätet "Mätmetod och övriga upplysningar" att visa texten lika tydligt som i Excel, anpassat både för surfplatta och A4-utskrift. Excel-referens: 10 kolumner × 64 px bred, 5 rader × 21 px hög, Arial 10 pt.

## Problem idag

I `src/pages/Index.tsx` (raderna ~880–973) renderas anteckningsrutnätet med:

- `text-sm font-mono` (monospace, ~14 px) — inte Arial 10 pt → texten ser mycket bredare ut än i Excel och får inte plats.
- `h-9` (36 px) per rad — ej Excel-likt och slösar vertikalt utrymme.
- Overlay-divens text använder `whitespace-nowrap` med `width: max-content` inuti en cell-container utan `overflow: visible` på rad-nivå (`overflow-hidden` på raden) → text klipps vid radens högerkant, men angränsande celler kan dölja den eftersom varje cell ligger i en egen `relative`-container med fallande z-index.
- Mätfunktionen `measureNoteText` använder 14 px monospace, vilket gör fokuserings­bredden fel när vi byter typsnitt.

## Förslag på ändringar (endast `src/pages/Index.tsx`)

1. **Typsnitt och storlek**
   - Byt cellernas klasser från `text-sm font-mono` till en Arial-baserad stil i 10 pt:
     `font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.1;`
     (10 pt ≈ 13.33 px; 13 px ger samma intryck som Excel på A4 och tablet).
   - Gäller både `<input>` och overlay-`<div>`.

2. **Radhöjd**
   - Sänk radhöjd från `h-9` (36 px) till ~`h-[26px]` (~26 px). Excel = 21 px men på tablet behöver vi tap-target ≥ 24 px. 26 px ger Excel-känsla men är fortfarande bekvämt på pekskärm. Justera även overlay-divens höjd och `top`-offset.
   - På utskrift (A4): lägg till en `@media print`-regel via inline `<style>` eller Tailwind `print:` så raderna kollapsar till exakt 21 px för 1:1 med Excel.

3. **Excel-likt textöverflöde**
   - Behåll overlay-`<div>` med `whitespace-nowrap` men ta bort `overflow-hidden` på rad-containern och låt overlay flöda in i nästa (tom) cell, precis som Excel gör. Lägg `pointer-events: none` (redan satt) så input i nästa cell går att klicka. Sätt `overflow: visible` på cell-divsen och håll en hög z-index på overlayen så den syns över nästa cells transparenta input.
   - Säkerställ att overlay döljs så fort nästa cell har egen text (kontrollera `cells[colIdx+1]` — om icke-tom: klipp overlayen vid cellgränsen genom att sätta `max-width: 100%` på den).

4. **Konsekvent mätning**
   - Uppdatera `measureNoteText` så fontspec matchar nya stilen: `13px Arial, Helvetica, sans-serif`. Behövs för korrekt bredd vid fokus.

5. **Bredd / kolumnfördelning**
   - Behåll `grid-cols-10` (10 lika breda kolumner). På A4 print blir det 10 × ~64 px ≈ 640 px om vi sätter total bredd 640 px i `@media print`. Lägg `@media print { .notes-grid { width: 640px; } }` på containern.

6. **Tablet-anpassning**
   - Inga ändringar i layout för surfplatta utöver radhöjden ovan; cellbredden följer container (responsivt). Tap-target 26 px räcker för enkel cell-fokus eftersom man oftast tappar på text-overlayen.

## Inga andra ändringar

- Datamodell, import, export och övrig UI lämnas oförändrade.
- `AirflowGrid.tsx` ändras inte.

## Filer som ändras

- `src/pages/Index.tsx` (anteckningsrutnätet ~880–973 + `measureNoteText` ~187–195).
