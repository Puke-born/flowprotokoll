## Plan

Låt text i en cell visuellt flöda över intilliggande tomma celler (som i Excel), utan att ändra datalagringen eller exporten.

### Ändringar

- Anteckningsrutan: när en cell inte är fokuserad och nästa cell är tom, ska texten kunna synas över gränsen.
- När cellen är fokuserad eller grannen har innehåll, klipps texten som tidigare.
- Inga ändringar i export eller i hur `sheet.notes` sparas.

### Tekniskt

- Rendera varje cell som en relativ wrapper med en input ovanpå ett textöverlägg (`span`).
- Inputen är transparent och klipper text som vanligt; overlägget visar texten med `white-space: nowrap` och får växa förbi cellens högerkant så länge nästa cell är tom.
- Overlägget döljs när cellen är fokuserad så att markör och redigering fungerar normalt.

---

## Tidigare plan (redan implementerad)

Gör anteckningsdelen till 5 rader med 10 separata inmatningsceller per rad, men behåll den visuella rutan med rubrik, samma bredd och tydliga svarta understräck.

### Ändringar

1. Uppdatera anteckningsområdet så varje rad består av 10 celler i ett rutnät.
2. Låt texten sparas och läsas radvis så befintliga anteckningar fortsätter fungera.
3. Uppdatera Excel-exporten så området placeras som:
   - Rubrik i `A50`
   - Anteckningsceller i `A51:J55`

### Visuellt resultat

```text
Mätmetod och övriga upplysningar
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│  │  │  │  │  │  │  │  │  │  │  A51:J51
├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
│  │  │  │  │  │  │  │  │  │  │  A52:J52
├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
│  │  │  │  │  │  │  │  │  │  │  A53:J53
├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
│  │  │  │  │  │  │  │  │  │  │  A54:J54
├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
│  │  │  │  │  │  │  │  │  │  │  A55:J55
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
```

### Tekniskt

- I appen renderas anteckningsfältet som 5×10 inputs istället för 5 fullbreddsinputs.
- `sheet.notes` fortsätter användas, men tolkas som 5 rader där celler separeras med tabbar.
- Excel-exporten fyller alla 10 kolumner per anteckningsrad utan sammanfogade celler.