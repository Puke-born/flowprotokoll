## Mål
Göra Excel-importen flexibel: hitta automatiskt var datan börjar på varje blad och läs rader tills datan tar slut (istället för låst rad 14–49). Användaren ska kunna justera startraden per blad i importdialogen innan importen bekräftas.

## Ändringar

### 1. `src/lib/importExcel.ts`
- Lägg till `detectStartRow(ws)`: skanna rad 1–60 i kolumn A (`rum_nr`) och B (`rum_namn`). Returnera första raden där minst en av cellerna har innehåll och raden ovanför inte är en data‑rad (för att skippa rubriker som "Rum", "Nr" osv.). Fallback: rad 14.
- Ny funktion `detectSheetStartRows(buffer, sheetNames)` som returnerar `{ [sheetName]: number }` (1‑baserade radnummer) — används för att fylla dialogen.
- Uppdatera `importSheets` så den tar emot ett `startRows`‑objekt: `importSheets(buffer, sheetNames, startRows)`.
- I `importSheets`: läs från `startRow - 1` (0‑indexerat) och framåt. Stoppa när en helt tom rad påträffas (alla 10 kolumner tomma) eller efter max 36 rader. Notes läses fortfarande från ett fast offset relativt slutet av blocket — alternativt: skanna efter texten "Anteckningar" / "Övrigt" nedanför sista data‑raden, annars hoppa över notes vid varierande layout. **Förslag:** behåll notes‑logiken oförändrad om startraden = 14, annars läs 1–5 rader direkt efter sista icke‑tomma data‑raden.

### 2. `src/pages/Index.tsx`
- Ny state: `sheetStartRows: Record<string, number>` (per bladnamn i dialogen).
- I `handleFileSelect`: efter `getSheetNames`, anropa `detectSheetStartRows` och fyll `sheetStartRows`.
- I importdialogen (rad 782–807): bredvid varje bladnamn‑checkbox lägg till ett litet `Input type="number"` (min=1, max=60) som visar/redigerar startraden. Inaktiverat om bladet inte är markerat.
- I `handleImportConfirm`: skicka `sheetStartRows` till `importSheets`.

### 3. UI‑detaljer i dialogen
```text
☑ Blad 1          Startrad: [ 14 ]
☑ Offert 2025     Startrad: [ 17 ]
☐ Mall            Startrad: [ 14 ]
```
Liten hjälptext högst upp: "Startraden upptäcks automatiskt men kan justeras."

## Tekniska detaljer
- Auto‑detektering: en rad räknas som data‑rad om kolumn A eller B innehåller värde och värdet i A inte är en ren rubrik‑text ("Rum", "Rumsnr", "Nr"). Stoppvillkor i läsning: rad är tom i alla 10 datakolumner.
- Max 36 rader behålls som hård gräns (matchar `NUM_ROWS` i Index.tsx).
- Notes‑logik: enklast och säkrast — om startrad ≠ 14 hoppar vi över notes‑importen tills vidare (kan utökas senare). Bekräfta gärna om detta är okej.

## Öppen fråga
Är det okej att notes (raderna under tabellen) bara importeras när startrad = 14, eller ska vi också försöka hitta notes‑blocket automatiskt under data‑tabellen?