# CareerSignal AI — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 16 October 2026  
**Purpose:** Source of truth for building the CareerSignal AI MVP.

> **Recommendation:** Build an evidence-first, career-positioning workflow before investing in advanced agent frameworks, paid APIs, or live job-market integrations. Start with a mock provider and user-supplied job descriptions; validate quality and user value before scaling.

## 1. Executive summary

CareerSignal AI helps professionals understand how they are positioned
in the job market, identify credible career directions, differentiate
themselves, and turn their real experience into a strong LinkedIn
profile and personal-brand plan.

The product is not merely a LinkedIn headline/About-section generator.
It orchestrates a set of specialized AI agents that perform separate
tasks: career discovery, evidence extraction, job-market analysis,
skills-gap analysis, positioning strategy, LinkedIn optimization,
personal-brand planning, and quality/evidence verification.

The product packages expertise into a guided workflow so users do not
need prompt-engineering skills or need to know which questions to ask a
general-purpose model.

### Product promise

> **Don't ask AI what to write. Let AI help you figure out what you
> should be known for---and then help you communicate it credibly.**

### MVP operating principle

Start with low-cost/free-tier Google Gemini or Groq API access, a
replaceable database layer, and a simple web application. Keep the LLM
provider, database, job-data source, embeddings provider, and deployment
target configurable. Validate output quality and user demand before
paying for premium APIs or infrastructure.

Free-tier limits and provider terms change. The application must display
provider/configuration status, handle quota errors gracefully, and never
assume a free API will provide unlimited or production-grade
availability.

------------------------------------------------------------------------

## 2. Problem statement

Professionals often know their work but struggle to explain their value
to the market. They may: - Describe duties instead of outcomes. - Have a
generic or unfocused LinkedIn headline and About section. - List many
skills without a clear professional identity. - Want to transition
careers but not know how to bridge their existing experience to the
target role. - Not understand which capabilities are common or important
in current job descriptions. - Lack evidence to support their claims. -
Generate generic AI content because they do not know how to structure
the task or challenge the model's output. - Have no practical plan to
make their profile and personal brand more distinctive over time.

General-purpose LLMs can help with individual tasks, but the user must
know what context to provide, which questions to ask, how to compare
outputs with market evidence, and how to verify claims. CareerSignal AI
productizes that workflow.

## 3. Product vision and goals

### Vision

Become a trusted career-positioning copilot that helps professionals
connect their authentic experience with realistic market opportunities
and communicate their value clearly.

### MVP goals

1.  Guide a user through a structured career-discovery workflow.
2.  Create an evidence-backed Career Profile from user-supplied
    information.
3.  Analyze a target role using user-provided job descriptions and/or
    permitted public job sources.
4.  Identify strengths, gaps, differentiators, and positioning options.
5.  Produce a coherent LinkedIn profile draft aligned to a chosen career
    objective.
6.  Create a practical personal-brand strategy with content pillars and
    a 30-day starter calendar.
7.  Verify that generated claims are supported by user evidence and
    clearly flag missing information.
8.  Make each agent's responsibility and output visible in an
    understandable way.
9.  Support low-cost model providers now and premium providers later
    without rewriting product logic.
10. Validate whether users find the insights useful enough to pay for.

### Non-goals for the MVP

-   Guaranteeing interviews, job offers, recruiter views, or salary
    increases.
-   Claiming that an internal score predicts hiring success.
-   Scraping LinkedIn or bypassing its access controls, login, rate
    limits, or terms.
-   Automatically editing/publishing a user's LinkedIn profile.
-   Sending messages to recruiters or applying for jobs automatically.
-   Training a proprietary predictive hiring model.
-   Using private recruiter/application outcomes unless legitimately
    obtained with permission.
-   Building a full job board or recruitment management system.
-   Building a complex autonomous multi-agent framework before proving
    the workflow.

## 4. Target users and initial segment

### Primary target

Professionals with approximately 3--20 years of experience who want
to: - Improve LinkedIn positioning. - Transition to a new role or
industry. - Move into AI/data/product/technology-adjacent roles. -
Communicate business impact more clearly. - Build a credible
professional brand.

### Initial launch segment

Start with one narrow segment to improve the relevance of the product
and make testing manageable:

**Experienced professionals in India pursuing a career transition or
repositioning into business analysis, data/AI, product, automation, or
adjacent roles.**

This is a starting hypothesis, not a permanent limitation. Keep role
taxonomy and geography configurable.

### Secondary users

-   Early-career professionals.
-   Independent consultants and freelancers.
-   Senior professionals building thought leadership.
-   Career coaches (future B2B or partner channel).

## 5. Jobs to be done

When I am unsure how the market sees me, help me understand my current
professional positioning.

