import { memo, useCallback, useEffect, useRef, useState } from "react";

const ROWS = 5;
const COLS = 10;

const parseNotes = (notes: string): string[][] => {
  const lines = (notes || "").split("\n");
  return Array.from({ length: ROWS }, (_, r) => {
    const cells = (lines[r] || "").split("\t");
    return Array.from({ length: COLS }, (_, c) => cells[c] || "");
  });
};

const serializeNotes = (grid: string[][]): string =>
  grid
    .slice(0, ROWS)
    .map((row) => row.slice(0, COLS).join("\t").replace(/\t+$/, ""))
    .join("\n");

interface NotesGridProps {
  notes: string;
  onNotesCommit: (next: string) => void;
  onCellSelect?: (r: number, c: number) => void;
}

const NotesGrid = memo(({ notes, onNotesCommit, onCellSelect }: NotesGridProps) => {
  const [localGrid, setLocalGrid] = useState<string[][]>(() => parseNotes(notes));
  const [focusedNoteCell, setFocusedNoteCell] = useState<{ r: number; c: number } | null>(null);
  const focusedRef = useRef<{ r: number; c: number } | null>(null);
  focusedRef.current = focusedNoteCell;

  const notesGridRef = useRef<HTMLDivElement>(null);
  const [notesRowWidth, setNotesRowWidth] = useState(0);
  const noteInputsRef = useRef<(HTMLInputElement | null)[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  );

  // Sync from parent prop when no cell is focused (avoids clobbering active typing).
  const lastNotesRef = useRef(notes);
  useEffect(() => {
    if (notes === lastNotesRef.current) return;
    lastNotesRef.current = notes;
    if (focusedRef.current === null) {
      setLocalGrid(parseNotes(notes));
    }
  }, [notes]);

  useEffect(() => {
    const el = notesGridRef.current;
    if (!el) return;
    const update = () => setNotesRowWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measureCacheRef = useRef<Map<string, number>>(new Map());
  const measureNoteText = useCallback((text: string) => {
    if (typeof document === "undefined") return 0;
    const cache = measureCacheRef.current;
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    const holder = measureNoteText as unknown as { _c?: HTMLCanvasElement };
    const canvas = holder._c ?? (holder._c = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    ctx.font = '13px Arial, Helvetica, sans-serif';
    const w = Math.ceil(ctx.measureText(text).width);
    if (cache.size > 5000) cache.clear();
    cache.set(text, w);
    return w;
  }, []);

  const commitIfChanged = useCallback((grid: string[][]) => {
    const serialized = serializeNotes(grid);
    if (serialized !== lastNotesRef.current) {
      lastNotesRef.current = serialized;
      onNotesCommit(serialized);
    }
  }, [onNotesCommit]);

  const handleChange = useCallback((r: number, c: number, value: string) => {
    const clean = value.replace(/\t|\n/g, " ");
    setLocalGrid((prev) => {
      if (prev[r][c] === clean) return prev;
      const next = prev.map((row) => row.slice());
      next[r][c] = clean;
      return next;
    });
  }, []);

  const handleBlur = useCallback((r: number, c: number) => {
    setFocusedNoteCell((cur) => (cur?.r === r && cur?.c === c ? null : cur));
    // Commit latest local state to parent.
    setLocalGrid((prev) => {
      commitIfChanged(prev);
      return prev;
    });
  }, [commitIfChanged]);

  return (
    <>
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
          {Array.from({ length: ROWS }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="notes-grid-row grid grid-cols-10 border-b border-black last:border-b-0 relative overflow-hidden"
            >
              {Array.from({ length: COLS }).map((_, colIdx) => {
                const cellValue = localGrid[rowIdx][colIdx] || "";
                const nextCellValue = localGrid[rowIdx][colIdx + 1] || "";
                const isFocused =
                  focusedNoteCell?.r === rowIdx && focusedNoteCell?.c === colIdx;
                const cellWidth = notesRowWidth / COLS;
                const textWidth = measureNoteText(cellValue) + 28;
                const remainingWidth = notesRowWidth - colIdx * cellWidth;
                const focusedWidth = Math.min(Math.max(textWidth, cellWidth), remainingWidth);
                const nextHasText = !!(nextCellValue && nextCellValue.trim());
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
                        {cellValue}
                      </div>
                    )}
                    <input
                      type="text"
                      ref={(el) => {
                        noteInputsRef.current[rowIdx][colIdx] = el;
                      }}
                      value={cellValue}
                      onChange={(e) => handleChange(rowIdx, colIdx, e.target.value)}
                      onFocus={() => {
                        setFocusedNoteCell({ r: rowIdx, c: colIdx });
                        onCellSelect?.(rowIdx, colIdx);
                      }}
                      onBlur={() => handleBlur(rowIdx, colIdx)}
                      onKeyDown={(e) => {
                        const input = e.currentTarget;
                        const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
                        const atEnd =
                          input.selectionStart === input.value.length &&
                          input.selectionEnd === input.value.length;
                        let nr = rowIdx;
                        let nc = colIdx;
                        if (e.key === "ArrowUp") nr = rowIdx - 1;
                        else if (e.key === "ArrowDown") nr = rowIdx + 1;
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
          ))}
        </div>
      </div>
    </>
  );
});

NotesGrid.displayName = "NotesGrid";
export default NotesGrid;