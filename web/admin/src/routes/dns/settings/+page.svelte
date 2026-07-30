<!-- Route view for `/dns/settings` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asObject } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import ServiceBadge from '$lib/components/admin/ServiceBadge.svelte';
  import StatsGrid from '$lib/components/admin/StatsGrid.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SaveIcon from '@lucide/svelte/icons/save';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';

  import { _ } from '$lib/i18n';
  type DnsSettings = {
    enabled: boolean;
    listenInterface: string;
    listenPort: string;
    upstreamResolvers: string;
    cacheSizeMb: string;
    dnssecValidation: boolean;
    blocklistsEnabled: boolean;
    dotEnabled: boolean;
    dotPort: string;
    dohEnabled: boolean;
    dohUrlPath: string;
    rebindAttackProtection: boolean;
    rebindAllowedDomains: string;
    ednsClientSubnet: string;
    queryRateLimitQps: string;
    queryLogging: boolean;
    privateDomains: string;
    blocklistUrls: string;
    hardenBelowNxdomain: boolean;
    minimalResponses: boolean;
    serveExpiredRecords: boolean;
    prefetchSupport: boolean;
    hideIdentity: boolean;
    hideVersion: boolean;
    aggressiveNsec: boolean;
    rrsetRoundRobin: boolean;
    maxNegativeTtl: string;
    infraCacheMinRtt: string;
    outgoingRange: string;
    outgoingNumTcp: string;
    msgCacheSlabs: string;
    rrsetCacheSlabs: string;
    operatorContact: string;
    changeTicketPrefix: string;
  };

  type ForwardZone = {
    id: string;
    enabled: boolean;
    domain: string;
    targetResolvers: string;
    tlsName: string;
    tlsPort: string;
    policy: string;
    owner: string;
    priority: number;
    description: string;
    tags: string;
    lastReviewedAt: string;
    changeTicket: string;
  };

  type Option = {
    value: string;
    label: string;
  };

  const defaultSettings: DnsSettings = {
    enabled: true,
    listenInterface: '',
    listenPort: '53',
    upstreamResolvers: '',
    cacheSizeMb: '128',
    dnssecValidation: false,
    blocklistsEnabled: false,
    dotEnabled: false,
    dotPort: '853',
    dohEnabled: false,
    dohUrlPath: '/dns-query',
    rebindAttackProtection: true,
    rebindAllowedDomains: '',
    ednsClientSubnet: '',
    queryRateLimitQps: '0',
    queryLogging: false,
    privateDomains: '',
    blocklistUrls: '',
    hardenBelowNxdomain: true,
    minimalResponses: true,
    serveExpiredRecords: false,
    prefetchSupport: true,
    hideIdentity: true,
    hideVersion: true,
    aggressiveNsec: true,
    rrsetRoundRobin: true,
    maxNegativeTtl: '60',
    infraCacheMinRtt: '50',
    outgoingRange: '8192',
    outgoingNumTcp: '100',
    msgCacheSlabs: '4',
    rrsetCacheSlabs: '4',
    operatorContact: '',
    changeTicketPrefix: 'DNS-CHG'
  };

  const policyOptions: Option[] = [
    { value: 'forward-only', label: 'Forward only' },
    { value: 'forward-first', label: 'Forward first' },
    { value: 'stub', label: 'Stub zone' }
  ];

  let interfaceOptions = $state<{ label: string; value: string }[]>([]);

  let loadingSettings = $state(true);
  let savingSettings = $state(false);
  let settingsError = $state('');
  let settings = $state<DnsSettings>({ ...defaultSettings });

  let statsLoading = $state(false);
  let stats = $state<Record<string, unknown>>({});
  let flushing = $state(false);

  let statusLoading = $state(false);
  let serviceStatus = $state('unknown');
  let serviceUptime = $state('-');

  let showAdvancedResolver = $state(false);
  let showAdvancedZone = $state(false);

  let zones = $state<ForwardZone[]>([]);
  let zoneDraft = $state<ForwardZone>({
    id: '',
    enabled: true,
    domain: '',
    targetResolvers: '',
    tlsName: '',
    tlsPort: '853',
    policy: 'forward-only',
    owner: '',
    priority: 100,
    description: '',
    tags: '',
    lastReviewedAt: '',
    changeTicket: ''
  });

  let editingZoneId = $state<string | null>(null);
  let zoneSearch = $state('');
  let zoneStatusFilter = $state('all');
  let zoneSort = $state<'domain' | 'priority' | 'owner'>('priority');
  let zoneSortDirection = $state<'asc' | 'desc'>('asc');

  function resetZoneDraft(): void {
    zoneDraft = {
      id: '',
      enabled: true,
      domain: '',
      targetResolvers: '',
      tlsName: '',
      tlsPort: '853',
      policy: 'forward-only',
      owner: '',
      priority: 100,
      description: '',
      tags: '',
      lastReviewedAt: '',
      changeTicket: ''
    };
    editingZoneId = null;
  }

  function asText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  function asBool(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value !== 0;
    return fallback;
  }

  function asNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeZone(raw: unknown): ForwardZone {
    const row = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    return {
      id: asText(row.id || row.uuid || crypto.randomUUID()),
      enabled: asBool(row.enabled, true),
      domain: asText(row.domain),
      targetResolvers: asText(row.targetResolvers),
      tlsName: asText(row.tlsName),
      tlsPort: asText(row.tlsPort, '853'),
      policy: asText(row.policy, 'forward-only'),
      owner: asText(row.owner),
      priority: asNumber(row.priority, 100),
      description: asText(row.description),
      tags: asText(row.tags),
      lastReviewedAt: asText(row.lastReviewedAt),
      changeTicket: asText(row.changeTicket)
    };
  }

  const settingsErrors = $derived.by(() => {
    const errors: Record<string, string> = {};

    const listenPort = Number(settings.listenPort || 0);
    if (!Number.isFinite(listenPort) || listenPort < 1 || listenPort > 65535) {
      errors.listenPort = 'Listen port must be between 1 and 65535.';
    }

    const dotPort = Number(settings.dotPort || 0);
    if (!Number.isFinite(dotPort) || dotPort < 1 || dotPort > 65535) {
      errors.dotPort = 'DoT port must be between 1 and 65535.';
    }

    const cacheSize = Number(settings.cacheSizeMb || 0);
    if (!Number.isFinite(cacheSize) || cacheSize < 16 || cacheSize > 65536) {
      errors.cacheSizeMb = 'Cache size must be between 16 and 65536 MB.';
    }

    const qps = Number(settings.queryRateLimitQps || 0);
    if (!Number.isFinite(qps) || qps < 0 || qps > 100000) {
      errors.queryRateLimitQps = 'QPS limit must be between 0 and 100000.';
    }

    const maxNegativeTtl = Number(settings.maxNegativeTtl || 0);
    if (!Number.isFinite(maxNegativeTtl) || maxNegativeTtl < 0 || maxNegativeTtl > 86400) {
      errors.maxNegativeTtl = 'Max negative TTL must be between 0 and 86400 seconds.';
    }

    const infraCacheMinRtt = Number(settings.infraCacheMinRtt || 0);
    if (!Number.isFinite(infraCacheMinRtt) || infraCacheMinRtt < 0 || infraCacheMinRtt > 10000) {
      errors.infraCacheMinRtt = 'Infrastructure minimum RTT must be between 0 and 10000 ms.';
    }

    if (settings.operatorContact && !settings.operatorContact.includes('@')) {
      errors.operatorContact = 'Operator contact should be a mailbox or address containing @.';
    }

    if (settings.dohEnabled && !settings.dohUrlPath.trim().startsWith('/')) {
      errors.dohUrlPath = 'DoH URL path should start with /.';
    }

    return errors;
  });

  const zoneErrors = $derived.by(() => {
    const errors: Record<string, string> = {};

    if (!zoneDraft.domain.trim()) {
      errors.domain = 'Domain is required.';
    }

    if (!zoneDraft.targetResolvers.trim()) {
      errors.targetResolvers = 'Target resolvers are required.';
    }

    if (!zoneDraft.owner.trim()) {
      errors.owner = 'Owner team is required.';
    }

    if (!zoneDraft.changeTicket.trim()) {
      errors.changeTicket = 'Change ticket is required.';
    }

    if (zoneDraft.description.trim().length < 15) {
      errors.description = 'Description should include at least 15 characters of context.';
    }

    const priority = Number(zoneDraft.priority || 0);
    if (!Number.isFinite(priority) || priority < 1 || priority > 1000) {
      errors.priority = 'Priority must be between 1 and 1000.';
    }

    const tlsPort = Number(zoneDraft.tlsPort || 0);
    if (!Number.isFinite(tlsPort) || tlsPort < 1 || tlsPort > 65535) {
      errors.tlsPort = 'TLS port must be between 1 and 65535.';
    }

    return errors;
  });

  const settingsErrorList = $derived.by(() => Object.values(settingsErrors));
  const zoneErrorList = $derived.by(() => Object.values(zoneErrors));

  const canSaveSettings = $derived.by(() => settingsErrorList.length === 0 && !savingSettings);
  const canSaveZone = $derived.by(() => zoneErrorList.length === 0 && !savingSettings);

  const filteredZones = $derived.by(() => {
    const needle = zoneSearch.trim().toLowerCase();

    const filtered = zones.filter((row) => {
      if (zoneStatusFilter !== 'all') {
        const enabled = zoneStatusFilter === 'enabled';
        if (row.enabled !== enabled) return false;
      }
      if (!needle) return true;
      return [row.domain, row.targetResolvers, row.owner, row.tags, row.changeTicket]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    const direction = zoneSortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (zoneSort === 'priority') {
        return direction * (a.priority - b.priority);
      }
      if (zoneSort === 'owner') {
        return direction * a.owner.localeCompare(b.owner);
      }
      return direction * a.domain.localeCompare(b.domain);
    });
  });

  const zoneEnabledCount = $derived.by(() => zones.filter((row) => row.enabled).length);
  const zoneDisabledCount = $derived.by(() => zones.length - zoneEnabledCount);

  async function loadSettings(): Promise<void> {
    loadingSettings = true;
    settingsError = '';
    try {
      const payload = asObject(await api.get('/dns'));
      settings = {
        enabled: asBool(payload.enabled, defaultSettings.enabled),
        listenInterface: asText(payload.listenInterface),
        listenPort: asText(payload.listenPort, defaultSettings.listenPort),
        upstreamResolvers: asText(payload.upstreamResolvers),
        cacheSizeMb: asText(payload.cacheSizeMb, defaultSettings.cacheSizeMb),
        dnssecValidation: asBool(payload.dnssecValidation),
        blocklistsEnabled: asBool(payload.blocklistsEnabled),
        dotEnabled: asBool(payload.dotEnabled),
        dotPort: asText(payload.dotPort, defaultSettings.dotPort),
        dohEnabled: asBool(payload.dohEnabled),
        dohUrlPath: asText(payload.dohUrlPath, defaultSettings.dohUrlPath),
        rebindAttackProtection: asBool(payload.rebindAttackProtection, defaultSettings.rebindAttackProtection),
        rebindAllowedDomains: asText(payload.rebindAllowedDomains),
        ednsClientSubnet: asText(payload.ednsClientSubnet),
        queryRateLimitQps: asText(payload.queryRateLimitQps, defaultSettings.queryRateLimitQps),
        queryLogging: asBool(payload.queryLogging),
        privateDomains: asText(payload.privateDomains),
        blocklistUrls: asText(payload.blocklistUrls),
        hardenBelowNxdomain: asBool(payload.hardenBelowNxdomain, defaultSettings.hardenBelowNxdomain),
        minimalResponses: asBool(payload.minimalResponses, defaultSettings.minimalResponses),
        serveExpiredRecords: asBool(payload.serveExpiredRecords),
        prefetchSupport: asBool(payload.prefetchSupport, defaultSettings.prefetchSupport),
        hideIdentity: asBool(payload.hideIdentity, defaultSettings.hideIdentity),
        hideVersion: asBool(payload.hideVersion, defaultSettings.hideVersion),
        aggressiveNsec: asBool(payload.aggressiveNsec, defaultSettings.aggressiveNsec),
        rrsetRoundRobin: asBool(payload.rrsetRoundRobin, defaultSettings.rrsetRoundRobin),
        maxNegativeTtl: asText(payload.maxNegativeTtl, defaultSettings.maxNegativeTtl),
        infraCacheMinRtt: asText(payload.infraCacheMinRtt, defaultSettings.infraCacheMinRtt),
        outgoingRange: asText(payload.outgoingRange, defaultSettings.outgoingRange),
        outgoingNumTcp: asText(payload.outgoingNumTcp, defaultSettings.outgoingNumTcp),
        msgCacheSlabs: asText(payload.msgCacheSlabs, defaultSettings.msgCacheSlabs),
        rrsetCacheSlabs: asText(payload.rrsetCacheSlabs, defaultSettings.rrsetCacheSlabs),
        operatorContact: asText(payload.operatorContact),
        changeTicketPrefix: asText(payload.changeTicketPrefix, defaultSettings.changeTicketPrefix)
      };

      const rawZones = Array.isArray(payload.forwardZones) ? payload.forwardZones : [];
      zones = rawZones.map((row) => normalizeZone(row));
    } catch (e) {
      settings = { ...defaultSettings };
      zones = [];
      settingsError = e instanceof Error ? e.message : 'Unable to load DNS settings';
    } finally {
      loadingSettings = false;
    }
  }

  async function saveSettings(): Promise<void> {
    if (!canSaveSettings) {
      toasts.error($_('dns_settings.toast_resolve_settings_validation_issues_before_saving'));
      return;
    }

    savingSettings = true;
    try {
      await api.patch('/dns', {
        ...settings,
        listenPort: Number(settings.listenPort || 53),
        cacheSizeMb: Number(settings.cacheSizeMb || 0),
        dotPort: Number(settings.dotPort || 853),
        queryRateLimitQps: Number(settings.queryRateLimitQps || 0),
        maxNegativeTtl: Number(settings.maxNegativeTtl || 0),
        infraCacheMinRtt: Number(settings.infraCacheMinRtt || 0),
        outgoingRange: Number(settings.outgoingRange || 0),
        outgoingNumTcp: Number(settings.outgoingNumTcp || 0),
        msgCacheSlabs: Number(settings.msgCacheSlabs || 0),
        rrsetCacheSlabs: Number(settings.rrsetCacheSlabs || 0),
        forwardZones: zones
      });
      toasts.success($_('dns_settings.toast_dns_settings_saved'));
      await loadSettings();
      await Promise.all([loadStats(), loadServiceStatus()]);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save DNS settings');
    } finally {
      savingSettings = false;
    }
  }

  async function saveZone(): Promise<void> {
    if (!canSaveZone) {
      toasts.error($_('dns_settings.toast_resolve_zone_validation_issues_before_saving'));
      return;
    }

    const model: ForwardZone = {
      ...zoneDraft,
      id: editingZoneId ?? crypto.randomUUID()
    };

    if (editingZoneId) {
      zones = zones.map((row) => (row.id === editingZoneId ? model : row));
    } else {
      zones = [model, ...zones];
    }

    await saveSettings();
    resetZoneDraft();
  }

  function editZone(zone: ForwardZone): void {
    zoneDraft = { ...zone };
    editingZoneId = zone.id;
  }

  async function deleteZone(id: string): Promise<void> {
    zones = zones.filter((row) => row.id !== id);
    await saveSettings();
  }

  async function loadStats(): Promise<void> {
    statsLoading = true;
    try {
      stats = asObject(await api.get('/dns/stats'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load DNS statistics');
      stats = {};
    } finally {
      statsLoading = false;
    }
  }

  async function flushCache(): Promise<void> {
    flushing = true;
    try {
      await api.post('/dns/cache/flush');
      toasts.success($_('dns_settings.toast_dns_cache_flushed'));
      await loadStats();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Cache flush failed');
    } finally {
      flushing = false;
    }
  }

  async function loadServiceStatus(): Promise<void> {
    statusLoading = true;
    try {
      const payload = asObject(await api.get('/dns/service-status'));
      serviceStatus = asText(payload.status, 'unknown');
      serviceUptime = asText(payload.uptime, '-');
    } catch (e) {
      serviceStatus = 'unknown';
      serviceUptime = '-';
      toasts.error(e instanceof Error ? e.message : 'Failed to load DNS service status');
    } finally {
      statusLoading = false;
    }
  }


  /** Fetch available network interfaces for dropdown population. */
  async function loadInterfaces(): Promise<void> {
    try {
      const payload = await api.get('/interfaces');
      if (Array.isArray(payload)) {
        interfaceOptions = (payload as unknown[]).map((iface: unknown) => {
          const obj = typeof iface === 'object' && iface !== null ? (iface as Record<string, unknown>) : {};
          const name = String(obj.name || obj.interface || obj.id || '');
          const desc = String(obj.description || obj.alias || '');
          return { label: desc ? `${name} (${desc})` : name, value: name };
        }).filter((o) => o.value);
      } else if (typeof payload === 'object' && payload !== null) {
        interfaceOptions = Object.entries(payload as Record<string, unknown>).map(([key, val]) => {
          const desc = typeof val === 'object' && val !== null ? String((val as Record<string, unknown>).description || '') : '';
          return { label: desc ? `${key} (${desc})` : key, value: key };
        });
      }
    } catch {
      interfaceOptions = [];
    }
  }

  onMount(() => {
    void loadInterfaces();
    void loadSettings();
    void loadStats();
    void loadServiceStatus();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-925 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('dns_settings.dns_resolver_settings')}</CardTitle>
          <CardDescription class="text-slate-400">Unbound resolver configuration with deep operational controls and inline forwarding zone workflows.</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => { void loadSettings(); void loadStats(); void loadServiceStatus(); }}>
            <RefreshCwIcon class="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={() => void saveSettings()} disabled={!canSaveSettings}>
            <SaveIcon class="mr-2 h-4 w-4" />{savingSettings ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('dns_settings.service')}</p>{#if statusLoading}<p class="text-sm text-slate-500">{$_('common.loading')}</p>{:else}<ServiceBadge status={serviceStatus} />{/if}</div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('dns_settings.uptime')}</p><p class="text-sm text-slate-100">{serviceUptime}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('dns_settings.forward_zones')}</p><p class="text-sm text-slate-100">{zones.length}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p class="text-xs text-slate-400">{$_('dns_settings.zone_state')}</p><p class="text-sm text-slate-100"><span class="text-emerald-300">{zoneEnabledCount}</span> enabled / <span class="text-amber-300">{zoneDisabledCount}</span> disabled</p></div>
      </div>

      {#if loadingSettings}
        <p class="text-sm text-slate-400">{$_('dns_settings.loading_dns_settings')}</p>
      {:else}
        {#if settingsError}
          <p class="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{settingsError}</p>
        {/if}

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div class="space-y-2"><FieldLabel label="Enabled" hint="Turn DNS resolver on or off. Disabling stops local DNS service for clients and can impact every dependent network segment." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.enabled} onCheckedChange={(checked) => (settings.enabled = checked)} /><span class="text-xs text-slate-300">{settings.enabled ? 'Resolver active' : 'Resolver disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Listen Interface" hint="Interface where Unbound listens for queries. Restricting interfaces can reduce exposure on transit and untrusted segments." /><select class="cursor-pointer h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={settings.listenInterface}><option value="">— All interfaces —</option>{#each interfaceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="space-y-2"><FieldLabel label="Listen Port" hint="DNS listener port, typically 53. Change only when co-hosting services require alternate ports." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.listenPort} />{#if settingsErrors.listenPort}<p class="text-xs text-red-300">{settingsErrors.listenPort}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="Upstream Resolvers" hint="Comma-separated resolver list for forwarding behavior. Keep entries reachable and trusted to avoid outage amplification." /><Input class="border-slate-700 bg-slate-900" bind:value={settings.upstreamResolvers} placeholder="1.1.1.1,9.9.9.9" /></div>
          <div class="space-y-2"><FieldLabel label="Cache Size MB" hint="Memory budget for resolver cache. Larger caches improve hit rate but should fit safely within system RAM constraints." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.cacheSizeMb} />{#if settingsErrors.cacheSizeMb}<p class="text-xs text-red-300">{settingsErrors.cacheSizeMb}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="DNSSEC Validation" hint="Enables DNSSEC chain validation for authenticity checks. Keep enabled unless troubleshooting known-bad authoritative domains." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.dnssecValidation} onCheckedChange={(checked) => (settings.dnssecValidation = checked)} /><span class="text-xs text-slate-300">{settings.dnssecValidation ? 'Validation active' : 'Validation disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Blocklists Enabled" hint="Activates DNS-based threat blocking feeds. Validate false-positive rates and maintain exception workflows for critical SaaS dependencies." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.blocklistsEnabled} onCheckedChange={(checked) => (settings.blocklistsEnabled = checked)} /><span class="text-xs text-slate-300">{settings.blocklistsEnabled ? 'Blocklists active' : 'Blocklists disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="DoT Enabled" hint="Encrypts upstream DNS with TLS. Use with trusted resolvers and verify certificate names when enforcing strict privacy profiles." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.dotEnabled} onCheckedChange={(checked) => (settings.dotEnabled = checked)} /><span class="text-xs text-slate-300">{settings.dotEnabled ? 'DoT active' : 'DoT disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="DoT Port" hint="TLS resolver port, usually 853. Keep aligned with provider documentation to prevent silent forwarding failures." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.dotPort} />{#if settingsErrors.dotPort}<p class="text-xs text-red-300">{settingsErrors.dotPort}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="DoH Enabled" hint="Uses HTTPS upstream DNS transport. Useful where TLS DNS is blocked but should be paired with strict endpoint trust controls." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.dohEnabled} onCheckedChange={(checked) => (settings.dohEnabled = checked)} /><span class="text-xs text-slate-300">{settings.dohEnabled ? 'DoH active' : 'DoH disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="DoH URL Path" hint="Path component used by DoH upstream endpoints. Most providers use /dns-query but verify against your selected resolver." /><Input class="border-slate-700 bg-slate-900" bind:value={settings.dohUrlPath} />{#if settingsErrors.dohUrlPath}<p class="text-xs text-red-300">{settingsErrors.dohUrlPath}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="Rebind Attack Protection" hint="Blocks responses that map public names into private ranges. Keep enabled unless split-DNS needs explicit exceptions." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.rebindAttackProtection} onCheckedChange={(checked) => (settings.rebindAttackProtection = checked)} /><span class="text-xs text-slate-300">{settings.rebindAttackProtection ? 'Protection active' : 'Protection disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Rebind Allowed Domains" hint="Comma-separated domain exemptions for legitimate internal mappings. Keep this list short and reviewed to avoid abuse." /><Input class="border-slate-700 bg-slate-900" bind:value={settings.rebindAllowedDomains} /></div>
          <div class="space-y-2"><FieldLabel label="EDNS Client Subnet" hint="Forward limited client subnet context upstream for geo-optimized responses. This may reduce privacy and should follow policy guidance." /><Input class="border-slate-700 bg-slate-900" bind:value={settings.ednsClientSubnet} /></div>
          <div class="space-y-2"><FieldLabel label="Query Rate Limit QPS" hint="Caps response rate under high query floods. Tune conservatively to avoid throttling legitimate burst traffic." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.queryRateLimitQps} />{#if settingsErrors.queryRateLimitQps}<p class="text-xs text-red-300">{settingsErrors.queryRateLimitQps}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="Query Logging" hint="Stores query logs for troubleshooting and incident reconstruction. Disable in privacy-sensitive environments where logging is restricted." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.queryLogging} onCheckedChange={(checked) => (settings.queryLogging = checked)} /><span class="text-xs text-slate-300">{settings.queryLogging ? 'Logging enabled' : 'Logging disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Private Domains" hint="Domains treated as private/local and not leaked to public recursion. Keep internal suffixes here for cleaner split-horizon behavior." /><Input class="border-slate-700 bg-slate-900" bind:value={settings.privateDomains} /></div>
          <div class="space-y-2 md:col-span-3"><FieldLabel label="Blocklist URLs" hint="One feed URL per line for threat domain ingestion. Monitor source quality because poor feeds can increase false positives and latency." /><Textarea class="min-h-24 border-slate-700 bg-slate-900" bind:value={settings.blocklistUrls} /></div>
        </div>

        <Collapsible.Root bind:open={showAdvancedResolver} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left"><span class="text-sm font-medium text-slate-200">{$_('dns_settings.advanced_resolver_controls')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showAdvancedResolver ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
          <Collapsible.Content class="grid gap-4 pt-3 md:grid-cols-2 lg:grid-cols-3">
            <div class="space-y-2"><FieldLabel label="Harden Below NXDOMAIN" hint="Returns NXDOMAIN for descendants of non-existent names. This limits wildcard abuse and improves deterministic negative caching behavior." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.hardenBelowNxdomain} onCheckedChange={(checked) => (settings.hardenBelowNxdomain = checked)} /><span class="text-xs text-slate-300">{settings.hardenBelowNxdomain ? 'Enabled' : 'Disabled'}</span></div></div>
            <div class="space-y-2"><FieldLabel label="Minimal Responses" hint="Serves only required records to reduce packet size and amplification risk. Keep enabled unless legacy clients require additional sections." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.minimalResponses} onCheckedChange={(checked) => (settings.minimalResponses = checked)} /><span class="text-xs text-slate-300">{settings.minimalResponses ? 'Enabled' : 'Disabled'}</span></div></div>
            <div class="space-y-2"><FieldLabel label="Serve Expired Records" hint="Respond from expired cache when upstream paths fail. Improves resiliency at the cost of potentially stale DNS data." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.serveExpiredRecords} onCheckedChange={(checked) => (settings.serveExpiredRecords = checked)} /><span class="text-xs text-slate-300">{settings.serveExpiredRecords ? 'Enabled' : 'Disabled'}</span></div></div>
            <div class="space-y-2"><FieldLabel label="Prefetch Support" hint="Proactively refreshes popular cache entries before expiry. This can smooth latency for frequent domains under steady query rates." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.prefetchSupport} onCheckedChange={(checked) => (settings.prefetchSupport = checked)} /><span class="text-xs text-slate-300">{settings.prefetchSupport ? 'Enabled' : 'Disabled'}</span></div></div>
            <div class="space-y-2"><FieldLabel label="Hide Identity" hint="Suppresses resolver hostname in CHAOS class responses. Keep enabled to reduce passive fingerprinting surface." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.hideIdentity} onCheckedChange={(checked) => (settings.hideIdentity = checked)} /><span class="text-xs text-slate-300">{settings.hideIdentity ? 'Enabled' : 'Disabled'}</span></div></div>
            <div class="space-y-2"><FieldLabel label="Hide Version" hint="Suppresses resolver version disclosure in diagnostic replies. Useful for reducing opportunistic exploit targeting based on version strings." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.hideVersion} onCheckedChange={(checked) => (settings.hideVersion = checked)} /><span class="text-xs text-slate-300">{settings.hideVersion ? 'Enabled' : 'Disabled'}</span></div></div>
            <div class="space-y-2"><FieldLabel label="Aggressive NSEC" hint="Uses DNSSEC denial proofs aggressively to reduce recursive load. Works best with validated zones and stable DNSSEC chains." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.aggressiveNsec} onCheckedChange={(checked) => (settings.aggressiveNsec = checked)} /><span class="text-xs text-slate-300">{settings.aggressiveNsec ? 'Enabled' : 'Disabled'}</span></div></div>
            <div class="space-y-2"><FieldLabel label="RRset Round Robin" hint="Shuffles answer order across equivalent records for simple load distribution. Disable only when deterministic order is operationally required." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={settings.rrsetRoundRobin} onCheckedChange={(checked) => (settings.rrsetRoundRobin = checked)} /><span class="text-xs text-slate-300">{settings.rrsetRoundRobin ? 'Enabled' : 'Disabled'}</span></div></div>
            <div class="space-y-2"><FieldLabel label="Max Negative TTL" hint="Maximum TTL applied to negative cache entries. Lower values improve correction speed; higher values reduce repeated failed lookups." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.maxNegativeTtl} />{#if settingsErrors.maxNegativeTtl}<p class="text-xs text-red-300">{settingsErrors.maxNegativeTtl}</p>{/if}</div>
            <div class="space-y-2"><FieldLabel label="Infra Cache Min RTT" hint="Minimum response time floor in infrastructure cache calculations. Helps smooth erratic RTT estimates in unstable upstream paths." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.infraCacheMinRtt} />{#if settingsErrors.infraCacheMinRtt}<p class="text-xs text-red-300">{settingsErrors.infraCacheMinRtt}</p>{/if}</div>
            <div class="space-y-2"><FieldLabel label="Outgoing Range" hint="Number of simultaneous outgoing ports available for recursion. Higher values reduce port reuse under heavy load but consume more resources." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.outgoingRange} /></div>
            <div class="space-y-2"><FieldLabel label="Outgoing TCP" hint="Maximum concurrent outgoing TCP queries for large or truncated responses. Tune carefully in DNSSEC-heavy environments with frequent TCP fallback." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.outgoingNumTcp} /></div>
            <div class="space-y-2"><FieldLabel label="Message Cache Slabs" hint="Shard count for message cache structures. Keep powers of two for predictable lock distribution under concurrency." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.msgCacheSlabs} /></div>
            <div class="space-y-2"><FieldLabel label="RRset Cache Slabs" hint="Shard count for RRset cache internals. Align with CPU topology to improve cache lock behavior at peak load." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.rrsetCacheSlabs} /></div>
            <div class="space-y-2"><FieldLabel label="Operator Contact" hint="Mailbox for DNS-specific escalations and maintenance notices. Keep this current so alerts reach on-duty responders without delay." /><Input class="border-slate-700 bg-slate-900" bind:value={settings.operatorContact} placeholder="dns-ops@example.org" />{#if settingsErrors.operatorContact}<p class="text-xs text-red-300">{settingsErrors.operatorContact}</p>{/if}</div>
            <div class="space-y-2"><FieldLabel label="Change Ticket Prefix" hint="Prefix used when recording DNS changes in governance systems. Consistent prefixes improve report joins across platforms." /><Input class="border-slate-700 bg-slate-900" bind:value={settings.changeTicketPrefix} /></div>
          </Collapsible.Content>
        </Collapsible.Root>

        {#if settingsErrorList.length > 0}
          <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"><div class="mb-2 flex items-center gap-2"><AlertTriangleIcon class="h-4 w-4" /><span>Resolve DNS settings validation errors before saving.</span></div><ul class="space-y-1 text-xs text-red-100">{#each settingsErrorList as err}<li>{err}</li>{/each}</ul></div>
        {:else}
          <div class="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"><div class="flex items-center gap-2"><CheckCircle2Icon class="h-4 w-4" />DNS settings validation passed.</div></div>
        {/if}
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('dns_settings.dns_forward_zones')}</CardTitle>
      <CardDescription class="text-slate-400">Create, filter, and sort forwarding zones directly in-page with full metadata capture.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <Input class="border-slate-700 bg-slate-900" value={zoneSearch} placeholder="Search zones" oninput={(event) => (zoneSearch = (event.currentTarget as HTMLInputElement).value)} />
        <Select.Root type="single" value={zoneStatusFilter} onValueChange={(v) => { if (v) zoneStatusFilter = v; }}><Select.Trigger class="w-full border-slate-700 bg-slate-900 text-slate-100"><span>{zoneStatusFilter === 'all' ? 'All zones' : zoneStatusFilter === 'enabled' ? 'Enabled only' : 'Disabled only'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900"><Select.Item value="all" label="All zones" class="cursor-pointer text-slate-200 hover:bg-slate-800" /><Select.Item value="enabled" label="Enabled only" class="cursor-pointer text-slate-200 hover:bg-slate-800" /><Select.Item value="disabled" label="Disabled only" class="cursor-pointer text-slate-200 hover:bg-slate-800" /></Select.Content></Select.Root>
        <Select.Root type="single" value={zoneSort} onValueChange={(v) => { if (v === 'domain' || v === 'priority' || v === 'owner') zoneSort = v; }}><Select.Trigger class="w-full border-slate-700 bg-slate-900 text-slate-100"><span>{zoneSort === 'domain' ? 'Sort by Domain' : zoneSort === 'priority' ? 'Sort by Priority' : 'Sort by Owner'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900"><Select.Item value="domain" label="Sort by Domain" class="cursor-pointer text-slate-200 hover:bg-slate-800" /><Select.Item value="priority" label="Sort by Priority" class="cursor-pointer text-slate-200 hover:bg-slate-800" /><Select.Item value="owner" label="Sort by Owner" class="cursor-pointer text-slate-200 hover:bg-slate-800" /></Select.Content></Select.Root>
        <Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => (zoneSortDirection = zoneSortDirection === 'asc' ? 'desc' : 'asc')}>Direction: {zoneSortDirection === 'asc' ? 'Ascending' : 'Descending'}</Button>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="space-y-2"><FieldLabel label="Enabled" hint="Allows staging zone definitions before activation. Keep disabled until upstream resolver reachability and policy validation are complete." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3"><Switch checked={zoneDraft.enabled} onCheckedChange={(checked) => (zoneDraft.enabled = checked)} /><span class="text-xs text-slate-300">{zoneDraft.enabled ? 'Zone enabled' : 'Zone staged'}</span></div></div>
        <div class="space-y-2"><FieldLabel label="Domain" hint="Authoritative suffix for this forwarding policy. Use exact zone names without wildcards for predictable matching." /><Input class="border-slate-700 bg-slate-900" bind:value={zoneDraft.domain} placeholder="corp.example" />{#if zoneErrors.domain}<p class="text-xs text-red-300">{zoneErrors.domain}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="Target Resolvers" hint="Comma-separated IPs for forwarding this zone. Keep targets highly available and monitored because failures can isolate dependent apps." /><Input class="border-slate-700 bg-slate-900" bind:value={zoneDraft.targetResolvers} placeholder="10.0.10.2,10.0.10.3" />{#if zoneErrors.targetResolvers}<p class="text-xs text-red-300">{zoneErrors.targetResolvers}</p>{/if}</div>
        <div class="space-y-2"><FieldLabel label="Policy" hint="Forward-only skips recursion fallback while forward-first can recurse if forwarders fail. Choose based on trust boundaries and data ownership." /><Select.Root type="single" value={zoneDraft.policy} onValueChange={(v) => { if (v) zoneDraft.policy = v; }}><Select.Trigger class="w-full border-slate-700 bg-slate-900 text-slate-100"><span>{policyOptions.find((o) => o.value === zoneDraft.policy)?.label ?? 'Select policy'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each policyOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-2"><FieldLabel label="TLS Name" hint="Expected certificate name for TLS forwarding targets. Leave empty only when TLS verification is intentionally relaxed by policy." /><Input class="border-slate-700 bg-slate-900" bind:value={zoneDraft.tlsName} placeholder="dns.internal.example" /></div>
        <div class="space-y-2"><FieldLabel label="TLS Port" hint="Port used for encrypted forwarding sessions. Use 853 unless upstream infrastructure requires a custom listener." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={zoneDraft.tlsPort} />{#if zoneErrors.tlsPort}<p class="text-xs text-red-300">{zoneErrors.tlsPort}</p>{/if}</div>
      </div>

      <Collapsible.Root bind:open={showAdvancedZone} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
        <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left"><span class="text-sm font-medium text-slate-200">{$_('dns_settings.advanced_zone_metadata')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showAdvancedZone ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
        <Collapsible.Content class="grid gap-4 pt-3 md:grid-cols-2">
          <div class="space-y-2"><FieldLabel label="Owner" hint="Team accountable for this forwarding zone lifecycle. Clear ownership speeds troubleshooting and review during incidents." /><Input class="border-slate-700 bg-slate-900" bind:value={zoneDraft.owner} placeholder="infrastructure-dns" />{#if zoneErrors.owner}<p class="text-xs text-red-300">{zoneErrors.owner}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="Priority" hint="Lower values evaluate first when overlapping rules exist. Reserve highest priority for critical zones with strict dependency requirements." /><Input class="border-slate-700 bg-slate-900" type="number" bind:value={zoneDraft.priority} min={1} max={1000} />{#if zoneErrors.priority}<p class="text-xs text-red-300">{zoneErrors.priority}</p>{/if}</div>
          <div class="space-y-2"><FieldLabel label="Tags" hint="Operational tags used by automation and reporting pipelines. Keep vocabulary standardized so filtering remains reliable." /><Input class="border-slate-700 bg-slate-900" bind:value={zoneDraft.tags} placeholder="prod,internal,critical" /></div>
          <div class="space-y-2"><FieldLabel label="Last Reviewed At" hint="Timestamp indicating most recent manual validation. Regular review timestamps reduce stale-zone drift over long-lived deployments." /><Input class="border-slate-700 bg-slate-900" bind:value={zoneDraft.lastReviewedAt} placeholder="2026-03-03" /></div>
          <div class="space-y-2"><FieldLabel label="Change Ticket" hint="Mandatory ticket reference for governance and rollback context. This keeps every zone mutation traceable through change workflows." /><Input class="border-slate-700 bg-slate-900" bind:value={zoneDraft.changeTicket} placeholder="DNS-CHG-8842" />{#if zoneErrors.changeTicket}<p class="text-xs text-red-300">{zoneErrors.changeTicket}</p>{/if}</div>
          <div class="space-y-2 md:col-span-2"><FieldLabel label="Description" hint="Describe business purpose, expected query patterns, and rollback strategy. Detailed descriptions improve continuity for on-call engineers." /><Textarea class="min-h-24 border-slate-700 bg-slate-900" bind:value={zoneDraft.description} />{#if zoneErrors.description}<p class="text-xs text-red-300">{zoneErrors.description}</p>{/if}</div>
        </Collapsible.Content>
      </Collapsible.Root>

      {#if zoneErrorList.length > 0}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"><div class="mb-2 flex items-center gap-2"><AlertTriangleIcon class="h-4 w-4" /><span>Resolve zone validation issues before saving.</span></div><ul class="space-y-1 text-xs text-red-100">{#each zoneErrorList as err}<li>{err}</li>{/each}</ul></div>
      {/if}

      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={() => void saveZone()} disabled={!canSaveZone}><PlusIcon class="mr-2 h-4 w-4" />{editingZoneId ? 'Update Zone' : 'Add Zone'}</Button>
        <Button variant="outline" class="border-slate-700 text-slate-200" onclick={resetZoneDraft}>{$_('dns_settings.cancel_edit')}</Button>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm"><thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400"><tr><th class="px-3 py-2 text-left">Domain</th><th class="px-3 py-2 text-left">Targets</th><th class="px-3 py-2 text-left">Policy</th><th class="px-3 py-2 text-left">Owner</th><th class="px-3 py-2 text-left">Priority</th><th class="px-3 py-2 text-left">Tags</th><th class="px-3 py-2 text-left">Ticket</th><th class="px-3 py-2 text-left">State</th><th class="px-3 py-2 text-left">Actions</th></tr></thead>
          <tbody>
            {#if filteredZones.length === 0}
              <tr><td colspan={9} class="px-3 py-6 text-center text-slate-500">No forward zones match current filters.</td></tr>
            {:else}
              {#each filteredZones as row}
                <tr class="border-t border-slate-800/80 text-slate-200"><td class="px-3 py-2 text-xs">{row.domain}</td><td class="px-3 py-2 text-xs">{row.targetResolvers}</td><td class="px-3 py-2 text-xs">{row.policy}</td><td class="px-3 py-2 text-xs">{row.owner}</td><td class="px-3 py-2 text-xs">{row.priority}</td><td class="px-3 py-2 text-xs">{row.tags || '-'}</td><td class="px-3 py-2 text-xs">{row.changeTicket}</td><td class="px-3 py-2 text-xs"><span class={row.enabled ? 'text-emerald-300' : 'text-amber-300'}>{row.enabled ? 'Enabled' : 'Disabled'}</span></td><td class="px-3 py-2"><div class="flex gap-2"><Button size="sm" variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => editZone(row)}><PencilIcon class="h-3.5 w-3.5" /></Button><Button size="sm" variant="outline" class="border-red-500/50 text-red-300 hover:bg-red-950/40" onclick={() => void deleteZone(row.id)}><Trash2Icon class="h-3.5 w-3.5" /></Button></div></td></tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</div>