When I want to move into a new role, help me assess the fit between my
evidence and the target role's requirements.

When my profile sounds generic, help me identify a credible
differentiator and communicate it clearly.

When I have achievements but struggle to explain them, ask targeted
questions and turn the answers into accurate, evidence-backed
statements.

When I want to build a personal brand, help me choose a clear audience,
point of view, content pillars, and realistic publishing plan.

When I update my profile or target role, help me see what changed and
what to do next.

## 6. Product principles

1.  **Evidence before eloquence:** Never invent metrics, achievements,
    credentials, employers, projects, or responsibilities.
2.  **Market evidence over model confidence:** Distinguish findings
    grounded in supplied job descriptions from general model knowledge.
3.  **Positioning before copywriting:** Do not generate the final
    LinkedIn profile before analyzing goals, evidence, and target-market
    requirements.
4.  **One clear professional narrative:** Avoid keyword stuffing and
    incompatible identities.
5.  **Explainable scores:** Every score must show its definition,
    component scores, evidence, and limitations.
6.  **Human approval:** The user controls the final narrative and every
    profile claim.
7.  **Multi-agent with real separation:** Each agent has one defined
    task, a typed input/output contract, and a visible result. Do not
    create agents that merely rewrite one another's text.
8.  **Provider independence:** LLM providers are adapters, not business
    logic.
9.  **Privacy by design:** Collect only what is necessary; let users
    export and delete their data.
10. **No false promises:** Never represent a profile-quality score as
    probability of getting an interview or job.

------------------------------------------------------------------------

## 7. Core user journey

### Stage 1 --- Welcome and goal selection

Ask the user to choose one primary objective: - Improve current LinkedIn
profile. - Transition to a new role. - Position for promotion/senior
leadership. - Build a professional personal brand. - Understand
target-role gaps. - Explore plausible career directions.

Collect country/market, current role, years of experience, target
role(s), target industry, and target companies if known. Allow
unknown/skip responses.

### Stage 2 --- Import career information

Support: - Resume PDF/DOCX/TXT upload where parsing is available. -
Manual paste of resume or LinkedIn sections. - Structured form for
current role, previous roles, projects, education, skills,
certifications, and achievements. - User-provided job descriptions
(paste or file upload). - Optional public profile URL as a reference
only; do not promise automated extraction from LinkedIn. If extraction
is unavailable or disallowed, request pasted content or an exported
profile PDF.

Show extracted information to the user for correction before analysis.

### Stage 3 --- Evidence interview

Ask adaptive follow-up questions to clarify vague achievements.
Prioritize questions with high impact on the final positioning. Avoid
asking all possible questions at once.

Example: - What process or problem did you change? - What was the
baseline? - What changed after your work? - How was the result
measured? - Who used the output? - What tools or methods did you use? -
Can the result be quantified? If not, what qualitative evidence exists?

Store claims with evidence status: - Verified by user - User-provided,
not independently verified - Inferred candidate (requires
confirmation) - Unsupported / do not use

### Stage 4 --- Career Profile

Build a structured, editable Career Profile that includes: - Career
history and role chronology. - Skills with evidence links. - Domain
expertise. - Projects and deliverables. - Achievements and impact. -
Leadership and stakeholder experience. - Tools/technology. -
Credentials. - Career preferences and constraints. - Target roles and
geography. - Values, strengths, and differentiators. - Evidence gaps and
unresolved questions.

### Stage 5 --- Market analysis

Analyze 3--10 supplied job descriptions where possible. Extract: - Role
title and seniority. - Required vs preferred skills. - Responsibilities
and outcomes. - Tools/technologies. - Domain knowledge. -
Leadership/stakeholder expectations. - Repeated terminology. -
Experience and credential requirements. - Signals of product, strategy,
delivery, or technical ownership.

Show the sample size, source, date collected/provided, and coverage
limitations. If there are too few job descriptions, clearly label
findings as directional rather than market-wide.

For an MVP without a live job-data API, the user-provided job
descriptions are the primary source of market evidence. Do not fabricate
job-market percentages. A percentage such as "78% of jobs require GenAI"
may only be displayed when calculated from a disclosed, sufficiently
sized dataset.

### Stage 6 --- Positioning and career-fit analysis

Generate 2--3 positioning options, each containing: - Positioning
statement. - Target audience/recruiter. - Evidence supporting the
option. - Strengths. - Gaps/risks. - Target job families. - Suggested
LinkedIn headline direction. - What not to claim. - Confidence level and
reason.

Recommend one option, but allow the user to compare and choose. Explain
trade-offs. Do not force a career transition if the evidence is
insufficient.

### Stage 7 --- LinkedIn profile generation

