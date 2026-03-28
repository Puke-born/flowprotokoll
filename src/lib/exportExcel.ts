import * as XLSX from "xlsx";
import type { GridRow } from "@/components/AirflowGrid";

interface HeaderData {
  kund: string;
  anlaggning: string;
  system: string;
  utfordAv: string;
  plan: string;
  sidNr: string;
  arbNr: string;
  datum: string;
}

const COL_KEYS = [
  "rum_nr",
  "rum_namn",
  "tilluft_dontyp",
  "tilluft_inst",
  "tilluft_beraknat",
  "tilluft_uppmat",
  "franluft_dontyp",
  "franluft_inst",
  "franluft_beraknat",
  "franluft_uppmat",
];

export function exportToExcel(header: HeaderData, rows: GridRow[]) {
  const wb = XLSX.utils.book_new();
  const wsData: (string | number | null)[][] = [];

  // Header rows (rows 1-13 in Excel)
  wsData.push([]); // row 1
  wsData.push([null, null, null, "OVK - Luftflödesprotokoll"]); // row 2
  wsData.push([]); // row 3
  wsData.push(["Kund:", null, header.kund, null, null, null, null, "Plan:", null, header.plan]); // row 4
  wsData.push(["Anläggning:", null, header.anlaggning, null, null, null, null, "Sid nr:", null, header.sidNr]); // row 5
  wsData.push(["System:", null, header.system, null, null, null, null, "Arb.nr:", null, header.arbNr]); // row 6
  wsData.push(["Utfört av:", null, header.utfordAv, null, null, null, null, "Datum:", null, header.datum]); // row 7
  wsData.push([]); // row 8
  wsData.push([null, null, "Tilluft", null, "Luftmängd", null, "Frånluft", null, "Luftmängd"]); // row 9
  wsData.push([]); // row 10
  wsData.push(["Rum"]); // row 11
  wsData.push([null, null, null, "Inst", "Luftflöde", null, null, "Inst", "Luftflöde"]); // row 12
  wsData.push([null, null, "Dontyp", "Pa/K-f", "Beräknat", "Uppmätt", "Dontyp", "Pa/K-f", "Beräknat", "Uppmätt"]); // row 13

  // Data rows 14-55
  for (let i = 0; i < 42; i++) {
    const row = rows[i] || {};
    wsData.push([
      row.rum || null,
      null,
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

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Luftflödesprotokoll");

  const filename = `Luftflodesprotokoll_${header.kund || "export"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
