<!-- Route view for `/firewall/sni-filter` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Switch } from '$lib/components/ui/switch';
  import { Badge } from '$lib/components/ui/badge';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';

  import { _ } from '$lib/i18n';
  type SniFilterAction = 'allow' | 'block' | 'log' | 'redirect';
  type SniMatchType = 'exact' | 'wildcard' | 'regex' | 'category';
  type EncryptedSniPolicy = 'allow' | 'block' | 'log';
  type QuicSniPolicy = 'allow' | 'block' | 'log';

  type SniFilterSettings = {
    enabled: boolean;
    default_action: SniFilterAction;
    log_default: boolean;
    encrypted_sni_policy: EncryptedSniPolicy;
    quic_policy: QuicSniPolicy;
  };

  type SniFilterRule = {
    id: string;
    enabled: boolean;
    name: string;
    description: string;
    action: SniFilterAction;
    match_type: SniMatchType;
    sni_patterns: string[];
    port_filter: number[] | null;
    protocol_filter: string[] | null;
    source_zones: string[];
    schedule: string | null;
    log_matches: boolean;
    order: number;
  };

  type AppCategory = {
    id: string;
    name: string;
    description: string;
    sni_patterns: string[];
    editable: boolean;
  };

  type MatchLog = {
    timestamp: string;
    source_ip: string;
    sni: string;
    rule_name: string;
    action: SniFilterAction;
    matched_pattern: string;
    protocol: string;
    port: number;
  };

  type TestMatch = {
    rule_id: string;
    rule_name: string;
    action: SniFilterAction;
    matched_pattern: string;
    order: number;
  };

  type TestResult = {
    domain: string;
    matched: boolean;
    matches: TestMatch[];
    effective_action: SniFilterAction;
  };

  const actionOptions = [
    { value: 'allow', label: 'Allow' },
    { value: 'block', label: 'Block' },
    { value: 'log', label: 'Log' },
    { value: 'redirect', label: 'Redirect' }
  ];

  const matchTypeOptions = [
    { value: 'wildcard', label: 'Wildcard' },
    { value: 'exact', label: 'Exact' },
    { value: 'regex', label: 'Regex' },
    { value: 'category', label: 'Category IDs' }
  ];

  const policyOptions = [
    { value: 'allow', label: 'Allow' },
    { value: 'block', label: 'Block' },
    { value: 'log', label: 'Log' }
  ];

  const emptySettings: SniFilterSettings = {
    enabled: false,
    default_action: 'allow',
    log_default: false,
    encrypted_sni_policy: 'log',
    quic_policy: 'block'
  };

  const defaultRuleForm = (): SniFilterRule => ({
    id: '',
    enabled: true,
    name: '',
    description: '',
    action: 'block',
    match_type: 'wildcard',
    sni_patterns: [],
    port_filter: [443],
    protocol_filter: ['tcp'],
    source_zones: [],
    schedule: null,
    log_matches: true,
    order: 100
  });

  let loading = $state(true);
  let savingSettings = $state(false);
  let savingRule = $state(false);
  let bulkBusy = $state(false);

  let settings = $state<SniFilterSettings>({ ...emptySettings });
  let rules = $state<SniFilterRule[]>([]);
  let categories = $state<AppCategory[]>([]);
  let logs = $state<MatchLog[]>([]);
  let zones = $state<string[]>([]);

  let filterText = $state('');
  let sortBy = $state<'order' | 'name' | 'action'>('order');
  let sortDir = $state<'asc' | 'desc'>('asc');
  let selected: Record<string, boolean> = $state({});

  let editRuleId = $state('');
  let ruleForm = $state<SniFilterRule>(defaultRuleForm());
  let patternsText = $state('');
  let portsText = $state('443');
  let protocolsText = $state('tcp');
  let scheduleText = $state('');
  let zoneToAdd = $state('');

  let testDomain = $state('');
  let testing = $state(false);
  let testResult = $state<TestResult | null>(null);

  const parseCsv = (value: string): string[] =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

  const parsePorts = (value: string): number[] =>
    parseCsv(value)
      .map((part) => Number(part))
      .filter((port) => Number.isInteger(port) && port > 0 && port < 65536);

  const normalizeRuleForm = (): SniFilterRule => ({
    ...ruleForm,
    name: ruleForm.name.trim(),
    description: ruleForm.description.trim(),
    sni_patterns: patternsText
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean),
    port_filter: parsePorts(portsText).length ? parsePorts(portsText) : null,
    protocol_filter: parseCsv(protocolsText).length ? parseCsv(protocolsText) : null,
    schedule: scheduleText.trim() ? scheduleText.trim() : null,
    source_zones: Array.from(new Set(ruleForm.source_zones))
  });

  const displayedRules = $derived.by(() => {
    const q = filterText.trim().toLowerCase();
    const filtered = rules.filter((rule) => {
      if (!q) return true;
      return (
        rule.name.toLowerCase().includes(q) ||
        rule.description.toLowerCase().includes(q) ||
        rule.sni_patterns.some((pattern) => pattern.toLowerCase().includes(q))
      );
    });
    const next = [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'order') return (a.order - b.order) * dir;
      return String((a as Record<string, unknown>)[sortBy]).localeCompare(String((b as Record<string, unknown>)[sortBy])) * dir;
    });
    return next;
  });

  const selectedIds = $derived.by(() => Object.keys(selected).filter((id) => selected[id]));

  async function loadData() {
    loading = true;
    try {
      const [settingsData, rulesData, categoriesData, logsData, zonesData] = await Promise.all([
        api.get<SniFilterSettings>('/sni-filter/settings'),
        api.get<SniFilterRule[]>('/sni-filter/rules'),
        api.get<AppCategory[]>('/sni-filter/categories'),
        api.get<MatchLog[]>('/sni-filter/logs'),
        api.get<{ name: string }[]>('/zones').catch(() => [])
      ]);
      settings = settingsData;
      rules = rulesData;
      categories = categoriesData;
      logs = logsData;
      zones = zonesData.map((zone) => zone.name).filter(Boolean);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load SNI filter data');
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    savingSettings = true;
    try {
      settings = await api.put<SniFilterSettings>('/sni-filter/settings', settings);
      toasts.success($_('firewall_sni.toast_sni_filter_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      savingSettings = false;
    }
  }

  function beginCreate() {
    editRuleId = '';
    ruleForm = defaultRuleForm();
    patternsText = '';
    portsText = '443';
    protocolsText = 'tcp';
    scheduleText = '';
    zoneToAdd = '';
  }

  function beginEdit(rule: SniFilterRule) {
    editRuleId = rule.id;
    ruleForm = structuredClone(rule);
    patternsText = rule.sni_patterns.join('\n');
    portsText = (rule.port_filter ?? []).join(',');
    protocolsText = (rule.protocol_filter ?? []).join(',');
    scheduleText = rule.schedule ?? '';
    zoneToAdd = '';
  }

  function addZoneToRule() {
    if (!zoneToAdd || ruleForm.source_zones.includes(zoneToAdd)) return;
    ruleForm.source_zones = [...ruleForm.source_zones, zoneToAdd];
    zoneToAdd = '';
  }

  function removeZone(zone: string) {
    ruleForm.source_zones = ruleForm.source_zones.filter((z) => z !== zone);
  }

  async function saveRule() {
    const payload = normalizeRuleForm();
    if (!payload.name) {
      toasts.error($_('firewall_sni.toast_rule_name_is_required'));
      return;
    }
    if (!payload.sni_patterns.length) {
      toasts.error($_('firewall_sni.toast_at_least_one_sni_pattern_is_required'));
      return;
    }

    savingRule = true;
    try {
      if (editRuleId) {
        await api.put(`/sni-filter/rules/${encodeURIComponent(editRuleId)}`, payload);
        toasts.success($_('firewall_sni.toast_rule_updated'));
      } else {
        await api.post('/sni-filter/rules', payload);
        toasts.success($_('firewall_sni.toast_rule_created'));
      }
      await loadData();
      beginCreate();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save rule');
    } finally {
      savingRule = false;
    }
  }

  async function deleteRule(id: string) {
    try {
      await api.del(`/sni-filter/rules/${encodeURIComponent(id)}`);
      toasts.success($_('firewall_sni.toast_rule_deleted'));
      await loadData();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to delete rule');
    }
  }

  async function runBulk(action: 'enable' | 'disable' | 'delete') {
    const ids = selectedIds;
    if (!ids.length) return;
    bulkBusy = true;
    try {
      if (action === 'delete') {
        await Promise.all(ids.map((id) => api.del(`/sni-filter/rules/${encodeURIComponent(id)}`)));
      } else {
        await Promise.all(
          ids.map((id) => {
            const current = rules.find((rule) => rule.id === id);
            if (!current) return Promise.resolve();
            return api.put(`/sni-filter/rules/${encodeURIComponent(id)}`, {
              ...current,
              enabled: action === 'enable'
            });
          })
        );
      }
      selected = {};
      await loadData();
      toasts.success(`Bulk ${action} completed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : `Bulk ${action} failed`);
    } finally {
      bulkBusy = false;
    }
  }

  async function saveCategory(category: AppCategory) {
    try {
      await api.put(`/sni-filter/categories/${encodeURIComponent(category.id)}`, category);
      toasts.success(`Category ${category.name} updated`);
      await loadData();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to update category');
    }
  }

  async function runTest() {
    if (!testDomain.trim()) {
      toasts.error($_('firewall_sni.toast_enter_a_domain_to_test'));
      return;
    }
    testing = true;
    try {
      testResult = await api.post<TestResult>('/sni-filter/test', { domain: testDomain.trim(), port: 443, protocol: 'tcp' });
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Pattern test failed');
    } finally {
      testing = false;
    }
  }

  function toggleSort(next: 'order' | 'name' | 'action') {
    if (sortBy === next) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else {
      sortBy = next;
      sortDir = 'asc';
    }
  }

  onMount(() => {
    beginCreate();
    void loadData();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-700 bg-slate-900">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-slate-100"><ShieldIcon class="size-4" /> SNI Filter Settings</CardTitle>
      <CardDescription class="text-slate-300">Control TLS ClientHello SNI enforcement without TLS decryption. QUIC blocking forces fallback to TCP/443 for SNI visibility.</CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-300">{$_('firewall_sni.loading_settings')}</p>
      {:else}
        <form class="grid gap-4 md:grid-cols-2" onsubmit={(event) => { event.preventDefault(); void saveSettings(); }}>
          <label class="space-y-1 text-sm text-slate-100"><FieldLabel label="Enabled" hint="Enable SNI-based policy evaluation for TLS ClientHello traffic." /><div class="flex h-10 items-center"><Switch checked={settings.enabled} onCheckedChange={(v) => (settings.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm text-slate-100"><FieldLabel label="Log Default" hint="Write log entries when no explicit rule matches." /><div class="flex h-10 items-center"><Switch checked={settings.log_default} onCheckedChange={(v) => (settings.log_default = v)} /></div></label>
          <label class="space-y-1 text-sm text-slate-100"><FieldLabel label="Default Action" hint="Action applied when no rules match." /><Select.Root type="single" value={settings.default_action} onValueChange={(v) => { if (v) settings.default_action = v as SniFilterAction; }}><Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{settings.default_action}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each actionOptions as option}<Select.Item class="cursor-pointer text-slate-100" value={option.value} label={option.label} />{/each}</Select.Content></Select.Root></label>
          <label class="space-y-1 text-sm text-slate-100"><FieldLabel label="QUIC Policy" hint="UDP/443 QUIC can bypass SNI visibility. Block to force TCP/TLS fallback." /><Select.Root type="single" value={settings.quic_policy} onValueChange={(v) => { if (v) settings.quic_policy = v as QuicSniPolicy; }}><Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{settings.quic_policy}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each policyOptions as option}<Select.Item class="cursor-pointer text-slate-100" value={option.value} label={option.label} />{/each}</Select.Content></Select.Root></label>
          <label class="space-y-1 text-sm text-slate-100 md:col-span-2"><FieldLabel label="ECH/ESNI Policy" hint="Behavior when encrypted ClientHello hides SNI." /><Select.Root type="single" value={settings.encrypted_sni_policy} onValueChange={(v) => { if (v) settings.encrypted_sni_policy = v as EncryptedSniPolicy; }}><Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{settings.encrypted_sni_policy}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each policyOptions as option}<Select.Item class="cursor-pointer text-slate-100" value={option.value} label={option.label} />{/each}</Select.Content></Select.Root></label>
          <div class="md:col-span-2"><Button type="submit" class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-500" disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save Global Settings'}</Button></div>
        </form>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-950">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('firewall_sni.rules')}</CardTitle>
      <CardDescription class="text-slate-300">Lower order executes first. Combine SNI with optional port/protocol filters for BYOD and guest segmentation.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <Input class="max-w-sm border-slate-700 bg-slate-900 text-slate-100" placeholder="Filter by name/pattern" value={filterText} oninput={(event) => (filterText = (event.currentTarget as HTMLInputElement).value)} />
        <Button class="cursor-pointer border-slate-700" variant="outline" disabled={bulkBusy || !selectedIds.length} onclick={() => void runBulk('enable')}>Enable</Button>
        <Button class="cursor-pointer border-slate-700" variant="outline" disabled={bulkBusy || !selectedIds.length} onclick={() => void runBulk('disable')}>Disable</Button>
        <Button class="cursor-pointer border-slate-700" variant="outline" disabled={bulkBusy || !selectedIds.length} onclick={() => void runBulk('delete')}><Trash2Icon class="mr-2 size-4" />Delete</Button>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-700">
        <Table>
          <TableHeader>
            <TableRow class="border-slate-700">
              <TableHead class="w-10 text-slate-300"><input type="checkbox" class="cursor-pointer" checked={displayedRules.length > 0 && selectedIds.length === displayedRules.length} onchange={(event) => { const checked = (event.currentTarget as HTMLInputElement).checked; selected = Object.fromEntries(displayedRules.map((rule) => [rule.id, checked])); }} /></TableHead>
              <TableHead class="cursor-pointer text-slate-300" onclick={() => toggleSort('order')}>{$_('firewall_sni.order')}</TableHead>
              <TableHead class="cursor-pointer text-slate-300" onclick={() => toggleSort('name')}>{$_('common.name')}</TableHead>
              <TableHead class="cursor-pointer text-slate-300" onclick={() => toggleSort('action')}>{$_('common.action')}</TableHead>
              <TableHead class="text-slate-300">{$_('firewall_sni.match')}</TableHead>
              <TableHead class="text-slate-300">{$_('firewall_sni.patterns')}</TableHead>
              <TableHead class="text-right text-slate-300">{$_('firewall_sni.ops')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each displayedRules as rule}
              <TableRow class="border-slate-800 bg-slate-950">
                <TableCell><input type="checkbox" class="cursor-pointer" checked={Boolean(selected[rule.id])} onchange={(event) => (selected = { ...selected, [rule.id]: (event.currentTarget as HTMLInputElement).checked })} /></TableCell>
                <TableCell class="text-slate-100">{rule.order}</TableCell>
                <TableCell class="text-slate-100">{rule.name}</TableCell>
                <TableCell><Badge class="bg-cyan-700 text-cyan-100">{rule.action}</Badge></TableCell>
                <TableCell class="text-slate-300">{rule.match_type}</TableCell>
                <TableCell class="max-w-[320px] truncate text-slate-300">{rule.sni_patterns.join(', ')}</TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-2">
                    <Button class="cursor-pointer border-slate-700" variant="outline" size="sm" onclick={() => beginEdit(rule)}><PencilIcon class="mr-1 size-4" />Edit</Button>
                    <Button class="cursor-pointer border-slate-700" variant="outline" size="sm" onclick={() => void deleteRule(rule.id)}><Trash2Icon class="mr-1 size-4" />Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{editRuleId ? 'Edit Rule' : 'Add Rule'}</CardTitle>
    </CardHeader>
    <CardContent>
      <form class="grid gap-4 md:grid-cols-2" onsubmit={(event) => { event.preventDefault(); void saveRule(); }}>
        <label class="space-y-1"><FieldLabel label="Name" hint="Short policy name for operations and logs." /><Input class="border-slate-700 bg-slate-950 text-slate-100" value={ruleForm.name} oninput={(event) => (ruleForm.name = (event.currentTarget as HTMLInputElement).value)} /></label>
        <label class="space-y-1"><FieldLabel label="Order" hint="Lower number means higher rule priority." /><Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(ruleForm.order)} oninput={(event) => (ruleForm.order = Number((event.currentTarget as HTMLInputElement).value || '100'))} /></label>
        <label class="space-y-1"><FieldLabel label="Action" hint="Allow, block, log, or redirect behavior." /><Select.Root type="single" value={ruleForm.action} onValueChange={(v) => { if (v) ruleForm.action = v as SniFilterAction; }}><Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{ruleForm.action}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each actionOptions as option}<Select.Item class="cursor-pointer text-slate-100" value={option.value} label={option.label} />{/each}</Select.Content></Select.Root></label>
        <label class="space-y-1"><FieldLabel label="Match Type" hint="Wildcard for patterns, exact for FQDN, regex for advanced matching, category for built-in IDs." /><Select.Root type="single" value={ruleForm.match_type} onValueChange={(v) => { if (v) ruleForm.match_type = v as SniMatchType; }}><Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{ruleForm.match_type}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each matchTypeOptions as option}<Select.Item class="cursor-pointer text-slate-100" value={option.value} label={option.label} />{/each}</Select.Content></Select.Root></label>
        <label class="space-y-1 md:col-span-2"><FieldLabel label="SNI Patterns" hint="One per line (for category match type, use category IDs like social-media)." /><Textarea class="min-h-28 border-slate-700 bg-slate-950 text-slate-100" value={patternsText} oninput={(event) => (patternsText = (event.currentTarget as HTMLTextAreaElement).value)} /></label>
        <label class="space-y-1"><FieldLabel label="Port Filter" hint="Comma-separated TCP/UDP ports, e.g. 443,8443." /><Input class="border-slate-700 bg-slate-950 text-slate-100" value={portsText} oninput={(event) => (portsText = (event.currentTarget as HTMLInputElement).value)} /></label>
        <label class="space-y-1"><FieldLabel label="Protocol Filter" hint="Comma-separated values, typically tcp,udp." /><Input class="border-slate-700 bg-slate-950 text-slate-100" value={protocolsText} oninput={(event) => (protocolsText = (event.currentTarget as HTMLInputElement).value)} /></label>
        <label class="space-y-1"><FieldLabel label="Schedule" hint="Optional schedule name for time-based enforcement." /><Input class="border-slate-700 bg-slate-950 text-slate-100" value={scheduleText} oninput={(event) => (scheduleText = (event.currentTarget as HTMLInputElement).value)} /></label>
        <label class="space-y-1"><FieldLabel label="Description" hint="Operational context for audits and troubleshooting." /><Input class="border-slate-700 bg-slate-950 text-slate-100" value={ruleForm.description} oninput={(event) => (ruleForm.description = (event.currentTarget as HTMLInputElement).value)} /></label>

        <div class="space-y-2 md:col-span-2">
          <FieldLabel label="Source Zones" hint="Restrict this rule to specific ingress zones." />
          <div class="flex flex-wrap items-center gap-2">
            <Select.Root type="single" value={zoneToAdd} onValueChange={(v) => { zoneToAdd = v ?? ''; }}>
              <Select.Trigger class="w-64 cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{zoneToAdd || 'Select zone'}</span></Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">{#each zones as zone}<Select.Item class="cursor-pointer text-slate-100" value={zone} label={zone} />{/each}</Select.Content>
            </Select.Root>
            <Button type="button" class="cursor-pointer border-slate-700" variant="outline" onclick={addZoneToRule}>{$_('firewall_sni.add_zone')}</Button>
            {#each ruleForm.source_zones as zone}
              <Badge class="cursor-pointer bg-slate-800 text-slate-100" onclick={() => removeZone(zone)}>{zone} x</Badge>
            {/each}
          </div>
        </div>

        <label class="space-y-1"><FieldLabel label="Enabled" hint="Enable or disable this rule without deleting it." /><div class="flex h-10 items-center"><Switch checked={ruleForm.enabled} onCheckedChange={(v) => (ruleForm.enabled = v)} /></div></label>
        <label class="space-y-1"><FieldLabel label="Log Matches" hint="Generate logs for matching traffic." /><div class="flex h-10 items-center"><Switch checked={ruleForm.log_matches} onCheckedChange={(v) => (ruleForm.log_matches = v)} /></div></label>

        <div class="md:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-500" disabled={savingRule}>{savingRule ? 'Saving...' : editRuleId ? 'Update Rule' : 'Create Rule'}</Button>
          <Button type="button" variant="outline" class="cursor-pointer border-slate-700" onclick={beginCreate}>{$_('common.reset')}</Button>
        </div>
      </form>
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-950">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('firewall_sni.application_categories')}</CardTitle>
      <CardDescription class="text-slate-300">Built-in category pattern packs for quick policy creation.</CardDescription>
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2">
      {#each categories as category, index}
        <div class="rounded-md border border-slate-700 bg-slate-900 p-4">
          <div class="mb-2 flex items-center justify-between">
            <div>
              <h3 class="font-semibold text-slate-100">{category.name}</h3>
              <p class="text-xs text-slate-400">{category.id}</p>
            </div>
            <Button class="cursor-pointer border-slate-700" variant="outline" size="sm" disabled={!category.editable} onclick={() => void saveCategory(category)}>Save</Button>
          </div>
          <p class="mb-3 text-sm text-slate-300">{category.description}</p>
          <Textarea class="min-h-28 border-slate-700 bg-slate-950 text-slate-100" disabled={!category.editable} value={category.sni_patterns.join('\n')} oninput={(event) => (categories[index].sni_patterns = (event.currentTarget as HTMLTextAreaElement).value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean))} />
        </div>
      {/each}
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-900">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-slate-100"><FlaskConicalIcon class="size-4" /> SNI Match Test</CardTitle>
      <CardDescription class="text-slate-300">Quickly check which rules match a domain and its effective action.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <Input class="max-w-sm border-slate-700 bg-slate-950 text-slate-100" placeholder="example.tiktok.com" value={testDomain} oninput={(event) => (testDomain = (event.currentTarget as HTMLInputElement).value)} />
        <Button class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-500" disabled={testing} onclick={() => void runTest()}>{testing ? 'Testing...' : 'Test Match'}</Button>
      </div>
      {#if testResult}
        <div class="rounded-md border border-slate-700 bg-slate-950 p-3">
          <p class="text-sm text-slate-200">Domain: <span class="text-cyan-300">{testResult.domain}</span></p>
          <p class="text-sm text-slate-200">Effective Action: <Badge class="bg-cyan-700 text-cyan-100">{testResult.effective_action}</Badge></p>
          <p class="mb-2 text-sm text-slate-200">Matched Rules: {testResult.matches.length}</p>
          {#each testResult.matches as match}
            <div class="mb-1 text-xs text-slate-300">#{match.order} {match.rule_name} -> {match.action} ({match.matched_pattern})</div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-950">
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle class="text-slate-100">{$_('firewall_sni.recent_match_logs')}</CardTitle>
        <Button class="cursor-pointer border-slate-700" variant="outline" size="sm" onclick={() => void loadData()}><RefreshCwIcon class="mr-1 size-4" />Refresh</Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto rounded-md border border-slate-700">
        <Table>
          <TableHeader>
            <TableRow class="border-slate-700">
              <TableHead class="text-slate-300">{$_('firewall_sni.timestamp')}</TableHead>
              <TableHead class="text-slate-300">{$_('firewall_sni.source_ip')}</TableHead>
              <TableHead class="text-slate-300">{$_('firewall_sni.sni')}</TableHead>
              <TableHead class="text-slate-300">{$_('firewall_sni.rule')}</TableHead>
              <TableHead class="text-slate-300">{$_('common.action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if logs.length === 0}
              <TableRow><TableCell colspan={5} class="text-center text-slate-400">No logs available</TableCell></TableRow>
            {:else}
              {#each logs as entry}
                <TableRow class="border-slate-800">
                  <TableCell class="text-slate-300">{entry.timestamp}</TableCell>
                  <TableCell class="text-slate-300">{entry.source_ip}</TableCell>
                  <TableCell class="text-slate-100">{entry.sni}</TableCell>
                  <TableCell class="text-slate-300">{entry.rule_name}</TableCell>
                  <TableCell><Badge class="bg-cyan-700 text-cyan-100">{entry.action}</Badge></TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
</div>