Create drafts for: - Headline (multiple options with character
counts). - About section. - Experience bullets per role. - Featured
section recommendations. - Skills shortlist and ordering. - Projects
section. - Certifications and education presentation. - Banner concept
and visual brief. - Optional call-to-action/contact line.

For every generated claim, maintain an internal link to the supporting
Career Profile evidence. In the UI, mark claims as: - Supported by
evidence - Needs user confirmation - Missing evidence / excluded

Use natural language. Avoid keyword stuffing, cliché-heavy wording,
exaggerated seniority, and claims that imply a role or expertise the
user has not held.

### Stage 8 --- Personal-brand strategy

Produce: - Brand positioning statement. - Audience definition. - 3--4
content pillars. - Distinct point of view for each pillar. - 10 post
ideas tied to the user's evidence and target audience. - 30-day starter
content calendar. - Suggested post formats (text, carousel, case study,
short video). - A consistent tone guide. - Topics to avoid or treat
carefully. - A simple engagement routine. - A plan to turn real projects
and learning into credible content.

Do not encourage fake expertise, manufactured personal stories, fake
engagement, or automated spam.

### Stage 9 --- Final review and export

Show: - Executive summary. - Career Positioning Report. - Market
requirement comparison. - Skills/evidence gaps. - Recommended LinkedIn
profile. - Personal-brand strategy. - Priority action plan for the next
30 days. - Score definitions and caveats.

Allow export to Markdown and a clean print-friendly HTML report. PDF can
be added if straightforward, but is not mandatory for the first working
version. Allow the user to copy individual sections.

### Stage 10 --- Re-analysis

Let the user update profile information or add new target job
descriptions and compare versions. Show what changed in evidence,
alignment, positioning, and profile copy. Do not imply a score
improvement predicts hiring outcomes.

------------------------------------------------------------------------

## 8. Multi-agent architecture and responsibilities

### Orchestrator

**Purpose:** Manage the workflow, agent order, retries, state, and final
assembly.

Responsibilities: - Validate prerequisites for each step. - Call only
the agents required for the current stage. - Pass typed, minimal inputs
to each agent. - Store outputs and status. - Handle timeouts, malformed
JSON, quota errors, and partial failures. - Never let an agent silently
overwrite user-approved facts. - Present progress and errors to the
UI. - Request user confirmation when an important ambiguity blocks the
workflow.

The orchestrator is workflow logic, not a free-roaming agent. Prefer
deterministic state transitions for the MVP.

### Agent 1 --- Career Discovery Agent

**Mission:** Structure the user's raw career information without
inventing facts.

Input: Resume/profile text, user questionnaire, prior confirmed
answers.\
Output: Structured career history, goals, role preferences, skills,
domains, projects, achievements, unknowns, and questions requiring
clarification.

Must: - Preserve original facts. - Mark ambiguous statements. - Separate
user facts from interpretations. - Produce schema-valid JSON. - Avoid
writing final LinkedIn copy.

### Agent 2 --- Evidence Mining Agent

**Mission:** Turn vague experience into specific, defensible evidence.

Input: Structured career profile and ambiguous claims.\
Output: Evidence-backed achievement candidates, follow-up questions,
proof strength, measurable outcomes where supplied, and unsupported
claims.

Must: - Never invent numbers. - Ask targeted questions when impact is
unclear. - Distinguish activity, output, outcome, and impact. - Store
source text for every claim. - Avoid market benchmarking and final
positioning.

### Agent 3 --- Market Intelligence Agent

**Mission:** Analyze supplied job descriptions and build a transparent
target-role requirement profile.

Input: Target role, geography, user-supplied job descriptions and source
metadata.\
Output: Normalized role requirements, required/preferred skills,
responsibilities, repeated terms, seniority indicators, dataset size,
and limitations.

Must: - Calculate frequencies from the actual supplied dataset only. -
Include numerator and denominator for any frequency. - Never fabricate
job listings or percentages. - Distinguish job-description evidence from
general background knowledge. - Avoid judging the user's fit or writing
their profile.

### Agent 4 --- Skills & Gap Analyst Agent

**Mission:** Compare the user's evidenced capabilities against
target-role requirements.

Input: Career Profile, Market Intelligence output.\
Output: Requirement-by-requirement matrix with evidence, match
classification, gaps, confidence, and next action.

Match classifications: - Demonstrated - Partially demonstrated - Claimed
but unsupported - Not evidenced - Not applicable

Must not treat missing profile evidence as proof that the user lacks a
skill. Say "not evidenced in supplied material" when appropriate.

### Agent 5 --- Competitive Positioning Strategist Agent

**Mission:** Recommend a differentiated, credible professional position.

Input: Career Profile, evidence records, target-role requirements, gap
analysis.\
Output: 2--3 positioning options, target audiences, proof points,
differentiators, trade-offs, risk flags, and a recommended option.

