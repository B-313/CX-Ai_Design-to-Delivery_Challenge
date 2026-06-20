import { Terminal } from "lucide-react";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <Terminal className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground tracking-tight">Accelerator</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="#techniques" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Techniques</a>
          <a href="#examples" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Examples</a>
          <a href="#principles" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Principles</a>
        </div>

        <Link to="/engine" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:shadow-[var(--glow-primary)] transition-all">
          Launch Engine
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
