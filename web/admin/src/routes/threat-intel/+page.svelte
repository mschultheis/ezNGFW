<!-- Route view for `/threat-intel` in the ezNGFW admin GUI. -->

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

  type ThreatFeed = { id: string; name: string; url: string; feed_type: string; enabled: boolean; auto_update: boolean; last_updated: string; indicator_count: number; description: string };
  type ThreatIntelConfig = { enabled: boolean; feeds: ThreatFeed[]; auto_update_interval_hours: number; stix_taxii_enabled: boolean; taxii_server_url: string; taxii_api_key: string; ip_reputation_enabled: boolean; ip_reputation_threshold: number; auto_block: boolean; botnet_detection_enabled: boolean; botnet_dns_monitoring: boolean; botnet_c2_lists: string[]; last_update: string; total_indicators: number };

  let cfg = $state<ThreatIntelConfig>({ enabled: false, feeds: [], auto_update_interval_hours: 6, stix_taxii_enabled: false, taxii_server_url: '', taxii_api_key: '', ip_reputation_enabled: true, ip_reputation_threshold: 70, auto_block: true, botnet_detection_enabled: true, botnet_dns_monitoring: true, botnet_c2_lists: [], last_update: '', total_indicators: 0 });
  let status = $state<Record<string, unknown>>({});
  let loading = $state(true);


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
      cfg = await api.get('/threat-intel') as ThreatIntelConfig;
      status = await api.get('/threat-intel/status') as Record<string, unknown>;
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load threat intelligence');
    } finally {
      loading = false;
    }
  }

  async function save() {
    try {
      await api.patch('/threat-intel', cfg);
      toasts.success($_('threat_intel.toastthreat_intelligence_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function updateFeeds() {
    try {
      await api.post('/threat-intel/update', {});
      await load();
      toasts.success($_('threat_intel.toastfeed_update_started'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function addFeed() {
    cfg.feeds = [...cfg.feeds, { id: `feed-${Date.now()}`, name: '', url: '', feed_type: 'stix', enabled: true, auto_update: true, last_updated: '', indicator_count: 0, description: '' }];
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('threat_intel.threat_intelligence')}</CardTitle><CardDescription class="text-slate-400">{$_('threat_intel.stixtaxii_feed_integration_ip_reputation_scoring_a')}</CardDescription></CardHeader><CardContent>{#if loading}<p class="text-sm text-slate-400">{$_('threat_intel.loading')}</p>{:else}<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}><div class="grid gap-4 md:grid-cols-3"><label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable threat feed ingestion and indicator correlation." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Auto Update (hours)" hint="Polling interval for feed refresh operations." /><Input class="border-slate-700 bg-slate-950" type="number" value={String(cfg.auto_update_interval_hours)} oninput={(e) => (cfg.auto_update_interval_hours = Number((e.currentTarget as HTMLInputElement).value || 6))} /></label><label class="space-y-1 text-sm"><FieldLabel label="IP Reputation Threshold" hint="Threshold score for automatic blocking decisions." /><Input class="border-slate-700 bg-slate-950" type="number" value={String(cfg.ip_reputation_threshold)} oninput={(e) => (cfg.ip_reputation_threshold = Number((e.currentTarget as HTMLInputElement).value || 70))} /></label><label class="space-y-1 text-sm"><FieldLabel label="IP Reputation" hint="Enable scoring of source and destination IP addresses." /><div class="flex h-9 items-center"><Switch checked={cfg.ip_reputation_enabled} onCheckedChange={(v) => (cfg.ip_reputation_enabled = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Auto Block" hint="Automatically block indicators above threshold." /><div class="flex h-9 items-center"><Switch checked={cfg.auto_block} onCheckedChange={(v) => (cfg.auto_block = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Botnet DNS Monitoring" hint="Monitor DNS requests for C2 and known botnet domains." /><div class="flex h-9 items-center"><Switch checked={cfg.botnet_dns_monitoring} onCheckedChange={(v) => (cfg.botnet_dns_monitoring = v)} /></div></label></div><div class="flex gap-2"><Button type="submit">Save</Button><Button type="button" variant="outline" class="border-slate-700" onclick={() => void updateFeeds()}>Update Feeds</Button><Button type="button" variant="outline" class="border-slate-700" onclick={addFeed}>Add Feed</Button></div></form>{/if}</CardContent></Card>

  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('threat_intel.feeds')}</CardTitle></CardHeader><CardContent class="space-y-3">{#each cfg.feeds as feed, i}<div class="grid gap-3 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-4"><Input class="border-slate-700 bg-slate-900" placeholder={$_('threat_intel.placeholdername')} value={feed.name} oninput={(e) => (cfg.feeds[i].name = (e.currentTarget as HTMLInputElement).value)} /><Input class="border-slate-700 bg-slate-900" placeholder={$_('threat_intel.placeholderurl')} value={feed.url} oninput={(e) => (cfg.feeds[i].url = (e.currentTarget as HTMLInputElement).value)} /><select
              bind:value={feed.feed_type}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="ip-reputation">ip-reputation</option>
              <option value="domain-blocklist">domain-blocklist</option>
              <option value="url-blocklist">url-blocklist</option>
              <option value="malware-hash">malware-hash</option>
              <option value="tor-exit-nodes">tor-exit-nodes</option>
              <option value="botnet-c2">botnet-c2</option>
              <option value="custom">custom</option>
            </select> (cfg.feeds[i].feed_type = (e.currentTarget as HTMLInputElement).value)} /><div class="flex items-center"><Switch checked={feed.enabled} onCheckedChange={(v) => (cfg.feeds[i].enabled = v)} /></div></div>{/each}</CardContent></Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('threat_intel.service_status')}</CardTitle></CardHeader>
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
