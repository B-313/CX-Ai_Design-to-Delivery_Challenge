import { motion } from "framer-motion";

const principles = [
  { number: "01", title: "Be Specific", desc: "Vague inputs produce vague outputs. Define format, length, tone, and constraints." },
  { number: "02", title: "Provide Context", desc: "Give the model the background it needs - audience, purpose, and domain knowledge." },
  { number: "03", title: "Iterate Relentlessly", desc: "Treat prompts like code. Test, refine, and version control your best prompts." },
  { number: "04", title: "Think in Systems", desc: "Complex tasks need prompt chains, not monolithic instructions. Decompose and compose." },
];

const PrinciplesSection = () => {
  return (
    <section id="principles" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Guiding <span className="text-gradient-primary">Principles</span>
          </h2>
        </motion.div>

        <div className="space-y-0">
          {principles.map((p, i) => (
            <motion.div
              key={p.number}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-6 py-8 border-b border-border group"
            >
              <span className="text-3xl md:text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">
                {p.number}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">{p.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PrinciplesSection;