Must: - Prefer intersections of proven experience, credible ambition,
and market demand. - Avoid claiming proprietary competitor analysis
unless actual, permitted competitor data is available. - Use "market
positioning hypotheses" rather than unsupported claims about what all
candidates do. - Explicitly identify where the target role may be a
stretch.

### Agent 6 --- LinkedIn Profile Architect Agent

**Mission:** Generate a coherent LinkedIn profile based on the selected
positioning.

Input: User-approved positioning, evidence records, target-role
analysis, current profile text.\
Output: Headline options, About, Experience bullets, Skills,
Featured/Projects recommendations, and profile improvement checklist.

Must: - Use only supported facts or clearly flagged drafts requiring
confirmation. - Keep copy consistent across sections. - Avoid keyword
stuffing and false credentials. - Explain the purpose of each major
edit. - Respect current LinkedIn section constraints when known; if
uncertain, do not claim exact platform limits.

### Agent 7 --- Personal Brand Strategist Agent

**Mission:** Turn the positioning into a credible public-facing content
strategy.

Input: Selected positioning, target audience, user experience/projects,
tone preferences.\
Output: Brand statement, content pillars, point of view, post ideas,
30-day calendar, tone guide, and practical engagement routine.

Must: - Ground content in the user's actual work, learning, and
opinions. - Label hypothetical examples as examples. - Avoid fabricating
first-person stories or claiming results the user did not achieve. -
Avoid spam tactics or engagement manipulation.

### Agent 8 --- Critic, Evidence & Quality Assurance Agent

**Mission:** Independently audit the proposed report and profile before
release.

Input: All prior outputs plus evidence ledger.\
Output: Pass/fail checks, unsupported claims, contradictions, generic
phrasing, keyword stuffing, inconsistent seniority, overconfident
claims, missing caveats, and required revisions.

Checks: - Every factual career claim has evidence or is marked for
confirmation. - No fabricated metrics, titles, employers,
certifications, or projects. - Market statistics have traceable data and
denominator. - Scores have defined formulas and limitations. -
Positioning aligns with the user's stated goal and actual evidence. -
LinkedIn sections tell one coherent story. - Brand calendar does not
overstate expertise. - Output conforms to schemas and length
requirements.

The QA agent may request one revision cycle from the relevant agent. If
critical issues remain, block publication and show the user the issue.

### Agent 9 --- Career Action Planner Agent (MVP if time permits; otherwise phase 1.1)

**Mission:** Convert the report into a realistic 30-day execution plan.

Input: Approved report, identified gaps, user's time availability and
constraints.\
Output: Prioritized weekly actions, deliverables, effort estimate,
dependencies, and completion criteria.

Must distinguish between: - Profile edits the user can make now. -
Evidence they can gather. - Skills they may need to develop. - Projects
they can credibly demonstrate. - Market assumptions that require
validation.

### Agent execution rules

-   Each agent must have a separate prompt/module and typed input/output
    schema.
-   Use structured JSON outputs where possible; validate before storing.
-   The orchestrator controls order and state transitions.
-   Do not run every agent on every user interaction; invoke only the
    relevant agent.
-   Persist agent outputs for debugging and reproducibility, subject to
    privacy settings.
-   Add a "How this insight was reached" disclosure showing data used
    and relevant evidence.
-   In the UI, describe agent responsibilities in user-friendly language
    rather than exposing hidden chain-of-thought or internal reasoning
    traces.
-   Log provider, model identifier, latency, token usage if available,
    status, and estimated cost; do not log secrets or unnecessary
    personal data.
-   Never expose API keys in the browser or client-side code.

------------------------------------------------------------------------

## 9. Scoring framework

Scores are diagnostic heuristics, not hiring probabilities. The MVP must
display definitions and evidence for each score. Do not present a single
score as scientifically validated.

Suggested initial components:

  ------------------------------------------------------------------------
  Component                         Suggested weight Definition
  --------------------- ---------------------------- ---------------------
  Profile completeness                           10% Presence and
                                                     usability of relevant
                                                     profile sections

  Target-role alignment                          25% Evidence-backed
                                                     alignment with
                                                     requirements from
                                                     supplied target job
                                                     descriptions

  Evidence strength                              20% Specificity and
                                                     defensibility of
                                                     achievements and
                                                     examples

  Search-term coverage                           15% Natural inclusion of
                                                     relevant terminology
                                                     from the supplied job
                                                     descriptions

  Career narrative                               15% Consistency between
  coherence                                          experience,
                                                     strengths, target
                                                     role, and profile
                                                     story

  Differentiation                                10% Clarity of a
                                                     credible,
                                                     evidence-backed
                                                     professional angle

  Personal-brand                                  5% Presence of a defined
  readiness                                          audience, point of
                                                     view, and content
                                                     themes
  ------------------------------------------------------------------------

