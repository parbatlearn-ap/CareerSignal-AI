/**
 * Mock provider: no network, no API key. It runs each agent's deterministic
 * rule-based implementation over the agent's real input, so demo mode works
 * end-to-end on the user's own text and is fully reproducible in tests.
 * Output is clearly labelled "Demo mode (rule-based)" in the UI.
 */
import type { AgentId } from "../schemas/common";
import { ProviderError, type HealthStatus, type LLMProvider, type ModelMetadata, type TextRequest, type TextResponse } from "./types";

type Handler = (input: unknown) => unknown;
const handlers = new Map<AgentId, Handler>();

export function registerMockHandler(agentId: AgentId, h: Handler) {
  handlers.set(agentId, h);
}

export class MockProvider implements LLMProvider {
  readonly id = "mock" as const;

  /** Test hook: force failures to exercise error handling. */
  constructor(private behaviour: { failWith?: ProviderError; malformedFor?: AgentId[]; malformedOnce?: boolean } = {}) {}
  private malformedServed = new Set<AgentId>();

  modelFor(): string {
    return "rule-based-v1";
  }

  getModelMetadata(): ModelMetadata {
    return { provider: "mock", model: "rule-based-v1", label: "Demo mode (rule-based, no AI provider)", isMock: true };
  }

  async generateText(req: TextRequest): Promise<TextResponse> {
    if (this.behaviour.failWith) throw this.behaviour.failWith;
    if (this.behaviour.malformedFor?.includes(req.agentId)) {
      if (!this.behaviour.malformedOnce || !this.malformedServed.has(req.agentId)) {
        this.malformedServed.add(req.agentId);
        return { text: "```json\n{ \"not\": \"the expected schema\" ", usage: null, model: "rule-based-v1" };
      }
    }
    const h = handlers.get(req.agentId);
    if (!h) throw new ProviderError("PROVIDER_ERROR", `No mock handler registered for ${req.agentId}`);
    return { text: JSON.stringify(h(req.input)), usage: null, model: "rule-based-v1" };
  }

  async checkHealth(): Promise<HealthStatus> {
    return {
      ok: true,
      provider: "mock",
      model: "rule-based-v1",
      configured: true,
      message: "Demo mode: deterministic rule-based agents. No data leaves this server.",
      checkedAt: new Date().toISOString(),
    };
  }
}
