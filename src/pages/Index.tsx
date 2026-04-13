import { useState, useCallback, useRef, useEffect } from "react";
import { AirVent, Download, Upload, Trash2, Plus, Copy, ChevronLeft, ChevronRight, Pencil, FilePlus2, Save, FolderOpen, MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
const IMPORTED_CELLS_KEY = "lfp-imported-cells";
const CELL_COLORS_KEY = "lfp-cell-colors";
const LAST_COLOR_KEY = "lfp-last-color";

const COLOR_PALETTE = [
  { hex: "transparent", label: "Ingen" },
  { hex: "#fef9c3", label: "Gul" },
  { hex: "#bbf7d0", label: "Grön" },
  { hex: "#bfdbfe", label: "Blå" },
  { hex: "#fecaca", label: "Röd" },
  { hex: "#fed7aa", label: "Orange" },
];

const serializeImportedCells = (map: Map<number, Set<string>[]>): string => {
  const obj: Record<string, string[][]> = {};
  map.forEach((sets, key) => {
    obj[key] = sets.map((s) => Array.from(s));
  });
  return JSON.stringify(obj);
};

const deserializeImportedCells = (raw: string): Map<number, Set<string>[]> => {
  try {
    const obj = JSON.parse(raw) as Record<string, string[][]>;
    const map = new Map<number, Set<string>[]>();
    Object.entries(obj).forEach(([key, arrays]) => {
      map.set(Number(key), arrays.map((a) => new Set(a)));
    });
    return map;
  } catch {
    return new Map();
  }
};

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
  const [importedCellsMap, setImportedCellsMap] = useState<Map<number, Set<string>[]>>(() => {
    try {
      const raw = localStorage.getItem(IMPORTED_CELLS_KEY);
      return raw ? deserializeImportedCells(raw) : new Map();
    } catch {
      return new Map();
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const [importFileBuffer, setImportFileBuffer] = useState<ArrayBuffer | null>(null);

  // Cell coloring state
  const [cellColorsMap, setCellColorsMap] = useState<Map<number, Record<string, Record<string, string>>>>(() => {
    try {
      const raw = localStorage.getItem(CELL_COLORS_KEY);
      if (!raw) return new Map();
      const obj = JSON.parse(raw) as Record<string, Record<string, Record<string, string>>>;
      const map = new Map<number, Record<string, Record<string, string>>>();
      Object.entries(obj).forEach(([k, v]) => map.set(Number(k), v));
      return map;
    } catch { return new Map(); }
  });
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null);
  const [lastColor, setLastColor] = useState(() => localStorage.getItem(LAST_COLOR_KEY) || "#fef9c3");

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, activeSheet }));
  }, [sheets, activeSheet]);

  useEffect(() => {
    localStorage.setItem(IMPORTED_CELLS_KEY, serializeImportedCells(importedCellsMap));
  }, [importedCellsMap]);

  useEffect(() => {
    const obj: Record<string, Record<string, Record<string, string>>> = {};
    cellColorsMap.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(CELL_COLORS_KEY, JSON.stringify(obj));
  }, [cellColorsMap]);

  useEffect(() => {
    localStorage.setItem(LAST_COLOR_KEY, lastColor);
  }, [lastColor]);

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
      setSheets([createEmptySheet("Blad 1")]);
      setActiveSheet(0);
      setImportedCellsMap(new Map());
      setCellColorsMap(new Map());
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
    setCellColorsMap((prev) => {
      const next = new Map<number, Record<string, Record<string, string>>>();
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
    setCellColorsMap(new Map());
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

  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);

  const handleSaveProject = useCallback(async () => {
    const cellColorsObj: Record<string, Record<string, Record<string, string>>> = {};
    cellColorsMap.forEach((v, k) => { cellColorsObj[k] = v; });
    const projectData = {
      sheets,
      activeSheet,
      importedCells: serializeImportedCells(importedCellsMap),
      cellColors: cellColorsObj,
    };
    const jsonString = JSON.stringify(projectData);

    // Try to reuse existing file handle or pick a new one via File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        if (!fileHandleRef.current) {
          const anlaggning = sheets[0]?.anlaggning?.trim();
          const fileName = anlaggning ? `${anlaggning}.lfp.json` : "projekt.lfp.json";
          fileHandleRef.current = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'LFP Projekt', accept: { 'application/json': ['.json'] } }],
          });
        }
        const writable = await fileHandleRef.current!.createWritable();
        await writable.write(jsonString);
        await writable.close();
        toast.success("Projekt sparat!");
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled
        // Fall through to legacy download
      }
    }

    // Fallback for Firefox/Safari
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const anlaggning = sheets[0]?.anlaggning?.trim();
    const fileName = anlaggning ? `${anlaggning}.lfp.json` : "projekt.lfp.json";
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Projekt sparat!");
  }, [sheets, activeSheet, importedCellsMap, cellColorsMap]);

  const handleLoadProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data.sheets) && data.sheets.length > 0) {
          setSheets(data.sheets);
          setActiveSheet(data.activeSheet ?? 0);
          setImportedCellsMap(
            data.importedCells ? deserializeImportedCells(data.importedCells) : new Map()
          );
          if (data.cellColors) {
            const map = new Map<number, Record<string, Record<string, string>>>();
            Object.entries(data.cellColors).forEach(([k, v]) => map.set(Number(k), v as Record<string, Record<string, string>>));
            setCellColorsMap(map);
          } else {
            setCellColorsMap(new Map());
          }
          toast.success("Projekt laddat!");
        } else {
          toast.error("Ogiltig projektfil");
        }
      } catch {
        toast.error("Kunde inte läsa projektfilen");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleExport = useCallback(() => {
    const cellColorsForExport: Record<string, Record<string, string>>[] = sheets.map((_, i) => cellColorsMap.get(i) || {});
    exportAllSheets(sheets, cellColorsForExport);
    setImportedCellsMap(new Map());
    toast.success("Excel-fil exporterad!");
  }, [sheets, cellColorsMap]);

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
    setCellColorsMap((prev) => {
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
    setCellColorsMap(new Map());
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
    setImportedCellsMap((prev) => {
      const next = new Map<number, Set<string>[]>();
      prev.forEach((v, k) => {
        if (k === activeSheet) next.set(target, v);
        else if (k === target) next.set(activeSheet, v);
        else next.set(k, v);
      });
      return next;
    });
    setCellColorsMap((prev) => {
      const next = new Map<number, Record<string, Record<string, string>>>();
      prev.forEach((v, k) => {
        if (k === activeSheet) next.set(target, v);
        else if (k === target) next.set(activeSheet, v);
        else next.set(k, v);
      });
      return next;
    });
    setActiveSheet(target);
  }, [activeSheet, sheets.length]);

  const handleApplyColor = useCallback((color: string) => {
    if (!selectedCell) return;
    const actualColor = color === "transparent" ? undefined : color;
    setCellColorsMap((prev) => {
      const next = new Map(prev);
      const sheetColors = { ...(next.get(activeSheet) || {}) };
      const rowColors = { ...(sheetColors[selectedCell.row] || {}) };
      if (actualColor) {
        rowColors[selectedCell.col] = actualColor;
      } else {
        delete rowColors[selectedCell.col];
      }
      if (Object.keys(rowColors).length === 0) {
        delete sheetColors[selectedCell.row];
      } else {
        sheetColors[selectedCell.row] = rowColors;
      }
      next.set(activeSheet, sheetColors);
      return next;
    });
    // Also remove import highlight when applying transparent
    if (color === "transparent") {
      setImportedCellsMap((prev) => {
        const next = new Map(prev);
        const arr = next.get(activeSheet);
        if (arr && arr[selectedCell.row]) {
          const newSet = new Set(arr[selectedCell.row]);
          newSet.delete(selectedCell.col);
          const newArr = [...arr];
          newArr[selectedCell.row] = newSet;
          next.set(activeSheet, newArr);
        }
        return next;
      });
    }
    if (color !== "transparent") setLastColor(color);
  }, [activeSheet, selectedCell]);

  const handleCellSelect = useCallback((row: number, colKey: string) => {
    setSelectedCell({ row, col: colKey });
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
            <AirVent className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              LFP
            </h1>
          </div>
          {/* Hidden file inputs */}
          <input ref={projectInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadProject} />
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />

          {/* Desktop buttons */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveProject} className="gap-1.5">
              <Save className="w-4 h-4" />
              Spara
            </Button>
            <Button variant="outline" size="sm" onClick={() => projectInputRef.current?.click()} className="gap-1.5">
              <FolderOpen className="w-4 h-4" />
              Öppna
            </Button>
            <Button variant="outline" size="sm" onClick={handleNewProtocol} className="gap-1.5">
              <FilePlus2 className="w-4 h-4" />
              Nytt
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} className="gap-1.5">
              <Trash2 className="w-4 h-4" />
              Rensa
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Download className="w-4 h-4" />
              Import
            </Button>
            <Button size="sm" onClick={handleExport} className="gap-1.5">
              <Upload className="w-4 h-4" />
              Export
            </Button>
          </div>

          {/* Mobile: Export button + dropdown menu */}
          <div className="flex md:hidden items-center gap-2">
            <Button size="sm" onClick={handleExport} className="gap-1.5">
              <Upload className="w-4 h-4" />
              Export
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSaveProject}>
                  <Save className="w-4 h-4 mr-2" />
                  Spara projekt
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => projectInputRef.current?.click()}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Öppna projekt
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Download className="w-4 h-4 mr-2" />
                  Import
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleNewProtocol}>
                  <FilePlus2 className="w-4 h-4 mr-2" />
                  Nytt
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClear} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Rensa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div className="ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="w-6 h-6 rounded border border-border shadow-sm cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: lastColor }}
                  title="Cellfärg"
                  onClick={() => handleApplyColor(lastColor)}
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" side="bottom" align="end">
                <div className="flex gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleApplyColor(c.hex)}
                      title={c.label}
                      className={`w-6 h-6 rounded border shadow-sm cursor-pointer hover:scale-110 transition-transform ${
                        c.hex === "transparent" ? "border-dashed border-muted-foreground bg-white" : "border-border"
                      }`}
                      style={c.hex !== "transparent" ? { backgroundColor: c.hex } : undefined}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <ProtocolHeader fields={headerFields} />
        <AirflowGrid
          rows={sheet.rows}
          importedCells={importedCellsMap.get(activeSheet)}
          cellColors={cellColorsMap.get(activeSheet)}
          onCellChange={handleCellChange}
          onCellSelect={handleCellSelect}
        />
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
