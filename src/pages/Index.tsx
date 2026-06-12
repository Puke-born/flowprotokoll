import { useState, useCallback, useRef, useEffect } from "react";
import { AirVent, Download, Upload, Trash2, Plus, Copy, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Pencil, FilePlus2, Save, FolderOpen, MoreVertical } from "lucide-react";
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
import { getSheetNames, importSheets, parseRange, readSheetPreview, type CellRange } from "@/lib/importExcel";
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
import { useUpdateNotifier } from "@/hooks/useUpdateNotifier";

const NUM_ROWS = 36; // rows 14–49

const createEmptyRows = (): GridRow[] =>
  Array.from({ length: NUM_ROWS }, () => ({}));

const colLetter = (c: number): string => {
  let s = ""; let n = c;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};

const encodeRange = (r1: number, c1: number, r2: number, c2: number): string => {
  const rr1 = Math.min(r1, r2), rr2 = Math.max(r1, r2);
  const cc1 = Math.min(c1, c2), cc2 = Math.max(c1, c2);
  return `${colLetter(cc1)}${rr1 + 1}:${colLetter(cc2)}${rr2 + 1}`;
};

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


function useVirtualKeyboard() {
  const [state, setState] = useState<{ open: boolean; offsetTop: number }>({ open: false, offsetTop: 0 });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let rafId: number | null = null;
    let lastOpen = false;
    let lastOffset = 0;
    const update = () => {
      rafId = null;
      const kbHeight = window.innerHeight - vv.height - vv.offsetTop;
      const open = kbHeight > 150;
      const offsetTop = Math.round(vv.offsetTop);
      if (open === lastOpen && offsetTop === lastOffset) return;
      lastOpen = open;
      lastOffset = offsetTop;
      setState({ open, offsetTop });
    };
    const schedule = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(update);
    };
    update();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, []);
  return state;
}

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
  const [dataRangeInput, setDataRangeInput] = useState("A14:J49");
  const [notesRangeInput, setNotesRangeInput] = useState("A51:J55");
  const [previewSheetName, setPreviewSheetName] = useState<string>("");
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [rangeSelectionMode, setRangeSelectionMode] = useState<"data" | "notes">("data");
  const [dragSelect, setDragSelect] = useState<null | { startR: number; startC: number; target: "data" | "notes" }>(null);

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
  const [confirmAction, setConfirmAction] = useState<null | "new" | "clear" | "remove" | "export">(null);
  useUpdateNotifier();
  const [activeCell, setActiveCell] = useState<ActiveCell>(null);
  const [formulaBarOpen, setFormulaBarOpen] = useState(() => {
    const v = localStorage.getItem(FORMULA_BAR_KEY);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    localStorage.setItem(FORMULA_BAR_KEY, formulaBarOpen ? "1" : "0");
  }, [formulaBarOpen]);
  const kb = useVirtualKeyboard();

  // Anteckningsrutnät: fokuserad cell + mätt rad-bredd för dynamisk inputbredd
  const [focusedNoteCell, setFocusedNoteCell] = useState<{ r: number; c: number } | null>(null);
  const notesGridRef = useRef<HTMLDivElement>(null);
  const [notesRowWidth, setNotesRowWidth] = useState(0);
  const noteInputsRef = useRef<(HTMLInputElement | null)[][]>(
    Array.from({ length: 5 }, () => Array(10).fill(null)),
  );
  useEffect(() => {
    const el = notesGridRef.current;
    if (!el) return;
    const update = () => setNotesRowWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const measureNoteText = useCallback((text: string) => {
    if (typeof document === "undefined") return 0;
    const canvas = (measureNoteText as unknown as { _c?: HTMLCanvasElement })._c
      ?? ((measureNoteText as unknown as { _c?: HTMLCanvasElement })._c = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    ctx.font = '13px Arial, Helvetica, sans-serif';
    return Math.ceil(ctx.measureText(text).width);
  }, []);

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
      description:
        "Obs! De tillfälliga gula markeringarna av importerade celler försvinner efter export. Egna färgmarkeringar behålls.",
    },
  } as const;

  // Persist to localStorage – debounced så att varje tangenttryck inte
  // kör en synkron JSON.stringify av hela projektet (stort prestandalyft).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, activeSheet }));
      } catch { /* quota etc */ }
    }, 250);
    return () => window.clearTimeout(id);
  }, [sheets, activeSheet]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(IMPORTED_CELLS_KEY, serializeImportedCells(importedCellsMap));
      } catch { /* ignore */ }
    }, 250);
    return () => window.clearTimeout(id);
  }, [importedCellsMap]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const obj: Record<string, Record<string, Record<string, string>>> = {};
        cellColorsMap.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(CELL_COLORS_KEY, JSON.stringify(obj));
      } catch { /* ignore */ }
    }, 250);
    return () => window.clearTimeout(id);
  }, [cellColorsMap]);

  // Spara alltid kvarvarande pending state innan sidan stängs/refreshas
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, activeSheet }));
        localStorage.setItem(IMPORTED_CELLS_KEY, serializeImportedCells(importedCellsMap));
        const obj: Record<string, Record<string, Record<string, string>>> = {};
        cellColorsMap.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(CELL_COLORS_KEY, JSON.stringify(obj));
      } catch { /* ignore */ }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [sheets, activeSheet, importedCellsMap, cellColorsMap]);

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
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const names = getSheetNames(buffer);
      setImportFileBuffer(buffer);
      setAvailableSheetNames(names);
      setSelectedSheetNames(names); // select all by default
      const first = names[0] ?? "";
      setPreviewSheetName(first);
      setPreviewData(first ? readSheetPreview(buffer, first) : []);
      setImportDialogOpen(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // reset so same file can be picked again
  }, []);

  useEffect(() => {
    if (!importFileBuffer || !previewSheetName) return;
    setPreviewData(readSheetPreview(importFileBuffer, previewSheetName, 55, 10));
  }, [previewSheetName, importFileBuffer]);

  const handleImportConfirm = useCallback(() => {
    if (!importFileBuffer || selectedSheetNames.length === 0) return;
    const dataRange = parseRange(dataRangeInput);
    const notesRange = parseRange(notesRangeInput);
    if (!dataRange || !notesRange) {
      toast.error("Ogiltigt cellområde");
      return;
    }
    const imported = importSheets(importFileBuffer, selectedSheetNames, dataRange, notesRange);
    const padRows = (rows: GridRow[]): GridRow[] => {
      const out = rows.slice(0, NUM_ROWS);
      while (out.length < NUM_ROWS) out.push({});
      return out;
    };
    const newSheets: Sheet[] = imported.map((s) => ({
      ...createEmptySheet(s.name),
      rows: padRows(s.rows),
      notes: s.notes,
    }));
    // Build imported cells map
    const newImportedMap = new Map<number, Set<string>[]>();
    imported.forEach((s, sheetIdx) => {
      const paddedRows = padRows(s.rows);
      const rowSets: Set<string>[] = paddedRows.map((row) => {
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
  }, [importFileBuffer, selectedSheetNames, dataRangeInput, notesRangeInput]);

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
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={async () => {
              const ok = window.confirm(
                "Tvinga uppdatering av appen?\n\nAlla osparade ändringar bör sparas först. Appen laddas om och hämtar senaste versionen.",
              );
              if (!ok) return;
              try {
                if ("serviceWorker" in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map((r) => r.unregister()));
                }
                if ("caches" in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map((k) => caches.delete(k)));
                }
              } catch {
                // ignore – fortsätt med reload ändå
              }
              const url = new URL(window.location.href);
              url.searchParams.set("_uv", Date.now().toString());
              window.location.replace(url.toString());
            }}
            className="flex items-center gap-2 rounded-md px-1 -mx-1 py-1 hover:bg-muted/60 active:bg-muted transition-colors"
            aria-label="Tvinga uppdatering av appen"
            title="Tryck för att tvinga fram en uppdatering"
          >
            <AirVent className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              LFP
            </h1>
          </button>
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
            <Button size="sm" onClick={() => setConfirmAction("export")} className="gap-1.5">
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
            <Button size="sm" onClick={() => setConfirmAction("export")} className="gap-1.5">
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
          <div
            className={
              kb.open
                ? "fixed left-0 right-0 z-[60] border-b border-border bg-card shadow-md will-change-transform"
                : "border-t border-border bg-card"
            }
            style={
              kb.open
                ? { top: 0, transform: `translateY(${kb.offsetTop}px)` }
                : undefined
            }
          >
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
        <style>{`
          @media print {
            .notes-grid-wrapper { width: 640px; }
            .notes-grid-row { height: 21px !important; }
            .notes-grid-cell, .notes-grid-cell input, .notes-grid-cell .notes-overlay { height: 21px !important; }
          }
        `}</style>
        <div className="rounded-lg border border-grid-border shadow-sm overflow-visible notes-grid-wrapper">
          <div className="bg-grid-header px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-grid-header-foreground">Mätmetod och övriga upplysningar</span>
          </div>
          <div className="bg-grid-cell" ref={notesGridRef}>
            {(() => {
              const allLines = (sheet.notes || "").split("\n");
              return Array.from({ length: 5 }).map((_, rowIdx) => {
              const cells = (allLines[rowIdx] || "").split("\t");
              return (
                <div
                  key={rowIdx}
                  className="notes-grid-row grid grid-cols-10 border-b border-black last:border-b-0 relative overflow-hidden"
                >
                  {Array.from({ length: 10 }).map((_, colIdx) => {
                    const isFocused =
                      focusedNoteCell?.r === rowIdx && focusedNoteCell?.c === colIdx;
                    const cellWidth = notesRowWidth / 10;
                    const textWidth = measureNoteText(cells[colIdx] || "") + 28;
                    const remainingWidth = notesRowWidth - colIdx * cellWidth;
                    const focusedWidth = Math.min(Math.max(textWidth, cellWidth), remainingWidth);
                    const nextHasText = !!(cells[colIdx + 1] && cells[colIdx + 1].trim());
                    return (
                    <div
                      key={colIdx}
                      className="notes-grid-cell relative h-[26px] focus-within:z-50 overflow-visible"
                      style={{ zIndex: 10 - colIdx }}
                    >
                      {!isFocused && (
                        <div
                          aria-hidden
                          className="notes-overlay pointer-events-none absolute top-0 left-0 h-[26px] px-1 flex items-center whitespace-nowrap text-foreground"
                          style={{
                            width: "max-content",
                            maxWidth: nextHasText ? "100%" : undefined,
                            overflow: nextHasText ? "hidden" : "visible",
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            fontSize: '13px',
                            lineHeight: 1.1,
                          }}
                        >
                          {cells[colIdx] || ""}
                        </div>
                      )}
                      <input
                        type="text"
                        ref={(el) => {
                          noteInputsRef.current[rowIdx][colIdx] = el;
                        }}
                        value={cells[colIdx] || ""}
                        onChange={(e) => {
                          const allLines = (sheet.notes || "").split("\n");
                          while (allLines.length < 5) allLines.push("");
                          const rowCells = (allLines[rowIdx] || "").split("\t");
                          while (rowCells.length < 10) rowCells.push("");
                          rowCells[colIdx] = e.target.value.replace(/\t|\n/g, " ");
                          allLines[rowIdx] = rowCells.slice(0, 10).join("\t").replace(/\t+$/, "");
                          handleNotesChange({
                            target: { value: allLines.slice(0, 5).join("\n") },
                          } as React.ChangeEvent<HTMLTextAreaElement>);
                        }}
                        onFocus={() => {
                          setFocusedNoteCell({ r: rowIdx, c: colIdx });
                          setActiveCell({ source: "notes", r: rowIdx, c: colIdx });
                        }}
                        onBlur={() => setFocusedNoteCell((cur) =>
                          cur?.r === rowIdx && cur?.c === colIdx ? null : cur,
                        )}
                        onKeyDown={(e) => {
                          const input = e.currentTarget;
                          const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
                          const atEnd =
                            input.selectionStart === input.value.length &&
                            input.selectionEnd === input.value.length;
                          let nr = rowIdx;
                          let nc = colIdx;
                          if (e.key === "ArrowUp") nr = rowIdx - 1;
                          else if (e.key === "ArrowDown" || e.key === "Enter") nr = rowIdx + 1;
                          else if (e.key === "ArrowLeft" && atStart) nc = colIdx - 1;
                          else if (e.key === "ArrowRight" && atEnd) nc = colIdx + 1;
                          else if (e.key === "Tab") {
                            nc = colIdx + (e.shiftKey ? -1 : 1);
                            if (nc < 0) { nc = 9; nr = rowIdx - 1; }
                            else if (nc > 9) { nc = 0; nr = rowIdx + 1; }
                          } else return;
                          if (nr < 0 || nr > 4 || nc < 0 || nc > 9) return;
                          const next = noteInputsRef.current[nr]?.[nc];
                          if (next) {
                            e.preventDefault();
                            next.focus();
                            next.select();
                          }
                        }}
                        style={
                          isFocused
                            ? { width: `${focusedWidth}px`, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: 1.1 }
                            : { width: "100%", fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: 1.1 }
                        }
                        className="absolute top-0 left-0 h-[26px] px-1 bg-transparent text-transparent caret-foreground focus:text-foreground focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring rounded-none"
                      />
                    </div>
                    );
                  })}
                </div>
              );
              });
            })()}
          </div>
        </div>
      </main>
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] sm:p-5 p-3 max-h-[96dvh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Importera Excel</DialogTitle>
          </DialogHeader>
          {(() => {
            const dataRange = parseRange(dataRangeInput);
            const notesRange = parseRange(notesRangeInput);
            const dataValid = !!dataRange;
            const notesValid = !!notesRange;
            const inRange = (r: number, c: number, range: CellRange | null) =>
              !!range && r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
            const cols = previewData[0]?.length ?? 0;
            const applyDragRange = (startR: number, startC: number, endR: number, endC: number, target: "data" | "notes") => {
              const encoded = encodeRange(startR, startC, endR, endC);
              if (target === "data") setDataRangeInput(encoded);
              else setNotesRangeInput(encoded);
            };
            const onCellDown = (r: number, c: number) => (e: React.PointerEvent) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
              setDragSelect({ startR: r, startC: c, target: rangeSelectionMode });
              applyDragRange(r, c, r, c, rangeSelectionMode);
            };
            const onCellEnter = (r: number, c: number) => () => {
              if (!dragSelect) return;
              applyDragRange(dragSelect.startR, dragSelect.startC, r, c, dragSelect.target);
            };
            return (
              <div
                className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden"
                onPointerUp={() => setDragSelect(null)}
                onPointerLeave={() => setDragSelect(null)}
              >
                <div className="flex flex-wrap gap-5">
                  <div className="flex-1 min-w-[220px]">
                    <div className="text-sm font-medium mb-2 text-muted-foreground">Blad att importera</div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {availableSheetNames.map((name) => (
                        <label key={name} className="flex items-center gap-2 cursor-pointer text-sm min-h-[40px] px-1">
                          <Checkbox
                            className="h-5 w-5"
                            checked={selectedSheetNames.includes(name)}
                            onCheckedChange={() => toggleSheetSelection(name)}
                          />
                          <span className="truncate">{name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[220px]">
                    <div className="text-sm font-medium mb-2 text-muted-foreground">Förhandsvisa blad</div>
                    <select
                      className="w-full border rounded-md px-3 h-11 text-sm bg-background"
                      value={previewSheetName}
                      onChange={(e) => setPreviewSheetName(e.target.value)}
                    >
                      {availableSheetNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[260px]">
                    <label className="text-sm font-medium mb-1.5 text-muted-foreground flex items-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 rounded-sm bg-primary/30 ring-1 ring-primary/60" />
                      Cellområde – Data
                      <button
                        type="button"
                        onClick={() => setRangeSelectionMode("data")}
                        className={`ml-auto text-xs px-2.5 h-8 rounded-md border transition-colors ${rangeSelectionMode === "data" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                      >
                        {rangeSelectionMode === "data" ? "Markerar nu" : "Markera i tabell"}
                      </button>
                    </label>
                    <Input
                      value={dataRangeInput}
                      onChange={(e) => setDataRangeInput(e.target.value)}
                      placeholder="A14:J49"
                      className={`h-11 text-base ${dataValid ? "" : "border-destructive focus-visible:ring-destructive"}`}
                    />
                    {!dataValid && <p className="text-xs text-destructive mt-1">Ogiltigt format (t.ex. A14:J49)</p>}
                  </div>
                  <div className="flex-1 min-w-[260px]">
                    <label className="text-sm font-medium mb-1.5 text-muted-foreground flex items-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 rounded-sm bg-amber-300/60 ring-1 ring-amber-500" />
                      Cellområde – Anteckningar
                      <button
                        type="button"
                        onClick={() => setRangeSelectionMode("notes")}
                        className={`ml-auto text-xs px-2.5 h-8 rounded-md border transition-colors ${rangeSelectionMode === "notes" ? "bg-amber-500 text-white border-amber-500" : "bg-background hover:bg-muted"}`}
                      >
                        {rangeSelectionMode === "notes" ? "Markerar nu" : "Markera i tabell"}
                      </button>
                    </label>
                    <Input
                      value={notesRangeInput}
                      onChange={(e) => setNotesRangeInput(e.target.value)}
                      placeholder="A51:J55"
                      className={`h-11 text-base ${notesValid ? "" : "border-destructive focus-visible:ring-destructive"}`}
                    />
                    {!notesValid && <p className="text-xs text-destructive mt-1">Ogiltigt format (t.ex. A51:J55)</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Tips: klicka eller dra i tabellen nedan för att markera det aktiva området ({rangeSelectionMode === "data" ? "Data" : "Anteckningar"}).
                </p>
                <div className="border rounded-md flex-1 min-h-0 overflow-auto bg-background select-none">
                  {previewData.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Ingen förhandsvisning</div>
                  ) : (
                    <table className="border-collapse text-[11px] font-mono w-full table-fixed">
                      <thead className="sticky top-0 z-20 bg-muted">
                        <tr>
                          <th className="sticky left-0 z-30 bg-muted border border-border w-8 min-w-8 h-6"></th>
                          {Array.from({ length: cols }, (_, c) => (
                            <th key={c} className="border border-border px-1 h-6 text-center font-medium">
                              {colLetter(c)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, r) => (
                          <tr key={r}>
                            <td className="sticky left-0 z-10 bg-muted border border-border w-8 min-w-8 text-center font-medium h-6">
                              {r + 1}
                            </td>
                            {Array.from({ length: cols }, (_, c) => {
                              const inData = inRange(r, c, dataRange);
                              const inNotes = inRange(r, c, notesRange);
                              const cls = inNotes
                                ? "bg-amber-200/50 ring-1 ring-inset ring-amber-500/60"
                                : inData
                                  ? "bg-primary/15 ring-1 ring-inset ring-primary/50"
                                  : "";
                              return (
                                <td
                                  key={c}
                                  className={`border border-border px-1 h-6 whitespace-nowrap overflow-hidden text-ellipsis cursor-cell ${cls}`}
                                  title={row[c] ?? ""}
                                  onPointerDown={onCellDown(r, c)}
                                  onPointerEnter={onCellEnter(r, c)}
                                >
                                  {row[c] ?? ""}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="lg" onClick={() => setImportDialogOpen(false)}>
              Avbryt
            </Button>
            <Button
              size="lg"
              onClick={handleImportConfirm}
              disabled={
                selectedSheetNames.length === 0 ||
                !parseRange(dataRangeInput) ||
                !parseRange(notesRangeInput)
              }
            >
              Bekräfta import ({selectedSheetNames.length} blad)
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
                else if (confirmAction === "export") handleExport();
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
