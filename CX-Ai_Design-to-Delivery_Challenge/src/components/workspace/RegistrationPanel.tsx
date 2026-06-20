import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { saveApiKey } from "@/lib/protectedInvoke";

const RegistrationPanel = () => {
  const { goToStep, setUser } = useWorkspace();
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", empNumber: "", department: "", country: "",
  });
  const [judgeAccessKey, setJudgeAccessKey] = useState("");

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const canSubmit = form.firstName && form.lastName && form.email && form.empNumber && form.department && form.country;

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Persist key so protected endpoints can use it across the full workflow.
    saveApiKey(judgeAccessKey, true);
    setUser(form as any);
    goToStep(1);
  };

  const countries = [
    "United Kingdom", "United States", "Germany", "France", "Spain", "Italy",
    "Netherlands", "Australia", "Japan", "China", "India", "Brazil",
    "South Africa", "UAE", "Singapore", "Global",
  ];

  return (
    <div className="flex-1 flex items-start justify-center overflow-y-auto py-8" style={{ background: "radial-gradient(ellipse at 60% 0%, hsl(198 76% 96%) 0%, hsl(210 33% 97%) 55%)" }}>
      <div className="bg-card border border-border rounded-[20px] shadow-pf-lg p-10 w-[620px] max-w-[95vw] animate-fade-up">
        <h2 className="font-serif text-2xl text-pf-dark mb-1">Welcome to the Accelerator</h2>
        <p className="text-[13px] text-muted-foreground mb-5">Enter your details to personalise your workspace.</p>
        <div className="bg-primary/10 border border-primary/25 rounded-md px-3 py-2 text-[12px] text-primary font-semibold mb-6">
          All fields are mandatory.
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <Field label="First Name" value={form.firstName} onChange={v => update("firstName", v)} placeholder="Jane" />
          <Field label="Last Name" value={form.lastName} onChange={v => update("lastName", v)} placeholder="Smith" />
        </div>
        <Field label="Company Email" value={form.email} onChange={v => update("email", v)} placeholder="jane.smith@company.com" type="email" />
        <Field label="Phone Number" value={form.phone} onChange={v => update("phone", v)} placeholder="+44 7700 000000" />
        <div className="grid grid-cols-2 gap-4 mb-3">
          <Field label="Employee Number" value={form.empNumber} onChange={v => update("empNumber", v)} placeholder="EMP-00000" />
          <Field label="Department" value={form.department} onChange={v => update("department", v)} placeholder="Digital Marketing" />
        </div>
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Country / Region</label>
          <select
            value={form.country}
            onChange={e => update("country", e.target.value)}
            className="w-full bg-secondary border-[1.5px] border-border rounded-md px-3 py-2 text-[13.5px] text-foreground outline-none focus:border-primary transition-colors appearance-none"
          >
            <option value="">Select…</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="mb-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">API Key <span className="text-muted-foreground/70">(Optional)</span></label>
          <input
            type="password"
            value={judgeAccessKey}
            onChange={e => setJudgeAccessKey(e.target.value)}
            placeholder="Enter your own API key or leave blank"
            className="w-full bg-secondary border-[1.5px] border-border rounded-md px-3 py-2 text-[13.5px] text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Optional. Provide your own API key to enable protected AI endpoints, or leave blank to use default demo capabilities.</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-btn-gradient text-primary-foreground rounded-md py-3.5 text-sm font-bold shadow-pf hover:shadow-pf-md transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-1"
        >
          Continue to Workspace →
        </button>
      </div>
    </div>
  );
};

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-secondary border-[1.5px] border-border rounded-md px-3 py-2 text-[13.5px] text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
      />
    </div>
  );
}

export default RegistrationPanel;
