<!-- Route view for `/sandbox` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  type SandboxConfig = { enabled: boolean; engine: string; file_types: string[]; max_analysis_time_sec: number; auto_block_malicious: boolean; verdict_cache_hours: number; cloud_submission: boolean; cloud_api_key: string; log_enabled: boolean };

  const ENGINE_OPTIONS = [
    { value: 'cuckoo', label: 'Cuckoo' },
    { value: 'clamav', label: 'ClamAV' },
    { value: 'crowdsec', label: 'CrowdSec' }
  ];

  let cfg = $state<SandboxConfig>({ enabled: false, engine: 'cuckoo', file_types: ['exe'], max_analysis_time_sec: 180, auto_block_malicious: true, verdict_cache_hours: 24, cloud_submission: false, cloud_api_key: '', log_enabled: true });
  let status = $state<Record<string, unknown>>({});
  let verdicts = $state<Record<string, unknown>[]>([]);


  /** Convert snake_case keys to Title Case labels. */
  function formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Format a status value for human-readable display. */
  function formatStatusValue(value: unknown): string {
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string' && value !== '') return value;
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    return String(value ?? '—');
  }

  /** Format epoch seconds as a localized date/time string. */
  function formatEpoch(epoch: unknown): string {
    const n = Number(epoch);
    if (!n || isNaN(n)) return '—';
    return new Date(n > 1e12 ? n : n * 1000).toLocaleString();
  }

  async function load() {
    try {
      cfg = await api.get('/sandbox') as SandboxConfig;
      status = await api.get('/sandbox/status') as Record<string, unknown>;
      verdicts = await api.get('/sandbox/verdicts') as Record<string, unknown>[];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load sandbox');
    }
  }

  async function save() {
    try {
      await api.patch('/sandbox', cfg);
      toasts.success($_('sandbox.toastsandbox_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Save failed');
    }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('sandbox.sandboxing')}</CardTitle><CardDescription class="text-slate-400">{$_('sandbox.detonation_engine_settings_verdict_cache_strategy')}</CardDescription></CardHeader><CardContent><form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}><div class="grid gap-4 md:grid-cols-3"><label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable dynamic file detonation analysis." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Engine" hint="Sandbox backend for detonation and behavior scoring." /><select bind:value={cfg.engine} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each ENGINE_OPTIONS as option}<option value={option.value}>{option.label}</option>{/each}</select></label><label class="space-y-1 text-sm"><FieldLabel label="Max Analysis Time (sec)" hint="Maximum detonation runtime before timeout verdict." /><Input class="border-slate-700 bg-slate-950" type="number" value={String(cfg.max_analysis_time_sec)} oninput={(e) => (cfg.max_analysis_time_sec = Number((e.currentTarget as HTMLInputElement).value || 180))} /></label><label class="space-y-1 text-sm"><FieldLabel label="Auto Block Malicious" hint="Block transfers immediately on malicious verdict." /><div class="flex h-9 items-center"><Switch checked={cfg.auto_block_malicious} onCheckedChange={(v) => (cfg.auto_block_malicious = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Cloud Submission" hint="Submit files to cloud detonation service." /><div class="flex h-9 items-center"><Switch checked={cfg.cloud_submission} onCheckedChange={(v) => (cfg.cloud_submission = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Verdict Cache (hours)" hint="How long to reuse previous analysis verdicts." /><Input class="border-slate-700 bg-slate-950" type="number" value={String(cfg.verdict_cache_hours)} oninput={(e) => (cfg.verdict_cache_hours = Number((e.currentTarget as HTMLInputElement).value || 24))} /></label></div><div class="flex gap-2"><Button type="submit">Save</Button></div></form></CardContent></Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('sandbox.service_status')}</CardTitle></CardHeader>
    <CardContent>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each Object.entries(status) as [key, value]}
          <div class="rounded border border-slate-800 bg-slate-950 p-3">
            <p class="text-xs text-slate-400">{formatLabel(key)}</p>
            <p class="mt-1 text-sm font-medium {typeof value === 'boolean' ? (value ? 'text-emerald-400' : 'text-red-400') : 'text-slate-100'}">
              {formatStatusValue(value)}
            </p>
          </div>
        {/each}
      </div>
    </CardContent>
  </Card>
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('sandbox.recent_verdicts')}</CardTitle></CardHeader>
    <CardContent>
      {#if Array.isArray(verdicts) && verdicts.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-slate-300">
            <thead>
              <tr class="border-b border-slate-700 text-left text-xs text-slate-400">
                <th class="px-3 py-2">File</th>
                <th class="px-3 py-2">SHA256</th>
                <th class="px-3 py-2">Confidence</th>
                <th class="px-3 py-2">Cached Until</th>
              </tr>
            </thead>
            <tbody>
              {#each verdicts as v}
                <tr class="border-b border-slate-800">
                  <td class="px-3 py-2">{v.file_name || '—'}</td>
                  <td class="px-3 py-2 font-mono text-xs">{String(v.sha256 || '').slice(0, 16)}…</td>
                  <td class="px-3 py-2">{v.confidence ?? '—'}</td>
                  <td class="px-3 py-2">{formatEpoch(v.cached_until)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-sm text-slate-400">{$_('sandbox.no_verdicts_recorded_yet')}</p>
      {/if}
    </CardContent>
  </Card>
</div>
