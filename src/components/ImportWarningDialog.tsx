import { memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { SheetOverflow } from "@/lib/importExcel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overflows: SheetOverflow[];
  onExpand: () => void;
  onIgnore: () => void;
}

const ImportWarningDialog = memo(({ open, onOpenChange, overflows, onExpand, onIgnore }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Granskning utanför område
        </DialogTitle>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">
        Extra mätvärden hittades utanför ditt valda område på följande blad:
      </p>
      <ul className="rounded-lg border border-border divide-y divide-border max-h-60 overflow-y-auto">
        {overflows.map((o) => (
          <li key={o.name} className="px-4 py-3 text-sm">
            <span className="font-semibold">{o.name}:</span> Mätvärden fortsätter till rad {o.lastDataRow}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 pt-2">
        <Button className="h-14 text-base" onClick={onExpand}>Utöka och importera</Button>
        <Button variant="secondary" className="h-14 text-base" onClick={onIgnore}>Ignorera extra data</Button>
        <Button variant="outline" className="h-14 text-base" onClick={() => onOpenChange(false)}>Avbryt</Button>
      </div>
    </DialogContent>
  </Dialog>
));

ImportWarningDialog.displayName = "ImportWarningDialog";
export default ImportWarningDialog;
