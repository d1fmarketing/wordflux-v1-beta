import { AgentControllerV2 } from '@/lib/agent-controller-v2'
import { FunctionAgent } from '@/lib/agent/function-agent'

const cache = (globalThis as any).__WF_AGENT_CACHE__ || ((globalThis as any).__WF_AGENT_CACHE__ = {
  functionAgent: null as FunctionAgent | null,
  legacyAgent: null as AgentControllerV2 | null
})

export const USE_FUNCTION_AGENT = process.env.USE_FUNCTION_AGENT !== 'false'

export async function getAgent() {
  if (USE_FUNCTION_AGENT) {
    if (!cache.functionAgent) {
      const instance = new FunctionAgent()
      await instance.initialize()
      cache.functionAgent = instance
    }
    return cache.functionAgent as FunctionAgent
  }
  if (!cache.legacyAgent) {
    const instance = new AgentControllerV2()
    await instance.initialize()
    cache.legacyAgent = instance
  }
  return cache.legacyAgent as AgentControllerV2
}
