import { memo, useCallback, useRef, useState } from "react";

const EVAL_COLUMNS = new Set(["tilluft_uppmat", "franluft_uppmat"]);

function tryEvalMath(expr: string): string | null {
  // Only evaluate if it contains an operator
  if (!/[+\-*/]/.test(expr)) return null;
  // Only allow digits, operators, dots, spaces, parens
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
  { key: "rum_nr", label: "Rum" },
  { key: "rum_namn", label: "" },
  { key: "tilluft_dontyp", label: "Dontyp" },
  { key: "tilluft_inst", label: "Pa/K-f" },
  { key: "tilluft_beraknat", label: "Beräknat" },
  { key: "tilluft_uppmat", label: "Uppmätt" },
  { key: "franluft_dontyp", label: "Dontyp" },
  { key: "franluft_inst", label: "Pa/K-f" },
  { key: "franluft_beraknat", label: "Beräknat" },
  { key: "franluft_uppmat", label: "Uppmätt" },
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
}

const AirflowGrid = memo(({ rows, importedCells, cellColors, onCellChange, onCellSelect }: AirflowGridProps) => {
  const gridRef = useRef<HTMLDivElement>(null);

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
      } else if (e.key === "Tab" && !e.shiftKey) {
        // default tab behavior is fine
      }
    },
    []
  );

  return (
    <div ref={gridRef} className="overflow-x-auto rounded-lg border border-grid-border shadow-sm">
      <table className="w-full border-collapse min-w-[700px]">
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
              className={`${rowIdx % 2 === 0 ? "bg-grid-cell" : "bg-grid-cell-alt"} hover:bg-primary/5 transition-colors`}
            >
              <td className="px-1 py-0 text-[10px] text-muted-foreground text-center border-r border-grid-border/40 font-mono">
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
                    className={`w-full h-10 px-2 text-sm font-mono bg-transparent text-foreground focus:outline-none focus:bg-primary/10 focus:ring-1 focus:ring-ring rounded-none ${
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
