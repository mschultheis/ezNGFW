<!-- Route view for `/waf` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  type WafRule = { id: string; name: string; enabled: boolean; pattern: string; action: string; phase: string; severity: string; description: string };
  type WafProtectedHost = { hostname: string; backend_address: string; backend_port: number; ssl: boolean; certificate: string };
  type WafConfig = { enabled: boolean; mode: string; owasp_ruleset: boolean; owasp_paranoia_level: number; custom_rules: WafRule[]; learning_mode: boolean; request_body_limit_kb: number; blocked_response_code: number; blocked_response_body: string; excluded_paths: string[]; protected_hosts: WafProtectedHost[]; log_enabled: boolean };

  let cfg = $state<WafConfig>({ enabled: false, mode: 'blocking', owasp_ruleset: true, owasp_paranoia_level: 1, custom_rules: [], learning_mode: false, request_body_limit_kb: 512, blocked_response_code: 403, blocked_response_body: 'Request blocked by WAF', excluded_paths: [], protected_hosts: [], log_enabled: true });
  let events = $state<Record<string, unknown>[]>([]);

  async function load() {
    try {
      cfg = await api.get('/waf') as WafConfig;
      events = await api.get('/waf/events') as Record<string, unknown>[];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load WAF');
    }
  }

  async function save() {
    try {
      await api.patch('/waf', cfg);
      toasts.success($_('waf.toastwaf_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Save failed');
    }
  }


  /** Format epoch seconds as a localized date/time string. */
  function formatEpoch(epoch: unknown): string {
    const n = Number(epoch);
    if (!n || isNaN(n)) return '—';
    return new Date(n > 1e12 ? n : n * 1000).toLocaleString();
  }

  function addRule() { cfg.custom_rules = [...cfg.custom_rules, { id: `rule-${Date.now()}`, name: '', enabled: true, pattern: '', action: 'block', phase: 'request', severity: 'high', description: '' }]; }
  function addHost() { cfg.protected_hosts = [...cfg.protected_hosts, { hostname: '', backend_address: '', backend_port: 80, ssl: false, certificate: '' }]; }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('waf.web_application_firewall')}</CardTitle><CardDescription class="text-slate-400">{$_('waf.owasp_ruleset_controls_custom_signatures_learning')}</CardDescription></CardHeader><CardContent><form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}><div class="grid gap-4 md:grid-cols-3"><label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable WAF request inspection and active blocking." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="OWASP Ruleset" hint="Enable CRS managed baseline protections." /><div class="flex h-9 items-center"><Switch checked={cfg.owasp_ruleset} onCheckedChange={(v) => (cfg.owasp_ruleset = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Learning Mode" hint="Observe and score traffic before strict blocking." /><div class="flex h-9 items-center"><Switch checked={cfg.learning_mode} onCheckedChange={(v) => (cfg.learning_mode = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Paranoia Level" hint="CRS sensitivity from low (1) to aggressive (4)." /><Input class="border-slate-700 bg-slate-950" type="number" min="1" max="4" value={String(cfg.owasp_paranoia_level)} oninput={(e) => (cfg.owasp_paranoia_level = Number((e.currentTarget as HTMLInputElement).value || 1))} /></label><label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Blocked Response Body" hint="Message body returned for blocked requests." /><Textarea class="min-h-24 border-slate-700 bg-slate-950" value={cfg.blocked_response_body} oninput={(e) => (cfg.blocked_response_body = (e.currentTarget as HTMLTextAreaElement).value)} /></label></div><div class="flex gap-2"><Button type="submit">Save</Button><Button type="button" variant="outline" class="border-slate-700" onclick={addRule}>Add Rule</Button><Button type="button" variant="outline" class="border-slate-700" onclick={addHost}>Add Host</Button></div></form></CardContent></Card>

  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('waf.rules')}</CardTitle></CardHeader><CardContent class="space-y-3">{#each cfg.custom_rules as rule, i}<div class="grid gap-3 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-4"><Input class="border-slate-700 bg-slate-900" placeholder={$_('waf.placeholdername')} value={rule.name} oninput={(e) => (cfg.custom_rules[i].name = (e.currentTarget as HTMLInputElement).value)} /><Input class="border-slate-700 bg-slate-900" placeholder={$_('waf.placeholderpattern')} value={rule.pattern} oninput={(e) => (cfg.custom_rules[i].pattern = (e.currentTarget as HTMLInputElement).value)} /><select
              bind:value={rule.action}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="allow">allow</option>
              <option value="block">block</option>
              <option value="log">log</option>
              <option value="challenge">challenge</option>
              <option value="redirect">redirect</option>
            </select> (cfg.custom_rules[i].action = (e.currentTarget as HTMLInputElement).value)} /><div class="flex items-center"><Switch checked={rule.enabled} onCheckedChange={(v) => (cfg.custom_rules[i].enabled = v)} /></div></div>{/each}</CardContent></Card>

  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('waf.protected_hosts')}</CardTitle></CardHeader><CardContent class="space-y-3">{#each cfg.protected_hosts as host, i}<div class="grid gap-3 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-4"><Input class="border-slate-700 bg-slate-900" placeholder={$_('waf.placeholderhostname')} value={host.hostname} oninput={(e) => (cfg.protected_hosts[i].hostname = (e.currentTarget as HTMLInputElement).value)} /><Input class="border-slate-700 bg-slate-900" placeholder={$_('waf.placeholderbackend_address')} value={host.backend_address} oninput={(e) => (cfg.protected_hosts[i].backend_address = (e.currentTarget as HTMLInputElement).value)} /><Input class="border-slate-700 bg-slate-900" placeholder={$_('waf.placeholderbackend_port')} type="number" value={String(host.backend_port)} oninput={(e) => (cfg.protected_hosts[i].backend_port = Number((e.currentTarget as HTMLInputElement).value || 80))} /><div class="flex items-center"><Switch checked={host.ssl} onCheckedChange={(v) => (cfg.protected_hosts[i].ssl = v)} /></div></div>{/each}</CardContent></Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('waf.recent_events')}</CardTitle></CardHeader>
    <CardContent>
      {#if Array.isArray(events) && events.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-slate-300">
            <thead>
              <tr class="border-b border-slate-700 text-left text-xs text-slate-400">
                <th class="px-3 py-2">Time</th>
                <th class="px-3 py-2">Source IP</th>
                <th class="px-3 py-2">Path</th>
                <th class="px-3 py-2">Rule</th>
                <th class="px-3 py-2">Severity</th>
                <th class="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each events as ev}
                <tr class="border-b border-slate-800">
                  <td class="px-3 py-2 text-xs">{formatEpoch(ev.timestamp)}</td>
                  <td class="px-3 py-2 font-mono text-xs">{ev.source_ip || '—'}</td>
                  <td class="px-3 py-2 font-mono text-xs">{ev.path || '—'}</td>
                  <td class="px-3 py-2">{ev.rule_id || '—'}</td>
                  <td class="px-3 py-2">
                    <span class="rounded px-1.5 py-0.5 text-xs font-medium {ev.severity === 'high' ? 'bg-red-500/20 text-red-300' : ev.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'}">{ev.severity || '—'}</span>
                  </td>
                  <td class="px-3 py-2">
                    <span class="rounded px-1.5 py-0.5 text-xs font-medium {ev.action === 'blocked' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}">{ev.action || '—'}</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-sm text-slate-400">{$_('waf.no_recent_events')}</p>
      {/if}
    </CardContent>
  </Card>
</div>
