# Known limitations

Stated plainly so nobody mistakes this MVP for more than it is.

## Not verified in this build
- **No successful live Gemini or Groq generation has been run.** No API keys were available in the build environment. For Gemini, only the endpoint, header auth and the invalid-key error path were confirmed live, using a deliberately fake key. Native schema enforcement (`responseJsonSchema`) is sent by default and falls back automatically to plain JSON mode if Gemini rejects our schema. Whether Gemini accepts the schema as-is is unconfirmed. Run `npm run gemini:check` with a real key as the first live test.
- **Gemini model ids churn fast.** As of Oct 2026, public sources report that the 2.0 models are shut down and the 2.5 models are restricted for new projects. The newer 3.x ids conflict across sources. The app therefore defaults to Google's moving alias `gemini-flash-latest`, which can change behaviour when Google updates it (Google gives about 2 weeks' notice for breaking changes). Pin `GEMINI_MODEL` once you have a model you trust.
- **Gemini free-tier privacy:** Google's terms for the unpaid tier allow submitted content to be used to improve its products. The app asks for per-analysis consent, but it cannot change Google's terms.
- No deployment was performed.
- Accessibility was checked for labels, focus, contrast tokens and keyboard reachability, but not with a real screen reader. Only Chromium was tested.

## Product and quality
- **Mock mode is rule-based, not AI.** It extracts with a fixed taxonomy and simple patterns (dated role headers, bullet lists). Unusual resume layouts may produce sparse profiles; users can correct the profile manually. Generated copy in mock mode is template-based and reuses the user's own wording.
- Output quality with real LLMs depends on the model; the deterministic grounding layer limits fabrication but cannot guarantee good writing.
- Number grounding compares numeric values, so a model could re-use a true number in a false context (e.g. attach "40" to a different achievement). The cited-evidence check reduces this risk; user confirmation remains the final control.
- Seniority/expertise detection is a word list ("senior", "lead", "expert", …), so it can produce false positives and false negatives.
- Market analysis is limited to the JDs the user supplies; there is no live job-data source. With fewer than 3 JDs, findings are labelled directional; percentages are hidden below 5.
- Scoring weights are initial hypotheses (`heuristic-v1.0`), not validated against outcomes. There is deliberately no benchmark.
- LinkedIn character limits (220 headline / 2,600 About) are labelled "commonly cited; verify in LinkedIn".
- The evidence interview generates questions once per evidence run plus a single adaptive follow-up; it does not dynamically re-plan the question order with an LLM after each answer.

## Security and data
- **No real authentication.** Ownership is a random httpOnly cookie per browser (local-first mode). Anyone with server filesystem access can read `DATA_DIR`. Do not deploy publicly for multiple users without adding authentication, a hosted database and access controls.
- Workspaces are stored unencrypted at rest in `DATA_DIR` (file mode 0600). No automatic retention/expiry job exists yet; users delete manually.
- The per-workspace lock is in-process; running multiple server instances against one `DATA_DIR` could race.
- Raw uploaded files are never stored, but extracted resume text is stored until the user deletes it (needed to re-run analysis).
- The persistence layer is a JSON-file repository rather than SQLite (documented deviation; swap it in via `WorkspaceRepository`).

## Not built (by design or deferred)
- Billing/pricing tiers (PRD: validate value first).
- PDF export (print-friendly HTML is available).
- OpenAI/Anthropic adapters (the interface is ready).
- Vector search (not needed for the MVP).
- Any LinkedIn scraping, auto-publishing, job applications or recruiter outreach. These will not be built.
