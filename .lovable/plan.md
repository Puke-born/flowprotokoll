## Plan

Få den fokuserade cellen i anteckningsrutnätet att expandera bredden efter textens längd (Excel-beteende), så det blir lättare att redigera lång text.

### Ändringar i `src/pages/Index.tsx` (anteckningsrutnätet)

- Inputen byter från `w-full` till `min-w-full w-max` (eller `width: max-content; min-width: 100%`), så att fältet växer förbi den egna kolumnbredden när texten är lång — annars fyller det fortfarande hela cellen.
- Vid fokus ligger inputen redan ovanpå grannarna via `focus-within:z-50` + `focus:bg-background`, så den expanderade bredden täcker tomma celler till höger utan att förstöra layouten.
- Lägg till `max-width` (t.ex. hela rutnätets bredd via `max-w-[calc(10*10%)]` eller motsvarande container-trick) så fältet inte växer utanför rutnätets högerkant.
- Overlay-`div` (som visar texten när cellen inte är fokuserad) lämnas oförändrad — den är redan `max-content`.

Resultat: när du klickar i en cell expanderar input-fältet till att rymma hela textens längd, lägger sig ovanpå tomma grannar och du ser allt du redigerar. När du klickar ur, faller cellen tillbaka och overlay-texten flödar visuellt över intilliggande tomma celler precis som idag.

### Filer
- `src/pages/Index.tsx` — endast styling/bredd-ändringar i anteckningscellens `<input>`.

Inga ändringar i datamodell, lagring eller Excel-export.