### Score safeguards

-   Display "heuristic assessment" and a plain-language explanation.
-   Allow "insufficient data" instead of forcing a score.
-   Display the number of job descriptions analyzed.
-   Do not compare users against an invented population benchmark.
-   Do not claim that 80/100 means an 80% chance of interview.
-   Do not imply that keyword coverage alone predicts recruiter
    discovery.
-   Keep component scores and weights configurable and versioned.
-   Treat these weights as initial hypotheses to test with users, not
    scientific facts.

------------------------------------------------------------------------

## 10. Data sources and data integrity

### MVP sources

1.  User-uploaded resume/profile text.
2.  User-entered career information.
3.  User-provided job descriptions.
4.  User-provided target companies and roles.
5.  Optional permitted public information sources if a compliant
    retrieval method is configured.

### Future sources

-   Licensed job-market APIs.
-   Public labor-market datasets.
-   Licensed occupational skills taxonomies.
-   Salary datasets with clear source/date/coverage.
-   User-authorized profile import integrations.
-   Aggregate, consent-based product outcome data.

### Data integrity requirements

-   Store source, timestamp, and provenance for each market item.
-   Deduplicate job descriptions where possible.
-   Keep observed facts separate from model-generated interpretations.
-   Never claim to have analyzed "thousands of jobs" unless it actually
    has.
-   Do not scrape behind logins or bypass access controls.
-   Respect site terms, copyright, rate limits, and data protection
    requirements.
-   Use synthetic demo data only when labeled as synthetic.
-   Do not use one user's private career data to train or benchmark
    against other users without explicit, informed consent.

------------------------------------------------------------------------

## 11. Technology and implementation requirements

### Recommended MVP stack

Keep choices simple and replaceable. Claude should inspect the existing
repository before choosing or changing the stack.

Suggested default: - **Frontend:** Next.js + TypeScript + responsive
UI. - **Backend:** Next.js server routes or a separate Python FastAPI
service; choose one primary backend for MVP rather than duplicating
business logic. - **Agent orchestration:** Deterministic state
machine/workflow with individual agent modules. A lightweight framework
may be used if it materially helps; do not introduce a large framework
just for branding. - **LLM provider:** Google Gemini API or Groq API
through a provider adapter. - **Database:** SQLite for a local prototype
or Supabase/PostgreSQL for a hosted multi-user MVP. Make repository/data
access abstract enough to switch later. - **File storage:** Local
development storage initially; private object storage when deployed. -
**Document parsing:** Use established parsers for PDF/DOCX and validate
extracted text. Provide manual paste fallback. - **Validation:** Typed
schemas (e.g., Zod for TypeScript or Pydantic for Python). -
**Testing:** Unit tests for scoring, schema validation, evidence checks,
and orchestration; integration tests with mocked LLM providers. -
**Deployment:** Configurable, with environment-based secrets.

These are recommendations, not rigid requirements. If the repository
already has a viable stack, preserve it unless there is a clear reason
to change.

### Provider abstraction

Create a common interface such as: - `generateStructuredOutput()` -
`generateText()` - `checkHealth()` - `getModelMetadata()`

Implement provider adapters for Gemini and Groq. Allow a later OpenAI or
Anthropic adapter without modifying agent business logic.

Requirements: - Select provider/model via environment variables and/or
server-side settings. - Support per-agent model configuration. -
Validate JSON; retry once with a repair request where appropriate. -
Handle rate limits, timeouts, unavailable models, invalid API keys, and
quota exhaustion. - Never silently switch providers if that would
violate user settings or privacy expectations. - Show a clear error and
retry option when no provider is available. - Keep all secrets
server-side. - Provide a mock provider for deterministic local demos and
automated tests. - Record model/provider/version used for each run.

### Database abstraction

Use repository interfaces for users, career profiles, evidence claims,
job descriptions, analyses, generated profile versions, and agent runs.

Minimum entities: - `users` (or anonymous local sessions for a
single-user prototype) - `career_profiles` - `career_experiences` -
`skills` - `achievements` - `evidence_claims` - `target_roles` -
`job_descriptions` - `job_requirements` - `analysis_runs` -
`agent_runs` - `positioning_options` - `linkedin_profile_versions` -
`brand_strategies` - `content_calendar_items` - `user_feedback` -
`consent_and_preferences`

Include created/updated timestamps, ownership/user ID,
source/provenance, and version identifiers where relevant. Avoid storing
unnecessary raw documents indefinitely. Provide delete/export workflows.

### Optional vector search

