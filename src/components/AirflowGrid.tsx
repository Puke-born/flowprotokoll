import { memo, useCallback, useRef, useState } from "react";

const EVAL_COLUMNS = new Set(["tilluft_uppmat", "franluft_uppmat"]);

function tryEvalMath(expr: string): string | null {
  if (!/[+\-*/]/.test(expr)) return null;
  if (!/^[\d+\-*/.()\s]+$/.test(expr.trim())) return null;
  try {
    const result = new Function(`"use strict"; return (${expr.trim()})`)();
    if (typeof result === "number" && isFinite(result)) {
      return String(Math.round(result * 100) / 100);
    }
  } catch {
    // ignore
  }
  return null;
}

const COLUMNS = [
  { key: "rum_nr", label: "Rum", width: "7%", center: false, pad: true },
  { key: "rum_namn", label: "", width: "13%", center: false, pad: true },
  { key: "tilluft_dontyp", label: "Dontyp", width: "8%", center: true, pad: false },
  { key: "tilluft_inst", label: "Pa/K-f", width: "8%", center: true, pad: false },
  { key: "tilluft_beraknat", label: "Beräknat", width: "12%", center: true, pad: false },
  { key: "tilluft_uppmat", label: "Uppmätt", width: "12%", center: true, pad: false },
  { key: "franluft_dontyp", label: "Dontyp", width: "8%", center: true, pad: false },
  { key: "franluft_inst", label: "Pa/K-f", width: "8%", center: true, pad: false },
  { key: "franluft_beraknat", label: "Beräknat", width: "12%", center: true, pad: false },
  { key: "franluft_uppmat", label: "Uppmätt", width: "12%", center: true, pad: false },
];

export interface GridRow {
  [key: string]: string;
}

interface AirflowGridProps {
  rows: GridRow[];
  importedCells?: Set<string>[];
  cellColors?: Record<string, Record<string, string>>;
  onCellChange: (rowIndex: number, colKey: string, value: string) => void;
  onCellSelect?: (row: number, colKey: string) => void;
  onRowReorder?: (fromIndex: number, toIndex: number) => void;
}

const AirflowGrid = memo(({ rows, importedCells, cellColors, onCellChange, onCellSelect, onRowReorder }: AirflowGridProps) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = gridRef.current?.querySelector<HTMLInputElement>(
          `[data-row="${rowIdx + 1}"][data-col="${colIdx}"]`
        );
        next?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = gridRef.current?.querySelector<HTMLInputElement>(
          `[data-row="${rowIdx - 1}"][data-col="${colIdx}"]`
        );
        prev?.focus();
      }
    },
    []
  );

  const handleDragStart = useCallback((e: React.DragEvent, rowIdx: number) => {
    setDragFrom(rowIdx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(rowIdx));
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      const tr = e.currentTarget.closest("tr");
      if (tr) {
        e.dataTransfer.setDragImage(tr, 0, 20);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, rowIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(rowIdx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = dragFrom;
    setDragFrom(null);
    setDragOver(null);
    if (fromIdx !== null && fromIdx !== toIdx) {
      onRowReorder?.(fromIdx, toIdx);
    }
  }, [dragFrom, onRowReorder]);

  const handleDragEnd = useCallback(() => {
    setDragFrom(null);
    setDragOver(null);
  }, []);

  return (
    <div ref={gridRef} className="overflow-x-auto rounded-lg border border-grid-border shadow-sm">
      <table className="w-full border-collapse min-w-[700px]">
        <colgroup>
          <col style={{ width: "32px" }} />
          {COLUMNS.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-grid-header text-grid-header-foreground">
            <th className="px-1 py-2 text-[10px] font-semibold uppercase tracking-wider text-center border-r border-grid-border/30 w-8">
              #
            </th>
            <th colSpan={2} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-left border-r border-grid-border/30">
              Rum
            </th>
            <th colSpan={4} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-center border-r border-grid-border/30 bg-primary/80">
              Tilluft
            </th>
            <th colSpan={4} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-center bg-accent/80">
              Frånluft
            </th>
          </tr>
          <tr className="bg-grid-header/90 text-grid-header-foreground">
            <th className="border-r border-grid-border/30"></th>
            <th className="border-r border-grid-border/30"></th>
            <th className="border-r border-grid-border/30"></th>
            {COLUMNS.slice(2).map((col, i) => (
              <th
                key={col.key}
                className={`px-1 py-1.5 text-[9px] font-medium uppercase tracking-wider text-center ${
                  i < 4 ? "border-r border-grid-border/30" : ""
                } ${i === 3 ? "border-r-2 border-grid-border/50" : ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={`${rowIdx % 2 === 0 ? "bg-grid-cell" : "bg-grid-cell-alt"} hover:bg-primary/5 transition-colors ${
                dragFrom === rowIdx ? "opacity-40" : ""
              } ${dragOver === rowIdx && dragFrom !== null && dragFrom !== rowIdx ? "border-t-2 border-primary" : ""}`}
            >
              <td
                draggable
                onDragStart={(e) => handleDragStart(e, rowIdx)}
                onDragOver={(e) => handleDragOver(e, rowIdx)}
                onDrop={(e) => handleDrop(e, rowIdx)}
                onDragEnd={handleDragEnd}
                className="px-1 py-0 text-[10px] text-muted-foreground text-center border-r border-grid-border/40 font-mono cursor-grab active:cursor-grabbing select-none hover:bg-primary/10 transition-colors"
                title="Dra för att flytta rad"
              >
                {rowIdx + 1}
              </td>
              {COLUMNS.map((col, colIdx) => (
                <td
                  key={col.key}
                  className={`px-0 py-0 border-r border-grid-border/30 last:border-r-0 ${
                    colIdx === 5 ? "border-r-2 border-grid-border/50" : ""
                  }`}
                >
                  <input
                    data-row={rowIdx}
                    data-col={colIdx}
                    type="text"
                    inputMode="text"
                    value={row[col.key] || ""}
                    onChange={(e) => onCellChange(rowIdx, col.key, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                    onFocus={() => onCellSelect?.(rowIdx, col.key)}
                    onBlur={() => {
                      if (EVAL_COLUMNS.has(col.key)) {
                        const val = row[col.key] || "";
                        const result = tryEvalMath(val);
                        if (result !== null) {
                          onCellChange(rowIdx, col.key, result);
                        }
                      }
                    }}
                    style={cellColors?.[rowIdx]?.[col.key] ? { backgroundColor: cellColors[rowIdx][col.key] } : undefined}
                    className={`w-full h-10 ${col.pad ? "px-2" : "px-0.5"} text-sm font-mono bg-transparent text-foreground focus:outline-none focus:bg-primary/10 focus:ring-1 focus:ring-ring rounded-none ${
                      col.center ? "text-center" : ""
                    } ${
                      !cellColors?.[rowIdx]?.[col.key] && importedCells?.[rowIdx]?.has(col.key) ? "bg-yellow-100 dark:bg-yellow-900/30" : ""
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

AirflowGrid.displayName = "AirflowGrid";
export default AirflowGrid;
