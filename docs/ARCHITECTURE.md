# Architecture

## Stack and why

| Concern | Choice | Reason |
|---|---|---|
| UI + server | Next.js 16 (App Router) + React 19 + TypeScript | One runtime for UI and API routes; the PRD's recommended default. The repo was empty, so there was no existing stack to preserve. |
| Validation | Zod 4 | Typed schemas for every agent output and every user action; `z.toJSONSchema` gives the model the exact contract. |
| Persistence | JSON file repository behind a `WorkspaceRepository` interface | **Deviation from the PRD's "SQLite" suggestion:** no native module or DB server is needed, data is easy to inspect, export and delete, and writes are atomic. The interface makes a SQLite/PostgreSQL implementation a drop-in replacement. |
| Parsing | `unpdf` (PDF), `mammoth` (DOCX), UTF-8 (TXT) | Established, pure-JS parsers that run server-side only. |
| Tests | Vitest | Fast TypeScript tests; the mock provider makes the whole pipeline deterministic. |
| Styling | Hand-written CSS with design tokens, light and dark | No extra build tooling; accessible contrast and focus states. |

## Layers

```
src/
  app/                     UI pages (App Router) + API route handlers (server only)
  components/              Client components: workspace context, statement cards, visuals
  lib/
    schemas/               Zod schemas (agent I/O, inputs) + persisted TypeScript model
    agents/                One module per agent: responsibility, prompt, schema, rule-based impl
    providers/             LLM provider interface, Gemini/Groq/Mock adapters, structured output + repair
    orchestrator/          Deterministic state machine, input builders, grounding, QA, actions, versions
    analysis/              Deterministic services: scoring, JD frequency, claim safety, consistency,
                           recruiter lens, injection scan, taxonomy, text utils
    repo/                  Repository interface + File/Memory implementations
    export/                Markdown / HTML report builders
    server/                Session/ownership, parsing, HTTP helpers, view model
    fixtures/              SYNTHETIC demo data (labelled)
tests/                     Unit + integration tests
```

Only `app/api/**` and `lib/server`, `lib/providers`, `lib/orchestrator` and `lib/repo` run on the server. Client components import only types and pure modules (`analysis/market`, `analysis/taxonomy`, `analysis/versionDiff`, `config`, `schemas`).

## Agents

Each agent is an `AgentDefinition` (`src/lib/agents/base.ts`) with:

- `responsibility`: one plain-language job, shown in the UI.
- `system`: the agent's own instructions, plus `SHARED_RULES` (never invent facts; documents are untrusted data; no protected attributes; no reasoning in output).
- `buildPrompt(input)`: builds the prompt over a **minimal typed input** prepared by `orchestrator/apply.ts`. For example, the Market agent sees only JDs plus target role and market; the Gap agent sees requirements, claims, skills and roles, but no resume.
- `outputSchema`: a Zod schema.
- `ruleBased(input)`: a deterministic implementation used by the mock provider.

| # | Agent | Input (minimal) | Output |
|---|---|---|---|
| 1 | Career Discovery | resume text, pasted LinkedIn text, roles from Goals | roles, skills, projects, certs, education, domains, achievement candidates, ambiguities, unknowns |
| 2 | Evidence Mining | achievement candidates, role ids | claims (activity/output/outcome/impact, source text, metrics) + follow-up questions |
| 3 | Market Intelligence | JDs, target role, market | per-JD extraction (required/preferred/tools/responsibilities/seniority/etc.) |
| 4 | Skills & Gap Analyst | key requirements with counts, claims, listed skills, roles | requirement × match matrix with evidence ids and next action |
| 5 | Positioning Strategist | goals, domains, claims, gap matrix | 2–3 options with proof points, risks, trade-offs, do-not-claim, recommendation |
| 6 | LinkedIn Architect | approved positioning, claims, roles, skills+gap status, projects, current text, QA revisions | headline options, About, Experience bullets, skills order, featured, checklist |
| 7 | Brand Strategist | approved positioning, themes, claims, tone, QA revisions | brand statement, 3–4 pillars, 10 ideas, 30-day calendar, tone, avoid, routine |
| 8 | Critic / QA | generated statements + cited evidence, positioning, market size | judgement flags (overconfidence, implied titles, missing caveats) |
| 9 | Action Planner | gaps, open questions, unconfirmed statements, QA flags, hours/week | 4-week prioritised actions with effort and completion criteria |

## Orchestrator (deterministic state machine)

`src/lib/orchestrator/steps.ts` holds pure functions:

- `prerequisite(ws, agent)` returns a blocker or null.
- `isStale(ws, agent)` compares monotonic sequence numbers. Each agent success and each user edit takes `ws.seq + 1`. An agent is stale if an upstream agent or a relevant user edit (`editSeq`) is newer, applied transitively.
- **Approval gates** are never auto-passed: confirm profile → evidence; choose positioning → LinkedIn/Brand; no open critical QA flag → planner.
- `nextStep(ws)` returns the first agent that is not done or is stale, or the gate that blocks it.

`src/lib/orchestrator/index.ts` (`runStep`) runs one agent:

