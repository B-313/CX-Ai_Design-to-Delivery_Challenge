import { useState } from "react";
import type { BriefData } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

const FIELDS: { key: keyof BriefData; label: string; maxLen: number; heading?: boolean; list?: boolean }[] = [
  { key: "projectTitle", label: "Project Name", maxLen: 80, heading: true },
  { key: "goal", label: "Goal & Purpose", maxLen: 400 },
  { key: "audience", label: "Target Audience", maxLen: 300 },
  { key: "contentSections", label: "Page Sections Structured for Website Generation", maxLen: 500, list: true },
  { key: "informationFromSources", label: "Source Synthesis from Documents and Links", maxLen: 700 },
];

interface BriefAccordionProps {
  brief: BriefData;
  onUpdate: (brief: BriefData) => void;
}

const BriefAccordion = ({ brief, onUpdate }: BriefAccordionProps) => {
  const [open, setOpen] = useState<string | null>("projectTitle");

  const getValue = (key: keyof BriefData) => {
    const val = brief[key];
    return Array.isArray(val) ? val.join("\n") : (val || "");
  };

  const getListValue = (key: keyof BriefData) => {
    const val = brief[key];
    return Array.isArray(val) ? val : [];
  };

  const handleChange = (key: keyof BriefData, value: string, list?: boolean) => {
    const updated = { ...brief, [key]: list ? value.split("\n").map(l => l.trim()).filter(Boolean) : value };
    onUpdate(updated);
  };

  const handleListItemChange = (key: keyof BriefData, index: number, value: string) => {
    const items = [...getListValue(key)];
    items[index] = value;
    onUpdate({ ...brief, [key]: items });
  };

  const addListItem = (key: keyof BriefData) => {
    const items = [...getListValue(key), ""];
    onUpdate({ ...brief, [key]: items });
  };

  const removeListItem = (key: keyof BriefData, index: number) => {
    const items = getListValue(key).filter((_, i) => i !== index);
    onUpdate({ ...brief, [key]: items });
  };

  return (
    <div className="bg-card">
      {FIELDS.map((f, i) => {
        const raw = getValue(f.key);
        const len = raw.length;
        const isOpen = open === f.key;
        const countClass = len > f.maxLen ? "text-destructive font-bold" : len > f.maxLen * 0.85 ? "text-warning font-bold" : "text-muted-foreground/50";

        return (
          <div key={f.key} className="border-b border-border">
            <button
              onClick={() => setOpen(isOpen ? null : f.key)}
              className={cn(
                "w-full flex items-center gap-3 px-7 py-4 text-left hover:bg-secondary transition-colors select-none",
                isOpen && "bg-secondary"
              )}
            >
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-extrabold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </div>
              <div className="text-sm font-bold text-foreground flex-1">{f.label}</div>
              <div className="text-xs text-muted-foreground flex-[2] overflow-hidden text-ellipsis whitespace-nowrap px-4">
                {raw.slice(0, 60)}{raw.length > 60 ? "…" : ""}
              </div>
              <div className={cn("text-[11px] font-mono whitespace-nowrap", countClass)}>
                {len}/{f.maxLen}
              </div>
              <span className={cn("text-[10px] text-muted-foreground/50 transition-transform", isOpen && "rotate-180")}>▼</span>
            </button>

            {isOpen && (
              <div className="px-7 pb-5 pl-16 animate-fade-up">
                {f.list ? (
                  <div className="space-y-2.5">
                    {getListValue(f.key).map((item, itemIndex) => (
                      <div key={`${f.key}-${itemIndex}`} className="flex items-start gap-2">
                        <div className="mt-2 text-[11px] text-muted-foreground w-5 text-center">
                          {itemIndex + 1}
                        </div>
                        <input
                          value={item}
                          onChange={(e) => handleListItemChange(f.key, itemIndex, e.target.value)}
                          className="flex-1 border-[1.5px] border-border rounded-md px-3 py-2.5 text-[14px] text-foreground outline-none bg-card hover:border-muted-foreground/30 focus:border-primary focus:shadow-[0_0_0_3px_hsla(200,100%,41%,0.1)] transition-all"
                          placeholder={f.key === "contentSections" ? "Add a section heading" : "Add a key message"}
                        />
                        <button
                          type="button"
                          onClick={() => removeListItem(f.key, itemIndex)}
                          className="text-xs text-muted-foreground hover:text-destructive px-2 py-2"
                          aria-label={`Remove ${f.label} item ${itemIndex + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addListItem(f.key)}
                      className="text-xs font-semibold text-primary hover:text-primary/80 px-1 py-1"
                    >
                      + Add {f.key === "contentSections" ? "Section" : "Message"}
                    </button>
                  </div>
                ) : (
                  <textarea
                    value={raw}
                    onChange={e => handleChange(f.key, e.target.value, f.list)}
                    className={cn(
                      "w-full border-[1.5px] border-border rounded-md p-3.5 text-[15px] leading-[1.75] text-foreground resize-none outline-none bg-card hover:border-muted-foreground/30 focus:border-primary focus:shadow-[0_0_0_3px_hsla(200,100%,41%,0.1)] transition-all",
                      f.heading && "font-serif text-[22px] text-pf-dark min-h-[52px]"
                    )}
                    rows={f.heading ? 2 : 3}
                    style={{ minHeight: f.heading ? 52 : 90 }}
                  />
                )}
                <div className={cn("text-right text-[11px] font-mono mt-1", countClass)}>
                  {len}/{f.maxLen} characters
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BriefAccordion;
