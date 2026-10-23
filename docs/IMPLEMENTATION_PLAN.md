# Implementation plan and status

The repository was empty at the start (no commits, no files). Everything below was built in this change.

## Slices delivered (in build order)

| Slice | Content | Status |
|---|---|---|
| 0 Foundation | Next.js + TS + Zod + Vitest + ESLint config, `.env.example`, PRD copied to `docs/PRD.md` | ✅ |
| 1 Schemas | Agent I/O schemas, inputs, persisted workspace model | ✅ |
| 2 Deterministic services | Taxonomy, text utils, JD frequency, claim safety, consistency, injection scan, recruiter lens, scoring | ✅ |
| 3 Providers | Interface, Mock, Gemini, Groq, structured output with one repair retry, error taxonomy | ✅ (live APIs untested, see limitations) |
| 4 Agents 1–9 | Separate modules, prompts, schemas, rule-based implementations | ✅ |
| 5 Orchestrator | State machine, gates, staleness, grounding, run records, QA revision cycle, versions, user actions | ✅ |
| 6 Persistence + API | File/memory repositories, owner cookie, routes for health, workspaces, actions, run, export, parse, data | ✅ |
| 7 UI | Welcome, analyses list, settings/privacy, workspace shell with stepper, 15 workspace pages | ✅ |
| 8 Tests | 61 tests: unit + end-to-end orchestrator + integrity + providers + data | ✅ |
| 9 Docs | README, architecture, testing, limitations, this plan | ✅ |

## Feature checklist vs PRD

### Core journey (PRD §7 / prompt §6)
- ✅ Welcome page with value proposition, privacy note and "Start my analysis"
- ✅ Goal setup (objective, current/target role, market, industry, seniority, years, hours/week, tone, target companies; optional fields can be skipped)
- ✅ Import: paste resume; upload PDF/DOCX/TXT; paste or upload JDs; LinkedIn URL stored as a reference only, with an explicit "we do not fetch this" note
- ✅ Preview and correct extracted profile (edit/remove roles, add/remove skills, projects, certifications; explicit confirmation gate)
- ✅ Adaptive evidence interview: one question at a time, priority-ordered, saved immediately (resume anytime), adaptive follow-up on brief answers
- ✅ Career Profile view, evidence ledger with status control, Career DNA Map
- ✅ Market analysis with sample size, sources, dates and limitations
- ✅ Skills/gap matrix
- ✅ 2–3 positioning options side by side; user chooses and can edit the statement
- ✅ LinkedIn Builder: multiple headlines with character counts, editable About/Experience, skills order, featured, banner brief, checklist, copy controls, evidence badges
- ✅ Personal Brand Studio: statement, pillars, 10 ideas, tone guide, avoid list, routine, editable 30-day calendar
- ✅ Critic/QA review with flags and resolution (confirm / exclude / dismiss non-critical / reopen)
- ✅ Final report: executive summary, score definitions, sample size, gaps, profile copy, brand strategy, action plan
- ✅ Markdown export, print-friendly HTML, JSON data export, section-level copy
- ✅ Re-analysis via staleness + version snapshots and comparison
- ✅ Settings/privacy: provider status and health check, consent, export/delete (per analysis and all)
- ✅ Feedback (rating + inaccurate flag + comment) attached to the latest version

### Wow features
- ✅ P0 Evidence traceability (every statement expands to the source text it cites)
- ✅ P0 Positioning alternatives with pros/cons, proof points and risk
- ✅ P0 Claim Safety Check (metrics, credentials, seniority, generic language)
- ✅ P0 Market Signal Cards ("n of N", percentages only at N ≥ 5)
- ✅ P0 Before/After profile with change notes
- ✅ P0 Recruiter Lens (labelled simulation)
- ✅ P1 Career DNA Map, Current vs Target visual, resume/LinkedIn consistency flags, 30-day calendar + action plan, version comparison

### Deferred / next tasks (in recommended order)
1. **Validate Gemini live (chosen as the first provider).** Ready to run: `npm run gemini:check`, native `responseJsonSchema` with automatic fallback, default model `gemini-flash-latest`. Still needed: one successful run with a real key, confirming the schema is accepted, quota error bodies and output quality versus mock mode. Groq stays second.
2. **Usability test with 10–20 target users** (PRD Phase 3). Review outputs manually and tune taxonomy, prompts and scoring weights from observed failures.
3. **Stronger rule-based extraction** for unusual resume layouts (mock mode relies on dated role headers and bullet lists).
4. **Authentication + hosted PostgreSQL/Supabase** before any multi-user deployment: implement `WorkspaceRepository` for Postgres, replace the owner cookie with real auth, and add retention jobs.
5. Optional OpenAI/Anthropic adapters (one class each implementing `LLMProvider`).
6. PDF export (HTML print view is available today).
7. Rich-text diff in version comparison (currently side-by-side text plus change flags).
8. Billing only after value is validated (PRD §16). Not started, by design.

## Assumptions made (reversible)
- India-first defaults (market field defaults to "India"); the taxonomy targets BA/data/AI/product/automation roles and is editable in `src/lib/analysis/taxonomy.ts`.
- The 220/2600 LinkedIn limits are shown as "commonly cited; verify in LinkedIn", not as verified facts.
- One analysis = one workspace; multiple analyses per browser are supported.
- At least one JD is required before gap analysis (the PRD makes supplied JDs the primary market evidence).
