import * as XLSX from "xlsx";
import type { GridRow } from "@/components/AirflowGrid";

interface Sheet {
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

  wsData.push([]);
  if (sheet.notes) {
    wsData.push(["Övriga anteckningar:", null, sheet.notes]);
  }

  return wsData;
}

export function exportAllSheets(sheets: Sheet[]) {
  const wb = XLSX.utils.book_new();
  const total = sheets.length;

  sheets.forEach((sheet, i) => {
    const sidNr = `${i + 1}/${total}`;
    const wsData = buildSheet(sheet, sidNr);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const name = sheet.name || (total === 1 ? "Luftflödesprotokoll" : `Blad ${i + 1}`);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });

  const anlaggning = sheets[0]?.anlaggning?.replace(/[/\\:*?"<>|]/g, "").trim() || "export";
  const datum = sheets[0]?.datum || new Date().toISOString().slice(0, 10);
  const filename = `LFP ${anlaggning} ${datum}.xlsx`;
  XLSX.writeFile(wb, filename);
}
