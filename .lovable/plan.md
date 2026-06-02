## Problem

Vid fokus i en cell i anteckningsrutnätet kan inputens expanderade bredd (samt overlay-textens `width: max-content`) sticka ut förbi rutnätets högra ytterkant. Användaren vill att text aldrig syns utanför rutnätets ytterkanter.

## Lösning

Begränsa expansionen till rutnätets återstående bredd och klipp av allt som ligger utanför raden.

### Ändringar i `src/pages/Index.tsx` (anteckningsrutnätet, ~rad 796–890)

1. **Cappa `focusedWidth` till resterande gridbredd**
   - Beräkna `remainingWidth = notesRowWidth - colIdx * cellWidth`.
   - `focusedWidth = Math.min(Math.max(textWidth, cellWidth), remainingWidth)`.
   - Då kan en fokuserad cell högst expandera till högerkanten av rutnätet, aldrig utanför.

2. **Klipp av varje rad vid ytterkanterna**
   - På rad-`div` (`grid grid-cols-10 ...`): lägg till `overflow-hidden`.
   - Det hindrar både den fokuserade inputens högerkant och den icke-fokuserade overlay-textens (`width: max-content`) från att synas utanför sista kolumnen.
   - `focus-within:z-50` på cellen är fortfarande relevant för att täcka celler till höger i samma rad.

3. **Yttre container**
   - Ytterramen `<div className="rounded-lg border ... overflow-visible">` kan ligga kvar som `overflow-visible` (eller bytas till `overflow-hidden` — funktionellt samma eftersom raderna nu klipper själva). Förslag: behåll som den är för att inte påverka eventuell focus-ring vertikalt.

4. **Inga ändringar i piltangentnavigering, datamodell eller Excel-export.**

### Effekter

- Skriver man en lång text i sista kolumnen växer cellen inte alls (remainingWidth = cellWidth). Texten scrollas då internt i inputen från höger som standard. Detta är en medveten kompromiss — alternativet (texten sticker ut) är det användaren just bad oss undvika.
- I tidigare kolumner expanderar cellen så långt som möjligt fram till högerkanten och klipps där.

### Filer

- `src/pages/Index.tsx` — enbart.
