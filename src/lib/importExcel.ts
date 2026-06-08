import * as XLSX from "xlsx";
import type { GridRow } from "@/components/AirflowGrid";

const COL_KEYS = [
  "rum_nr", "rum_namn", "tilluft_dontyp", "tilluft_inst",
  "tilluft_beraknat", "tilluft_uppmat", "franluft_dontyp",
  "franluft_inst", "franluft_beraknat", "franluft_uppmat",
];

export interface CellRange {
  r1: number; c1: number; r2: number; c2: number;
}

export function parseRange(range: string): CellRange | null {
  if (!range) return null;
  const trimmed = range.trim().toUpperCase();
  if (!/^[A-Z]+\d+:[A-Z]+\d+$/.test(trimmed)) return null;
  try {
    const r = XLSX.utils.decode_range(trimmed);
    if (r.s.r < 0 || r.s.c < 0 || r.e.r < r.s.r || r.e.c < r.s.c) return null;
    return { r1: r.s.r, c1: r.s.c, r2: r.e.r, c2: r.e.c };
  } catch {
    return null;
  }
}

export function readSheetPreview(
  file: ArrayBuffer,
  sheetName: string,
  maxRows = 100,
  maxCols = 26,
): string[][] {
  const wb = XLSX.read(file, { type: "array" });
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const ref = ws["!ref"];
  let endR = maxRows - 1;
  let endC = maxCols - 1;
  if (ref) {
    try {
      const range = XLSX.utils.decode_range(ref);
      endR = Math.min(maxRows - 1, Math.max(range.e.r, 0));
      endC = Math.min(maxCols - 1, Math.max(range.e.c, 0));
    } catch { /* ignore */ }
  }
  const rows: string[][] = [];
  for (let r = 0; r <= endR; r++) {
    const row: string[] = [];
    for (let c = 0; c <= endC; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      row.push(cell && cell.v != null ? String(cell.w ?? cell.v) : "");
    }
    rows.push(row);
  }
  return rows;
}

interface ImportedSheet {
  name: string;
  rows: GridRow[];
  notes: string;
}

export function getSheetNames(file: ArrayBuffer): string[] {
  const wb = XLSX.read(file, { type: "array" });
  return wb.SheetNames;
}

export function importSheets(
  file: ArrayBuffer,
  sheetNames: string[],
  dataRange: CellRange,
  notesRange: CellRange,
): ImportedSheet[] {
  const wb = XLSX.read(file, { type: "array" });
  const dataRowCount = dataRange.r2 - dataRange.r1 + 1;
  return sheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws) return { name, rows: Array.from({ length: dataRowCount }, () => ({})), notes: "" };

    // Read data range; map up to 10 columns (A–J) to COL_KEYS in order
    const rows: GridRow[] = [];
    const dataColCount = Math.min(COL_KEYS.length, dataRange.c2 - dataRange.c1 + 1);
    for (let r = dataRange.r1; r <= dataRange.r2; r++) {
      const row: GridRow = {};
      for (let i = 0; i < dataColCount; i++) {
        const addr = XLSX.utils.encode_cell({ r, c: dataRange.c1 + i });
        const cell = ws[addr];
        if (cell && cell.v != null) {
          row[COL_KEYS[i]] = String(cell.w ?? cell.v);
        }
      }
      rows.push(row);
    }

    // Read notes range, preserving column layout via tabs
    const noteLines: string[] = [];
    const notesColCount = notesRange.c2 - notesRange.c1 + 1;
    for (let r = notesRange.r1; r <= notesRange.r2; r++) {
      const lineParts: string[] = [];
      for (let i = 0; i < notesColCount; i++) {
        const addr = XLSX.utils.encode_cell({ r, c: notesRange.c1 + i });
        const cell = ws[addr];
        lineParts.push(cell && cell.v != null ? String(cell.w ?? cell.v).replace(/\t|\n/g, " ") : "");
      }
      noteLines.push(lineParts.join("\t").replace(/\t+$/, ""));
    }
    while (noteLines.length && noteLines[noteLines.length - 1] === "") noteLines.pop();

    return { name, rows, notes: noteLines.join("\n") };
  });
}
