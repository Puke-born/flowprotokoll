import * as XLSX from "xlsx";
import type { GridRow } from "@/components/AirflowGrid";

interface Sheet {
  name: string;
  kund: string;
  anlaggning: string;
  utfordAv: string;
  arbNr: string;
  datum: string;
  system: string;
  plan: string;
  rows: GridRow[];
  notes: string;
}

const COL_KEYS = [
  "rum_nr", "rum_namn", "tilluft_dontyp", "tilluft_inst",
  "tilluft_beraknat", "tilluft_uppmat", "franluft_dontyp",
  "franluft_inst", "franluft_beraknat", "franluft_uppmat",
];

function hexToXlsxRgb(hex: string): string {
  return hex.replace("#", "").toUpperCase();
}

function buildSheet(sheet: Sheet, sidNr: string): (string | number | null)[][] {
  const wsData: (string | number | null)[][] = [];

  wsData.push([]);
  wsData.push([null, null, null, "OVK - Luftflödesprotokoll"]);
  wsData.push([]);
  wsData.push(["Kund:", null, sheet.kund, null, null, null, null, "Plan:", null, sheet.plan]);
  wsData.push(["Anläggning:", null, sheet.anlaggning, null, null, null, null, "Sid nr:", null, sidNr]);
  wsData.push(["System:", null, sheet.system, null, null, null, null, "Arb.nr:", null, sheet.arbNr]);
  wsData.push(["Utfört av:", null, sheet.utfordAv, null, null, null, null, "Datum:", null, sheet.datum]);
  wsData.push([]);
  wsData.push([null, null, "Tilluft", null, "Luftmängd", null, "Frånluft", null, "Luftmängd"]);
  wsData.push([]);
  wsData.push(["Rum"]);
  wsData.push([null, null, null, "Inst", "Luftflöde", null, null, "Inst", "Luftflöde"]);
  wsData.push([null, null, "Dontyp", "Pa/K-f", "Beräknat", "Uppmätt", "Dontyp", "Pa/K-f", "Beräknat", "Uppmätt"]);

  for (let i = 0; i < 36; i++) {
    const row = sheet.rows[i] || {};
    wsData.push([
      row.rum_nr || null,
      row.rum_namn || null,
      row.tilluft_dontyp || null,
      row.tilluft_inst || null,
      row.tilluft_beraknat || null,
      row.tilluft_uppmat || null,
      row.franluft_dontyp || null,
      row.franluft_inst || null,
      row.franluft_beraknat || null,
      row.franluft_uppmat || null,
    ]);
  }

  // Row 50 (index 49): title in A50
  wsData.push(["Mätmetod och övriga upplysningar"]);
  // Rows 51-55 (index 50-54): up to 5 note lines in A
  const noteLines = (sheet.notes || "").split("\n");
  for (let i = 0; i < 5; i++) {
    const cells = (noteLines[i] || "").split("\t");
    const row: (string | null)[] = [];
    for (let c = 0; c < 10; c++) {
      row.push(cells[c] || null);
    }
    wsData.push(row);
  }

  return wsData;
}

export function exportAllSheets(sheets: Sheet[], cellColorsPerSheet?: Record<string, Record<string, string>>[]) {
  const wb = XLSX.utils.book_new();
  const total = sheets.length;
  const DATA_START_ROW = 13; // 0-indexed row where grid data starts (row 14 in the sheet)

  sheets.forEach((sheet, i) => {
    const sidNr = `${i + 1}/${total}`;
    const wsData = buildSheet(sheet, sidNr);
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply cell colors
    const colors = cellColorsPerSheet?.[i];
    if (colors) {
      Object.entries(colors).forEach(([rowIdxStr, cols]) => {
        const rowIdx = Number(rowIdxStr);
        Object.entries(cols).forEach(([colKey, hex]) => {
          const colIdx = COL_KEYS.indexOf(colKey);
          if (colIdx === -1) return;
          const cellRef = XLSX.utils.encode_cell({ r: DATA_START_ROW + rowIdx, c: colIdx });
          if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };
          ws[cellRef].s = {
            fill: { patternType: "solid", fgColor: { rgb: hexToXlsxRgb(hex) } },
          };
        });
      });
    }

    const name = sheet.name || (total === 1 ? "Luftflödesprotokoll" : `Blad ${i + 1}`);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });

  const anlaggning = sheets[0]?.anlaggning?.replace(/[/\\:*?"<>|]/g, "").trim() || "export";
  const datum = sheets[0]?.datum || new Date().toISOString().slice(0, 10);
  const filename = `LFP ${anlaggning} ${datum}.xlsx`;
  XLSX.writeFile(wb, filename);
}
