import { memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Minus, Plus } from "lucide-react";
import type { SmartImportSettings } from "@/lib/importExcel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableSheetNames: string[];
  selectedSheetNames: string[];
  onToggleSheet: (name: string) => void;
  settings: SmartImportSettings;
  onSettingsChange: (s: SmartImportSettings) => void;
  onConfirm: () => void;
  loading?: boolean;
}

const Stepper = ({
  label,
  value,
  onChange,
  min = 1,
}: { label: string; value: number; onChange: (v: number) => void; min?: number }) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-14 w-14 shrink-0"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={`Minska ${label}`}
      >
        <Minus className="h-5 w-5" />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        className="h-14 w-full min-w-0 rounded-md border border-input bg-card text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button
        type="button"
        variant="outline"
        className="h-14 w-14 shrink-0"
        onClick={() => onChange(value + 1)}
        aria-label={`Öka ${label}`}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  </div>
);

const CellField = ({
  label,
  value,
  onChange,
}: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      placeholder="t.ex. C5"
      className="h-14 px-4 rounded-md border border-input bg-card text-base font-mono focus:outline-none focus:ring-2 focus:ring-ring"
    />
  </div>
);

const ImportMappingDialog = memo(({
  open, onOpenChange, availableSheetNames, selectedSheetNames, onToggleSheet,
  settings, onSettingsChange, onConfirm, loading,
}: Props) => {
  const set = <K extends keyof SmartImportSettings>(key: K, value: SmartImportSettings[K]) =>
    onSettingsChange({ ...settings, [key]: value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Smart Import – inställningar</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Blad att importera</h3>
            <div className="rounded-lg border border-border divide-y divide-border">
              {availableSheetNames.map((name) => (
                <label key={name} className="flex items-center gap-4 px-4 py-4 cursor-pointer min-h-[56px]">
                  <Checkbox
                    className="h-6 w-6"
                    checked={selectedSheetNames.includes(name)}
                    onCheckedChange={() => onToggleSheet(name)}
                  />
                  <span className="text-base">{name}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Mätvärden – rader</h3>
            <div className="grid grid-cols-2 gap-4">
              <Stepper label="Start" value={settings.dataStart} onChange={(v) => set("dataStart", v)} />
              <Stepper label="Slut" value={settings.dataEnd} onChange={(v) => set("dataEnd", v)} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Anteckningar – rader</h3>
            <div className="grid grid-cols-2 gap-4">
              <Stepper label="Start" value={settings.notesStart} onChange={(v) => set("notesStart", v)} />
              <Stepper label="Slut" value={settings.notesEnd} onChange={(v) => set("notesEnd", v)} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Global data (läses från första bladet)</h3>
            <div className="grid grid-cols-2 gap-4">
              <CellField label="Kund" value={settings.kundCell} onChange={(v) => set("kundCell", v)} />
              <CellField label="Anläggning" value={settings.anlaggningCell} onChange={(v) => set("anlaggningCell", v)} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Bladspecifik data (läses per blad)</h3>
            <div className="grid grid-cols-2 gap-4">
              <CellField label="System" value={settings.systemCell} onChange={(v) => set("systemCell", v)} />
              <CellField label="Plan" value={settings.planCell} onChange={(v) => set("planCell", v)} />
            </div>
          </section>
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 border-t border-border bg-card gap-3 sm:gap-3">
          <Button variant="outline" className="h-14 flex-1 text-base" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            className="h-14 flex-1 text-base"
            onClick={onConfirm}
            disabled={selectedSheetNames.length === 0 || loading}
          >
            {loading ? "Analyserar…" : `Importera (${selectedSheetNames.length} blad)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ImportMappingDialog.displayName = "ImportMappingDialog";
export default ImportMappingDialog;
