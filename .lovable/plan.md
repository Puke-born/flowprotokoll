## Plan

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