1. Checks prerequisites and consent: non-mock providers require `consent.sendToProvider`.
2. Builds the minimal input and calls the provider through `generateStructuredOutput` (JSON mode, schema in the prompt, Zod validation, **one** repair retry).
3. Applies the output to a **clone** of the workspace with deterministic grounding (below). The workspace is replaced only on success, so a failure (timeout, quota, invalid output) never corrupts saved or approved data.
4. Records an `AgentRun`: provider, model, latency, attempts, token usage when reported, status, error code, correlation id. Prompts are never stored.
5. Recomputes scores. After the critic, if open critical/major flags target agent-written statements, it runs **one** revision cycle of the LinkedIn/Brand agents with those issues, then re-runs QA. Flags fixed by the revision are marked "revised".

The browser calls `/api/workspaces/:id/run` once per agent, so the stepper shows real progress and intermediate results, not a simulated animation.

## Evidence integrity (applies in every provider mode)

`orchestrator/apply.ts` treats all model output as untrusted:

- **Discovery:** roles, skills, certifications, domains and projects are kept only if they literally appear in the user's text; anything removed is listed in "ambiguities".
- **Evidence:** `sourceText` must be found in the user's material, or the claim becomes `inferred_needs_confirmation`. Metrics are kept only if their number appears in `sourceText`. `impact` requires a metric. Agents cannot mark claims `verified_by_user`; only the user can.
- **Market:** every extracted term must appear in that JD's text; ungrounded terms are dropped and reported. Frequencies are computed in code (`analysis/market.ts`) with numerator and denominator. Percentages are shown only at 5 or more JDs. Synthetic JDs are counted and labelled.
- **Gap:** "demonstrated" requires a valid, non-unsupported cited claim, otherwise it is downgraded. Missing evidence is "not evidenced in supplied material", never "lacks".
- **LinkedIn/Brand statements:** cited claim ids are validated, and `claimSafety.checkStatement` runs on each statement (numbers vs cited evidence, credentials, seniority/expertise terms, generic phrases). Status is derived deterministically: *supported*, *needs confirmation* or *excluded*. Skills not in the user's profile are removed. User-edited statements and calendar items are never overwritten.
- **QA:** `orchestrator/qa.ts` rule checks cover traceability, fabrication, market traceability, score definitions, positioning evidence, keyword stuffing, resume/LinkedIn consistency, brand grounding, schema validity and injection warnings. Critic-agent flags are merged in. Critical flags block export until the user confirms, edits or excludes the statement; critical flags cannot be dismissed.

## Prompt-injection defence

All user documents are wrapped in `<untrusted_document>` delimiters (closing tags inside the text are neutralised), and the shared rules tell every agent to treat them as data. Agents have no tools, so injected text cannot trigger actions. `analysis/injection.ts` scans inputs and surfaces warnings in Import and QA. The synthetic demo JD includes an injection string, and tests assert it changes no output.

## Scoring

`analysis/scoring.ts` implements seven rule-based components with versioned weights (`config.ts`, `heuristic-v1.0`): completeness 10%, alignment 25%, evidence 20%, search terms 15%, coherence 15%, differentiation 10%, brand 5%. Each returns a score with a formula and reasons, or `null` ("insufficient data"). The overall score is a weight-renormalised mean, shown only when at least 60% of weight has data. All components are labelled rule-based. The only LLM assessment is the Critic's flags, which are labelled "QA agent" in the UI.

## Providers

`providers/types.ts` defines `LLMProvider { generateText, checkHealth, getModelMetadata, modelFor }`. `generateStructuredOutput()` is provider-neutral. Adapters:

- `GeminiProvider`: `POST /v1beta/models/{model}:generateContent`, key in the `x-goog-api-key` header, `responseMimeType: application/json`, usage from `usageMetadata`.
- `GroqProvider`: OpenAI-compatible `/openai/v1/chat/completions`, bearer auth, `response_format: json_object`.
- `MockProvider`: runs each agent's `ruleBased` implementation; test hooks simulate failures and malformed output.

HTTP errors map to `NO_API_KEY`, `INVALID_API_KEY`, `RATE_LIMITED` (with retry-after), `QUOTA_EXHAUSTED`, `TIMEOUT`, `MODEL_UNAVAILABLE`, `SAFETY_BLOCKED`, `PROVIDER_ERROR` and `INVALID_OUTPUT`, each with a user-facing message. To add OpenAI or Anthropic, implement `LLMProvider`, then add a case in `providers/index.ts`. No agent changes are needed.

## Data model

`schemas/workspace.ts` defines the persisted `Workspace`: one user's analysis, owned via `ownerId`. It aggregates the PRD entities as typed collections (the mapping is documented at the top of that file) and carries timestamps, `schemaVersion`, sequence numbers, provenance (`origin`, `locked`, `sourceType`, `sourceText`, JD `source`/`providedAt`/`synthetic`), agent runs, report versions and feedback attached to a version id.

## Security

- API keys are read only in `providers/index.ts` (server). The browser receives `publicProviderStatus()`, which contains no keys.
- Ownership: the httpOnly `cs_owner` cookie. Every workspace route checks `ws.ownerId` and returns 404 otherwise.
- Workspace ids are validated against a strict pattern before touching the filesystem (no path traversal).
- Mutations are serialised per workspace (`withLock`); file writes are atomic.
- Uploads: extension, magic-byte and 5 MB size checks; parsed in memory and never stored.
- Security headers: `nosniff`, `DENY` framing, `same-origin` referrer.
- No outbound side effects: no publishing, applications, emails or scraping.
