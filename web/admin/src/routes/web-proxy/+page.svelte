<!-- Route view for `/web-proxy` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Select from '$lib/components/ui/select';
  import { _ } from '$lib/i18n';

  type WebProxyConfig = { enabled: boolean; mode: string; listen_port: number; ssl_bump: boolean; ssl_ca_certificate: string; authentication: string; cache_enabled: boolean; cache_size_mb: number; max_object_size_kb: number; pac_file_enabled: boolean; pac_file_content: string; allowed_networks: string[]; bypass_domains: string[]; upstream_proxy: string; upstream_proxy_port: number; log_enabled: boolean; description: string };

  let cfg = $state<WebProxyConfig>({ enabled: false, mode: 'transparent', listen_port: 3128, ssl_bump: false, ssl_ca_certificate: '', authentication: 'none', cache_enabled: true, cache_size_mb: 1024, max_object_size_kb: 4096, pac_file_enabled: false, pac_file_content: '', allowed_networks: [], bypass_domains: [], upstream_proxy: '', upstream_proxy_port: 0, log_enabled: true, description: '' });
  let status = $state<Record<string, unknown>>({});
  let loading = $state(true);

  const modeOptions = [{ label: 'Transparent', value: 'transparent' }, { label: 'Explicit', value: 'explicit' }];
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


  async function load() {
    loading = true;
    try {
      cfg = await api.get('/web-proxy') as WebProxyConfig;
      status = await api.get('/web-proxy/status') as Record<string, unknown>;
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load web proxy');
    } finally {
      loading = false;
    }
  }

  async function save() {
    try {
      await api.patch('/web-proxy', cfg);
      toasts.success($_('web_proxy.toastweb_proxy_updated'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function clearCache() {
    try {
      await api.post('/web-proxy/clear-cache', {});
      toasts.success($_('web_proxy.toastproxy_cache_clear_requested'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Clear cache failed');
    }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('web_proxy.web_proxy')}</CardTitle><CardDescription class="text-slate-400">{$_('web_proxy.configure_explicittransparent_proxying_ssl_bump_au')}</CardDescription></CardHeader><CardContent>{#if loading}<p class="text-sm text-slate-400">{$_('web_proxy.loading')}</p>{:else}<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}><div class="grid gap-4 md:grid-cols-3"><label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable proxy service for traffic interception/forwarding." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Mode" hint="Transparent intercepts traffic automatically; explicit requires browser proxy config or PAC." /><Select.Root type="single" value={cfg.mode} onValueChange={(v) => { if (v) cfg.mode = v; }}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{cfg.mode}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each modeOptions as o}<Select.Item value={o.value} label={o.label} class="cursor-pointer text-slate-200" />{/each}</Select.Content></Select.Root></label><label class="space-y-1 text-sm"><FieldLabel label="Listen Port" hint="TCP listener for explicit proxy clients." /><Input class="border-slate-700 bg-slate-950" type="number" value={String(cfg.listen_port)} oninput={(e) => (cfg.listen_port = Number((e.currentTarget as HTMLInputElement).value || 3128))} /></label><label class="space-y-1 text-sm"><FieldLabel label="SSL Bump" hint="Inspect HTTPS sessions using forward-proxy TLS resigning." /><div class="flex h-9 items-center"><Switch checked={cfg.ssl_bump} onCheckedChange={(v) => (cfg.ssl_bump = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Cache Enabled" hint="Enable local object caching for proxy responses." /><div class="flex h-9 items-center"><Switch checked={cfg.cache_enabled} onCheckedChange={(v) => (cfg.cache_enabled = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Cache Size (MB)" hint="Maximum allocated storage for proxy object cache." /><Input class="border-slate-700 bg-slate-950" type="number" value={String(cfg.cache_size_mb)} oninput={(e) => (cfg.cache_size_mb = Number((e.currentTarget as HTMLInputElement).value || 1024))} /></label></div><label class="space-y-1 text-sm"><FieldLabel label="PAC File Content" hint="Automatic browser proxy configuration script content." /><Textarea class="min-h-32 border-slate-700 bg-slate-950" value={cfg.pac_file_content} oninput={(e) => (cfg.pac_file_content = (e.currentTarget as HTMLTextAreaElement).value)} /></label><div class="flex gap-2"><Button type="submit">Save</Button><Button type="button" variant="outline" class="border-slate-700" onclick={() => void clearCache()}>Clear Cache</Button></div></form>{/if}</CardContent></Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('web_proxy.service_status')}</CardTitle></CardHeader>
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
</div>
