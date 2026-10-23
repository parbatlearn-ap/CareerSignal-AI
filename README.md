# CareerSignal AI

Evidence-first career positioning, LinkedIn profile intelligence and personal-brand strategy.

CareerSignal AI guides a professional through a deterministic workflow of **nine specialised agents**. They structure the user's experience, mine evidence, analyse the job descriptions the user supplies, compare evidence against requirements, propose 2–3 positioning options, draft a LinkedIn profile and a brand plan, audit every claim, and produce a 30-day action plan and an exportable report.

> **Disclaimer:** CareerSignal AI offers informational career guidance. It does not guarantee interviews, job offers, recruiter views or salary outcomes. Scores are heuristic diagnostics, not hiring probabilities.

- Product source of truth: [`docs/PRD.md`](docs/PRD.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Implementation plan and status: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- Testing and manual QA checklist: [`docs/TESTING.md`](docs/TESTING.md)
- Known limitations: [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md)

## Requirements

- Node.js **20.9 or newer** (developed and tested on Node 22.22)
- npm 10+
- No database server, no API key and no paid service is needed for demo mode.

## Install and run (demo / mock mode, no API keys)

```bash
git clone https://github.com/parbatlearn-ap/CareerSignal-AI.git
cd CareerSignal-AI
npm install
cp .env.example .env.local      # LLM_PROVIDER=mock by default
npm run dev                     # http://localhost:3000
```

Open http://localhost:3000 and choose one of:

- **Try the synthetic demo**: loads a clearly labelled fictional Business Analyst profile and 5 fictional job descriptions (one contains a prompt-injection test string). Click **Run next steps**; the workflow pauses at each decision that is yours to make (confirm profile, choose positioning, resolve critical QA flags).
- **Start my analysis**: enter your own goals, paste or upload your resume (PDF/DOCX/TXT), and paste target job descriptions.

In mock mode, every agent runs its deterministic, rule-based implementation over **your real input**. Nothing leaves the server, and the UI labels it "Demo mode · rule-based agents".

## Self-test with Google Gemini (recommended first provider)

Follow these steps on your own computer. Keys never go in chat, email or git.

1. **Get a key.** Go to https://aistudio.google.com/apikey, sign in with a Google account, and click **Create API key**. Copy the key.
2. **Put it in `.env.local`** (the file you created from `.env.example`, in the project folder). Set these two lines and save:
   ```
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=paste-your-key-here
   ```
   Leave `GEMINI_MODEL=gemini-flash-latest` unless step 3 tells you otherwise.
3. **Check it.** In the project folder, run `npm run gemini:check`. You should see three ✅ lines: key set, model found, valid JSON returned. If you see ❌, the message says what to fix (wrong key, model not available, quota reached). The check also lists the Flash models your key can use. To pin one, copy its name into `GEMINI_MODEL`.
4. **Restart the app.** Stop `npm run dev` (Ctrl+C) and start it again. The badge at the top of each analysis should now show `gemini · <model>` instead of "Demo mode".
5. **Give consent per analysis.** Open the analysis → **Privacy** → tick *Allow sending this analysis's … text to the configured external AI provider*. Without it, steps stop with a "consent required" message. Nothing is sent silently.
6. **Run it.** Click **Run next steps**. Each agent is one Gemini call, so a full run is roughly 10–13 calls including the QA revision cycle. If a step shows a quota or rate-limit error, wait and click **Re-run** on that step; completed steps are kept.

**Privacy warning for your first test:** Google's terms for the *unpaid* Gemini API tier allow Google to use submitted content to improve its products, and human reviewers may read it. Check Google's current terms. For a first test, use the synthetic demo or a resume with your name, contact details and employer names removed.

**What to compare in your self-test:** run the same material once in mock mode and once with Gemini, then compare. Do the positioning options feel specific to you? Are any statements marked "Needs your confirmation" that are actually true? Does QA flag anything Gemini invented? Use the **Rate this section** links so your notes stay attached to that version.

## Use a real LLM (Google Gemini or Groq)

Edit `.env.local` (server-side only; keys never reach the browser):

```bash
# Google Gemini - key from https://aistudio.google.com/apikey
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-flash-latest     # or a pinned id listed by `npm run gemini:check`

# or Groq - key from https://console.groq.com/keys
LLM_PROVIDER=groq
GROQ_API_KEY=your-key
GROQ_MODEL=llama-3.3-70b-versatile   # verify the current model id in Groq's model list

# Optional: a different model for one agent (same provider)
LLM_MODEL_CRITIC=...
LLM_TIMEOUT_MS=60000
```

Restart the server. Then:

1. Open **Settings & privacy → Check provider health** to confirm the key and model are reachable (quotas are not checked).
2. In each analysis, open **Privacy** and tick *Allow sending this analysis's text to the configured external AI provider*. Until you do, agent runs fail with a clear `CONSENT_REQUIRED` message. The app never switches providers on its own.

Free tiers have rate and daily limits that change over time. Quota and rate-limit errors are shown on the failed step with a **Re-run** button; saved data is never lost when a step fails.

> **Verification status:** both adapters are tested with mocked HTTP responses. Against the live Gemini API, only the endpoint, header authentication and the invalid-key error were confirmed (a fake key returned Google's real "API key not valid" response). No successful live generation has been run yet; `npm run gemini:check` with your key is that first test. Groq has not been exercised live. See `docs/KNOWN_LIMITATIONS.md`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build (`-p 3100` to change port) |
| `npm test` | Unit and integration tests (Vitest, mock provider) |
| `npm run lint` | ESLint (Next.js core-web-vitals and TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | lint + typecheck + test + build |
| `npm run gemini:check` | Verifies your Gemini key and model with one tiny synthetic request |

## Data and privacy

- Workspaces are stored as JSON files in `DATA_DIR` (default `.data/`, gitignored, mode 0600), bound to a random httpOnly cookie in the browser. This is a local-first boundary, **not** multi-user authentication.
- Uploaded files are parsed in memory and discarded; only the text the user saves is stored.
- Export: per analysis (Privacy page → JSON; Report page → Markdown/HTML), or everything (Settings → Export all).
- Delete: per analysis, or all data for this browser (Settings → Delete all my data).
- Agent run logs record provider, model, latency, attempts, token usage when reported, status and error code. They never record prompts or keys.

## Deployment

The app is a standard Next.js server (`npm run build && npm start`) and needs a writable `DATA_DIR`. It is suitable for a single-user or trusted-team deployment on any Node host with a persistent disk. It has **not** been deployed as part of this build. Before any public multi-user deployment, add real authentication and a hosted database (see `docs/KNOWN_LIMITATIONS.md` and `docs/IMPLEMENTATION_PLAN.md`). Serverless hosts with ephemeral filesystems (for example Vercel) will lose data with the file store.

## Agent workflow

```
Goals + Import (resume, current LinkedIn text, job descriptions)
        │
        ▼
 1 Career Discovery ──► [you confirm/correct profile] ──► 2 Evidence Mining ──► Evidence Interview (optional, one question at a time)
                                                                │
 3 Market Intelligence (JDs only; counts computed in code) ─────┤
                                                                ▼
                                                     4 Skills & Gap Analyst
                                                                │
                                                                ▼
                                          5 Positioning Strategist ──► [you choose / edit one option]
                                                                │
                                         ┌──────────────────────┴───────────────────┐
                                         ▼                                          ▼
                              6 LinkedIn Profile Architect                7 Personal Brand Strategist
                                         └──────────────────────┬───────────────────┘
                                                                ▼
                           8 Critic / QA (rule checks + agent) ──► one automatic revision cycle ──► [you resolve critical flags]
                                                                │
                                                                ▼
                                                   9 Career Action Planner ──► Report, export, versions
```

A deterministic orchestrator (`src/lib/orchestrator`) controls ordering, prerequisites, staleness, approval gates, retries, persistence and run records. It is not itself an agent.
