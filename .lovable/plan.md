## Plan

Gör så text i anteckningscellerna inte klipps av tomma grannar — texten i vänster cell ska visuellt ligga ovanpå och svämma över in i nästa tomma celler (likt Excel).

### Ändringar

- Varje cell renderas i en wrapper med `position: relative` och tillåten overflow.
- Inputen får växa förbi sin egen kolumnbredd när den innehåller text, så texten visas i sin helhet.
- Vid fokus får cellen högsta z-index så den läggs ovanpå grannarna.
- Vertikala avgränsare och svarta understräck behålls.
- Ingen ändring i hur `sheet.notes` sparas eller exporteras till Excel.