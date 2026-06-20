import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const examples = [
  {
    label: "Basic → Refined",
    bad: "Write about dogs.",
    good: "Write a 200-word informative paragraph about the cognitive abilities of Border Collies, citing at least one study. Use a conversational but authoritative tone suitable for a pet-owner blog.",
    insight: "Specificity in length, topic, tone, and audience transforms a vague request into a precise one.",
  },
  {
    label: "Chain-of-Thought",
    bad: "Is 17 a prime number?",
    good: "Determine if 17 is a prime number. Think step-by-step:\n1. List all integers from 2 to √17 ≈ 4.1\n2. Check if 17 is divisible by any of them\n3. State your conclusion with reasoning.",
    insight: "Explicit reasoning steps improve accuracy on math, logic, and analytical tasks.",
  },
  {
    label: "Role Prompting",
    bad: "Review my code.",
    good: "You are a senior software engineer specializing in TypeScript and React performance optimization. Review the following component for:\n- Unnecessary re-renders\n- Memory leaks\n- Accessibility issues\nProvide fixes with code examples.",
    insight: "Assigning expertise and structured output requirements yields targeted, actionable feedback.",
  },
];

const ExamplesSection = () => {
  const [active, setActive] = useState(0);

  return (
    <section id="examples" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Before & <span className="text-gradient-primary">After</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            See how small changes in prompting create dramatically better outputs.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          {examples.map((ex, i) => (
            <button
              key={ex.label}
              onClick={() => setActive(i)}
              className={`px-5 py-2 rounded-lg text-sm font-mono transition-all ${
                active === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {ex.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid md:grid-cols-2 gap-5 mb-6">
              {/* Bad prompt */}
              <div className="rounded-xl border border-[hsl(0,60%,40%)/0.3] bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-[hsl(0,70%,50%)]" />
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Weak Prompt</span>
                </div>
                <pre className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {examples[active].bad}
                </pre>
              </div>

              {/* Good prompt */}
              <div className="rounded-xl border-glow bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Strong Prompt</span>
                </div>
                <pre className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {examples[active].good}
                </pre>
              </div>
            </div>

            {/* Insight */}
            <div className="rounded-xl bg-secondary border border-border p-5">
              <p className="text-sm text-muted-foreground">
                <span className="text-primary font-semibold font-mono mr-2">→</span>
                {examples[active].insight}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default ExamplesSection;
