import { useState, useCallback } from "react";
import { FileSpreadsheet, Download, Trash2, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProtocolHeader from "@/components/ProtocolHeader";
import AirflowGrid, { type GridRow } from "@/components/AirflowGrid";
import { exportAllSheets } from "@/lib/exportExcel";
import { toast } from "sonner";

const NUM_ROWS = 36; // rows 14–49

const createEmptyRows = (): GridRow[] =>
  Array.from({ length: NUM_ROWS }, () => ({}));

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

const createEmptySheet = (): Sheet => ({
  kund: "",
  anlaggning: "",
  utfordAv: "",
  arbNr: "",
  datum: new Date().toISOString().slice(0, 10),
  system: "",
  plan: "",
  rows: createEmptyRows(),
  notes: "",
});

const Index = () => {
  const [sheets, setSheets] = useState<Sheet[]>([createEmptySheet()]);
  const [activeSheet, setActiveSheet] = useState(0);

  const sheet = sheets[activeSheet];
  const totalPages = sheets.length;
  const sidNr = `${activeSheet + 1}/${totalPages}`;

  const updateSheetField = useCallback((key: keyof Sheet) => (value: string) => {
    setSheets((prev) => {
      const next = [...prev];
      next[activeSheet] = { ...next[activeSheet], [key]: value };
      return next;
    });
  }, [activeSheet]);

  const handleCellChange = useCallback(
    (rowIndex: number, colKey: string, value: string) => {
      setSheets((prev) => {
        const next = [...prev];
        const rows = [...next[activeSheet].rows];
        rows[rowIndex] = { ...rows[rowIndex], [colKey]: value };
        next[activeSheet] = { ...next[activeSheet], rows };
        return next;
      });
    },
    [activeSheet]
  );

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSheets((prev) => {
      const next = [...prev];
      next[activeSheet] = { ...next[activeSheet], notes: value };
      return next;
    });
  }, [activeSheet]);

  const handleAddSheet = useCallback(() => {
    setSheets((prev) => [...prev, createEmptySheet()]);
    setActiveSheet((prev) => prev + 1);
    toast.success("Nytt blad tillagt");
  }, []);

  const handleCopyData = useCallback(() => {
    if (activeSheet === 0) return;
    const prev = sheets[activeSheet - 1];
    setSheets((s) => {
      const next = [...s];
      next[activeSheet] = {
        ...next[activeSheet],
        kund: prev.kund,
        anlaggning: prev.anlaggning,
        utfordAv: prev.utfordAv,
        arbNr: prev.arbNr,
        datum: prev.datum,
        system: prev.system,
        plan: prev.plan,
      };
      return next;
    });
    toast.success("Data kopierad från föregående blad");
  }, [activeSheet, sheets]);

  const handleRemoveSheet = useCallback(() => {
    if (sheets.length <= 1) return;
    setSheets((prev) => prev.filter((_, i) => i !== activeSheet));
    setActiveSheet((prev) => Math.min(prev, sheets.length - 2));
    toast.info("Blad borttaget");
  }, [activeSheet, sheets.length]);

  const handleExport = useCallback(() => {
    exportAllSheets(sheets);
    toast.success("Excel-fil exporterad!");
  }, [sheets]);

  const handleClear = useCallback(() => {
    setSheets([createEmptySheet()]);
    setActiveSheet(0);
    toast.info("Formuläret har rensats");
  }, []);

  const headerFields = [
    { label: "Kund", value: sheet.kund, onChange: updateSheetField("kund") },
    { label: "Plan", value: sheet.plan, onChange: updateSheetField("plan") },
    { label: "Anläggning", value: sheet.anlaggning, onChange: updateSheetField("anlaggning") },
    { label: "Sid nr", value: sidNr, onChange: () => {}, readOnly: true },
    { label: "System", value: sheet.system, onChange: updateSheetField("system") },
    { label: "Arb.nr", value: sheet.arbNr, onChange: updateSheetField("arbNr") },
    { label: "Utfört av", value: sheet.utfordAv, onChange: updateSheetField("utfordAv") },
    { label: "Datum", value: sheet.datum, onChange: updateSheetField("datum") },
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
            <Button variant="outline" size="sm" onClick={handleClear} className="gap-1.5">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Rensa</span>
            </Button>
            <Button size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportera Excel</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-8">
        {/* Sheet tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {sheets.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSheet(i)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  i === activeSheet
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Blad {i + 1}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleAddSheet} className="gap-1 h-8">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nytt blad</span>
          </Button>
          {activeSheet > 0 && (
            <Button variant="outline" size="sm" onClick={handleCopyData} className="gap-1 h-8">
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kopiera data</span>
            </Button>
          )}
          {sheets.length > 1 && (
            <Button variant="ghost" size="sm" onClick={handleRemoveSheet} className="gap-1 h-8 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ta bort blad</span>
            </Button>
          )}
        </div>

        <ProtocolHeader fields={headerFields} />
        <AirflowGrid rows={sheet.rows} onCellChange={handleCellChange} />
        <div className="rounded-lg border border-grid-border shadow-sm overflow-hidden">
          <div className="bg-grid-header px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-grid-header-foreground">Övriga anteckningar</span>
          </div>
          <textarea
            value={sheet.notes}
            onChange={handleNotesChange}
            placeholder="Skriv eventuella anteckningar här..."
            className="w-full min-h-[100px] px-3 py-2 text-sm font-mono bg-grid-cell text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </div>
        <p className="text-[11px] text-muted-foreground text-right">
          Samtliga luftflöden i l/s
        </p>
      </main>
    </div>
  );
};

export default Index;