Vector search is not required for the first local prototype. Add it only
if there is a clear use case, such as semantic retrieval over job
descriptions or a user's evidence records. Keep embeddings
provider-independent and ensure the product still works without a vector
database.

------------------------------------------------------------------------

## 12. User interface requirements

### Main screens

1.  **Landing / Welcome:** Value proposition, privacy note, and "Start
    my analysis."
2.  **Goal Setup:** Current position, target, geography, seniority, and
    desired outcome.
3.  **Career Import:** Resume upload, paste profile, structured entry,
    job-description upload.
4.  **Evidence Interview:** One question at a time, progress indicator,
    save-and-resume.
5.  **Analysis Workspace:** Agent stages and status, with meaningful
    progress---not fake animation.
6.  **Career Positioning Report:** Current vs target positioning,
    strengths, gaps, options, recommendation.
7.  **LinkedIn Builder:** Editable sections, alternate versions,
    evidence badges, copy buttons.
8.  **Personal Brand Studio:** Pillars, ideas, calendar, tone guide.
9.  **Action Plan:** Prioritized next steps and progress.
10. **Settings / Privacy:** Provider status, data export/delete,
    consent, and model disclosures.

### "Wow factor" UX features

-   **Career DNA Map:** A visual map of evidence-backed skills, domains,
    outcomes, and differentiators.
-   **Current vs Target Positioning:** A clear visual comparison of
    current story and target story.
-   **Evidence Traceability:** Click a generated sentence to see the
    user-provided evidence supporting it.
-   **Positioning Alternatives:** Compare three narratives side by side,
    including trade-offs and risk.
-   **Recruiter Lens:** Explain how the profile communicates role,
    domain, level, and relevant keywords. Label this as a simulation,
    not a real LinkedIn search ranking.
-   **Before/After Profile:** Side-by-side original and proposed copy
    with explanations.
-   **Claim Safety Check:** Flag unsupported metrics, vague claims, and
    overstated expertise.
-   **Market Signal Cards:** Show repeated requirements from the actual
    job descriptions supplied.
-   **One-click Copy/Markdown Export:** Make results immediately usable.
-   **Progressive disclosure:** Show an executive summary first; allow
    the user to expand technical details.
-   **Resume-to-Profile Consistency:** Flag contradictory dates, titles,
    or claims between supplied sources.
-   **Version Comparison:** Compare two profile drafts and explain
    meaningful differences.

Do not use fake real-time progress, fabricated benchmarks, or decorative
scores without traceable calculations.

------------------------------------------------------------------------

## 13. Functional requirements and acceptance criteria

### FR-01: Guided onboarding

-   User can select a goal and enter current/target roles.
-   User can skip optional fields.
-   State is saved and can be resumed.

### FR-02: Document/profile import

-   User can paste content and/or upload supported documents.
-   Parsing errors are visible and recoverable.
-   Extracted content is editable before analysis.
-   A URL alone does not imply successful LinkedIn extraction.

### FR-03: Evidence collection

-   The system identifies vague claims and asks follow-up questions.
-   Each claim has a status and source.
-   The system never creates unsupported numeric outcomes.

### FR-04: Job description analysis

-   User can submit multiple job descriptions.
-   System extracts normalized requirements.
-   Frequency statistics are calculated from the actual dataset.
-   The report discloses sample size and limitations.

### FR-05: Career positioning

-   System provides 2--3 options with supporting evidence and risks.
-   User can select/edit an option.
-   Recommendation is linked to target requirements and evidence.

### FR-06: LinkedIn draft

-   Generate all core LinkedIn sections.
-   Every factual claim is supported or flagged.
-   User can edit and copy each section.
-   The draft remains consistent with selected positioning.

### FR-07: Personal brand strategy

-   Generate 3--4 pillars, 10 ideas, and a 30-day calendar.
-   Ideas are grounded in the user's evidence and goals.
-   Calendar is editable.

### FR-08: Scoring

-   Scores are reproducible from disclosed component formulas.
-   Score definitions and caveats are visible.
-   Insufficient data is allowed.
-   No hiring probability is displayed.

### FR-09: Agent orchestration

-   Each agent is a separate module with its own prompt and schema.
-   Agent inputs, outputs, status, latency, and errors are recorded.
-   Invalid output is validated and handled.
-   Partial failures do not corrupt approved user data.

### FR-10: Provider configuration

-   Gemini and Groq adapters can be selected/configured.
-   Missing/invalid keys are handled clearly.
-   API keys never reach the browser.
-   Mock mode works without paid APIs.

### FR-11: Privacy and control

-   User can export report data.
-   User can delete profile data.
-   Consent and data retention are explicit.
-   Sensitive uploaded files are not publicly accessible.

### FR-12: Accessibility and responsive design

