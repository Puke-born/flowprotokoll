import { memo } from "react";

interface HeaderField {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

interface ProtocolHeaderProps {
  fields: HeaderField[];
}

const ProtocolHeader = memo(({ fields }: ProtocolHeaderProps) => {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 bg-card rounded-lg border border-border shadow-sm">
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {field.label}
          </label>
          <input
            type="text"
            value={field.value}
            readOnly={field.readOnly}
            onChange={(e) => field.onChange(e.target.value)}
            className={`h-11 px-3 rounded-md border border-input bg-card text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring ${field.readOnly ? "bg-muted cursor-default" : ""}`}
            placeholder={field.label}
          />
        </div>
      ))}
    </div>
  );
});

ProtocolHeader.displayName = "ProtocolHeader";
export default ProtocolHeader;
