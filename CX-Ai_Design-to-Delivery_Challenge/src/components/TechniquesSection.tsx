import { motion } from "framer-motion";
import { Braces, Layers, Target, Zap, MessageSquare, GitBranch } from "lucide-react";

const techniques = [
  {
    icon: Target,
    title: "Zero-Shot Prompting",
    description: "Direct instructions without examples. Works best for straightforward tasks where the model already has strong knowledge.",
    tag: "Beginner",
  },
  {
    icon: Layers,
    title: "Few-Shot Prompting",
    description: "Provide examples of input-output pairs to guide the model's behavior and establish the desired format.",
    tag: "Intermediate",
  },
  {
    icon: Braces,
    title: "Chain-of-Thought",
    description: "Ask the model to think step-by-step, breaking complex reasoning into intermediate steps for better accuracy.",
    tag: "Advanced",
  },
  {
    icon: MessageSquare,
    title: "Role Prompting",
    description: "Assign a persona or expert role to the AI, shaping its tone, depth, and perspective in responses.",
    tag: "Beginner",
  },
  {
    icon: GitBranch,
    title: "Tree of Thoughts",
    description: "Explore multiple reasoning paths simultaneously, evaluating and pruning branches for optimal solutions.",
    tag: "Expert",
  },
  {
    icon: Zap,
    title: "Prompt Chaining",
    description: "Break complex tasks into sequential prompts, using each output as input for the next step.",
    tag: "Advanced",
  },
];

const tagColors: Record<string, string> = {
  Beginner: "text-primary border-primary/30",
  Intermediate: "text-accent border-accent/30",
  Advanced: "text-[hsl(45,100%,60%)] border-[hsl(45,100%,60%)/0.3]",
  Expert: "text-[hsl(340,80%,60%)] border-[hsl(340,80%,60%)/0.3]",
};

const TechniquesSection = () => {
  return (
    <section id="techniques" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Core <span className="text-gradient-primary">Techniques</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            The fundamental patterns every prompt engineer should master.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {techniques.map((tech, i) => (
            <motion.div
              key={tech.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group rounded-xl border border-border bg-card p-6 card-hover"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-lg bg-secondary">
                  <tech.icon className="w-5 h-5 text-primary" />
                </div>
                <span className={`text-xs font-mono border rounded-full px-2.5 py-0.5 ${tagColors[tech.tag]}`}>
                  {tech.tag}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{tech.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{tech.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechniquesSection;