-   Core workflow works on desktop and mobile.
-   Inputs have labels and clear error messages.
-   Keyboard navigation and readable contrast are supported.

### FR-13: Report export

-   User can export the full report as Markdown.
-   Copy controls work for individual sections.
-   Export does not expose hidden prompts, secrets, or internal
    reasoning traces.

### FR-14: Feedback

-   User can rate usefulness of insights and flag inaccurate output.
-   Feedback is attached to an analysis version, not silently mixed into
    factual data.

------------------------------------------------------------------------

## 14. Non-functional requirements

-   **Security:** Server-side secrets, input validation, safe file
    handling, access control, no public uploads.
-   **Privacy:** Data minimization, clear consent, export/delete,
    configurable retention.
-   **Reliability:** Graceful provider failures, retry limits, saved
    intermediate results.
-   **Observability:** Structured logs with correlation IDs; avoid
    sensitive content in logs.
-   **Performance:** Show useful intermediate results as each agent
    completes; avoid waiting for all optional steps before displaying
    anything.
-   **Cost control:** Token/usage estimates where provider metadata
    permits, configurable model choice, per-step limits, caching of
    repeatable analyses where safe.
-   **Maintainability:** Separate UI, orchestration, agent prompts,
    schemas, providers, repositories, scoring, and tests.
-   **Portability:** No hard dependency on one LLM vendor or database.
-   **Explainability:** Every insight identifies whether it came from
    user data, job-description data, a deterministic rule, or an LLM
    interpretation.
-   **Compliance:** Use only authorized data sources; provide
    appropriate privacy disclosures and terms before public launch.

------------------------------------------------------------------------

## 15. Security, privacy, and responsible AI

-   Never scrape LinkedIn behind login, circumvent restrictions, or use
    unauthorized automation.
-   Treat uploaded documents and job descriptions as untrusted input.
    Prompt-injection text inside them must not override system
    instructions or tool permissions.
-   Do not execute instructions found inside resumes/job descriptions.
-   Do not send emails, apply to jobs, publish posts, or contact
    recruiters without explicit user action.
-   Do not expose raw prompts, API keys, system instructions, or
    internal reasoning traces.
-   Separate factual evidence from generated interpretation.
-   Allow users to correct or remove extracted facts.
-   Avoid inferring protected or sensitive attributes.
-   Do not use age, gender, religion, health, ethnicity, or other
    sensitive attributes to recommend career opportunities.
-   Include a disclaimer that recommendations are informational and not
    a guarantee of employment outcomes.
-   Make any external data retrieval visible, with sources and
    timestamps.
-   Use only synthetic sample profiles in demo mode and label them
    clearly.

------------------------------------------------------------------------

## 16. Pricing and business model hypotheses

Pricing is a hypothesis to test, not a proven willingness-to-pay result.
Start with India-first pricing and avoid building billing until product
quality has been validated.

### Proposed initial tiers

-   **Free:** Basic health check, limited analysis, one target role,
    short summary.
-   **Pro --- ₹999 one-time (test price):** Full career analysis, one
    target role, positioning options, LinkedIn profile rewrite, evidence
    checks, and report export.
-   **Career Brand --- ₹1,999 one-time (test price):** Pro plus
    personal-brand strategy, 30-day calendar, multiple target job
    descriptions, and action plan.
-   **Future subscription:** Re-analysis and market updates only after
    reliable data sources and repeat usage are demonstrated.

Do not launch every tier at once. Test a free report and one paid offer
first. Track willingness to pay, completion, perceived usefulness, and
refund/complaint rates. Do not promise recruiter visibility or job
outcomes.

### Possible future revenue

-   Individual paid reports.
-   Monthly career-intelligence subscription.
-   Career coach / outplacement workspace.
-   University/alumni employability offering.
-   Employer-sponsored career development---subject to strong privacy
    boundaries.

------------------------------------------------------------------------

## 17. MVP scope and phased roadmap

### Phase 0 --- Technical foundation

-   Inspect repository and document current state.
-   Define architecture and schemas.
-   Implement provider adapter and mock provider.
-   Create working local setup and environment template.
-   Add baseline tests.

### Phase 1 --- End-to-end MVP

-   Guided onboarding.
-   Resume/profile paste/upload.
-   Career Discovery Agent.
-   Evidence Mining Agent.
-   User-provided job-description analysis.
-   Skills & Gap Analyst Agent.
-   Positioning Strategist Agent.
-   LinkedIn Profile Architect Agent.
-   Critic/QA Agent.
-   Editable report and Markdown export.
-   Provider configuration for Gemini/Groq.
-   Local database and persistence.

### Phase 2 --- Wow-factor experience

-   Career DNA Map.
-   Current vs target positioning visualization.
-   Evidence traceability.
-   Before/after profile comparison.
-   Personal Brand Strategist Agent and 30-day calendar.
-   Career Action Planner.
-   Version comparison and feedback.

