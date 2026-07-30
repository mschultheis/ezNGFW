<!-- Route view for `/system/ai` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import BotIcon from '@lucide/svelte/icons/bot';
  import PlugZapIcon from '@lucide/svelte/icons/plug-zap';
  import TestTubeDiagonalIcon from '@lucide/svelte/icons/test-tube-diagonal';
  import SaveIcon from '@lucide/svelte/icons/save';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { _ } from '$lib/i18n';

  type Provider = 'anthropic' | 'openai' | 'ollama';

  type AiSettings = {
    enabled: boolean;
    provider: Provider;
    apiKey: string;
    model: string;
    openaiBaseUrl: string;
    ollamaBaseUrl: string;
    mcpUrl: string;
  };

  const STORAGE_KEY = 'ezngfw_ai_settings';

  const defaults: AiSettings = {
    enabled: true,
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4.1-mini',
    openaiBaseUrl: '',
    ollamaBaseUrl: 'http://127.0.0.1:11434/v1',
    mcpUrl: 'http://127.0.0.1:8788'
  };

  const modelOptions: Record<Provider, Array<{ label: string; value: string }>> = {
    anthropic: [
      { label: 'Claude 4 Sonnet', value: 'claude-sonnet-4-20250514' },
      { label: 'Claude 4 Opus', value: 'claude-opus-4-20250514' },
      { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-latest' },
      { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-latest' }
    ],
    openai: [
      { label: 'GPT-4.1', value: 'gpt-4.1' },
      { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
      { label: 'GPT-4.1 Nano', value: 'gpt-4.1-nano' },
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
      { label: 'o3', value: 'o3' },
      { label: 'o4 Mini', value: 'o4-mini' }
    ],
    ollama: [
      { label: 'Llama 3.3', value: 'llama3.3' },
      { label: 'Llama 3.1', value: 'llama3.1' },
      { label: 'Qwen 3', value: 'qwen3' },
      { label: 'Qwen 2.5', value: 'qwen2.5' },
      { label: 'Gemma 3', value: 'gemma3' },
      { label: 'Mistral', value: 'mistral' },
      { label: 'DeepSeek R1', value: 'deepseek-r1' }
    ]
  };

  let loading = $state(true);
  let saving = $state(false);
  let testing = $state(false);
  let settings = $state<AiSettings>({ ...defaults });

  function normalizeModelForProvider(provider: Provider) {
    const options = modelOptions[provider];
    if (!options.some((option) => option.value === settings.model)) {
      settings.model = options[0]?.value ?? defaults.model;
    }
  }

  async function loadSettings() {
    loading = true;
    try {
      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (localRaw) {
        settings = { ...defaults, ...JSON.parse(localRaw) };
      }

      const systemConfig = await api
        .get<Record<string, unknown>>('/system/config')
        .catch(() => ({} as Record<string, unknown>));
      const aiFromConfig = (systemConfig['ai_assistant'] ?? systemConfig['aiAssistant']) as
        | Record<string, unknown>
        | undefined;
      if (aiFromConfig && typeof aiFromConfig === 'object') {
        settings = {
          ...settings,
          enabled: Boolean(aiFromConfig.enabled ?? settings.enabled),
          provider: (aiFromConfig.provider as Provider | undefined) ?? settings.provider,
          apiKey: String(aiFromConfig.apiKey ?? settings.apiKey),
          model: String(aiFromConfig.model ?? settings.model),
          openaiBaseUrl: String(aiFromConfig.openaiBaseUrl ?? settings.openaiBaseUrl),
          ollamaBaseUrl: String(aiFromConfig.ollamaBaseUrl ?? settings.ollamaBaseUrl),
          mcpUrl: String(aiFromConfig.mcpUrl ?? settings.mcpUrl)
        };
      }
      normalizeModelForProvider(settings.provider);
    } catch {
      settings = { ...defaults };
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      await api.patch('/system/config', {
        ai_assistant: {
          enabled: settings.enabled,
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          openaiBaseUrl: settings.openaiBaseUrl,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          mcpUrl: settings.mcpUrl
        }
      }).catch(() => undefined);

      toasts.success($_('system_ai.toastai_assistant_settings_saved'));
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      saving = false;
    }
  }

  async function testConnection() {
    testing = true;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testConnection: true,
          mode: 'show-me',
          settings,
          messages: [{ id: 'test-message', role: 'user', parts: [{ type: 'text', text: 'Connection test' }] }]
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Connection test failed' }));
        throw new Error(payload.error ?? 'Connection test failed');
      }
      // Consume the stream to ensure it completes, then show success
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
      toasts.success($_('system_ai.toastai_provider_connection_test_succeeded'));
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Connection test failed');
    } finally {
      testing = false;
    }
  }

  onMount(() => {
    void loadSettings();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-slate-100"><BotIcon class="size-4" /> AI Assistant</CardTitle>
      <CardDescription class="text-slate-400">
        Configure LLM provider access and MCP bridge settings for the ezNGFW assistant.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('system_ai.loading_settings')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 rounded-md border border-slate-800 bg-slate-950 p-3 md:col-span-2">
            <span class="text-sm font-medium text-slate-200">{$_('system_ai.enable_ai_assistant')}</span>
            <div class="flex items-center justify-between">
              <p class="text-xs text-slate-400">{$_('system_ai.toggle_global_assistant_visibility_in_admin_layout')}</p>
              <Switch checked={settings.enabled} onCheckedChange={(value) => (settings.enabled = value)} />
            </div>
          </label>

          <label class="space-y-2 text-sm">
            <FieldLabel label="LLM Provider" hint="Choose between cloud-based OpenAI, Anthropic, or self-hosted Ollama for AI chat." />
            <Select.Root
              type="single"
              value={settings.provider}
              onValueChange={(value) => {
                if (!value) return;
                settings.provider = value as Provider;
                normalizeModelForProvider(settings.provider);
              }}
            >
              <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{({ anthropic: "Anthropic", openai: "OpenAI", ollama: "Local / Ollama" })[settings.provider] ?? settings.provider}</span></Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                <Select.Item value="anthropic" label="Anthropic" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                <Select.Item value="openai" label="OpenAI" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                <Select.Item value="ollama" label="Local / Ollama" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-2 text-sm">
            <FieldLabel label="Model" hint="Specific model identifier to use for chat completions and reasoning." />
            <Select.Root type="single" value={settings.model} onValueChange={(value) => value && (settings.model = value)}>
              <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{modelOptions[settings.provider]?.find(o => o.value === settings.model)?.label ?? settings.model}</span></Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each modelOptions[settings.provider] as option}
                  <Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-2 text-sm md:col-span-2">
            <FieldLabel label="API Key" hint="Authentication token for the selected LLM provider. Required for cloud providers like OpenAI and Anthropic." />
            <Input
              type="password"
              class="border-slate-700 bg-slate-950 text-slate-100"
              bind:value={settings.apiKey}
              placeholder={settings.provider === 'ollama' ? 'Optional for local deployments' : 'Enter provider API key'}
            />
          </label>

          {#if settings.provider === 'openai'}
            <label class="space-y-2 text-sm md:col-span-2">
              <FieldLabel label="OpenAI Base URL (optional)" hint="Custom endpoint for OpenAI-compatible APIs. Leave blank to use the default official API." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" bind:value={settings.openaiBaseUrl} placeholder="https://api.openai.com/v1" />
            </label>
          {/if}

          {#if settings.provider === 'ollama'}
            <label class="space-y-2 text-sm md:col-span-2">
              <FieldLabel label="Ollama Base URL" hint="The local or remote endpoint where your Ollama instance is running." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" bind:value={settings.ollamaBaseUrl} placeholder="http://127.0.0.1:11434/v1" />
            </label>
          {/if}

          <label class="space-y-2 text-sm md:col-span-2">
            <FieldLabel label="MCP Server URL" hint="Connection string for the Model Context Protocol server that provides tool access to the assistant." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" bind:value={settings.mcpUrl} placeholder="http://127.0.0.1:8788" />
          </label>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <Button class="cursor-pointer bg-cyan-500 text-white hover:bg-cyan-600" onclick={saveSettings} disabled={saving}>
            <SaveIcon class="mr-2 size-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            variant="outline"
            class="cursor-pointer border-slate-700 text-slate-100 hover:bg-slate-800"
            onclick={testConnection}
            disabled={testing}
          >
            <TestTubeDiagonalIcon class="mr-2 size-4" />
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
