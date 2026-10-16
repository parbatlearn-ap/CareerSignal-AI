/**
 * Configurable skills taxonomy used by deterministic extraction (mock mode)
 * and by term normalisation for frequency counts in every mode.
 * Extend freely; it is a starting list for the initial launch segment
 * (business analysis, data/AI, product, automation).
 */
import { containsTerm } from "./text";

export type TermKind = "tool" | "method" | "domain" | "soft" | "leadership" | "credential";

export interface TaxonomyTerm {
  canonical: string;
  kind: TermKind;
  aliases: string[];
}

const T = (canonical: string, kind: TermKind, aliases: string[] = []): TaxonomyTerm => ({
  canonical,
  kind,
  aliases,
});

export const TAXONOMY: TaxonomyTerm[] = [
  // Tools / technology
  T("SQL", "tool", ["mysql", "postgresql", "t-sql", "sql server"]),
  T("Python", "tool", ["pandas"]),
  T("Excel", "tool", ["advanced excel", "ms excel", "microsoft excel", "spreadsheets"]),
  T("Power BI", "tool", ["powerbi", "power-bi"]),
  T("Tableau", "tool"),
  T("Jira", "tool"),
  T("Confluence", "tool"),
  T("Power Automate", "tool", ["microsoft power automate"]),
  T("UiPath", "tool", ["ui path"]),
  T("Figma", "tool"),
  T("Looker", "tool"),
  T("Snowflake", "tool"),
  T("Salesforce", "tool"),
  T("SAP", "tool"),
  T("APIs", "tool", ["api", "rest api", "rest apis"]),
  T("Large Language Models", "tool", ["llm", "llms", "large language model"]),
  T("Generative AI", "domain", ["genai", "gen ai", "generative-ai"]),
  T("Machine Learning", "domain", ["ml", "machine-learning"]),
  T("Prompt Engineering", "method", ["prompt design", "prompting"]),
  T("RAG", "method", ["retrieval augmented generation", "retrieval-augmented generation"]),
  T("Cloud Platforms", "tool", ["aws", "azure", "gcp", "google cloud"]),
  // Methods
  T("Requirements Gathering", "method", ["requirements elicitation", "requirement gathering", "business requirements", "brd"]),
  T("User Stories", "method", ["user story", "acceptance criteria"]),
  T("Process Improvement", "method", ["process optimization", "process optimisation", "process re-engineering", "lean"]),
  T("Process Mapping", "method", ["bpmn", "process maps", "as-is", "to-be"]),
  T("Data Analysis", "method", ["data analytics", "analytics", "analysed data", "analyzed data"]),
  T("Data Visualization", "method", ["data visualisation", "dashboards", "dashboard", "dashboarding"]),
  T("Reporting", "method", ["business reporting", "mis reporting", "mis reports", "reports"]),
  T("A/B Testing", "method", ["ab testing", "experimentation", "experiments"]),
  T("Product Roadmap", "method", ["roadmap", "roadmaps", "roadmapping"]),
  T("Product Discovery", "method", ["discovery", "customer discovery", "user research"]),
  T("Agile", "method", ["scrum", "kanban", "sprint"]),
  T("Automation", "method", ["automated", "automate", "workflow automation"]),
  T("Metrics & KPIs", "method", ["kpi", "kpis", "metrics", "okrs", "success metrics"]),
  T("Prioritization", "method", ["prioritisation", "prioritize", "prioritise", "backlog"]),
  T("Data Quality", "method", ["data governance", "data validation"]),
  T("Responsible AI", "domain", ["ai ethics", "ai governance", "ai risk"]),
  T("AI Product Management", "domain", ["ai product", "ai products", "ai-powered products", "ai features"]),
  // Domains
  T("Banking & Financial Services", "domain", ["banking", "bfsi", "financial services", "fintech", "lending"]),
  T("Insurance", "domain"),
  T("Healthcare", "domain"),
  T("Retail & E-commerce", "domain", ["retail", "e-commerce", "ecommerce"]),
  T("Supply Chain", "domain", ["logistics", "procurement"]),
  T("Telecom", "domain", ["telecommunications"]),
  T("SaaS", "domain", ["b2b saas"]),
  T("Customer Operations", "domain", ["customer support", "contact centre", "contact center", "customer service"]),
  T("Compliance", "domain", ["regulatory", "audit", "kyc", "aml"]),
  // Soft / leadership
  T("Stakeholder Management", "leadership", ["stakeholder", "stakeholders", "cross-functional", "cross functional"]),
  T("Communication", "soft", ["presentations", "storytelling", "presented"]),
  T("Team Leadership", "leadership", ["led a team", "managed a team", "mentored", "mentoring", "people management"]),
  T("Problem Solving", "soft", ["problem-solving", "root cause"]),
  T("Strategic Thinking", "leadership", ["strategy", "strategic"]),
  T("Vendor Management", "leadership", ["vendors", "vendor"]),
  // Credentials
  T("CBAP", "credential"),
  T("PMP", "credential"),
  T("CSPO", "credential"),
  T("CSM", "credential", ["certified scrummaster", "certified scrum master"]),
  T("MBA", "credential"),
];

/** Return canonical taxonomy terms present in a text. */
export function findTerms(text: string, kinds?: TermKind[]): TaxonomyTerm[] {
  return TAXONOMY.filter(
    (t) =>
      (!kinds || kinds.includes(t.kind)) &&
      [t.canonical, ...t.aliases].some((a) => containsTerm(text, a)),
  );
}

/** Map an arbitrary term (e.g. from an LLM) to a canonical taxonomy term if one matches. */
export function canonicalize(term: string): string {
  const hit = TAXONOMY.find((t) =>
    [t.canonical, ...t.aliases].some((a) => a.toLowerCase() === term.trim().toLowerCase()),
  );
  return hit ? hit.canonical : term.trim();
}

export function aliasesFor(term: string): string[] {
  const c = canonicalize(term);
  const hit = TAXONOMY.find((t) => t.canonical === c);
  return hit ? [hit.canonical, ...hit.aliases] : [term];
}

/** True when the term, or one of its known aliases, literally appears in the text. */
export function termGrounded(text: string, term: string): boolean {
  return aliasesFor(term).some((a) => containsTerm(text, a));
}

export function kindOf(term: string): TermKind | null {
  const c = canonicalize(term);
  return TAXONOMY.find((t) => t.canonical === c)?.kind ?? null;
}
