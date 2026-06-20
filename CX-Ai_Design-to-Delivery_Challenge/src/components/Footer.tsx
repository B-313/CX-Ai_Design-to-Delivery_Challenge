import { Terminal } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Accelerator</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          Crafting better AI interactions, one prompt at a time.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
