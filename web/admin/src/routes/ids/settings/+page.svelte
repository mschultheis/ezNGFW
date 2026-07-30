<!-- Route view for `/ids/settings` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Badge } from '$lib/components/ui/badge';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import { _ } from '$lib/i18n';

  type SettingsModel = {
    enabled: boolean;
    mode: string;
    interfaces: string[];
    home_networks: string;
    rule_profiles: string[];
    eve_log: boolean;
    stream_memcap: number;
    max_pending_packets: number;
  };

  const modeOptions = [
    { label: 'IDS (alert only)', value: 'ids' },
    { label: 'IPS (inline block)', value: 'ips' }
  ];

  const ruleProfileOptions = [
    { label: 'Balanced', value: 'balanced' },
    { label: 'Security', value: 'security' },
    { label: 'Connectivity', value: 'connectivity' },
    { label: 'High confidence', value: 'high-confidence' },
    { label: 'Custom profile', value: 'custom' }
  ];

  const defaultModel = (): SettingsModel => ({
    enabled: false,
    mode: 'ids',
    interfaces: [],
    home_networks: '10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16',
    rule_profiles: ['balanced'],
    eve_log: true,
    stream_memcap: 64,
    max_pending_packets: 1024
  });

  let loading = $state(false);
  let saving = $state(false);

  let interfaceOptions = $state<{ label: string; value: string }[]>([]);
  let model = $state<SettingsModel>(defaultModel());

  let openDetection = $state(true);
  let openLogging = $state(true);
  let openPerformance = $state(true);

  function selectedValues(event: Event) {
    return Array.from((event.currentTarget as HTMLSelectElement).selectedOptions).map((option) => option.value);
  }

  async function loadInterfaces() {
    try {
      const payload = await api.get<unknown[]>('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      interfaceOptions = list
        .map((item) => {
          const row = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
          const value = String(row.name ?? row.id ?? item ?? '').trim();
          return { label: value, value };
        })
        .filter((item) => item.value.length > 0);
    } catch {
      interfaceOptions = [];
    }
  }

  async function loadSettings() {
    loading = true;
    try {
      const payload = await api.get<Record<string, unknown>>('/ids/settings');
      model = {
        enabled: Boolean(payload.enabled ?? false),
        mode: String(payload.mode ?? payload.ips_mode ?? 'ids'),
        interfaces: Array.isArray(payload.interfaces)
          ? payload.interfaces.map((item) => String(item))
          : String(payload.interfaces ?? '')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
        home_networks: Array.isArray(payload.home_networks)
          ? payload.home_networks.map((item) => String(item)).join('\n')
          : String(payload.home_networks ?? payload.home_net ?? model.home_networks),
        rule_profiles: Array.isArray(payload.rule_profiles)
          ? payload.rule_profiles.map((item) => String(item))
          : String(payload.rule_profiles ?? 'balanced')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
        eve_log: Boolean(payload.eve_log ?? payload.eve_log_enabled ?? true),
        stream_memcap: Number(payload.stream_memcap ?? 64),
        max_pending_packets: Number(payload.max_pending_packets ?? payload.max_pending_pkts ?? 1024)
      };
    } catch {
      try {
        const fallback = await api.get<Record<string, unknown>>('/suricata');
        model = {
          enabled: Boolean(fallback.enabled ?? false),
          mode: String(fallback.mode ?? fallback.ips_mode ?? 'ids'),
          interfaces: Array.isArray(fallback.interfaces)
            ? fallback.interfaces.map((item) => String(item))
            : String(fallback.interfaces ?? '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
          home_networks: Array.isArray(fallback.home_networks)
            ? fallback.home_networks.map((item) => String(item)).join('\n')
            : String(fallback.home_networks ?? fallback.home_net ?? model.home_networks),
          rule_profiles: Array.isArray(fallback.rule_profiles)
            ? fallback.rule_profiles.map((item) => String(item))
            : String(fallback.rule_profiles ?? 'balanced')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
          eve_log: Boolean(fallback.eve_log ?? fallback.eve_log_enabled ?? true),
          stream_memcap: Number(fallback.stream_memcap ?? 64),
          max_pending_packets: Number(fallback.max_pending_packets ?? fallback.max_pending_pkts ?? 1024)
        };
      } catch (error) {
        toasts.error(error instanceof Error ? error.message : 'Failed to load IDS settings');
      }
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      const payload = {
        enabled: model.enabled,
        mode: model.mode,
        interfaces: model.interfaces,
        home_networks: model.home_networks
          .split(/\n|,/) 
          .map((item) => item.trim())
          .filter(Boolean),
        rule_profiles: model.rule_profiles,
        eve_log: model.eve_log,
        stream_memcap: Number(model.stream_memcap),
        max_pending_packets: Number(model.max_pending_packets)
      };
      try {
        await api.patch('/ids/settings', payload);
      } catch {
        await api.patch('/suricata', payload);
      }
      toasts.success($_('ids_settings.toastids_settings_saved'));
      await loadSettings();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save IDS settings');
    } finally {
      saving = false;
    }
  }

  const selectedInterfaceCount = $derived.by(() => model.interfaces.length);
  const selectedProfileCount = $derived.by(() => model.rule_profiles.length);

  onMount(() => {
    void loadInterfaces();
    void loadSettings();
  });
</script>

<div class="space-y-6 p-4 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('ids_settings.idsips_settings')}</CardTitle><CardDescription class="text-slate-400">{$_('ids_settings.inline_ids_tuning_with_collapsible_detection_engin')}</CardDescription></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('ids_settings.engine')}</p><p class="text-lg text-slate-100">{model.enabled ? 'Enabled' : 'Disabled'}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('ids_settings.mode')}</p><p class="text-lg text-cyan-300">{model.mode.toUpperCase()}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('ids_settings.interfaces')}</p><p class="text-lg text-slate-100">{selectedInterfaceCount}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('ids_settings.rule_profiles')}</p><p class="text-lg text-slate-100">{selectedProfileCount}</p></div>
      </div>
      <Button variant="outline" class="border-slate-700 text-slate-100" onclick={() => void loadSettings()} disabled={loading}><RefreshCwIcon class="mr-2 h-4 w-4" />{loading ? 'Refreshing...' : 'Refresh settings'}</Button>
    </CardContent>
  </Card>

  <form class="space-y-6" onsubmit={(event) => { event.preventDefault(); void saveSettings(); }}>
    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader><CardTitle class="text-slate-100">{$_('ids_settings.core_settings')}</CardTitle></CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div class="space-y-2"><FieldLabel label="Enabled" hint="Master toggle for IDS/IPS processing." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={model.enabled} onCheckedChange={(checked) => { model.enabled = checked; model = { ...model }; }} /><span class="text-sm text-slate-300">{model.enabled ? 'Enabled' : 'Disabled'}</span></div></div>
        <div class="space-y-2"><FieldLabel label="Mode" hint="Choose IDS alert mode or IPS blocking mode." /><Select.Root type="single" value={model.mode} onValueChange={(value) => { if (value) { model.mode = value; model = { ...model }; } }}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{modeOptions.find((opt) => opt.value === model.mode)?.label ?? 'Select mode'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each modeOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-2"><FieldLabel label="EVE Log" hint="Enable JSON event stream output for SIEM integrations." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={model.eve_log} onCheckedChange={(checked) => { model.eve_log = checked; model = { ...model }; }} /><span class="text-sm text-slate-300">{model.eve_log ? 'Enabled' : 'Disabled'}</span></div></div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader><CardTitle class="text-slate-100">{$_('ids_settings.interface_and_profile_selection')}</CardTitle></CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2"><FieldLabel label="Interfaces" hint="Select monitored interfaces for IDS inspection." /><select class="cursor-pointer min-h-36 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" multiple value={model.interfaces} onchange={(event) => { model.interfaces = selectedValues(event); model = { ...model }; }}>{#each interfaceOptions as option}<option value={option.value}>{option.label}</option>{/each}</select></div>
        <div class="space-y-2"><FieldLabel label="Rule Profiles" hint="Choose one or more ruleset profile bundles." /><select class="cursor-pointer min-h-36 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" multiple value={model.rule_profiles} onchange={(event) => { model.rule_profiles = selectedValues(event); model = { ...model }; }}>{#each ruleProfileOptions as option}<option value={option.value}>{option.label}</option>{/each}</select></div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader><CardTitle class="text-slate-100">{$_('ids_settings.advanced_sections')}</CardTitle></CardHeader>
      <CardContent class="space-y-4">
        <Collapsible.Root open={openDetection} class="rounded-md border border-slate-800 bg-slate-950/50 p-4">
          <Collapsible.Trigger class="flex w-full items-center justify-between" onclick={() => (openDetection = !openDetection)}><span class="text-sm font-medium text-slate-100">{$_('ids_settings.detection_engine')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${openDetection ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
          <Collapsible.Content class="space-y-3 pt-4">
            <div class="space-y-2"><FieldLabel label="Home Networks" hint="Protected internal networks used for directional detection context." /><textarea class="min-h-36 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" value={model.home_networks} oninput={(event) => { model.home_networks = (event.currentTarget as HTMLTextAreaElement).value; model = { ...model }; }}></textarea></div>
          </Collapsible.Content>
        </Collapsible.Root>

        <Collapsible.Root open={openLogging} class="rounded-md border border-slate-800 bg-slate-950/50 p-4">
          <Collapsible.Trigger class="flex w-full items-center justify-between" onclick={() => (openLogging = !openLogging)}><span class="text-sm font-medium text-slate-100">{$_('ids_settings.logging')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${openLogging ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
          <Collapsible.Content class="space-y-3 pt-4">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2"><FieldLabel label="EVE Log" hint="Toggle event stream output for correlation systems." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={model.eve_log} onCheckedChange={(checked) => { model.eve_log = checked; model = { ...model }; }} /><span class="text-sm text-slate-300">{model.eve_log ? 'Enabled' : 'Disabled'}</span></div></div>
              <div class="space-y-2"><FieldLabel label="Rule Profiles" hint="Logging volume is impacted by profile aggressiveness." /><div class="flex h-10 items-center rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">{model.rule_profiles.join(', ') || 'none selected'}</div></div>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>

        <Collapsible.Root open={openPerformance} class="rounded-md border border-slate-800 bg-slate-950/50 p-4">
          <Collapsible.Trigger class="flex w-full items-center justify-between" onclick={() => (openPerformance = !openPerformance)}><span class="text-sm font-medium text-slate-100">{$_('ids_settings.performance')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${openPerformance ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
          <Collapsible.Content class="space-y-3 pt-4">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2"><FieldLabel label="Stream Memcap" hint="Memory cap in MB for stream engine state tracking." /><Input type="number" min="16" class="border-slate-700 bg-slate-950" value={model.stream_memcap} oninput={(event) => { model.stream_memcap = Number((event.currentTarget as HTMLInputElement).value || 0); model = { ...model }; }} /></div>
              <div class="space-y-2"><FieldLabel label="Max Pending Packets" hint="Maximum packet queue depth before processing drops." /><Input type="number" min="128" class="border-slate-700 bg-slate-950" value={model.max_pending_packets} oninput={(event) => { model.max_pending_packets = Number((event.currentTarget as HTMLInputElement).value || 0); model = { ...model }; }} /></div>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </CardContent>
    </Card>

    <div class="flex items-center justify-between">
      <Badge class="border-slate-600 bg-slate-800 text-slate-200">Interfaces {selectedInterfaceCount}</Badge>
      <Button class="bg-cyan-600 text-white hover:bg-cyan-500" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save IDS settings'}</Button>
    </div>
  </form>
</div>
