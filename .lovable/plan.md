## Mål

Två prestanda-/storleksförbättringar, utan att bryta piltangentnavigering, Enter/Tab, formelfältets skrivning eller EVAL-formelutvärderingen på `tilluft_uppmat`/`franluft_uppmat`.

---

### 1. Lokal cell-state i `AirflowGrid.tsx`

**Problem:** varje tangenttryck anropar `onCellChange` → `setSheets` i `Index.tsx` → hela rutnätet (36 rader × 10 kolumner) renderas om.

**Ny modell:**
- Skapa en intern memoiserad `GridCell`-komponent i `AirflowGrid.tsx` (en per input).
- `GridCell` har **eget lokalt state** `localValue`, initierat från prop `value`.
- `onChange` uppdaterar bara `localValue` (ingen förälder-render).
- `onBlur` committar uppåt via `onCellChange`:
  - Om kolumnen är i `EVAL_COLUMNS`: kör `tryEvalMath(localValue)`; om resultat ≠ null, sätt `localValue = result` och committa resultatet. Annars committa råvärdet.
  - Committa endast om `localValue !== value` (undvik onödiga setState).
- Piltangenter/Enter/Tab: nuvarande `handleKeyDown` flyttar fokus till annan cell → `onBlur` triggas automatiskt av webbläsaren på cellen vi lämnar → commit sker innan mottagarcellen får `value`-prop, så flödet fungerar oförändrat.
- **Extern sync (formelfältet):** när `Index` skriver via formelfältet ändras `value`-propen. `GridCell` har en `useEffect` som synkar `localValue` från `value`-propen **när cellen inte är fokuserad**. En `isFocusedRef` (eller `document.activeElement`-check) förhindrar att användarens pågående inmatning skrivs över.
- Memoisera `GridCell` med `React.memo` så att en cells re-render inte drar med resten.
- Behåll alla nuvarande props (data-row/data-col, `onCellSelect`, färger, importerad-highlight, styling, autofokusflöde via `gridRef.querySelector`).

**Bevaras:**
- Piltangentnavigering (samma `handleKeyDown` på cellnivå eller lyft till förälder-nivå med samma logik).
- Drag-and-drop-radordning (oförändrad, ligger på `<td>`).
- Import-highlight (gul bakgrund) och användarvalda cellfärger.
- Formelfältets tvåvägsbindning.

**Kvittering av EVAL:** logiken flyttas från nuvarande `onBlur`-block i `AirflowGrid` in i `GridCell.onBlur` — samma `tryEvalMath`-anrop, samma två målkolumner.

---

### 2. Byt `xlsx` mot `exceljs` i `src/lib/importExcel.ts`

**Ta bort:** `import * as XLSX from "xlsx"`.
**Använd:** `import ExcelJS from "exceljs"` (redan i dependencies via export).

**Nya signaturer (async):**
```ts
export async function getSheetNames(file: ArrayBuffer): Promise<string[]>
export async function importSheets(file: ArrayBuffer, sheetNames: string[]): Promise<ImportedSheet[]>
```

**Implementation:**
- `const wb = new ExcelJS.Workbook(); await wb.xlsx.load(file);`
- `getSheetNames`: `wb.worksheets.map(ws => ws.name)`.
- `importSheets`: för varje namn, `wb.getWorksheet(name)`; om saknas → tom sheet med 36 tomma rader.
- **Rader 14–49** (1-indexerat) × **kolumner 1–10**: `ws.getRow(r).getCell(c).value`.
- **Anteckningar rader 51–55** × kolumner 1–10 → samma tab/newline-serialisering som idag (`join("\t")` per rad, trimma trailing tabs, `join("\n")`, trimma trailing tomma rader).
- **Säker värdesutdragning** (hanterar formler, rich text, hyperlinks, null):
  ```ts
  function readCell(v: ExcelJS.CellValue): string {
    if (v == null) return "";
    if (typeof v === "object") {
      if ("result" in v && v.result != null) return String(v.result);       // formula
      if ("richText" in v) return v.richText.map(t => t.text).join("");     // rich text
      if ("text" in v) return String((v as { text: string }).text);         // hyperlink
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return "";
    }
    return String(v);
  }
  ```
- Kolumnmappning: samma `COL_KEYS`-array. Skriv bara till `row[key]` om `readCell` gav icke-tom sträng (bibehåller nuvarande "sparsam" struktur som `importedCellsMap` bygger på).

**Uppdatera anroparen i `Index.tsx`:**
- `handleFileSelect` (rad 375–389): `reader.onload` → gör `async`, `const names = await getSheetNames(buffer);`. Wrappa i try/catch → `toast.error("Kunde inte läsa filen")`.
- `handleImportConfirm` (rad 391–418): gör `async`, `const imported = await importSheets(...)`. Wrappa i try/catch → `toast.error(...)`.

**Bundle:** `xlsx` blir oanvänd — låt `package.json` vara orörd i denna PR (borttag hanteras separat om användaren vill), eller ta bort direktimporten så att tree-shaking utesluter den. Vi tar bort själva importen; paketet kan avinstalleras senare.

---

## Verifieringschecklista

- Skriv snabbt i en cell: inga renders av `Index` per tangent (kontrollera med `console.count("render")` tillfälligt).
- Pil upp/ner/Enter i huvudrutnätet flyttar fokus, och värdet finns kvar i cellen man lämnade (commit på blur).
- Skriv `2+3` i "Uppmätt (tilluft)" → Tab → cellen visar `5` och `sheet.rows` uppdateras.
- Formelfält: markera en cell, skriv i formelfältet → cellvärdet uppdateras live (extern sync fungerar när cellen inte är fokuserad).
- Import: välj `.xlsx` och `.xlsm` → dialog visar bladnamn → importera → rader 14–49 fyllda korrekt, anteckningar 51–55 med tab-separatorer bevarade.
- Cell med Excel-formel importeras med `.result`-värdet (inte `[object Object]`).
- Drag-and-drop av rader fungerar.
- Import-highlight (gul) och användarvalda cellfärger renderas.
- Export → återimport round-trip ger samma data.

## Filer

- **Ändras:** `src/components/AirflowGrid.tsx` (ny intern `GridCell`, lokal state, memo).
- **Ändras:** `src/lib/importExcel.ts` (byt bibliotek, async API, säker värdesutdragning).
- **Ändras:** `src/pages/Index.tsx` (`await` på import-anrop, try/catch runt dem).
