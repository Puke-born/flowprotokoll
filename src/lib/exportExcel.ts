import ExcelJS from "exceljs";
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

function hexToArgb(hex: string): string {
  const clean = hex.replace("#", "").toUpperCase();
  return clean.length === 6 ? `FF${clean}` : clean;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[<>:"/\\|?*[\]]/g, "").slice(0, 31) || "Blad";
}

function cloneWorksheetModel(model: ExcelJS.WorksheetModel): ExcelJS.WorksheetModel {
  return JSON.parse(JSON.stringify(model)) as ExcelJS.WorksheetModel;
}

function fillSheet(ws: ExcelJS.Worksheet, sheet: Sheet, sidNr: string, colors?: Record<string, Record<string, string>>) {
  // Header fields
  ws.getCell("C4").value = sheet.kund || null;
  ws.getCell("C5").value = sheet.anlaggning || null;
  ws.getCell("C6").value = sheet.system || null;
  ws.getCell("C7").value = sheet.utfordAv || null;
  ws.getCell("J4").value = sheet.plan || null;
  ws.getCell("J5").value = sidNr;
  ws.getCell("J6").value = sheet.arbNr || null;
  ws.getCell("J7").value = sheet.datum || null;

  // Grid rows A14:J49 (36 rows)
  for (let i = 0; i < 36; i++) {
    const row = sheet.rows[i] || ({} as GridRow);
    const rowNum = 14 + i;
    const values = [
      row.rum_nr, row.rum_namn, row.tilluft_dontyp, row.tilluft_inst,
      row.tilluft_beraknat, row.tilluft_uppmat, row.franluft_dontyp,
      row.franluft_inst, row.franluft_beraknat, row.franluft_uppmat,
    ];
    values.forEach((v, c) => {
      if (v !== undefined && v !== null && v !== "") {
        ws.getCell(rowNum, c + 1).value = v as string;
      }
    });
  }

  // Notes A51:J55
  const noteLines = (sheet.notes || "").split("\n");
  for (let i = 0; i < 5; i++) {
    const cells = (noteLines[i] || "").split("\t");
    for (let c = 0; c < 10; c++) {
      if (cells[c]) ws.getCell(51 + i, c + 1).value = cells[c];
    }
  }

  // User-picked cell colors on grid
  if (colors) {
    Object.entries(colors).forEach(([rowIdxStr, cols]) => {
      const rowIdx = Number(rowIdxStr);
      Object.entries(cols).forEach(([colKey, hex]) => {
        const colIdx = COL_KEYS.indexOf(colKey);
        if (colIdx === -1) return;
        const cell = ws.getCell(14 + rowIdx, colIdx + 1);
        cell.style = {
          ...cell.style,
          fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: hexToArgb(hex) },
          },
        };
      });
    });
  }
}

export async function exportAllSheets(
  sheets: Sheet[],
  cellColorsPerSheet?: Record<string, Record<string, string>>[]
) {
  let templateBuffer: ArrayBuffer;
  try {
    const templateUrl = `${import.meta.env.BASE_URL}LFP_Mall.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(String(response.status));
    templateBuffer = await response.arrayBuffer();
  } catch {
    throw new Error("Kunde inte ladda Excel-mallen (LFP_Mall.xlsx)");
  }

  const outWb = new ExcelJS.Workbook();
  await outWb.xlsx.load(templateBuffer.slice(0));
  const total = sheets.length;
  const templateWs = outWb.worksheets[0];
  const templateModel = cloneWorksheetModel(templateWs.model);

  for (let i = 0; i < total; i++) {
    const sheet = sheets[i];
    const sidNr = `${i + 1}/${total}`;

    const name = sanitizeSheetName(
      sheet.name || (total === 1 ? "Luftflödesprotokoll" : `Blad ${i + 1}`)
    );

    const newWs = i === 0 ? templateWs : outWb.addWorksheet(name);
    newWs.model = { ...cloneWorksheetModel(templateModel), name, id: newWs.id };

    fillSheet(newWs, sheet, sidNr, cellColorsPerSheet?.[i]);
  }

  const anlaggning = sheets[0]?.anlaggning?.replace(/[/\\:*?"<>|]/g, "").trim() || "export";
  const datum = sheets[0]?.datum || new Date().toISOString().slice(0, 10);
  const filename = `LFP ${anlaggning} ${datum}.xlsx`;

  const buf = await outWb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
