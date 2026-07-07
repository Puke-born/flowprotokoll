## Plan

1. **Ta bort modellkopiering mellan olika arbetsböcker**
   - Sluta skapa `outWb = new ExcelJS.Workbook()` och sedan kopiera `tmpWs.model` från en annan workbook.
   - Det är fortfarande roten till felet: även om `fillSheet` körs senare kan `newWs.model = { ...tmpWs.model, name }` föra över styleId/style-objekt på ett sätt som ExcelJS tolkar fel.

2. **Bygg exporten från en enda mall-workbook**
   - Ladda `OVK-LFP_Mall.xlsx` direkt som export-workbook.
   - Använd första bladet som mallblad i samma workbook.
   - För första exporterade bladet: döp om mallbladet och fyll det.
   - För efterföljande blad: duplicera mallbladet inom samma workbook och fyll kopian.
   - Då ligger template-stilar, media och nya cellfärger i samma style dictionary hela tiden.

3. **Säkerställ att cellfärger sätts på individuella celler**
   - När `cell.fill` sätts för användarvalda färger, skapa ett nytt fill-objekt per cell.
   - Undvik att återanvända eller mutera style-objekt som kan vara delade av template-rader/kolumner.
   - Kontrollera att rad 5 / Frånluft Dontyp mappar till Excel-cell `G18` och endast den cellen får röd fill.

4. **Bevara befintlig exportlogik i övrigt**
   - Behåll `fillSheet`, filnamn, sidnummer, datafält, anteckningar och `cellColorsPerSheet`-format.
   - Ändra endast workbook-/worksheet-kopieringen och färgsättningen så minimalt som möjligt.

5. **Verifiering**
   - Skapa/verifiera ett scenario med ett tomt blad där endast `cellColorsPerSheet[0][4].franluft_dontyp = '#ff0000'` exporteras.
   - Kontrollera den genererade arbetsboken med script/openpyxl att `G18` är röd och att `C:D15-49` samt `G:H15-49` inte massfärgas.
   - Kör relevant TypeScript-kontroll efter implementationen.