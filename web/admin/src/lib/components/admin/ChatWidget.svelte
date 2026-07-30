<!-- Docked AI assistant panel for ask-and-execute admin workflows in the ezNGFW GUI. -->

<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import { marked } from 'marked';
  import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
  import BotIcon from '@lucide/svelte/icons/bot';
  import SendIcon from '@lucide/svelte/icons/send';
  import XIcon from '@lucide/svelte/icons/x';
  import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';

  type Mode = 'show-me' | 'do-it';
  type Provider = 'anthropic' | 'openai' | 'ollama';

  type AssistantSettings = {
    enabled: boolean;
    provider: Provider;
    apiKey: string;
    model: string;
    openaiBaseUrl: string;
    ollamaBaseUrl: string;
    mcpUrl: string;
  };

  const STORAGE_KEY = 'ezngfw_ai_chat_session';
  const SETTINGS_KEY = 'ezngfw_ai_settings';
  const HINT_DISMISSED_KEY = 'ezngfw_ai_hint_dismissed';

  let open = $state(false);
  let minimized = $state(false);
  let showHint = $state(false);
  let mode = $state<Mode>('show-me');
  let input = $state('');
  let allowWriteForNextPrompt = $state(false);

  const defaultSettings: AssistantSettings = {
    enabled: true,
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4.1-mini',
    openaiBaseUrl: '',
    ollamaBaseUrl: 'http://127.0.0.1:11434/v1',
    mcpUrl: 'http://127.0.0.1:8788'
  };
  let settings = $state<AssistantSettings>({ ...defaultSettings });

  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({
        mode,
        allowWrite: allowWriteForNextPrompt,
        settings
      })
    })
  });

  /** True while a prompt is actively in-flight so duplicate sends can be blocked. */
  const isStreaming = $derived(chat.status === 'streaming' || chat.status === 'submitted');

  /** Flatten the SDK message-part structure into plain text for markdown rendering. */
  function extractText(message: any) {
    if (!message?.parts || !Array.isArray(message.parts)) return '';
    return message.parts
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => String(part.text ?? ''))
      .join('\n');
  }

  /** Convert assistant markdown into trusted HTML for display in the transcript. */
  function renderMarkdown(content: string) {
    return marked.parse(content, { async: false });
  }

  /** Persist panel state and transcript so the session survives route navigation. */
  function persistSession() {
    if (!browser) return;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        open,
        minimized,
        mode,
        messages: chat.messages
      })
    );
  }

  /** Dismiss the first-login welcome hint and persist so it never reappears. */
  function dismissHint() {
    showHint = false;
    if (browser) localStorage.setItem(HINT_DISMISSED_KEY, '1');
  }

  /** Validate and submit a prompt, optionally escalating to write-capable mode. */
  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming || !settings.enabled) return;

    // Write-enabled actions are explicitly confirmed per prompt to avoid accidental config changes.
    if (mode === 'do-it') {
      allowWriteForNextPrompt = confirm(
        'Allow this request to execute configuration changes (write operations) if needed?'
      );
    } else {
      allowWriteForNextPrompt = false;
    }

    input = '';
    await chat.sendMessage({ text });
    allowWriteForNextPrompt = false;
    persistSession();
  }

  /** Restore local settings and prior transcript, and watch for settings changes from other tabs. */
  onMount(() => {
    if (!browser) return;

    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      try {
        settings = { ...defaultSettings, ...JSON.parse(rawSettings) };
      } catch {
        settings = { ...defaultSettings };
      }
    }

    // Show the welcome hint if this is a first-time visitor (never dismissed before).
    const hintDismissed = localStorage.getItem(HINT_DISMISSED_KEY);
    if (!hintDismissed) {
      showHint = true;
    }

    const rawSession = sessionStorage.getItem(STORAGE_KEY);
    if (rawSession) {
      try {
        const restored = JSON.parse(rawSession) as {
          open?: boolean;
          minimized?: boolean;
          mode?: Mode;
          messages?: any[];
        };
        open = Boolean(restored.open);
        minimized = Boolean(restored.minimized);
        mode = restored.mode === 'do-it' ? 'do-it' : 'show-me';
        if (Array.isArray(restored.messages)) {
          chat.messages = restored.messages;
        }
      } catch {
        // Ignore invalid session payload.
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_KEY || !event.newValue) return;
      try {
        settings = { ...defaultSettings, ...JSON.parse(event.newValue) };
      } catch {
        settings = { ...defaultSettings };
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  });

  /** Keep browser session storage in sync whenever key chat state mutates. */
  $effect(() => {
    if (!browser) return;
    persistSession();
  });
</script>

{#if settings.enabled}
  <div class="pointer-events-none fixed right-4 bottom-4 z-50 md:right-6 md:bottom-6">
    {#if !open || minimized}
      <div class="pointer-events-auto flex items-end gap-3">
        {#if showHint && !open}
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
          <div
            role="button"
            tabindex="0"
            class="animate-fade-in-up mb-1 flex max-w-[220px] cursor-pointer items-start gap-2 rounded-xl border border-cyan-500/40 bg-slate-900 px-4 py-3 text-left shadow-[0_0_0_1px_rgba(6,182,212,0.2),0_12px_28px_rgba(2,8,23,0.6)] transition-all hover:border-cyan-400/60"
            onclick={() => {
              dismissHint();
              open = true;
              minimized = false;
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dismissHint();
                open = true;
                minimized = false;
              }
            }}
          >
            <SparklesIcon class="mt-0.5 size-4 shrink-0 text-cyan-400" />
            <div>
              <p class="text-sm font-medium leading-snug text-slate-100">Hey, I'm your assistant!</p>
              <p class="mt-0.5 text-xs leading-snug text-slate-400">Need help? Just click me.</p>
            </div>
            <button
              type="button"
              class="ml-1 mt-0.5 shrink-0 cursor-pointer rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              onclick={(e) => { e.stopPropagation(); dismissHint(); }}
              aria-label="Dismiss hint"
            >
              <XIcon class="size-3" />
            </button>
          </div>
        {/if}
        <button
          type="button"
          class="flex size-14 cursor-pointer items-center justify-center rounded-full border border-cyan-400/60 bg-slate-900 text-cyan-300 shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_16px_36px_rgba(2,8,23,0.65)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
          onclick={() => {
            if (showHint) dismissHint();
            open = true;
            minimized = false;
          }}
          aria-label="Open AI assistant"
        >
          <MessageCircleIcon class="size-6" />
        </button>
      </div>
    {/if}

    {#if open && !minimized}
      <section class="pointer-events-auto fixed top-0 right-0 flex h-screen w-full flex-col border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl md:w-[400px]">
        <header class="border-b border-slate-800 bg-slate-900/95 px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="inline-flex size-8 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-300">
                <BotIcon class="size-4" />
              </span>
              <div>
                <p class="text-sm font-semibold">AI Assistant</p>
                <p class="text-[11px] text-slate-400">ezNGFW MCP-connected copilot</p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                onclick={() => (minimized = true)}
                aria-label="Minimize panel"
              >
                <Minimize2Icon class="size-4" />
              </button>
              <button
                type="button"
                class="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                onclick={() => {
                  open = false;
                  minimized = false;
                }}
                aria-label="Close panel"
              >
                <XIcon class="size-4" />
              </button>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 rounded-md border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              class={`cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition ${mode === 'show-me' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-slate-900'}`}
              onclick={() => (mode = 'show-me')}
            >
              Show me
            </button>
            <button
              type="button"
              class={`cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition ${mode === 'do-it' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-slate-900'}`}
              onclick={() => (mode = 'do-it')}
            >
              Do it for me
            </button>
          </div>
        </header>

        <div class="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.16),transparent_50%)] px-4 py-4">
          {#if chat.messages.length === 0}
            <div class="rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
              <div class="mb-2 flex items-center gap-2 text-cyan-300">
                <SparklesIcon class="size-4" />
                <span class="font-medium">Ready to help</span>
              </div>
              Ask for firewall analysis, DNS/DHCP checks, routing insight, or guided configuration steps.
            </div>
          {/if}

          {#each chat.messages as message (message.id)}
            {@const text = extractText(message)}
            {#if text}
              <article class={`max-w-[90%] rounded-lg border p-3 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto border-cyan-500/30 bg-cyan-500/10 text-cyan-100' : 'border-slate-800 bg-slate-900 text-slate-100'}`}>
                <div class="prose prose-invert prose-sm max-w-none [&_a]:text-cyan-300 [&_code]:rounded [&_code]:bg-slate-950 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:border [&_pre]:border-slate-800 [&_pre]:bg-slate-950">
                  {@html renderMarkdown(text)}
                </div>
              </article>
            {/if}
          {/each}

          {#if isStreaming}
            <div class="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
              <span class="size-1.5 animate-pulse rounded-full bg-cyan-400"></span>
              Assistant is typing...
            </div>
          {/if}
        </div>

        <footer class="border-t border-slate-800 bg-slate-900/90 p-3">
          <form
            class="space-y-2"
            onsubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <Textarea
              rows={3}
              bind:value={input}
              placeholder={mode === 'do-it' ? 'Describe the change you want applied...' : 'Ask for guidance or explanation...'}
              class="min-h-[72px] resize-none border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
              onkeydown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />

            <div class="flex items-center justify-between gap-2">
              <p class="text-[11px] text-slate-500">{mode === 'do-it' ? 'Execution mode requires confirmation before writes.' : 'Guidance-only mode (no writes).'}</p>
              <Button
                type="submit"
                class="cursor-pointer bg-cyan-500 text-white hover:bg-cyan-600"
                disabled={!input.trim() || isStreaming}
              >
                <SendIcon class="mr-2 size-4" />
                Send
              </Button>
            </div>
          </form>
        </footer>
      </section>
    {/if}
  </div>
{/if}


<style>
  /* Slide-up entrance animation for the first-login AI assistant hint bubble. */
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  :global(.animate-fade-in-up) {
    animation: fade-in-up 0.4s ease-out both;
  }
</style>
