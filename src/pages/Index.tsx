import { useState, useCallback, useRef, useEffect } from "react";
import { AirVent, Download, Upload, Trash2, Plus, Copy, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Pencil, FilePlus2, Save, FolderOpen, MoreVertical, RefreshCw } from "lucide-react";
import { initUpdateCheck, forceHardReload } from "@/lib/updateCheck";
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
import { useEnterAsTab } from "@/hooks/use-enter-as-tab";
import AirflowGrid, { type GridRow } from "@/components/AirflowGrid";
import NotesGrid from "@/components/NotesGrid";
import flovvkLogo from "@/assets/flovvk-logo.png.asset.json";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  }
}

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
const FORMULA_BAR_KEY = "lfp-formula-bar-open";


type ActiveCell =
  | { source: "grid"; row: number; col: string }
  | { source: "notes"; r: number; c: number }
  | null;

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
  const [importFileName, setImportFileName] = useState<string>("");

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
  const [confirmAction, setConfirmAction] = useState<null | "new" | "clear" | "remove" | "export" | "reload">(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [activeCell, setActiveCell] = useState<ActiveCell>(null);
  const [formulaBarOpen, setFormulaBarOpen] = useState(() => {
    const v = localStorage.getItem(FORMULA_BAR_KEY);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    localStorage.setItem(FORMULA_BAR_KEY, formulaBarOpen ? "1" : "0");
  }, [formulaBarOpen]);

  useEnterAsTab();

  // Anteckningsrutnät: fokuserad cell + mätt rad-bredd för dynamisk inputbredd
  const confirmConfig = {
    new: {
      title: "Skapa nytt protokoll?",
      description: "All osparad data kommer att gå förlorad. Är du säker?",
    },
    clear: {
      title: "Rensa aktivt blad?",
      description: "All data och färgmarkering på det aktiva bladet kommer att tas bort.",
    },
    remove: {
      title: "Ta bort aktivt blad?",
      description: "Bladet och dess innehåll kommer att tas bort permanent.",
    },
    export: {
      title: "Exportera till Excel?",
      description: "De tillfälliga gula markeringarna från importen försvinner när du exporterar. Övriga färgmarkerade celler behålls.",
    },
    reload: {
      title: "Ladda om appen?",
      description: "Sparade projekt påverkas inte, men osparade ändringar kan gå förlorade.",
    },
  } as const;

  // Persist to localStorage (debounced to avoid JSON.stringify on every keystroke)
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, activeSheet }));
      localStorage.setItem(IMPORTED_CELLS_KEY, serializeImportedCells(importedCellsMap));
      const obj: Record<string, Record<string, Record<string, string>>> = {};
      cellColorsMap.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(CELL_COLORS_KEY, JSON.stringify(obj));
    }, 400);
    return () => window.clearTimeout(id);
  }, [sheets, activeSheet, importedCellsMap, cellColorsMap]);

  // Update-checker: check every 60 min + on window focus.
  useEffect(() => {
    const stop = initUpdateCheck(() => setUpdateAvailable(true), 60 * 60 * 1000);
    return () => stop && stop();
  }, []);

  // Keep sticky header pinned to the visible viewport even when the on-screen
  // keyboard shrinks the viewport on tablets/phones.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = headerRef.current;
    if (!vv || !el) return;
    const update = () => {
      // offsetTop is the number of pixels the visual viewport is offset from
      // the layout viewport (positive when the keyboard covers the bottom).
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    update();
    vv.addEventListener("scroll", update);
    vv.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("scroll", update);
      vv.removeEventListener("resize", update);
    };
  }, []);

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
      // Clear manual color for this cell so imported/marker colors reset on edit
      setCellColorsMap((prev) => {
        const sheetColors = prev.get(activeSheet);
        if (!sheetColors?.[rowIndex]?.[colKey]) return prev;
        const next = new Map(prev);
        const rowColors = { ...sheetColors[rowIndex] };
        delete rowColors[colKey];
        if (Object.keys(rowColors).length === 0) {
          const newSheetColors = { ...sheetColors };
          delete newSheetColors[rowIndex];
          if (Object.keys(newSheetColors).length === 0) {
            next.delete(activeSheet);
          } else {
            next.set(activeSheet, newSheetColors);
          }
        } else {
          next.set(activeSheet, { ...sheetColors, [rowIndex]: rowColors });
        }
        return next;
      });
    },
    [activeSheet]
  );


  const handleNotesCommit = useCallback((value: string) => {
    setSheets((prev) => {
      if (prev[activeSheet].notes === value) return prev;
      const next = [...prev];
      next[activeSheet] = { ...next[activeSheet], notes: value };
      return next;
    });
  }, [activeSheet]);

  const handleNotesCellSelect = useCallback((r: number, c: number) => {
    setActiveCell({ source: "notes", r, c });
  }, []);

  const writeNoteCell = useCallback((r: number, c: number, v: string) => {
    setSheets((prev) => {
      const next = [...prev];
      const allLines = (next[activeSheet].notes || "").split("\n");
      while (allLines.length < 5) allLines.push("");
      const rowCells = (allLines[r] || "").split("\t");
      while (rowCells.length < 10) rowCells.push("");
      rowCells[c] = v.replace(/\t|\n/g, " ");
      allLines[r] = rowCells.slice(0, 10).join("\t").replace(/\t+$/, "");
      next[activeSheet] = { ...next[activeSheet], notes: allLines.slice(0, 5).join("\n") };
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
    reader.onload = async (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const names = await getSheetNames(buffer, file.name);
        setImportFileBuffer(buffer);
        setImportFileName(file.name);
        setAvailableSheetNames(names);
        setSelectedSheetNames(names); // select all by default
        setImportDialogOpen(true);
      } catch (err) {
        console.error(err);
        toast.error("Kunde inte läsa filen");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // reset so same file can be picked again
  }, []);

  const handleImportConfirm = useCallback(async () => {
    if (!importFileBuffer || selectedSheetNames.length === 0) return;
    let imported: Awaited<ReturnType<typeof importSheets>>;
    try {
      imported = await importSheets(importFileBuffer, selectedSheetNames, importFileName);
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte importera filen");
      return;
    }
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
  }, [importFileBuffer, importFileName, selectedSheetNames]);

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
          fileHandleRef.current = await window.showSaveFilePicker!({
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

  const doExport = useCallback(async () => {
    const cellColorsForExport: Record<string, Record<string, string>>[] = sheets.map((_, i) => cellColorsMap.get(i) || {});
    try {
      await exportAllSheets(sheets, cellColorsForExport);
      setImportedCellsMap(new Map());
      toast.success("Excel-fil exporterad!");
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte exportera Excel-fil");
    }
  }, [sheets, cellColorsMap]);

  const handleExport = useCallback(() => {
    // Only warn when there are actually temporary yellow highlights present.
    let hasImported = false;
    importedCellsMap.forEach((rows) => {
      if (hasImported) return;
      for (const s of rows) { if (s && s.size > 0) { hasImported = true; break; } }
    });
    if (hasImported) setConfirmAction("export");
    else doExport();
  }, [importedCellsMap, doExport]);

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
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    if (/[<>:"/\\|?*]/.test(trimmed)) {
      toast.error('Bladnamn får inte innehålla < > : " / \\ | ? *');
      return;
    }
    setSheets((prev) => {
      const next = [...prev];
      next[activeSheet] = { ...next[activeSheet], name: trimmed };
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
    setActiveCell({ source: "grid", row, col: colKey });
  }, []);

  const handleRowReorder = useCallback((fromIndex: number, toIndex: number) => {
    setSheets(prev => {
      const updated = [...prev];
      const sheet = { ...updated[activeSheet] };
      const newRows = [...sheet.rows];
      const [movedRow] = newRows.splice(fromIndex, 1);
      newRows.splice(toIndex, 0, movedRow);
      sheet.rows = newRows;
      updated[activeSheet] = sheet;
      return updated;
    });

    // Reorder cellColors
    setCellColorsMap(prev => {
      const colors = prev.get(activeSheet);
      if (!colors) return prev;
      const entries = Object.entries(colors).map(([k, v]) => [Number(k), v] as [number, Record<string, string>]);
      const arr: (Record<string, string> | undefined)[] = [];
      entries.forEach(([idx, val]) => { arr[idx] = val; });
      const [movedColor] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, movedColor);
      const newColors: Record<string, Record<string, string>> = {};
      arr.forEach((val, idx) => { if (val && Object.keys(val).length > 0) newColors[idx] = val; });
      const next = new Map(prev);
      if (Object.keys(newColors).length > 0) next.set(activeSheet, newColors);
      else next.delete(activeSheet);
      return next;
    });

    // Reorder importedCells
    setImportedCellsMap(prev => {
      const imported = prev.get(activeSheet);
      if (!imported) return prev;
      const arr = [...imported];
      const [movedImported] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, movedImported);
      const next = new Map(prev);
      next.set(activeSheet, arr);
      return next;
    });
  }, [activeSheet]);

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
      {/* Update banner */}
      {updateAvailable && (
        <div className="sticky top-0 z-20 bg-primary text-primary-foreground text-sm px-4 py-2 flex items-center justify-between gap-3 shadow">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            En ny version av appen finns tillgänglig.
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="h-7" onClick={() => setConfirmAction("reload")}>
              Ladda om
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setUpdateAvailable(false)}>
              Senare
            </Button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header ref={headerRef} className="sticky top-0 z-10 bg-card border-b border-border shadow-sm will-change-transform">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setConfirmAction("reload")}
            title="Tvinga uppdatering av appen"
            className="flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-muted transition-colors"
          >
            <img src={flovvkLogo.url} alt="FLOVVK - LFP" className="h-8 w-auto" />
          </button>
          {/* Hidden file inputs */}
          <input ref={projectInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadProject} />
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={handleFileSelect} />

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
            <Button variant="outline" size="sm" onClick={() => setConfirmAction("new")} className="gap-1.5">
              <FilePlus2 className="w-4 h-4" />
              Nytt
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmAction("clear")} className="gap-1.5">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setFormulaBarOpen((v) => !v)}
              title={formulaBarOpen ? "Dölj formelfält" : "Visa formelfält"}
            >
              {formulaBarOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {/* Mobile: Export button + dropdown menu */}
          <div className="flex md:hidden items-center gap-2">
            <Button size="sm" onClick={handleExport} className="gap-1.5">
              <Upload className="w-4 h-4" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setFormulaBarOpen((v) => !v)}
              title={formulaBarOpen ? "Dölj formelfält" : "Visa formelfält"}
            >
              {formulaBarOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                <DropdownMenuItem onClick={() => setConfirmAction("new")}>
                  <FilePlus2 className="w-4 h-4 mr-2" />
                  Nytt
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmAction("clear")} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Rensa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Formelfält */}
        {formulaBarOpen && (
          <div className="border-t border-border bg-card">
            <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-2">
              <Input
                value={(() => {
                  if (!activeCell) return "";
                  if (activeCell.source === "grid") {
                    return sheet.rows[activeCell.row]?.[activeCell.col] || "";
                  }
                  const lines = (sheet.notes || "").split("\n");
                  return ((lines[activeCell.r] || "").split("\t")[activeCell.c]) || "";
                })()}
                onChange={(e) => {
                  if (!activeCell) return;
                  if (activeCell.source === "grid") {
                    handleCellChange(activeCell.row, activeCell.col, e.target.value);
                  } else {
                    writeNoteCell(activeCell.r, activeCell.c, e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                disabled={!activeCell}
                placeholder={activeCell ? "" : "Markera en cell"}
                className="h-8 text-sm font-mono flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="w-7 h-7 rounded border border-border shadow-sm cursor-pointer hover:scale-110 transition-transform shrink-0"
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
        )}
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
          <Button variant="ghost" size="sm" onClick={() => setConfirmAction("remove")} className="gap-1 h-8 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ta bort blad</span>
          </Button>
        </div>

        <ProtocolHeader fields={headerFields} />
        <AirflowGrid
          rows={sheet.rows}
          importedCells={importedCellsMap.get(activeSheet)}
          cellColors={cellColorsMap.get(activeSheet)}
          onCellChange={handleCellChange}
          onCellSelect={handleCellSelect}
          onRowReorder={handleRowReorder}
        />
        <NotesGrid
          key={activeSheet}
          notes={sheet.notes}
          onNotesCommit={handleNotesCommit}
          onCellSelect={handleNotesCellSelect}
        />
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
            onChange={(e) => setRenameValue(e.target.value.replace(/[<>:"/\\|?*]/g, ""))}
            placeholder="Bladnamn"
            onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm()}
          />
          <p className="text-xs text-muted-foreground">
            Får inte innehålla: {'< > : " / \\ | ? *'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleRenameConfirm} disabled={!renameValue.trim()}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction ? confirmConfig[confirmAction].title : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? confirmConfig[confirmAction].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction === "new") handleNewProtocol();
                else if (confirmAction === "clear") handleClear();
                else if (confirmAction === "remove") handleRemoveSheet();
                else if (confirmAction === "export") doExport();
                else if (confirmAction === "reload") { setConfirmAction(null); forceHardReload(); return; }
                setConfirmAction(null);
              }}
            >
              Bekräfta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
