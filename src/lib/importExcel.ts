import * as XLSX from "xlsx";
import type { GridRow } from "@/components/AirflowGrid";

const COL_KEYS = [
  "rum_nr", "rum_namn", "tilluft_dontyp", "tilluft_inst",
  "tilluft_beraknat", "tilluft_uppmat", "franluft_dontyp",
  "franluft_inst", "franluft_beraknat", "franluft_uppmat",
];

interface ImportedSheet {
  name: string;
  rows: GridRow[];
  notes: string;
}

export function getSheetNames(file: ArrayBuffer): string[] {
  const wb = XLSX.read(file, { type: "array" });
  return wb.SheetNames;
}

export function importSheets(file: ArrayBuffer, sheetNames: string[]): ImportedSheet[] {
  const wb = XLSX.read(file, { type: "array" });
  return sheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws) return { name, rows: Array.from({ length: 36 }, () => ({})), notes: "" };

    // Read rows 14-49 (0-indexed: 13-48) → columns A-J (0-9)
    const rows: GridRow[] = [];
    for (let r = 13; r < 49; r++) {
      const row: GridRow = {};
      for (let c = 0; c < 10; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.v != null) {
          row[COL_KEYS[c]] = String(cell.v);
        }
      }
      rows.push(row);
    }

    // Read notes from rows 51-55 (0-indexed: 50-54)
    const noteParts: string[] = [];
    for (let r = 50; r < 55; r++) {
      const lineParts: string[] = [];
      for (let c = 0; c < 10; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.v != null) lineParts.push(String(cell.v));
      }
      const line = lineParts.join(" ").trim();
      if (line) noteParts.push(line);
    }

    return { name, rows, notes: noteParts.join("\n") };
  });
}
