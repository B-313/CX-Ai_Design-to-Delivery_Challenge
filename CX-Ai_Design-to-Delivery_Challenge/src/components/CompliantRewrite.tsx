import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CompliantRewriteProps {
  rewrite: string;
}

const CompliantRewrite = ({ rewrite }: CompliantRewriteProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rewrite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border-glow bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Compliant Rewrite
        </p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="rounded-lg bg-background/50 p-4 max-h-[280px] overflow-y-auto">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono">
          {rewrite}
        </p>
      </div>
    </div>
  );
};

export default CompliantRewrite;
