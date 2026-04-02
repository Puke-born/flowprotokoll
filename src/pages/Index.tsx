import { useState, useCallback, useRef, useEffect } from "react";
import { FileSpreadsheet, Download, Upload, Trash2, Plus, Copy, ChevronLeft, ChevronRight, Pencil, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProtocolHeader from "@/components/ProtocolHeader";
import AirflowGrid, { type GridRow } from "@/components/AirflowGrid";
import { exportAllSheets } from "@/lib/exportExcel";
import { getSheetNames, importSheets } from "@/lib/importExcel";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const NUM_ROWS = 36; // rows 14–49

const createEmptyRows = (): GridRow[] =>
  Array.from({ length: NUM_ROWS }, () => ({}));

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

const createEmptySheet = (name?: string): Sheet => ({
  name: name || "Blad",
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

const STORAGE_KEY = "lfp-protocol-data";

const loadFromStorage = (): { sheets: Sheet[]; activeSheet: number } | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Array.isArray(data.sheets) && data.sheets.length > 0) {
      return { sheets: data.sheets, activeSheet: data.activeSheet ?? 0 };
    }
  } catch { /* ignore */ }
  return null;
};

const Index = () => {
  const [sheets, setSheets] = useState<Sheet[]>(() => {
    const saved = loadFromStorage();
    return saved ? saved.sheets : [createEmptySheet("Blad 1")];
  });
  const [activeSheet, setActiveSheet] = useState(() => {
    const saved = loadFromStorage();
    return saved ? Math.min(saved.activeSheet, (saved.sheets?.length ?? 1) - 1) : 0;
  });
  const [importedCellsMap, setImportedCellsMap] = useState<Map<number, Set<string>[]>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const [importFileBuffer, setImportFileBuffer] = useState<ArrayBuffer | null>(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, activeSheet }));
  }, [sheets, activeSheet]);

  const sheet = sheets[activeSheet];
  const totalPages = sheets.length;
  const sidNr = `${activeSheet + 1}/${totalPages}`;

  const updateSheetField = useCallback((key: keyof Sheet) => (value: string) => {
    const sanitized = key === "anlaggning" ? value.replace(/[/\\:*?"<>|]/g, "") : value;
    setSheets((prev) => {
      const next = [...prev];
      next[activeSheet] = { ...next[activeSheet], [key]: sanitized };
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
      // Clear imported flag for this cell
      setImportedCellsMap((prev) => {
        const sheetCells = prev.get(activeSheet);
        if (!sheetCells?.[rowIndex]?.has(colKey)) return prev;
        const next = new Map(prev);
        const rowSets = [...sheetCells];
        const newSet = new Set(rowSets[rowIndex]);
        newSet.delete(colKey);
        rowSets[rowIndex] = newSet;
        next.set(activeSheet, rowSets);
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
    setSheets((prev) => {
      const newName = `Blad ${prev.length + 1}`;
      return [...prev, createEmptySheet(newName)];
    });
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
    if (sheets.length <= 1) {
      // Last sheet — reset to clean state
      setSheets([createEmptySheet("Blad 1")]);
      setActiveSheet(0);
      setImportedCellsMap(new Map());
      toast.info("Blad borttaget");
      return;
    }
    // Clear imported cells for removed sheet and re-index
    setImportedCellsMap((prev) => {
      const next = new Map<number, Set<string>[]>();
      prev.forEach((v, k) => {
        if (k < activeSheet) next.set(k, v);
        else if (k > activeSheet) next.set(k - 1, v);
      });
      return next;
    });
    setSheets((prev) => prev.filter((_, i) => i !== activeSheet));
    setActiveSheet((prev) => Math.min(prev, sheets.length - 2));
    toast.info("Blad borttaget");
  }, [activeSheet, sheets.length]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const names = getSheetNames(buffer);
      setImportFileBuffer(buffer);
      setAvailableSheetNames(names);
      setSelectedSheetNames(names); // select all by default
      setImportDialogOpen(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // reset so same file can be picked again
  }, []);

  const handleImportConfirm = useCallback(() => {
    if (!importFileBuffer || selectedSheetNames.length === 0) return;
    const imported = importSheets(importFileBuffer, selectedSheetNames);
    const newSheets: Sheet[] = imported.map((s) => ({
      ...createEmptySheet(s.name),
      rows: s.rows,
      notes: s.notes,
    }));
    // Build imported cells map
    const newImportedMap = new Map<number, Set<string>[]>();
    imported.forEach((s, sheetIdx) => {
      const rowSets: Set<string>[] = s.rows.map((row) => {
        const keys = new Set<string>();
        for (const [k, v] of Object.entries(row)) {
          if (v) keys.add(k);
        }
        return keys;
      });
      newImportedMap.set(sheetIdx, rowSets);
    });
    setImportedCellsMap(newImportedMap);
    setSheets(newSheets);
    setActiveSheet(0);
    setImportDialogOpen(false);
    setImportFileBuffer(null);
    toast.success(`${newSheets.length} blad importerade`);
  }, [importFileBuffer, selectedSheetNames]);

  const toggleSheetSelection = useCallback((name: string) => {
    setSelectedSheetNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const handleExport = useCallback(() => {
    exportAllSheets(sheets);
    toast.success("Excel-fil exporterad!");
  }, [sheets]);

  const handleClear = useCallback(() => {
    setSheets((prev) => {
      const next = [...prev];
      next[activeSheet] = { ...createEmptySheet(prev[activeSheet].name) };
      return next;
    });
    setImportedCellsMap((prev) => {
      const next = new Map(prev);
      next.delete(activeSheet);
      return next;
    });
    toast.info("Bladet har rensats");
  }, [activeSheet]);

  const handleNewProtocol = useCallback(() => {
    setSheets([createEmptySheet("Blad 1")]);
    setActiveSheet(0);
    setImportedCellsMap(new Map());
    toast.success("Nytt protokoll skapat");
  }, []);

  const handleRenameSheet = useCallback(() => {
    setRenameValue(sheets[activeSheet].name);
    setRenameDialogOpen(true);
  }, [activeSheet, sheets]);

  const handleRenameConfirm = useCallback(() => {
    if (!renameValue.trim()) return;
    setSheets((prev) => {
      const next = [...prev];
      next[activeSheet] = { ...next[activeSheet], name: renameValue.trim() };
      return next;
    });
    setRenameDialogOpen(false);
    toast.success("Blad omdöpt");
  }, [activeSheet, renameValue]);

  const handleMoveSheet = useCallback((direction: -1 | 1) => {
    const target = activeSheet + direction;
    if (target < 0 || target >= sheets.length) return;
    setSheets((prev) => {
      const next = [...prev];
      [next[activeSheet], next[target]] = [next[target], next[activeSheet]];
      return next;
    });
    setActiveSheet(target);
  }, [activeSheet, sheets.length]);

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
            <Button variant="outline" size="sm" onClick={handleNewProtocol} className="gap-1.5">
              <FilePlus2 className="w-4 h-4" />
              <span className="hidden sm:inline">Nytt protokoll</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} className="gap-1.5">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Rensa</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Importera Excel</span>
            </Button>
            <Button size="sm" onClick={handleExport} className="gap-1.5">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Exportera Excel</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-8">
        {/* Sheet tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-wrap">
          {sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                i === activeSheet
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleAddSheet} className="gap-1 h-8">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nytt blad</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyData} disabled={activeSheet === 0} className="gap-1 h-8">
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kopiera data</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRenameSheet} className="gap-1 h-8">
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Döp om</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleMoveSheet(-1)} disabled={activeSheet === 0} className="h-8 w-8">
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleMoveSheet(1)} disabled={activeSheet === sheets.length - 1} className="h-8 w-8">
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRemoveSheet} className="gap-1 h-8 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ta bort blad</span>
          </Button>
        </div>

        <ProtocolHeader fields={headerFields} />
        <AirflowGrid rows={sheet.rows} importedCells={importedCellsMap.get(activeSheet)} onCellChange={handleCellChange} />
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
      </main>
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Välj blad att importera</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {availableSheetNames.map((name) => (
              <label key={name} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={selectedSheetNames.includes(name)}
                  onCheckedChange={() => toggleSheetSelection(name)}
                />
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleImportConfirm} disabled={selectedSheetNames.length === 0}>
              Importera ({selectedSheetNames.length} blad)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Döp om blad</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Bladnamn"
            onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleRenameConfirm} disabled={!renameValue.trim()}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
