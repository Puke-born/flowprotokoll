import { useState, useCallback } from "react";
import { FileSpreadsheet, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProtocolHeader from "@/components/ProtocolHeader";
import AirflowGrid, { type GridRow } from "@/components/AirflowGrid";
import { exportToExcel } from "@/lib/exportExcel";
import { toast } from "sonner";

const NUM_ROWS = 36; // rows 14–49

const createEmptyRows = (): GridRow[] =>
  Array.from({ length: NUM_ROWS }, () => ({}));

const Index = () => {
  const [header, setHeader] = useState({
    kund: "",
    anlaggning: "",
    system: "",
    utfordAv: "",
    plan: "",
    sidNr: "",
    arbNr: "",
    datum: new Date().toISOString().slice(0, 10),
  });

  const [rows, setRows] = useState<GridRow[]>(createEmptyRows);
  const [notes, setNotes] = useState("");

  const updateHeader = useCallback((key: string) => (value: string) => {
    setHeader((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleCellChange = useCallback(
    (rowIndex: number, colKey: string, value: string) => {
      setRows((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], [colKey]: value };
        return next;
      });
    },
    []
  );

  const handleExport = useCallback(() => {
    exportToExcel(header, rows, notes);
    toast.success("Excel-fil exporterad!");
  }, [header, rows, notes]);

  const handleClear = useCallback(() => {
    setRows(createEmptyRows());
    setNotes("");
    setHeader((prev) => ({ ...prev, kund: "", anlaggning: "", system: "", plan: "", sidNr: "", arbNr: "" }));
    toast.info("Formuläret har rensats");
  }, []);

  const headerFields = [
    { label: "Kund", value: header.kund, onChange: updateHeader("kund") },
    { label: "Plan", value: header.plan, onChange: updateHeader("plan") },
    { label: "Anläggning", value: header.anlaggning, onChange: updateHeader("anlaggning") },
    { label: "Sid nr", value: header.sidNr, onChange: updateHeader("sidNr") },
    { label: "System", value: header.system, onChange: updateHeader("system") },
    { label: "Arb.nr", value: header.arbNr, onChange: updateHeader("arbNr") },
    { label: "Utfört av", value: header.utfordAv, onChange: updateHeader("utfordAv") },
    { label: "Datum", value: header.datum, onChange: updateHeader("datum") },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Luftflödesprotokoll
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Rensa</span>
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportera Excel</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-8">
        <ProtocolHeader fields={headerFields} />
        <AirflowGrid rows={rows} onCellChange={handleCellChange} />
        <p className="text-[11px] text-muted-foreground text-right">
          Samtliga luftflöden i l/s
        </p>
      </main>
    </div>
  );
};

export default Index;
