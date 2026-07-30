/**
 * Route-side TypeScript module that supports SvelteKit page and endpoint behavior.
 */

import type { RequestHandler } from './$types';
import { convertToModelMessages, streamText, tool, type UIMessage } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { EZNGFW_DOCS_CONTEXT } from './docs-context';

const WRITE_TOOLS = new Set([
  'create_firewall_rule',
  'update_firewall_rule',
  'delete_firewall_rule',
  'update_dhcp_settings',
  'update_dns_settings',
  'update_interface',
  'create_vpn_peer',
  'update_routing'
]);

type ProviderKey = 'anthropic' | 'openai' | 'ollama';
type AssistantMode = 'show-me' | 'do-it';

type ChatRequestBody = {
  messages: unknown[];
  mode?: AssistantMode;
  allowWrite?: boolean;
  testConnection?: boolean;
  settings?: {
    provider?: ProviderKey;
    apiKey?: string;
    model?: string;
    openaiBaseUrl?: string;
    ollamaBaseUrl?: string;
    mcpUrl?: string;
  };
};

function resolveModel(settings?: ChatRequestBody['settings']) {
  const provider = settings?.provider ?? (process.env.EZNGFW_AI_PROVIDER as ProviderKey | undefined) ?? 'openai';

  if (provider === 'anthropic') {
    const apiKey = settings?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Missing Anthropic API key');
    const anthropic = createAnthropic({ apiKey });
    return {
      provider,
      model: anthropic(settings?.model ?? process.env.EZNGFW_AI_MODEL ?? 'claude-3-5-sonnet-latest')
    };
  }

  if (provider === 'ollama') {
    const baseURL = settings?.ollamaBaseUrl ?? process.env.EZNGFW_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1';
    const openai = createOpenAI({
      baseURL,
      apiKey: settings?.apiKey ?? process.env.OPENAI_API_KEY ?? 'ollama'
    });
    return {
      provider,
      model: openai.chat(settings?.model ?? process.env.EZNGFW_AI_MODEL ?? 'llama3.1')
    };
  }

  const apiKey = settings?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OpenAI API key');
  const openai = createOpenAI({
    apiKey,
    baseURL: settings?.openaiBaseUrl ?? process.env.OPENAI_BASE_URL
  });

  return {
    provider: 'openai' as const,
    model: openai.chat(settings?.model ?? process.env.EZNGFW_AI_MODEL ?? 'gpt-4.1-mini')
  };
}

