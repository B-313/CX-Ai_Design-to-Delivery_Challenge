declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

type RagChunk = {
  id: string;
  source: string;
  text: string;
};

type EmbeddingRow = {
  id: string;
  source: RagChunk["source"];
  text: string;
  similarity: number;
};

type EmbeddingRecord = {
  chunk: RagChunk;
  embedding: number[];
};

const CORPUS: RagChunk[] = [
  // === Company Name Brand Guide ===
  { id: "cn-brand-1", source: "Company Name Brand Guide", text: "Company Name content should be clear, evidence-based, respectful, and patient-centred. Avoid hype, absolute claims, and unsupported certainty." },
  { id: "cn-brand-2", source: "Company Name Brand Guide", text: "Use plain language, short sentences, and transparent risk-benefit framing. Keep calls to action specific, safe, and appropriate for the audience." },
  { id: "cn-brand-3", source: "Company Name Brand Guide", text: "Patient-facing content must prioritise emotional safety and achievable actions. Present statistics in absolute risk terms rather than relative risk; always include the denominator so patients understand the scale." },
  { id: "cn-brand-4", source: "Company Name Brand Guide", text: "HCP-facing content may use clinical terminology, dosing data, and published study results. Ensure every efficacy claim cites peer-reviewed evidence. Anecdote-based claims are not acceptable for HCP audiences." },
  { id: "cn-brand-5", source: "Company Name Brand Guide", text: "Digital headlines should be outcome-led and benefit-focused, not product-feature-led. Lead with what changes for the patient or HCP - the result - not what the product does mechanistically." },
  { id: "cn-brand-6", source: "Company Name Brand Guide", text: "Imagery must reflect diversity in age, ethnicity, and ability. Avoid representing patients as passive or helpless. Show agency and realistic daily-life activity where clinically appropriate." },
  { id: "cn-brand-7", source: "Company Name Brand Guide", text: "Every Company Name digital build must include a visible accessibility statement and meet WCAG 2.1 AA as a minimum standard. Screen-reader and keyboard-navigation testing is required before go-live." },
  { id: "cn-brand-8", source: "Company Name Brand Guide", text: "Preferred patient CTAs: 'Talk to your doctor', 'Learn about your treatment options', 'Find a specialist'. Avoid CTAs that imply self-diagnosis, self-treatment, or urgent action that bypasses clinical consultation." },
  // === UK MHRA Blue Guide ===
  { id: "uk-mhra-1", source: "UK MHRA Blue Guide", text: "United Kingdom: MHRA guidance and the Blue Guide (gov.uk/mhra, gov.uk/blue-guide) require medicinal promotion to be accurate, balanced, and not misleading." },
  { id: "uk-mhra-2", source: "UK MHRA Blue Guide", text: "UK MHRA rules strictly prohibit direct advertising of prescription-only medicines (POMs) to the general public. Consumer-facing digital content for POMs must be disease-awareness only and must not name the product or encourage its use." },
  { id: "uk-mhra-3", source: "UK MHRA Blue Guide", text: "UK prescription drug digital promotion to HCPs must be clearly labelled as promotional material and must include the company name, UK abbreviated prescribing information (API), and an adverse event reporting statement." },
  // === UK ABPI Code ===
  { id: "uk-abpi-1", source: "UK ABPI Code", text: "United Kingdom: ABPI Code of Practice (abpi.org.uk/code-of-practice) sets standards for promotional claims, substantiation, and responsible communications." },
  { id: "uk-abpi-2", source: "UK ABPI Code", text: "ABPI Code 2021: All UK digital promotional content must be certified by a senior medical or regulatory signatory before first use. The date of preparation (month and year) must appear in the material footer." },
  { id: "uk-abpi-3", source: "UK ABPI Code", text: "ABPI Code prohibits financial inducements to HCPs in digital campaigns. Prize draws, gifts, or hospitality beyond permitted educational materials require regulatory review. Gamification mechanics targeting HCPs are restricted." },
  { id: "uk-abpi-4", source: "UK ABPI Code", text: "ABPI Code comparative claims between medicines must be based on published peer-reviewed head-to-head data. Indirect or network meta-analysis comparisons must be clearly labelled and not presented as direct evidence of superiority." },
  // === UK Human Medicines Regulations 2012 ===
  { id: "uk-hmr-1", source: "UK Human Medicines Regulations 2012", text: "United Kingdom: Human Medicines Regulations 2012 (legislation.gov.uk/uksi/2012/1916) apply to medicinal product advertising and associated restrictions on claims, channels, and target audiences." },
  // === EU EMA Directive 2001/83/EC ===
  { id: "eu-ema-1", source: "EU EMA Directive 2001/83/EC", text: "European Union: EMA framework with Directive 2001/83/EC (ema.europa.eu) and national agencies (for example BfArM Germany, AIFA Italy) governs medicinal promotion and information quality." },
  { id: "eu-ema-2", source: "EU EMA Directive 2001/83/EC", text: "EU member states layer national rules on top of Directive 2001/83/EC. Multi-country EU campaigns require per-market local regulatory review (e.g., German Heilmittelwerbegesetz, French CSP). A single campaign rarely complies across all EU markets without localisation." },
  { id: "eu-ema-3", source: "EU EMA Directive 2001/83/EC", text: "EU comparative advertising of medicines must be objective, relevant, and verifiable. Superiority claims require head-to-head clinical evidence. Claims using surrogate endpoints only must be clearly qualified and cannot imply overall clinical superiority." },
  // === US FDA Fair Balance ===
  { id: "us-fda-1", source: "US FDA Fair Balance", text: "United States: FDA prescription drug advertising requires fair balance under 21 CFR 202.1 (fda.gov/drugs/drug-advertising). Benefit and risk information must be balanced and presented in understandable language." },
  { id: "us-fda-2", source: "US FDA Fair Balance", text: "US FDA fair balance: risk information must appear with prominence and readability comparable to benefit information. In digital formats the ISI must not be buried in scrollable fine print - it must be clearly visible or no more than one click away." },
  { id: "us-fda-3", source: "US FDA Fair Balance", text: "US social media pharma posts that name a product and its indication must always include or link to fair balance. Character-limited formats must link directly to a landing page displaying the full ISI and prescribing information." },
  // === US FDA DTC Advertising ===
  { id: "us-dtc-1", source: "US FDA DTC Advertising", text: "United States: Direct-to-consumer promotion follows FDA prescription drug advertising rules (fda.gov/drugs/prescription-drug-advertising)." },
  { id: "us-dtc-2", source: "US FDA DTC Advertising", text: "US DTC digital advertising must present the most important risks in consumer-friendly language (major statement). The full ISI must be accessible within the digital experience - a dynamically revealed section no more than one click away is acceptable." },
  // === AU TGA Advertising Code 2021 ===
  { id: "au-tga-1", source: "AU TGA Advertising Code 2021", text: "Australia: Therapeutic Goods Advertising Code 2021 applies (tga.gov.au) and requires compliant claim language and audience suitability for all therapeutic goods advertising." },
  { id: "au-tga-2", source: "AU TGA Advertising Code 2021", text: "Australia TGA: lay testimonials and patient experience references for therapeutic goods must comply with the TGA Advertising Code. Patient endorsements for prescription medicines are not permitted in consumer-facing digital promotion." },
  { id: "au-tga-3", source: "AU TGA Advertising Approval", text: "Australia: Pre-approval by TGA may be required for advertising specific therapeutic goods categories (tga.gov.au/advertising-approval). Confirm pre-approval requirements before publishing any Australian-facing campaign." },
  // === Accessibility Standards ===
  { id: "wcag-1", source: "WCAG 2.1 AA – Pharma Digital", text: "WCAG 2.1 AA requires a minimum 4.5:1 contrast ratio for normal body text and 3:1 for large text (18pt+) and UI components. All pharma digital assets must meet this standard; run automated checks with Lighthouse or axe before launch." },
  { id: "wcag-2", source: "WCAG 2.1 AA – Pharma Digital", text: "Patient-facing pharma websites must be fully keyboard-navigable and compatible with major screen readers (NVDA, JAWS, VoiceOver). Images require descriptive alt text; decorative images use empty alt. Video requires closed captions and audio description." },
  { id: "wcag-3", source: "WCAG 2.1 AA – Pharma Digital", text: "Modals, cookie banners, and pop-up overlays must trap focus while open, return focus to the trigger element on close, and be dismissible via the ESC key. This is a WCAG 2.1 AA requirement for all interactive dialogs on pharma sites." },
  // === GDPR / UK GDPR ===
  { id: "gdpr-1", source: "GDPR / UK GDPR", text: "GDPR and UK GDPR require freely given, specific, informed, and unambiguous consent before non-essential tracking cookies are set. Consent must be as easy to withdraw as to give; pre-ticked boxes are not valid consent." },
  { id: "gdpr-2", source: "GDPR / UK GDPR", text: "Patient portals and HCP registration forms collecting personal data must display a full privacy notice at point of collection. Data minimisation applies: collect only fields strictly necessary for the stated purpose." },
  { id: "gdpr-3", source: "GDPR / UK GDPR", text: "Health data is a GDPR Special Category. Any digital tool that could capture health status requires explicit consent, a Data Protection Impact Assessment (DPIA), and ICO registration in the UK. Pseudonymisation and encryption are expected technical safeguards." },
  // === Pharma Digital Best Practice ===
  { id: "digital-1", source: "Pharma Digital Best Practice", text: "Patient-facing pharma sites must be mobile-first. Over 70% of health queries begin on mobile devices. Touch targets must be at least 44×44 CSS pixels (WCAG 2.5.5). Target page load under 3 seconds on a 4G connection." },
  { id: "digital-2", source: "Pharma Digital Best Practice", text: "Patient content should target Grade 6–8 reading level (Flesch-Kincaid). Avoid unexplained medical Latin. Use short paragraphs (2–3 sentences maximum) and bulleted lists. Define every technical term at first mention without condescension." },
  { id: "digital-3", source: "Pharma Digital Best Practice", text: "UK social media posts referencing a named medicine must include a reference to the SmPC (Summary of Product Characteristics) and an adverse event reporting statement. Even character-limited posts must link directly to full prescribing information." },
  { id: "digital-4", source: "Pharma Digital Best Practice", text: "Email campaigns to HCPs in the UK must comply with PECR (Privacy and Electronic Communications Regulations). HCP email lists must be opt-in or within a verifiable professional relationship. Every email must contain a clear one-click unsubscribe mechanism." },
  // === Health Canada ===
  { id: "ca-1", source: "Health Canada DPSD", text: "Canada: Health Canada under the Food and Drugs Act prohibits branded DTC advertising of prescription drugs except for reminder ads (product name only) and help-seeking ads (no product named). Schedule A diseases restrict even these formats. HCP-facing promotion with fair balance is permitted." },
  // === Pharma Content Substantiation ===
  { id: "sub-1", source: "Pharma Content Substantiation", text: "All clinical claims in promotional digital materials must be substantiated by peer-reviewed evidence on file and dated. Use superscript reference numerals with a full bibliography section or accessible footnote. Do not overstate the evidence or omit study limitations." },
  { id: "sub-2", source: "Pharma Content Substantiation", text: "Superlative claims ('first', 'only', 'best', 'most effective') require watertight documented substantiation. Where evidence is uncertain, use qualified language ('among the first', 'one of the leading approaches'). Seek regulatory and legal sign-off before any superlative is published." },
];

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardScore(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function createEmbedding(_input: string): Promise<number[] | null> {
  // Groq does not provide an embeddings API; lexical fallback handles retrieval
  return null;
}

let corpusEmbeddingPromise: Promise<EmbeddingRecord[] | null> | null = null;

async function getCorpusEmbeddings(): Promise<EmbeddingRecord[] | null> {
  if (!corpusEmbeddingPromise) {
    corpusEmbeddingPromise = (async () => {
      const records: EmbeddingRecord[] = [];
      for (const chunk of CORPUS) {
        const embedding = await createEmbedding(`${chunk.source}\n${chunk.text}`);
        if (!embedding) return null;
        records.push({ chunk, embedding });
      }
      return records;
    })();
  }
  return corpusEmbeddingPromise;
}

async function retrieveFromVectorStore(query: string, topK: number): Promise<RagChunk[]> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];

  const embedding = await createEmbedding(query);
  if (!embedding) return [];

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_rag_documents`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: topK,
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    return (data as EmbeddingRow[])
      .filter((row) => typeof row?.text === "string" && row.text.length > 0)
      .map((row) => ({
        id: row.id,
        source: row.source,
        text: row.text,
      }));
  } catch (_) {
    return [];
  }
}

async function retrieveSemanticInMemory(query: string, topK: number): Promise<RagChunk[]> {
  const queryEmbedding = await createEmbedding(query);
  if (!queryEmbedding) return [];

  const corpusEmbeddings = await getCorpusEmbeddings();
  if (!corpusEmbeddings || corpusEmbeddings.length === 0) return [];

  const ranked = corpusEmbeddings
    .map((record) => ({
      chunk: record.chunk,
      score: cosineSimilarity(queryEmbedding, record.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.chunk);

  return ranked;
}

function retrieveLexicalFallback(query: string, topK: number): RagChunk[] {
  const q = tokenize(query || "");
  const scored = CORPUS.map((chunk) => {
    const score = jaccardScore(q, tokenize(chunk.text));
    return { chunk, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.chunk);

  return scored.length > 0 ? scored : CORPUS.slice(0, topK);
}

export async function retrievePharmaContext(query: string, topK = 6): Promise<RagChunk[]> {
  const vectorStore = await retrieveFromVectorStore(query, topK);
  if (vectorStore.length > 0) return vectorStore;

  const inMemorySemantic = await retrieveSemanticInMemory(query, topK);
  if (inMemorySemantic.length > 0) return inMemorySemantic;

  return retrieveLexicalFallback(query, topK);
}

export function formatRagContext(chunks: RagChunk[]): string {
  return chunks
    .map((c, idx) => `[${idx + 1}] (${c.source}) ${c.text}`)
    .join("\n");
}
