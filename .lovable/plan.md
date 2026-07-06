Fixa bugg: Style Dictionary Collision i exportAllSheets

I src/lib/exportExcel.ts ska ordningen i for-loopen i exportAllSheets ändras:

Nuvarande ordning (bugg):
1. tmpWb laddas från mallen
2. fillSheet(tmpWs, ...) körs → stilar registreras i tmpWb
3. newWs = outWb.addWorksheet(name)
4. newWs.model = { ...tmpWs.model, name } → råa styleIds kopieras till outWb med fel dictionary

Ny ordning (fix):
1. tmpWb laddas från mallen (oförändrat)
2. const name = sanitizeSheetName(...) (oförändrat)
3. const newWs = outWb.addWorksheet(name)
4. newWs.model = { ...tmpWs.model, name }
5. fillSheet(newWs, sheet, sidNr, cellColorsPerSheet?.[i])
   → stilar och cellfärger registreras nu direkt i outWb, inga kolliderande styleIds

Exakt kodändring:
- flytta `fillSheet(tmpWs, sheet, sidNr, cellColorsPerSheet?.[i]);` så att den körs på `newWs` istället
- placera anropet efter `newWs.model = { ...tmpWs.model, name };`
- ingen annan logik ändras