async function callMcpTool(mcpUrl: string, name: string, args: Record<string, unknown>) {
  const response = await fetch(`${mcpUrl.replace(/\/$/, '')}/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, args })
  });

  if (!response.ok) {
    throw new Error(`MCP tool failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { ok: boolean; result?: unknown; error?: string };
  if (!payload.ok) {
    throw new Error(payload.error ?? 'MCP tool execution failed');
  }
  return payload.result;
}

function createEzngfwSystemPrompt(mode: AssistantMode) {
  const behavior = mode === 'do-it'
    ? 'You are in DO-IT mode. Execute read/write tool calls when useful, but explain each action briefly and clearly.'
    : 'You are in SHOW-ME mode. Do not perform write operations. Explain exact GUI/API steps and use read tools for context only.';

  return [
    'You are ezNGFW AI Assistant — an expert on the ezNGFW enterprise next-generation firewall.',
    'You have comprehensive knowledge of every feature, configuration option, GUI page, API endpoint, and CLI command.',
    'Always prioritize safe, auditable networking changes and call out blast radius for risky operations.',
    behavior,
    'When using write operations, summarize what changed and suggest a quick verification checklist.',
    'If a request is ambiguous, ask one concise follow-up question before risky changes.',
    '',
    '## Your Knowledge Base',
    EZNGFW_DOCS_CONTEXT,
    '',
    'Use the above documentation to give accurate, specific answers. Reference exact GUI paths (e.g., "Navigate to Network > DHCP > Server Settings"), API endpoints, and CLI commands. When explaining configuration steps, be precise about field names, toggle switches, and button labels visible in the GUI.'
  ].join('\n');
}

function createEzngfwTools(mcpUrl: string, mode: AssistantMode, allowWrite: boolean) {
  const execute = async (name: string, input: Record<string, unknown>) => {
    if (WRITE_TOOLS.has(name) && (mode !== 'do-it' || !allowWrite)) {
      return {
        blocked: true,
        message: 'Write operation blocked. Enable Do it for me mode and confirm execution to apply config changes.'
      };
    }
    return callMcpTool(mcpUrl, name, input);
  };

  return {
    get_firewall_rules: tool({
      description: 'Read firewall rules',
      inputSchema: z.object({}),
      execute: (input) => execute('get_firewall_rules', input)
    }),
    get_dhcp_settings: tool({
      description: 'Read DHCP settings',
      inputSchema: z.object({}),
      execute: (input) => execute('get_dhcp_settings', input)
    }),
    get_dns_settings: tool({
      description: 'Read DNS settings',
      inputSchema: z.object({}),
      execute: (input) => execute('get_dns_settings', input)
    }),
    get_interfaces: tool({
      description: 'Read interfaces configuration/status',
      inputSchema: z.object({}),
      execute: (input) => execute('get_interfaces', input)
    }),
    get_vpn_config: tool({
      description: 'Read VPN configuration',
      inputSchema: z.object({ type: z.enum(['wireguard', 'openvpn', 'tailscale']).optional() }),
      execute: (input) => execute('get_vpn_config', input)
    }),
    get_routing_table: tool({
      description: 'Read routing table',
      inputSchema: z.object({}),
      execute: (input) => execute('get_routing_table', input)
    }),
    get_system_status: tool({
      description: 'Read system status',
      inputSchema: z.object({}),
      execute: (input) => execute('get_system_status', input)
    }),
    get_network_status: tool({
      description: 'Read network status',
      inputSchema: z.object({}),
      execute: (input) => execute('get_network_status', input)
    }),
    create_firewall_rule: tool({
      description: 'Create firewall rule',
      inputSchema: z.object({ rule: z.record(z.string(), z.unknown()) }),
      execute: (input) => execute('create_firewall_rule', input)
    }),
    update_firewall_rule: tool({
      description: 'Update firewall rule',
      inputSchema: z.object({ id: z.string(), rule: z.record(z.string(), z.unknown()) }),
      execute: (input) => execute('update_firewall_rule', input)
    }),
    delete_firewall_rule: tool({
      description: 'Delete firewall rule',
      inputSchema: z.object({ id: z.string() }),
      execute: (input) => execute('delete_firewall_rule', input)
    }),
    update_dhcp_settings: tool({
      description: 'Update DHCP settings',
      inputSchema: z.object({ settings: z.record(z.string(), z.unknown()) }),
      execute: (input) => execute('update_dhcp_settings', input)
    }),
    update_dns_settings: tool({
      description: 'Update DNS settings',
      inputSchema: z.object({ settings: z.record(z.string(), z.unknown()) }),
      execute: (input) => execute('update_dns_settings', input)
    }),
    update_interface: tool({
      description: 'Update interface settings',
      inputSchema: z.object({ id: z.string(), settings: z.record(z.string(), z.unknown()) }),
      execute: (input) => execute('update_interface', input)
    }),
    create_vpn_peer: tool({
      description: 'Create VPN peer',
      inputSchema: z.object({
        type: z.enum(['wireguard', 'openvpn']).default('wireguard'),
        peer: z.record(z.string(), z.unknown())
      }),
      execute: (input) => execute('create_vpn_peer', input)
    }),
    update_routing: tool({
      description: 'Update routing settings',
      inputSchema: z.object({ settings: z.record(z.string(), z.unknown()) }),
      execute: (input) => execute('update_routing', input)
    })
  };
}

/** Shared constant exported as POST for reuse across modules. */
export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as ChatRequestBody;
  const mode = body.mode ?? 'show-me';
  const allowWrite = Boolean(body.allowWrite);
  const mcpUrl = body.settings?.mcpUrl ?? process.env.EZNGFW_MCP_URL ?? 'http://127.0.0.1:8788';

  try {
    const { model } = resolveModel(body.settings);

    if (body.testConnection) {
      const test = streamText({
        model,
        system: 'You are a terse connectivity test assistant. Reply only with: Connection successful.',
        prompt: 'Ping',
        maxOutputTokens: 24
      });
      return test.toUIMessageStreamResponse();
    }

    const uiMessages: Array<Omit<UIMessage, 'id'>> = Array.isArray(body.messages)
      ? (body.messages as Array<Omit<UIMessage, 'id'>>)
      : [];
    const modelMessages = await convertToModelMessages(uiMessages);

    const result = streamText({
      model,
      system: createEzngfwSystemPrompt(mode),
      messages: modelMessages,
      tools: createEzngfwTools(mcpUrl, mode, allowWrite)
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Chat request failed'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
