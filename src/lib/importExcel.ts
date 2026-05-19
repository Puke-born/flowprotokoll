import * as XLSX from "xlsx";
import type { GridRow } from "@/components/AirflowGrid";

const COL_KEYS = [
  "rum_nr", "rum_namn", "tilluft_dontyp", "tilluft_inst",
  "tilluft_beraknat", "tilluft_uppmat", "franluft_dontyp",
  "franluft_inst", "franluft_beraknat", "franluft_uppmat",
];

const MAX_ROWS = 36;
const SCAN_LIMIT = 60;

interface ImportedSheet {
  name: string;
  rows: GridRow[];
  notes: string;
}

export function getSheetNames(file: ArrayBuffer): string[] {
  const wb = XLSX.read(file, { type: "array" });
  return wb.SheetNames;
}

function cellStr(ws: XLSX.WorkSheet, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  return cell && cell.v != null ? String(cell.v).trim() : "";
}

function detectStartRow(ws: XLSX.WorkSheet): number {
  // Find row containing "Dontyp" header (any column), data starts on the next row.
  for (let r = 0; r < SCAN_LIMIT; r++) {
    for (let c = 0; c < 10; c++) {
      if (cellStr(ws, r, c).toLowerCase() === "dontyp") {
        return r + 2; // 1-indexed row after the header
      }
    }
  }
  return 14;
}

export function detectSheetStartRows(
  file: ArrayBuffer,
  sheetNames: string[]
): Record<string, number> {
  const wb = XLSX.read(file, { type: "array" });
  const out: Record<string, number> = {};
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    out[name] = ws ? detectStartRow(ws) : 14;
  }
  return out;
}

export function importSheets(
  file: ArrayBuffer,
  sheetNames: string[],
  startRows?: Record<string, number>
): ImportedSheet[] {
  const wb = XLSX.read(file, { type: "array" });
  return sheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws) return { name, rows: Array.from({ length: MAX_ROWS }, () => ({})), notes: "" };

    const startRow1 = startRows?.[name] ?? 14;
    const startR = Math.max(0, startRow1 - 1);

    const rows: GridRow[] = [];
    let lastDataIdx = -1;
    for (let i = 0; i < MAX_ROWS; i++) {
      const r = startR + i;
      const row: GridRow = {};
      let any = false;
      for (let c = 0; c < 10; c++) {
        const v = cellStr(ws, r, c);
        if (v) {
          row[COL_KEYS[c]] = v;
          any = true;
        }
      }
      if (!any) break; // stop on first empty row
      rows.push(row);
      lastDataIdx = r;
    }
    // Pad to MAX_ROWS
    while (rows.length < MAX_ROWS) rows.push({});

    // Notes: read 5 rows starting 2 rows after last data row
    let notes = "";
    if (lastDataIdx >= 0) {
      const notesStart = startRow1 === 14 ? 50 : lastDataIdx + 2;
      const noteParts: string[] = [];
      for (let r = notesStart; r < notesStart + 5; r++) {
        const lineParts: string[] = [];
        for (let c = 0; c < 10; c++) {
          const v = cellStr(ws, r, c);
          if (v) lineParts.push(v);
        }
        const line = lineParts.join(" ").trim();
        if (line) noteParts.push(line);
      }
      notes = noteParts.join("\n");
    }

    return { name, rows, notes };
  });
}