### Phase 3 --- Validation and production readiness

-   Usability testing with 10--20 target users.
-   Review outputs manually for accuracy and usefulness.
-   Improve schemas, prompts, and scoring based on observed failures.
-   Add auth, hosted PostgreSQL/Supabase, secure storage, and deployment
    hardening if needed.
-   Add payment only after value is validated.

### Phase 4 --- Premium data and models

-   Optional OpenAI and Anthropic adapters.
-   Licensed/public job-market data integrations.
-   More robust benchmarking only when sufficient valid data exists.
-   Consent-based outcome tracking and statistical validation.
-   Subscription and career-coach features.

------------------------------------------------------------------------

## 18. Success metrics

### Product quality

-   Percentage of factual claims accepted without correction.
-   Unsupported-claim rate.
-   Percentage of users who complete the workflow.
-   Percentage of generated sections rated useful.
-   Number of critical QA failures per report.
-   Time to first useful insight.

### User value

-   Percentage of users who edit or copy at least one generated section.
-   Percentage who report clearer career positioning.
-   Percentage who complete at least one recommended action.
-   Repeat analysis rate.
-   Willingness to pay and paid conversion.

### Business

-   Cost per completed analysis.
-   Provider failure rate.
-   Conversion from free to paid.
-   Refund/complaint rate.
-   Acquisition cost when marketing begins.

### Guardrails

-   Zero intentionally fabricated metrics/credentials in test cases.
-   Zero API keys exposed client-side.
-   Zero market percentages without traceable data.
-   No score described as probability of employment.
-   User data deletion succeeds in tests.

Do not set arbitrary success targets without a baseline. Establish
baseline values in pilot testing, then set targets.

------------------------------------------------------------------------

## 19. Key risks and mitigations

  -----------------------------------------------------------------------
  Risk                    Impact                  Mitigation
  ----------------------- ----------------------- -----------------------
  Generic output          Users see little        Structured discovery,
                          advantage over ChatGPT  real job-description
                                                  evidence, evidence
                                                  ledger, QA agent

  Unsupported claims      Trust/reputation damage Claim provenance,
                                                  confirmation status,
                                                  critic agent, tests

  Weak job-market data    Misleading market       User-supplied JDs
                          insights                first, sample-size
                                                  disclosure, no invented
                                                  statistics

  Free API quotas         Interrupted workflows   Provider abstraction,
                                                  mock mode, clear quota
                                                  errors, resumable state

  Multi-agent complexity  High cost and slow      Deterministic
                          responses               orchestration, only
                                                  invoke needed agents,
                                                  strict output schemas

  LinkedIn access         Import failure/legal    Paste/upload fallback;
  restrictions            risk                    no unauthorized
                                                  scraping

  Commoditized            Poor differentiation    Focus on positioning,
  competitors                                     evidence,
                                                  explainability, brand
                                                  execution, workflow
                                                  convenience

  Users expect job        Complaints and refunds  Clear product claims
  guarantees                                      and score caveats

  Sensitive career data   Serious trust risk      Data minimization,
  exposure                                        secure storage,
                                                  delete/export, access
                                                  control

  Fake precision in       Misleading decisions    Transparent formulas,
  scoring                                         no invented benchmarks,
                                                  label heuristic scores
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 20. Required demo scenario

Build a complete demonstration using a clearly labeled synthetic
professional profile.

Example: - Current role: Business Analyst. - Experience: several years
in business reporting and process improvement. - Target: AI Product
Manager or AI-enabled Business Analyst. - Inputs: synthetic resume plus
5 synthetic job descriptions clearly marked as demo data. - Show the
complete pipeline: 1. Career discovery. 2. Evidence extraction and
follow-up questions. 3. Market requirement extraction. 4. Gap matrix. 5.
Two or three positioning options. 6. Selected positioning. 7. LinkedIn
profile draft with evidence links. 8. QA flags and corrections. 9.
Personal-brand pillars and 30-day calendar. 10. Exportable report.

Synthetic data must never be presented as live market research or actual
customer data.

------------------------------------------------------------------------

## 21. Open decisions / assumptions

The build agent should make reasonable reversible choices and document
them, rather than block the build for nonessential decisions.

Assumptions for the first implementation: - Product is a responsive web
app. - India-first pricing and messaging. - User-provided job
descriptions are the main market data source. - Google Gemini or Groq is
used initially; both must be configurable if feasible. - No automatic
LinkedIn scraping or publishing. - One user can complete a full workflow
locally without payment. - The initial product name is provisional. -
The first milestone is a working, testable end-to-end MVP, not a
production SaaS.

------------------------------------------------------------------------
