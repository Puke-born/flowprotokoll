## Mål

Byt ut nuvarande "från-noll"-export mot en export som utgår från din uppladdade mall `OVK-LFP_Mall.xlsx`. All formatering, ramar, rubriker, förifyllda etiketter och bildobjektet i mallen bevaras. Varje protokoll-blad i appen blir en full kopia av mallbladet med bara värdena ifyllda.

## Så gör vi

1. **Lägg in mallen i projektet**
  - Kopiera den uppladdade filen till `public/OVK-LFP_Mall.xlsx` så den kan hämtas i runtime med `fetch('/OVK-LFP_Mall.xlsx')`. Filen följer med i bygget och funkar även offline via befintlig PWA-cache (lägger till den i precache-listan i `vite.config.ts` `workbox.globPatterns`/`includeAssets`).
2. **Byt exportbibliotek till ExcelJS**
  - `xlsx-js-style` klarar inte att bevara inbäddade bilder från en mall. Installera `exceljs` (`bun add exceljs`) och skriv om `src/lib/exportExcel.ts`.
  - `xlsx` (för import) behålls oförändrat i `src/lib/importExcel.ts`.
3. **Ny exportlogik (`exportExcel.ts`)**
  - Hämta mallen som `ArrayBuffer`.
  - Skapa ett tomt slutgiltigt `ExcelJS.Workbook`.
  - För varje protokoll-blad i appen:
  1. Ladda mallen i en temporär workbook (en gång per blad, så bild/ramar/styles följer med rent).
  2. Ta mallbladet, döp om det till bladets namn + "LFP" (om det inte redan står) (samma sanering som idag: max 31 tecken, ta bort `< > : " / \\ | ? *`).
  3. Skriv värden till exakt samma celler som idag använder — mallen har identisk layout:
    - `C4` Kund, `C5` Anläggning, `C6` System, `C7` Utfört av
    - `J4` Plan, `J5` Sid nr (`i+1/total`), `J6` Arb.nr, `J7` Datum
    - Rader `A14:J49` → `rows[0..35]` (samma kolumnordning som idag)
    - `A51:J55` → 5 anteckningsrader (`\t`-splittade som idag)
    - `A50` lämnas orörd (mallen har redan "Mätmetod och övriga upplysningar.")
  4. Kopiera det ifyllda mallbladet in i slutgiltiga workbook via `workbook.addWorksheet(...).model = tempSheet.model` så bild och alla styles följer med. (ExcelJS bevarar workbook-media när `model` sätts.)
    plicera användarens manuellt satta cellfärger (`cellColorsPerSheet`) ovanpå mallens fyllning genom `cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb } }` för `A14:J49`-cellerna som har färg.
    riv ut med `workbook.xlsx.writeBuffer()` och trigga nedladdning via `Blob` + `URL.createObjectURL`. Filnamnet behålls: `LFP [Anläggning] [Datum].xlsx`.
4. **Rensning**
  - Ta bort `xlsx-js-style` från `package.json` när det inte längre används (behåll om annat kod importerar; annars `bun remove xlsx-js-style`).
  - Ingen ändring i UI, import, färgpalett, PWA-flöden eller andra filer.

## Tekniska detaljer

- `public/OVK-LFP_Mall.xlsx` serveras från roten. Fetchas med `fetch(import.meta.env.BASE_URL + 'OVK-LFP_Mall.xlsx')` för att fungera under valfri deploy-bas.
- ExcelJS `worksheet.model = other.model` kopierar rader, celler, sammanslagningar, kolumnbredder, radhöjder och drawing-referenser. Bilden ligger på workbook-nivå (`workbook.media`) och binds via drawings — därför laddas mallen på nytt per blad så att varje bladkopia får sin egen media-referens korrekt.
- ARGB för fill är 8-siffrig hex (`FF` + RRGGBB). Konvertering görs från de befintliga hex-värdena i `cellColorsPerSheet`.
- Import-flödet (import från excel) rörs inte; det läser fortfarande värden med `xlsx`.

## Filer som ändras

- Ny: `public/OVK-LFP_Mall.xlsx` (kopia av uppladdad mall)
- `src/lib/exportExcel.ts` — omskrivning enligt ovan
- `vite.config.ts` — lägga till mallen i PWA precache
- `package.json` — `bun add exceljs` (ev. `bun remove xlsx-js-style`)