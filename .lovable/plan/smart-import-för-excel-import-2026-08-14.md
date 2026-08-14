# Smart Import för Excel-import

Behåller nuvarande import oförändrad och lägger till ett nytt, tablet-first "Smart Import"-spår med mönsterigenkänning och varning när mätdata sträcker sig utanför valt område.

## 1. Nytt val efter filval

När en fil valts öppnas först en enkel dialog med två stora knappar (min 64px höjd, staplade på surfplatta):

- **Snabbimport (Standard)** — går direkt till nuvarande bladväljare och nuvarande import. Inget beteende ändras.
- **Smart Import** — öppnar den nya inställningsdialogen.

## 2. ImportMappingDialog (ny komponent)

Tablet-first layout, stora ytor, scrollbar innehållsyta med sticky knappar i botten.

- Bladval (samma checkbox-lista som idag, men med större träffytor).
- Radintervall som steppers med stora +/- knappar och läsbart värde:
  - Mätvärden: start (default 14), slut (default 49)
  - Anteckningar: start (default 51), slut (default 55)
- Cellkoordinatfält (stora textfält, tomma som default, t.ex. "C5"):
  - Global data, läses endast från första valda bladet: **Kund**, **Anläggning**
  - Bladspecifik data, läses per blad: **System**, **Plan**
- Knappar: Avbryt / Importera.

## 3. importSheetsSmart i importExcel.ts

Ny exporterad funktion vid sidan av befintliga `getSheetNames`/`importSheets` (som lämnas orörda).

Den tar bladnamn + inställningarna ovan och returnerar per blad: namn, rader (mätvärdesintervallet mappat till de 10 kolumnerna som idag), anteckningar, samt system/plan — plus global kund/anläggning från första bladet.

**Pre-flight scan (mönsterigenkänning):**

- Första valda bladet används som fingeravtryck: vilka kolumner som innehåller rumsdata (kol 1-2) respektive numeriska flödesvärden (kol 3-10).
- För varje blad skannas raderna efter användarens valda slutrad.
- En rad klassas som *mätvärdesrad* om den har innehåll i rumskolumnerna och/eller minst ett numeriskt värde i flödeskolumnerna, och inte utgörs av en lång fritextsträng.
- En rad klassas som *anteckningsrad* om den huvudsakligen är en lång textsträng eller inleds med ord som "Anteckningar", "Mätmetod", "Övriga".
- Skanningen stannar vid ett ankare: anteckningsrad, eller två tomma rader i följd (rimlig gräns, t.ex. max 60 rader framåt).
- Hittas mätvärdesrader utanför området sparas bladets faktiska sista mätvärdesrad undan och returneras som en avvikelse.

## 4. ImportWarningDialog (ny komponent)

Visas bara när avvikelser hittats; importen pausas.

Text: "Extra mätvärden hittades utanför ditt valda område på följande blad:" följt av lista, t.ex. "Blad 3: Mätvärden fortsätter till rad 55".

Tre stora knappar:

1. **Utöka och importera** — slutraden skrivs dynamiskt över per berört blad och importen körs om med de nya gränserna.
2. **Ignorera extra data** — importerar strikt inom användarens valda intervall.
3. **Avbryt** — stänger dialogen, ingen import.

## 5. State & integration i Index.tsx

- Snabbimport: oförändrad kodväg.
- Smart Import: importerade blad skapas som idag (gul markering för importerade celler, `cellColorsMap` nollställs). Kund/Anläggning från första bladet sätts på samtliga blad (globala fält), System/Plan sätts per blad. Mätvärden och anteckningar läggs på respektive blad.
- Rader utöver appens 36 grid-rader vid "Utöka och importera" spiller över till ett extra LFP-blad med samma huvuddata, så ingen data tappas.

## Teknik

- Nya filer: `src/components/ImportMappingDialog.tsx`, `src/components/ImportWarningDialog.tsx`.
- `src/lib/importExcel.ts`: ny `importSheetsSmart` + intern `scanBeyondRange`-hjälpare; befintlig kod orörd.
- `src/pages/Index.tsx`: ny dialog för val av importläge, state för smart-inställningar och avvikelser, samt kopplingen till sheets-state.
- Fortsatt ExcelJS, 1-indexerade rader/kolumner, samma säkra cellinläsning (`readCell`).
