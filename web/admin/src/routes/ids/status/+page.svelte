<!-- Route view for `/ids/status` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import PowerIcon from '@lucide/svelte/icons/power';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
  import { _ } from '$lib/i18n';

  type SignatureStat = {
    signature: string;
    count: number;
    action: string;
    source: string;
    destination: string;
    category: string;
    severity: string;
    updatedAt: string;
  };

  type Override = {
    id: string;
    signature: string;
    action: string;
    expiresAt: string;
    scope: string;
    owner: string;
    notes: string;
    enabled: boolean;
    changeTicket: string;
    matchInterface: string;
    reasonCode: string;
  };

  type Option = {
    value: string;
    label: string;
  };

  const modeOptions: Option[] = [
    {
      label: 'IDS (Detect only)',
      value: 'ids'
    },
    {
      label: 'IPS (Detect + block)',
      value: 'ips'
    }
  ];

  const policyModeOptions: Option[] = [
    {
      value: 'balanced',
      label: 'Balanced'
    },
    {
      value: 'security',
      label: 'Security first'
    },
    {
      value: 'performance',
      label: 'Performance first'
    }
  ];

  const actionOptions: Option[] = [
    {
      value: 'alert',
      label: 'Alert only'
    },
    {
      value: 'drop',
      label: 'Drop'
    },
    {
      value: 'reject',
      label: 'Reject'
    },
    {
      value: 'pass',
      label: 'Pass'
    }
  ];

  const scopeOptions: Option[] = [
    {
      value: 'global',
      label: 'Global'
    },
    {
      value: 'interface',
      label: 'Interface'
    },
    {
      value: 'source',
      label: 'Source subnet'
    },
    {
      value: 'destination',
      label: 'Destination subnet'
    }
  ];

  const reasonCodeOptions: Option[] = [
    {
      value: 'false-positive',
      label: 'False positive'
    },
    {
      value: 'maintenance',
      label: 'Maintenance window'
    },
    {
      value: 'vendor-bug',
      label: 'Vendor rule issue'
    },
    {
      value: 'exception',
      label: 'Business exception'
    }
  ];

  let loading = $state(true);
  let restarting = $state(false);
  let savingProfile = $state(false);
  let savingOverride = $state(false);
  let interfaceOptions = $state<{label: string; value: string}[]>([]);

  let autoRefresh = $state(true);
  let showAdvanced = $state(false);
  let showOverrideAdvanced = $state(false);
  let refreshSeconds = $state(20);
  let lastError = $state('');
  let searchSignatures = $state('');
  let signatureSort = $state<'count' | 'signature' | 'severity'>('count');
  let signatureDirection = $state<'asc' | 'desc'>('desc');
  let overrideSearch = $state('');
  let overrideFilter = $state('all');
  let editingOverrideId = $state<string | null>(null);

  let service = $state({
    active: false,
    mode: 'ids',
    rulesetVersion: '',
    lastUpdate: '',
    alertCount: 0,
    interface: 'lan',
    inspectionThreads: 2,
    streamMemcapMb: 128,
    maxPendingPackets: 4096,
    policyMode: 'balanced',
    dropInlineOnly: true,
    promiscuousMode: false,
    homeNet: '192.168.1.0/24',
    externalNet: 'any',
    eveLogEnabled: true,
    eveOutputs: 'alert,http,dns,tls,flow',
    retentionDays: 14,
    autoRuleUpdate: true,
    updateWindow: '03:00',
    notifyEmail: '',
    changeTicketPrefix: 'SEC-CHG'
  });

  let stats = $state({
    inspectedPackets: 0,
    droppedPackets: 0,
    tcpSessions: 0,
    memUseMb: 0,
    cpuPercent: 0,
    rulesLoaded: 0
  });

  let topSignatures = $state<SignatureStat[]>([]);
  let overrides = $state<Override[]>([]);
  let overrideDraft = $state<Override>({
    id: '',
    signature: '',
    action: 'alert',
    expiresAt: '',
    scope: 'global',
    owner: '',
    notes: '',
    enabled: true,
    changeTicket: '',
    matchInterface: 'lan',
    reasonCode: 'false-positive'
  });

  function resetOverrideDraft(): void {
    overrideDraft = {
      id: '',
      signature: '',
      action: 'alert',
      expiresAt: '',
      scope: 'global',
      owner: '',
      notes: '',
      enabled: true,
      changeTicket: '',
      matchInterface: 'lan',
      reasonCode: 'false-positive'
    };
    editingOverrideId = null;
  }

  function asText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) {
      return fallback;
    }
    return String(value);
  }

  function asBool(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return fallback;
  }

  function asNum(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeOverride(raw: unknown): Override {
    const row = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    return {
      id: asText(row.id || row.uuid || crypto.randomUUID()),
      signature: asText(row.signature),
      action: asText(row.action, 'alert'),
      expiresAt: asText(row.expiresAt),
      scope: asText(row.scope, 'global'),
      owner: asText(row.owner),
      notes: asText(row.notes),
      enabled: asBool(row.enabled, true),
      changeTicket: asText(row.changeTicket),
      matchInterface: asText(row.matchInterface, 'lan'),
      reasonCode: asText(row.reasonCode, 'false-positive')
    };
  }

  const profileErrors = $derived.by(() => {
    const errors: Record<string, string> = {};

    if (refreshSeconds < 5 || refreshSeconds > 900) {
      errors.refreshSeconds = 'Refresh interval must be between 5 and 900 seconds.';
    }

    if (service.inspectionThreads < 1 || service.inspectionThreads > 64) {
      errors.inspectionThreads = 'Inspection threads must be between 1 and 64.';
    }

    if (service.streamMemcapMb < 64 || service.streamMemcapMb > 8192) {
      errors.streamMemcapMb = 'Stream memcap must be between 64 and 8192 MB.';
    }

    if (service.maxPendingPackets < 512 || service.maxPendingPackets > 1000000) {
      errors.maxPendingPackets = 'Pending packet queue must be between 512 and 1,000,000.';
    }

    if (service.retentionDays < 1 || service.retentionDays > 365) {
      errors.retentionDays = 'Retention must be between 1 and 365 days.';
    }

    if (service.notifyEmail && !service.notifyEmail.includes('@')) {
      errors.notifyEmail = 'Notification email must look like a valid mailbox address.';
    }

    if (!service.interface.trim()) {
      errors.interface = 'Protected interface is required.';
    }

    if (!service.homeNet.trim()) {
      errors.homeNet = 'HOME_NET cannot be empty.';
    }

    if (!service.externalNet.trim()) {
      errors.externalNet = 'EXTERNAL_NET cannot be empty.';
    }

    return errors;
  });

  const overrideErrors = $derived.by(() => {
    const errors: Record<string, string> = {};

    if (!overrideDraft.signature.trim()) {
      errors.signature = 'Signature identifier is required.';
    }

    if (!overrideDraft.owner.trim()) {
      errors.owner = 'Owner is required for accountability.';
    }

    if (!overrideDraft.changeTicket.trim()) {
      errors.changeTicket = 'Change ticket is required for override traceability.';
    }

    if (overrideDraft.expiresAt && Number.isNaN(Date.parse(overrideDraft.expiresAt))) {
      errors.expiresAt = 'Expiration must be a valid date or ISO timestamp.';
    }

    if (overrideDraft.notes.trim().length < 15) {
      errors.notes = 'Notes should contain at least 15 characters with clear rationale.';
    }

    return errors;
  });

  const profileErrorList = $derived.by(() => Object.values(profileErrors));
  const overrideErrorList = $derived.by(() => Object.values(overrideErrors));

  const canSaveProfile = $derived.by(() => profileErrorList.length === 0 && !savingProfile);
  const canSaveOverride = $derived.by(() => overrideErrorList.length === 0 && !savingOverride);

  const sortedSignatures = $derived.by(() => {
    const needle = searchSignatures.trim().toLowerCase();
    const filtered = topSignatures.filter((row) => {
      if (!needle) return true;
      return [row.signature, row.source, row.destination, row.category, row.severity]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    const direction = signatureDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (signatureSort === 'count') {
        return direction * (a.count - b.count);
      }
      if (signatureSort === 'severity') {
        return direction * a.severity.localeCompare(b.severity);
      }
      return direction * a.signature.localeCompare(b.signature);
    });
  });

  const filteredOverrides = $derived.by(() => {
    const needle = overrideSearch.trim().toLowerCase();
    return overrides.filter((row) => {
      if (overrideFilter !== 'all') {
        const enabled = overrideFilter === 'enabled';
        if (row.enabled !== enabled) {
          return false;
        }
      }
      if (!needle) {
        return true;
      }
      return [row.signature, row.owner, row.scope, row.reasonCode, row.notes, row.changeTicket]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  });

  const overrideEnabledCount = $derived.by(() => overrides.filter((row) => row.enabled).length);
  const overrideDisabledCount = $derived.by(() => overrides.length - overrideEnabledCount);

  async function load(): Promise<void> {
    loading = true;
    lastError = '';

    try {
      const [statusPayload, statsPayload] = await Promise.all([
        api.get('/ids/service-status'),
        api.get('/ids/stats')
      ]);

      const status = statusPayload as Record<string, unknown>;
      const statsPayloadObj = statsPayload as Record<string, unknown>;

      service = {
        active: asBool(status.active),
        mode: asText(status.mode, 'ids'),
        rulesetVersion: asText(status.rulesetVersion, 'unknown'),
        lastUpdate: asText(status.lastUpdate),
        alertCount: asNum(statsPayloadObj.alertCount),
        interface: asText(status.interface, 'lan'),
        inspectionThreads: asNum(status.inspectionThreads, 2),
        streamMemcapMb: asNum(status.streamMemcapMb, 128),
        maxPendingPackets: asNum(status.maxPendingPackets, 4096),
        policyMode: asText(status.policyMode, 'balanced'),
        dropInlineOnly: asBool(status.dropInlineOnly, true),
        promiscuousMode: asBool(status.promiscuousMode, false),
        homeNet: asText(status.homeNet, '192.168.1.0/24'),
        externalNet: asText(status.externalNet, 'any'),
        eveLogEnabled: asBool(status.eveLogEnabled, true),
        eveOutputs: asText(status.eveOutputs, 'alert,http,dns,tls,flow'),
        retentionDays: asNum(status.retentionDays, 14),
        autoRuleUpdate: asBool(status.autoRuleUpdate, true),
        updateWindow: asText(status.updateWindow, '03:00'),
        notifyEmail: asText(status.notifyEmail),
        changeTicketPrefix: asText(status.changeTicketPrefix, 'SEC-CHG')
      };

      stats = {
        inspectedPackets: asNum(statsPayloadObj.inspectedPackets),
        droppedPackets: asNum(statsPayloadObj.droppedPackets),
        tcpSessions: asNum(statsPayloadObj.tcpSessions),
        memUseMb: asNum(statsPayloadObj.memUseMb),
        cpuPercent: asNum(statsPayloadObj.cpuPercent),
        rulesLoaded: asNum(statsPayloadObj.rulesLoaded)
      };

      const sig = Array.isArray(statsPayloadObj.topSignatures) ? statsPayloadObj.topSignatures : [];
      topSignatures = sig.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          signature: asText(item.signature, 'unknown'),
          count: asNum(item.count),
          action: asText(item.action, 'alert'),
          source: asText(item.source, 'any'),
          destination: asText(item.destination, 'any'),
          category: asText(item.category, 'misc'),
          severity: asText(item.severity, 'medium'),
          updatedAt: asText(item.updatedAt, service.lastUpdate)
        };
      });

      const rawOverrides = Array.isArray(status.overrides) ? status.overrides : [];
      overrides = rawOverrides.map((row) => normalizeOverride(row));
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Failed to load IDS status';
      toasts.error(lastError);
    } finally {
      loading = false;
    }
  }

  async function saveProfile(): Promise<void> {
    if (!canSaveProfile) {
      toasts.error($_('ids_status.toastresolve_profile_validation_errors_before_savi'));
      return;
    }

    savingProfile = true;
    try {
      await api.put('/ids/service-status', {
        ...service,
        overrides
      });
      toasts.success($_('ids_status.toastids_profile_updated'));
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save IDS profile');
    } finally {
      savingProfile = false;
    }
  }

  async function saveOverride(): Promise<void> {
    if (!canSaveOverride) {
      toasts.error($_('ids_status.toastresolve_override_validation_errors_before_sav'));
      return;
    }

    savingOverride = true;
    try {
      const model = {
        ...overrideDraft,
        id: editingOverrideId ?? crypto.randomUUID()
      };

      if (editingOverrideId) {
        overrides = overrides.map((row) => (row.id === editingOverrideId ? model : row));
      } else {
        overrides = [model, ...overrides];
      }

      await api.put('/ids/service-status', {
        ...service,
        overrides
      });

      toasts.success(editingOverrideId ? 'Override updated' : 'Override added');
      resetOverrideDraft();
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save override');
    } finally {
      savingOverride = false;
    }
  }

  function editOverride(row: Override): void {
    overrideDraft = { ...row };
    editingOverrideId = row.id;
  }

  async function deleteOverride(id: string): Promise<void> {
    savingOverride = true;
    try {
      overrides = overrides.filter((row) => row.id !== id);
      await api.put('/ids/service-status', {
        ...service,
        overrides
      });
      toasts.success($_('ids_status.toastoverride_deleted'));
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to delete override');
    } finally {
      savingOverride = false;
    }
  }

  async function restart(): Promise<void> {
    restarting = true;
    try {
      await api.post('/ids/restart', {});
      toasts.success($_('ids_status.toastids_restart_requested'));
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to restart IDS');
    } finally {
      restarting = false;
    }
  }

  onMount(() => {
    void load();
    api.get('/interfaces').then((payload: unknown) => {
      try {
        if (Array.isArray(payload)) {
          interfaceOptions = payload.map((iface: Record<string, unknown>) => {
            const name = String(iface.name || iface.interface || iface.id || '');
            return { label: name || 'unknown', value: name || 'unknown' };
          });
        } else if (payload && typeof payload === 'object') {
          interfaceOptions = Object.entries(payload as Record<string, unknown>).map(([key, val]) => {
            const label = (val && typeof val === 'object' && 'description' in val) ? String((val as Record<string, unknown>).description) : key;
            return { label: label || key, value: key };
          });
        }
      } catch { interfaceOptions = []; }
    }).catch(() => { interfaceOptions = []; });
  });

  $effect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void load();
    }, Math.max(5, refreshSeconds) * 1000);
    return () => clearInterval(interval);
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-925 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-slate-100">
        <ShieldIcon class="h-4 w-4 text-cyan-400" />
        IDS/IPS Runtime Status
      </CardTitle>
      <CardDescription class="text-slate-400">{$_('ids_status.service_health_throughput_indicators_and_modespeci')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <p class="text-sm text-slate-400">{$_('ids_status.loading_ids_service_status')}</p>
      {:else}
        <div class="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('ids_status.service')}</p><p class={service.active ? 'text-emerald-300 text-sm' : 'text-rose-300 text-sm'}>{service.active ? 'Active' : 'Inactive'}</p></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('ids_status.mode')}</p><p class="text-sm text-slate-100">{service.mode.toUpperCase()}</p></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('ids_status.ruleset')}</p><p class="truncate text-sm text-slate-100">{service.rulesetVersion}</p></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('ids_status.alerts')}</p><p class="text-sm text-slate-100">{service.alertCount}</p></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('ids_status.inspected')}</p><p class="text-sm text-slate-100">{stats.inspectedPackets}</p></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('ids_status.dropped')}</p><p class="text-sm text-slate-100">{stats.droppedPackets}</p></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">CPU</p><p class="text-sm text-slate-100">{stats.cpuPercent}%</p></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('ids_status.memory')}</p><p class="text-sm text-slate-100">{stats.memUseMb} MB</p></div>
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('ids_status.service_profile')}</CardTitle></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="space-y-2">
          <FieldLabel label="Active" hint="Controls whether IDS/IPS engine is running and inspecting packets. Keep disabled during planned maintenance to avoid half-applied policy states while signatures update." />
          <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={service.active} onCheckedChange={(v) => (service.active = v)} /><span class="text-sm text-slate-300">{service.active ? 'Inspecting traffic' : 'Not inspecting traffic'}</span></div>
        </div>
        <div class="space-y-2">
          <FieldLabel label="Inspection Mode" hint="IDS mode alerts only and is safer for early tuning. IPS mode enforces drops and should be enabled after verifying false-positive rates against production traffic profiles." />
          <Select.Root type="single" value={service.mode} onValueChange={(v) => { if (v) service.mode = v; }}>
            <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100"><span>{modeOptions.find((o) => o.value === service.mode)?.label ?? 'Select mode'}</span></Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900">{#each modeOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}</Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-2">
          <FieldLabel label="Policy Mode" hint="Balanced mode keeps broad protection while limiting disruption. Security-first raises detection strictness and performance-first reduces expensive checks on constrained hardware." />
          <Select.Root type="single" value={service.policyMode} onValueChange={(v) => { if (v) service.policyMode = v; }}>
            <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100"><span>{policyModeOptions.find((o) => o.value === service.policyMode)?.label ?? 'Select policy mode'}</span></Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900">{#each policyModeOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}</Select.Content>
          </Select.Root>
        </div>

        <div class="space-y-2"><FieldLabel label="Protected Interface" hint="Interface where packets are inspected against active signatures. Keep this aligned with real traffic ingress points such as WAN or exposed DMZ interfaces." /><select class="cursor-pointer h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={service.interface}><option value="">— Select interface —</option>{#each interfaceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>{#if profileErrors.interface}<p class="text-xs text-red-300">{profileErrors.interface}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="Inspection Threads" hint="Number of parallel detection threads processing packets. Increase gradually and validate CPU saturation to avoid context switching overhead on small appliances." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={service.inspectionThreads} min={1} max={64} />{#if profileErrors.inspectionThreads}<p class="text-xs text-red-300">{profileErrors.inspectionThreads}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="Stream Memcap (MB)" hint="Memory reserved for flow and stream tracking internals. Higher values support bursty workloads but should remain within platform memory budget." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={service.streamMemcapMb} min={64} max={8192} />{#if profileErrors.streamMemcapMb}<p class="text-xs text-red-300">{profileErrors.streamMemcapMb}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="Max Pending Packets" hint="Queue depth for packets waiting on inspection. Too low causes drops under spikes and too high can increase latency during sustained overload." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={service.maxPendingPackets} min={512} max={1000000} />{#if profileErrors.maxPendingPackets}<p class="text-xs text-red-300">{profileErrors.maxPendingPackets}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="HOME_NET" hint="Defines trusted/internal address ranges used by many signatures. Keep this accurate so internal traffic is classified correctly and false positives stay manageable." /><Input class="border-slate-700 bg-slate-900" bind:value={service.homeNet} />{#if profileErrors.homeNet}<p class="text-xs text-red-300">{profileErrors.homeNet}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="EXTERNAL_NET" hint="Defines external source set for policy logic; often any or negated home net. Use clear values to avoid inverting direction-sensitive signature behavior." /><Input class="border-slate-700 bg-slate-900" bind:value={service.externalNet} />{#if profileErrors.externalNet}<p class="text-xs text-red-300">{profileErrors.externalNet}</p>{/if}</div>
        <div class="space-y-2 md:col-span-2"><FieldLabel label="EVE Outputs" hint="Comma-separated event channels that control log stream richness. Include only channels consumed by your SIEM pipeline to avoid unnecessary storage overhead." /><Input class="border-slate-700 bg-slate-900" bind:value={service.eveOutputs} /></div>
        <div class="space-y-2"><FieldLabel label="Refresh Interval" hint="Polling interval for this page status and tables. Use short intervals for incident response and conservative intervals for daily monitoring." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={refreshSeconds} min={5} max={900} />{#if profileErrors.refreshSeconds}<p class="text-xs text-red-300">{profileErrors.refreshSeconds}</p>{/if}</div>
        <div class="space-y-2 md:col-span-2"><FieldLabel label="Auto Refresh" hint="Automatically reloads status and signature counters using the selected interval. Keep this enabled during active investigations so trend shifts are visible immediately." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={autoRefresh} onCheckedChange={(v) => (autoRefresh = v)} /><span class="text-sm text-slate-300">{autoRefresh ? 'Polling enabled' : 'Polling disabled'}</span></div></div>
      </div>

      <Collapsible.Root bind:open={showAdvanced} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
        <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left"><span class="text-sm font-medium text-slate-200">{$_('ids_status.advanced_service_tuning')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
        <Collapsible.Content class="grid gap-4 pt-3 md:grid-cols-2">
          <div class="space-y-2"><FieldLabel label="Drop Inline Only" hint="When enabled, drop actions are applied only in IPS mode to prevent unexpected enforcement while in passive detect workflows. This reduces accidental disruption during staged rollouts." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={service.dropInlineOnly} onCheckedChange={(v) => (service.dropInlineOnly = v)} /><span class="text-sm text-slate-300">{service.dropInlineOnly ? 'Inline-safe mode' : 'Apply drops in all modes'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Promiscuous Mode" hint="Allows interface capture beyond host-directed packets on capable drivers. Enable only when required because it increases packet volume and processing demand." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={service.promiscuousMode} onCheckedChange={(v) => (service.promiscuousMode = v)} /><span class="text-sm text-slate-300">{service.promiscuousMode ? 'Promiscuous capture enabled' : 'Standard capture only'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="EVE Log Enabled" hint="Master switch for JSON event logging. Disable only for emergency performance triage because most investigations depend on this telemetry stream." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={service.eveLogEnabled} onCheckedChange={(v) => (service.eveLogEnabled = v)} /><span class="text-sm text-slate-300">{service.eveLogEnabled ? 'Telemetry enabled' : 'Telemetry disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Retention Days" hint="Retention target for local alert metadata used by operators. Keep enough history for trend analysis while balancing disk usage and compliance boundaries." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={service.retentionDays} min={1} max={365} />{#if profileErrors.retentionDays}<p class="text-xs text-red-300">{profileErrors.retentionDays}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="Automatic Ruleset Updates" hint="Enables scheduled retrieval of signature updates from configured feeds. Keep enabled in most environments and pair with a controlled update window for stability." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={service.autoRuleUpdate} onCheckedChange={(v) => (service.autoRuleUpdate = v)} /><span class="text-sm text-slate-300">{service.autoRuleUpdate ? 'Scheduled updates enabled' : 'Manual update workflow'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Update Window" hint="Preferred clock time for pulling and applying new signatures. Choose periods with low traffic and available operator coverage to manage tuning aftermath." /><Input class="border-slate-700 bg-slate-900" bind:value={service.updateWindow} placeholder="03:00" /></div>
          <div class="space-y-2"><FieldLabel label="Notification Email" hint="Address used for update failures and critical daemon health alerts. Use a team mailbox rather than a personal account so ownership survives rotations." /><Input class="border-slate-700 bg-slate-900" bind:value={service.notifyEmail} placeholder="soc@example.org" />{#if profileErrors.notifyEmail}<p class="text-xs text-red-300">{profileErrors.notifyEmail}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="Change Ticket Prefix" hint="Prefix used by runbook automation when generating related change references. Consistent prefixes simplify SIEM and governance correlation across tooling." /><Input class="border-slate-700 bg-slate-900" bind:value={service.changeTicketPrefix} /></div>
        </Collapsible.Content>
      </Collapsible.Root>

      {#if profileErrorList.length > 0}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"><div class="mb-2 flex items-center gap-2"><AlertTriangleIcon class="h-4 w-4" /><span>{$_('ids_status.resolve_profile_validation_issues_before_saving')}</span></div><ul class="space-y-1 text-xs text-red-100">{#each profileErrorList as err}<li>{err}</li>{/each}</ul></div>
      {:else}
        <div class="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"><div class="flex items-center gap-2"><CheckCircle2Icon class="h-4 w-4" />Profile validation passed.</div></div>
      {/if}

      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={() => void saveProfile()} disabled={!canSaveProfile}>Save Profile</Button>
        <Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => void load()}><RefreshCwIcon class="mr-2 h-4 w-4" />Refresh</Button>
        <Button variant="outline" class="border-amber-500/40 text-amber-200 hover:bg-amber-500/10" onclick={() => void restart()} disabled={restarting}><PowerIcon class="mr-2 h-4 w-4" />{restarting ? 'Restarting...' : 'Restart IDS'}</Button>
      </div>

      {#if lastError}<div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{lastError}</div>{/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('ids_status.signature_activity')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('ids_status.search_sort_and_inspect_recent_top_signatures_befo')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-3 md:grid-cols-4">
        <Input class="border-slate-700 bg-slate-900" value={searchSignatures} placeholder={$_('ids_status.placeholdersearch_signature_source_destination_cat')} oninput={(event) => (searchSignatures = (event.currentTarget as HTMLInputElement).value)} />
        <Select.Root type="single" value={signatureSort} onValueChange={(v) => { if (v === 'count' || v === 'signature' || v === 'severity') signatureSort = v; }}>
          <Select.Trigger class="w-full border-slate-700 bg-slate-900 text-slate-100"><span>{signatureSort === 'count' ? 'Sort by Count' : signatureSort === 'severity' ? 'Sort by Severity' : 'Sort by Signature'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900"><Select.Item value="count" label="Sort by Count" class="cursor-pointer text-slate-200 hover:bg-slate-800" /><Select.Item value="severity" label="Sort by Severity" class="cursor-pointer text-slate-200 hover:bg-slate-800" /><Select.Item value="signature" label="Sort by Signature" class="cursor-pointer text-slate-200 hover:bg-slate-800" /></Select.Content>
        </Select.Root>
        <Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => (signatureDirection = signatureDirection === 'asc' ? 'desc' : 'asc')}>Direction: {signatureDirection === 'asc' ? 'Ascending' : 'Descending'}</Button>
        <Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => void load()}><RefreshCwIcon class="mr-2 h-4 w-4" />Refresh Signatures</Button>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400"><tr><th class="px-3 py-2 text-left">Signature</th><th class="px-3 py-2 text-left">Count</th><th class="px-3 py-2 text-left">Action</th><th class="px-3 py-2 text-left">Source</th><th class="px-3 py-2 text-left">Destination</th><th class="px-3 py-2 text-left">Category</th><th class="px-3 py-2 text-left">Severity</th><th class="px-3 py-2 text-left">Updated</th></tr></thead>
          <tbody>
            {#if sortedSignatures.length === 0}
              <tr><td colspan={8} class="px-3 py-6 text-center text-slate-500">No signature events match current filters.</td></tr>
            {:else}
              {#each sortedSignatures as sig}
                <tr class="border-t border-slate-800/80 text-slate-200"><td class="px-3 py-2 text-xs">{sig.signature}</td><td class="px-3 py-2 text-xs text-cyan-300">{sig.count}</td><td class="px-3 py-2 text-xs">{sig.action}</td><td class="px-3 py-2 text-xs">{sig.source}</td><td class="px-3 py-2 text-xs">{sig.destination}</td><td class="px-3 py-2 text-xs">{sig.category}</td><td class="px-3 py-2 text-xs">{sig.severity}</td><td class="px-3 py-2 text-xs">{sig.updatedAt}</td></tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('ids_status.inline_signature_overrides')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('ids_status.create_temporary_or_permanent_policy_exceptions_wi')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" value={overrideSearch} placeholder={$_('ids_status.placeholdersearch_overrides')} oninput={(event) => (overrideSearch = (event.currentTarget as HTMLInputElement).value)} />
        <Select.Root type="single" value={overrideFilter} onValueChange={(v) => { if (v) overrideFilter = v; }}>
          <Select.Trigger class="w-full border-slate-700 bg-slate-900 text-slate-100"><span>{overrideFilter === 'all' ? 'All overrides' : overrideFilter === 'enabled' ? 'Enabled only' : 'Disabled only'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900"><Select.Item value="all" label="All overrides" class="cursor-pointer text-slate-200 hover:bg-slate-800" /><Select.Item value="enabled" label="Enabled only" class="cursor-pointer text-slate-200 hover:bg-slate-800" /><Select.Item value="disabled" label="Disabled only" class="cursor-pointer text-slate-200 hover:bg-slate-800" /></Select.Content>
        </Select.Root>
        <div class="rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">Enabled: <span class="text-emerald-300">{overrideEnabledCount}</span> | Disabled: <span class="text-amber-300">{overrideDisabledCount}</span></div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="space-y-2"><FieldLabel label="Signature Identifier" hint="Enter a precise signature or SID reference to avoid broad policy impact. When possible, copy from live signature activity rows to reduce typing mistakes." /><Input class="border-slate-700 bg-slate-900" bind:value={overrideDraft.signature} />{#if overrideErrors.signature}<p class="text-xs text-red-300">{overrideErrors.signature}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="Action" hint="Choose alert, drop, reject, or pass behavior for this override. Use pass only for tightly scoped false positives with explicit ownership and expiration." /><Select.Root type="single" value={overrideDraft.action} onValueChange={(v) => { if (v) overrideDraft.action = v; }}><Select.Trigger class="w-full border-slate-700 bg-slate-900 text-slate-100"><span>{actionOptions.find((o) => o.value === overrideDraft.action)?.label ?? 'Select action'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each actionOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-2"><FieldLabel label="Scope" hint="Controls where the override applies, from global to narrowed selectors. Prefer narrow scopes for safety and easier rollback when traffic patterns change." /><Select.Root type="single" value={overrideDraft.scope} onValueChange={(v) => { if (v) overrideDraft.scope = v; }}><Select.Trigger class="w-full border-slate-700 bg-slate-900 text-slate-100"><span>{scopeOptions.find((o) => o.value === overrideDraft.scope)?.label ?? 'Select scope'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each scopeOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-2"><FieldLabel label="Expiration" hint="Set an expiration timestamp for temporary exceptions so stale overrides retire automatically. Leave empty only for long-term approved policy adjustments." /><Input class="border-slate-700 bg-slate-900" bind:value={overrideDraft.expiresAt} placeholder="2026-03-03T22:00:00Z" />{#if overrideErrors.expiresAt}<p class="text-xs text-red-300">{overrideErrors.expiresAt}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="Owner" hint="Team or individual accountable for this override and its periodic review. Clear ownership reduces lingering exceptions and speeds incident communication." /><Input class="border-slate-700 bg-slate-900" bind:value={overrideDraft.owner} placeholder="soc-oncall" />{#if overrideErrors.owner}<p class="text-xs text-red-300">{overrideErrors.owner}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="Change Ticket" hint="Reference a formal ticket for auditability and rollback planning. This field is required so every exception has documented authorization context." /><Input class="border-slate-700 bg-slate-900" bind:value={overrideDraft.changeTicket} placeholder={$_('ids_status.placeholdersecchg2044')} />{#if overrideErrors.changeTicket}<p class="text-xs text-red-300">{overrideErrors.changeTicket}</p>{/if}</div>
      </div>

      <Collapsible.Root bind:open={showOverrideAdvanced} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
        <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left"><span class="text-sm font-medium text-slate-200">{$_('ids_status.advanced_override_fields')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showOverrideAdvanced ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
        <Collapsible.Content class="grid gap-4 pt-3 md:grid-cols-2">
          <div class="space-y-2"><FieldLabel label="Enabled" hint="Allows pre-staging overrides before activation. Disable first when testing changed criteria or waiting on review approvals." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={overrideDraft.enabled} onCheckedChange={(v) => (overrideDraft.enabled = v)} /><span class="text-sm text-slate-300">{overrideDraft.enabled ? 'Override active' : 'Override staged only'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Match Interface" hint="Optional interface scoping to reduce policy exposure on multi-segment deployments. Use explicit interface names to avoid ambiguous behavior." /><select class="cursor-pointer h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={overrideDraft.matchInterface}><option value="">— Any interface —</option>{#each interfaceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="space-y-2"><FieldLabel label="Reason Code" hint="Standardized reason helps reporting and periodic exception reviews. Pick the closest category to preserve data quality in governance dashboards." /><Select.Root type="single" value={overrideDraft.reasonCode} onValueChange={(v) => { if (v) overrideDraft.reasonCode = v; }}><Select.Trigger class="w-full border-slate-700 bg-slate-900 text-slate-100"><span>{reasonCodeOptions.find((o) => o.value === overrideDraft.reasonCode)?.label ?? 'Select reason'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each reasonCodeOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
          <div class="space-y-2 md:col-span-2"><FieldLabel label="Notes" hint="Explain why this override exists, what traffic it impacts, and how to safely roll it back. High-quality notes prevent repeated investigations and accidental long-term drift." /><Textarea class="min-h-28 border-slate-700 bg-slate-900" bind:value={overrideDraft.notes} />{#if overrideErrors.notes}<p class="text-xs text-red-300">{overrideErrors.notes}</p>{/if}</div>
        </Collapsible.Content>
      </Collapsible.Root>

      {#if overrideErrorList.length > 0}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"><div class="mb-2 flex items-center gap-2"><AlertTriangleIcon class="h-4 w-4" /><span>{$_('ids_status.resolve_override_validation_issues_before_saving')}</span></div><ul class="space-y-1 text-xs text-red-100">{#each overrideErrorList as err}<li>{err}</li>{/each}</ul></div>
      {/if}

      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={() => void saveOverride()} disabled={!canSaveOverride}><PlusIcon class="mr-2 h-4 w-4" />{editingOverrideId ? 'Update Override' : 'Add Override'}</Button>
        <Button variant="outline" class="border-slate-700 text-slate-200" onclick={resetOverrideDraft}>Cancel Edit</Button>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm"><thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400"><tr><th class="px-3 py-2 text-left">Signature</th><th class="px-3 py-2 text-left">Action</th><th class="px-3 py-2 text-left">Scope</th><th class="px-3 py-2 text-left">Owner</th><th class="px-3 py-2 text-left">Ticket</th><th class="px-3 py-2 text-left">Expires</th><th class="px-3 py-2 text-left">Reason</th><th class="px-3 py-2 text-left">State</th><th class="px-3 py-2 text-left">Actions</th></tr></thead>
          <tbody>
            {#if filteredOverrides.length === 0}
              <tr><td colspan={9} class="px-3 py-6 text-center text-slate-500">No overrides match current filters.</td></tr>
            {:else}
              {#each filteredOverrides as row}
                <tr class="border-t border-slate-800/80 text-slate-200"><td class="px-3 py-2 text-xs">{row.signature}</td><td class="px-3 py-2 text-xs">{row.action}</td><td class="px-3 py-2 text-xs">{row.scope}</td><td class="px-3 py-2 text-xs">{row.owner}</td><td class="px-3 py-2 text-xs">{row.changeTicket}</td><td class="px-3 py-2 text-xs">{row.expiresAt || '-'}</td><td class="px-3 py-2 text-xs">{row.reasonCode}</td><td class="px-3 py-2 text-xs"><span class={row.enabled ? 'text-emerald-300' : 'text-amber-300'}>{row.enabled ? 'Enabled' : 'Disabled'}</span></td><td class="px-3 py-2"><div class="flex gap-2"><Button size="sm" variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => editOverride(row)}><PencilIcon class="h-3.5 w-3.5" /></Button><Button size="sm" variant="outline" class="border-red-500/50 text-red-300 hover:bg-red-950/40" onclick={() => void deleteOverride(row.id)}><Trash2Icon class="h-3.5 w-3.5" /></Button></div></td></tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</div>
