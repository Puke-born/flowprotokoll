import ExcelJS from "exceljs";
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

export const GRID_ROWS = 36;

export interface SmartImportSettings {
  dataStart: number;
  dataEnd: number;
  notesStart: number;
  notesEnd: number;
  kundCell: string;
  anlaggningCell: string;
  systemCell: string;
  planCell: string;
}

export interface SheetOverflow {
  name: string;
  lastDataRow: number;
}

export interface SmartImportedSheet {
  name: string;
  rows: GridRow[];
  notes: string;
  system: string;
  plan: string;
}

export interface SmartImportResult {
  kund: string;
  anlaggning: string;
  sheets: SmartImportedSheet[];
}

export const DEFAULT_SMART_SETTINGS: SmartImportSettings = {
  dataStart: 14,
  dataEnd: 49,
  notesStart: 51,
  notesEnd: 55,
  kundCell: "",
  anlaggningCell: "",
  systemCell: "",
  planCell: "",
};

function readCell(v: ExcelJS.CellValue | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const obj = v as unknown as Record<string, unknown>;
    if ("result" in obj && obj.result != null) {
      const r = obj.result;
      if (typeof r === "object" && r !== null && "error" in (r as Record<string, unknown>)) return "";
      return String(r);
    }
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map((t) => t.text ?? "").join("");
    }
    if ("text" in obj && obj.text != null) return String(obj.text);
    if ("error" in obj) return "";
  }
  return "";
}

async function loadWorkbook(file: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  // exceljs accepts ArrayBuffer via xlsx.load
  await wb.xlsx.load(file as ExcelJS.Buffer);
  return wb;
}

export async function getSheetNames(file: ArrayBuffer): Promise<string[]> {
  const wb = await loadWorkbook(file);
  return wb.worksheets.map((ws) => ws.name);
}

export async function importSheets(file: ArrayBuffer, sheetNames: string[]): Promise<ImportedSheet[]> {
  const wb = await loadWorkbook(file);
  return sheetNames.map((name) => {
    const ws = wb.getWorksheet(name);
    if (!ws) return { name, rows: Array.from({ length: 36 }, () => ({})), notes: "" };

    // Rows 14-49, columns 1-10 (A-J), ExcelJS is 1-indexed
    const rows: GridRow[] = [];
    for (let r = 14; r <= 49; r++) {
      const row: GridRow = {};
      for (let c = 1; c <= 10; c++) {
        const val = readCell(ws.getRow(r).getCell(c).value);
        if (val !== "") row[COL_KEYS[c - 1]] = val;
      }
      rows.push(row);
    }

    // Notes rows 51-55, columns 1-10 → tab/newline serialization
    const noteLines: string[] = [];
    for (let r = 51; r <= 55; r++) {
      const parts: string[] = [];
      for (let c = 1; c <= 10; c++) {
        parts.push(readCell(ws.getRow(r).getCell(c).value).replace(/\t|\n/g, " "));
      }
      noteLines.push(parts.join("\t").replace(/\t+$/, ""));
    }
    while (noteLines.length && noteLines[noteLines.length - 1] === "") noteLines.pop();

    return { name, rows, notes: noteLines.join("\n") };
  });
}

/* ---------- Smart Import ---------- */

function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = /^([A-Za-z]{1,3})\s*(\d{1,7})$/.exec(ref.trim());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]), col };
}

function cellText(ws: ExcelJS.Worksheet, ref: string): string {
  const pos = parseCellRef(ref);
  if (!pos) return "";
  return readCell(ws.getRow(pos.row).getCell(pos.col).value).trim();
}

function rowValues(ws: ExcelJS.Worksheet, r: number): string[] {
  const out: string[] = [];
  for (let c = 1; c <= 10; c++) out.push(readCell(ws.getRow(r).getCell(c).value).trim());
  return out;
}

const NOTE_KEYWORDS = ["anteckning", "mätmetod", "matmetod", "övrig", "ovrig", "upplysning", "kommentar"];

function isNumericish(v: string): boolean {
  if (!v) return false;
  return /^[\d\s.,+\-*/x]+$/.test(v) && /\d/.test(v);
}

type RowKind = "empty" | "data" | "notes";

