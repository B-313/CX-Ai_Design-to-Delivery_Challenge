# Design-to-Delivery Accelerator

Prompt Intelligence Engine (PIE) and Retrieval-Augmented Generation (RAG) for pharma content briefs.
The project was built as a secure Vercel frontend plus Supabase Edge Functions backend, with optional local AI prototypes for development.

## A Note from the Build

Full transparency: this started life as a hackathon piece of work, built fast and built to learn (with magic from ai paired coding). Along the way it became a proper crash course in the whole stack, the frontend (React, TypeScript, Vite, Tailwind), the backend (Supabase Edge Functions and a hybrid rules-plus-LLM pipeline), and the unglamorous-but-vital parts: deployment, hosting, and environment management.

Because this version is rendered public, a fair bit has been politely shown the door to keep secrets safe: API keys, service-role credentials, project identifiers, and anything resembling private or company-specific data have all been removed or replaced with friendly placeholders. Nothing load-bearing was lost. The original scope is all still here, just tidied up, scrubbed, and given a clean shave so it can be read by strangers without leaking anything it should not.

In short: same brain, fewer secrets. Plug in your own keys and it runs.

## What This Project Is

- A pharma-focused workflow that turns a plain-language prompt and supporting documents into a compliant, submit-ready content brief and webpage draft.
- PIE analyses the project prompt for audience, jurisdiction, regulatory risk, brand tone, and readability.
- RAG injects pharma-specific guidance (brand voice, regulatory codes, accessibility, GDPR) into generation and review.
- A human governance gate sits at the end: a reviewer approves the content, and any uploaded media is reviewed by a person rather than scored by the model.

## End-to-End Workflow

The app guides a requester through six steps:

1. **Register** - capture the requester's details for the audit trail.
2. **Ideation** - choose audience and region, name any specific product or therapy, write the prompt, and optionally attach supporting documents or a reference link.
3. **Brief** - PIE classifies the request and a brief is generated, grounded in the prompt, the uploaded sources, and RAG context.
4. **Enriched Content** - the brief is expanded into real webpage copy (hero, sections, call to action). Uploaded images are placed into the page, and uploaded documents can add content.
5. **Review** - a model-based compliance review returns scored findings (compliance, brand voice, grammar, accessibility). Each finding is accepted or declined, and the quality gate must pass before submission.
6. **Submit** - the project is exported as an HTML page and a PDF report, and a reviewer notification is sent.

## Content Grounding and Deliverables

- Concrete details supplied in the prompt or uploaded documents (for example fees, opening hours, contact details, or eligibility) are carried through into the generated brief and the enriched content rather than summarised away.
- Uploaded media (images and files) is not scored by PIE. It is flagged for human review, and the reviewer confirms suitability and compliance before approval.
- The Submit step downloads two artifacts: the page as standalone HTML (with any embedded images) and a PDF audit report that includes the PIE scorecard, review decisions, page content, and embedded images.

## Architecture Overview

- `src/`: React + TypeScript + Vite frontend.
- `supabase/functions/`: server-side AI and compliance workflows hosted as Supabase Edge Functions.
- `pie-engine/`: local Python prototype for prompt enrichment and analytics, not required for hosted production.
- `rag engine/`: optional local RAG demo engine, intended for development or offline proof-of-concept only.
- `tests/`: Playwright and Vitest coverage for UI and workflow behaviour.

## Hosting Recommendations

- **Frontend:** deploy on Vercel.
- **Backend:** deploy protected APIs on Supabase Edge Functions.
- **Secrets:** keep all API keys and service-role credentials in Vercel/Supabase environment settings only.
- Do not commit `.env` or secret values into Git.

## How the Core Mechanism Works

### PIE (Prompt Intelligence Engine)

The first layer of the workflow, it evaluates a brief with:

- jurisdiction detection based on country and prompt content
- risk scoring using pharma-sensitive keywords (whole-word matched to avoid false positives)
- tone analysis against approved brand voice criteria
- readability prediction (Flesch-Kincaid) tuned for patient versus professional audiences
- regulatory guidance injection for GDPR, FDA, EMA/MHRA, and other markets

The classifier logic lives in `supabase/functions/pie-classify/index.ts`, and the frontend uses its output to enrich the generation request.

### RAG (Retrieval-Augmented Generation)

RAG supplies context from a built-in corpus of brand, regulatory, accessibility, and best-practice guidance.

- `supabase/functions/_shared/pharmaRag.ts` retrieves and formats relevant context.
- The RAG context is embedded into the AI prompt before generation, enrichment, and review.
- This improves accuracy and reduces unsupported claims in pharma-focused copy.

### AI Functions

- `pie-classify`: scores incoming briefs for audience fit, regulatory risk, tone, and readability.
- `generate-brief`: produces a structured content brief grounded in the prompt, sources, and RAG context.
- `enrich-content`: expands the brief into real webpage copy and preserves specific facts from uploaded sources.
- `review-content`: runs a model-based compliance review and returns structured issues, severity labels, and remediation recommendations.
- `notify-reviewer`: sends the reviewer notification on submission.
- `analyze-brief`: standalone brief analysis helper.

The system is intentionally hybrid:

- rule-based scoring handles jurisdiction, risk keywords, tone guidance, and readability targets.
- model-based generation and review use structured tool/function output to return JSON-safe results.

## Folder Structure

- `src/` - frontend app and workflow UI
- `src/integrations/supabase/` - Supabase client and protected invocation helpers
- `src/components/` - UI panels, builder, review, submission flow
- `supabase/functions/` - deployed edge functions for AI workflows
- `supabase/functions/_shared/` - shared utilities such as RAG retrieval and API auth
- `pie-engine/` - local Python prompt engine prototype
- `rag engine/` - local RAG demo engine
- `tests/` - E2E and unit test suites

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Run frontend

```sh
npm install
npm run dev
```

Open the app at:

- `http://localhost:8080`

### Optional local AI prototype

The local Python prototype is only for development testing. Install dependencies with:

```sh
python -m pip install -r pie-engine/requirements
```

## Environment Configuration

Use `.env` for local frontend settings and keep it out of Git. Copy `.env.example` and fill in your own values.

Frontend `.env` sample:

```env
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

Supabase Edge Function secrets (set via the Supabase CLI or dashboard, never in the repo):

- `GROQ_API_KEY` - required, powers the generation and review functions
- `SUPABASE_SERVICE_ROLE_KEY` - required for vector retrieval
- `RESEND_API_KEY` and `REVIEWER_EMAIL` - optional, enable real reviewer emails

### API keys

The hosted functions use a shared server-side key by default so the app works without setup. A user may also paste their own key in the app, which takes precedence and is stored only in their browser.

## Deployment

### Vercel (frontend)

Deploy the app on Vercel and configure the frontend environment variables listed above.

### Supabase Edge Functions (backend)

Deploy the functions from `supabase/functions/`:

```sh
supabase functions deploy pie-classify generate-brief enrich-content review-content notify-reviewer analyze-brief --project-ref your-project-id
```

## Testing

Run unit tests:

```sh
npm test
```

Run E2E tests:

```sh
npx playwright test
```

## Git Safety Notes (which I learned the hard way)

- Never commit `.env` files or secret keys.
- Keep all API credentials in Vercel/Supabase settings.
- Remove large generated or binary artifacts from Git.
- This README uses placeholders only; replace them with your own deployment values.
