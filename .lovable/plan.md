

## Cellfärgning — Uppdaterad plan

### Knappens utseende
En minimalistisk kvadratisk ruta (ingen ikon, ingen text) — ca 24×24px med rundade hörn och tunn kant. Färgen på rutan visar senast använda färg (default: `#fef9c3` gul). Klick öppnar en Popover med 6 färgrutor i en rad.

### Ändringar

**1. `src/pages/Index.tsx`**
- Ny state: `cellColorsMap` (Map<number, Record<string, Record<string, string>>>) — sheet → row → col → hex
- Ny state: `selectedCell: { row: number; col: string } | null`
- Ny state: `lastColor` (string, default `#fef9c3`)
- Färgknapp som en enkel `<button>` med inline `backgroundColor` = `lastColor`, placerad efter "Ta bort blad"-knappen (rad 545), inuti en Popover
- Popover-innehåll: 6 färgrutor (`transparent`, `#fef9c3`, `#bbf7d0`, `#bfdbfe`, `#fecaca`, `#fed7aa`) — klick applicerar på `selectedCell` och uppdaterar `lastColor`
- "Vit/ingen" visas som vit ruta med streckad kant (för transparent)
- Synka `cellColorsMap` i: `handleMoveSheet`, `handleRemoveSheet`, `handleClear`, `handleNewProtocol`, `handleSaveProject`, `handleLoadProject`, localStorage

**2. `src/components/AirflowGrid.tsx`**
- Nya props: `cellColors?: Record<string, Record<string, string>>`, `onCellSelect?: (row: number, colKey: string) => void`
- `onFocus` → anropa `onCellSelect`
- Inline `style={{ backgroundColor }}` från cellColors, med prioritet över importerad gul markering

**3. `src/lib/exportExcel.ts`**
- Ny parameter `cellColors` per sheet
- Applicera XLSX cell fill-styling (`ws[ref].s = { fill: { fgColor: { rgb } } }`) på färgade celler
- Använda `xlsx-js-style` eller SheetJS Pro-liknande approach för cell-styling

### Visuellt
```text
[Ta bort blad] [■]  ← liten färgad kvadrat, klickbar
                 ↓
              ┌──────────────────┐
              │ ◻ 🟡 🟢 🔵 🔴 🟠 │  ← 6 färgrutor i popover
              └──────────────────┘
```