function classifyRow(vals: string[]): RowKind {
  const nonEmpty = vals.filter((v) => v !== "");
  if (nonEmpty.length === 0) return "empty";
  const lower = nonEmpty[0].toLowerCase();
  if (NOTE_KEYWORDS.some((k) => lower.startsWith(k))) return "notes";
  const longText = nonEmpty.some((v) => v.length > 40);
  if (longText) return "notes";
  const roomish = vals[0] !== "" || vals[1] !== "";
  const numeric = vals.slice(2).some(isNumericish);
  if (roomish && numeric) return "data";
  if (numeric) return "data";
  if (roomish && nonEmpty.length > 1) return "data";
  return "notes";
}

const MAX_SCAN = 60;

/** Scan rows after the chosen end row for rows matching the measurement pattern. */
export async function scanSmartImport(
  file: ArrayBuffer,
  sheetNames: string[],
  settings: SmartImportSettings
): Promise<SheetOverflow[]> {
  const wb = await loadWorkbook(file);
  const overflows: SheetOverflow[] = [];
  for (const name of sheetNames) {
    const ws = wb.getWorksheet(name);
    if (!ws) continue;
    let last = 0;
    let emptyStreak = 0;
    for (let r = settings.dataEnd + 1; r <= settings.dataEnd + MAX_SCAN; r++) {
      const kind = classifyRow(rowValues(ws, r));
      if (kind === "notes") break;
      if (kind === "empty") {
        emptyStreak++;
        if (emptyStreak >= 2) break;
        continue;
      }
      emptyStreak = 0;
      last = r;
    }
    if (last > settings.dataEnd) overflows.push({ name, lastDataRow: last });
  }
  return overflows;
}

export async function importSheetsSmart(
  file: ArrayBuffer,
  sheetNames: string[],
  settings: SmartImportSettings,
  endOverrides: Record<string, number> = {}
): Promise<SmartImportResult> {
  const wb = await loadWorkbook(file);
  const result: SmartImportResult = { kund: "", anlaggning: "", sheets: [] };

  sheetNames.forEach((name, sheetIdx) => {
    const ws = wb.getWorksheet(name);
    if (!ws) {
      result.sheets.push({ name, rows: Array.from({ length: GRID_ROWS }, () => ({})), notes: "", system: "", plan: "" });
      return;
    }

    if (sheetIdx === 0) {
      if (settings.kundCell) result.kund = cellText(ws, settings.kundCell);
      if (settings.anlaggningCell) result.anlaggning = cellText(ws, settings.anlaggningCell);
    }

    const system = settings.systemCell ? cellText(ws, settings.systemCell) : "";
    const plan = settings.planCell ? cellText(ws, settings.planCell) : "";

    const end = Math.max(settings.dataEnd, endOverrides[name] ?? 0);
    const allRows: GridRow[] = [];
    for (let r = settings.dataStart; r <= end; r++) {
      const vals = rowValues(ws, r);
      const row: GridRow = {};
      vals.forEach((v, i) => {
        if (v !== "") row[COL_KEYS[i]] = v;
      });
      allRows.push(row);
    }

    // Notes
    const noteLines: string[] = [];
    for (let r = settings.notesStart; r <= settings.notesEnd; r++) {
      const parts = rowValues(ws, r).map((v) => v.replace(/\t|\n/g, " "));
      noteLines.push(parts.join("\t").replace(/\t+$/, ""));
    }
    while (noteLines.length && noteLines[noteLines.length - 1] === "") noteLines.pop();
    const notes = noteLines.join("\n");

    // Split into chunks of GRID_ROWS (overflow spills to extra app sheets)
    const chunks = Math.max(1, Math.ceil(allRows.length / GRID_ROWS));
    for (let i = 0; i < chunks; i++) {
      const slice = allRows.slice(i * GRID_ROWS, (i + 1) * GRID_ROWS);
      while (slice.length < GRID_ROWS) slice.push({});
      result.sheets.push({
        name: i === 0 ? name : `${name} (${i + 1})`,
        rows: slice,
        notes: i === 0 ? notes : "",
        system,
        plan,
      });
    }
  });

  return result;
}
