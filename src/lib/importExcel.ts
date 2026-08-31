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
  /** rowIndex -> colKey -> "#RRGGBB" background color read from the workbook */
  colors: Record<number, Record<string, string>>;
}

const IGNORED_FILLS = new Set(["#FFFFFF", "#000000"]);

function readFillColor(cell: ExcelJS.Cell): string | null {
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  if (!fill || fill.type !== "pattern") return null;
  if (fill.pattern === "none") return null;
  const color = fill.fgColor ?? fill.bgColor;
  const argb = color && "argb" in color ? color.argb : undefined;
  if (!argb || argb.length < 6) return null;
  const hex = `#${argb.slice(-6).toUpperCase()}`;
  if (argb.length === 8 && argb.slice(0, 2).toUpperCase() === "00") return null;
  if (IGNORED_FILLS.has(hex)) return null;
  return hex;
}


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

async function loadWorkbook(file: ArrayBuffer, fileName?: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (fileName && /\.xls$/i.test(fileName.trim())) {
    // Legacy .xls: lazy-load SheetJS only when needed, convert to xlsx
    const XLSX = await import("xlsx");
    const xlsWb = XLSX.read(file, { type: "array" });
    const xlsxBuffer = XLSX.write(xlsWb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    await wb.xlsx.load(xlsxBuffer as ExcelJS.Buffer);
    return wb;
  }
  // exceljs accepts ArrayBuffer via xlsx.load
  await wb.xlsx.load(file as ExcelJS.Buffer);
  return wb;
}

export async function getSheetNames(file: ArrayBuffer, fileName?: string): Promise<string[]> {
  const wb = await loadWorkbook(file, fileName);
  return wb.worksheets.map((ws) => ws.name);
}

export async function importSheets(file: ArrayBuffer, sheetNames: string[], fileName?: string): Promise<ImportedSheet[]> {
  const wb = await loadWorkbook(file, fileName);
  return sheetNames.map((name) => {
    const ws = wb.getWorksheet(name);
    if (!ws) return { name, rows: Array.from({ length: 36 }, () => ({})), notes: "", colors: {} };

    // Rows 14-49, columns 1-10 (A-J), ExcelJS is 1-indexed
    const rows: GridRow[] = [];
    const colors: Record<number, Record<string, string>> = {};
    for (let r = 14; r <= 49; r++) {
      const row: GridRow = {};
      const rowIdx = r - 14;
      for (let c = 1; c <= 10; c++) {
        const cell = ws.getRow(r).getCell(c);
        const val = readCell(cell.value);
        if (val !== "") row[COL_KEYS[c - 1]] = val;
        const color = readFillColor(cell);
        if (color) {
          colors[rowIdx] = { ...(colors[rowIdx] || {}), [COL_KEYS[c - 1]]: color };
        }
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

    return { name, rows, notes: noteLines.join("\n"), colors };

  });
}
