<!-- Route view for `/nat/translations` in the ezNGFW admin GUI. -->

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
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import SearchIcon from '@lucide/svelte/icons/search';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';

  import { _ } from '$lib/i18n';
  type TranslationRow = {
    id: string;
    protocol: string;
    sourceAddress: string;
    sourcePort: string;
    destinationAddress: string;
    destinationPort: string;
    translatedAddress: string;
    translatedPort: string;
    state: string;
    ageSeconds: number;
    bytes: number;
    packets: number;
    interface: string;
  };

  const protocolOptions = [
    { value: 'all', label: 'All protocols' },
    { value: 'tcp', label: 'TCP' },
    { value: 'udp', label: 'UDP' },
    { value: 'icmp', label: 'ICMP' }
  ];

  const stateOptions = [
    { value: 'all', label: 'All states' },
    { value: 'established', label: 'Established' },
    { value: 'time_wait', label: 'Time Wait' },
    { value: 'syn_sent', label: 'SYN Sent' },
    { value: 'closing', label: 'Closing' }
  ];

  const pageSizeOptions = [
    { value: '50', label: '50 rows' },
    { value: '100', label: '100 rows' },
    { value: '250', label: '250 rows' }
  ];

  let translations = $state<TranslationRow[]>([]);
  let loadingTranslations = $state(true);
  let loadingError = $state('');

  let interfaceOptions = $state<SelectOption[]>([{ value: 'all', label: 'All interfaces' }]);

  let search = $state('');
  let protocolFilter = $state('all');
  let stateFilter = $state('all');
  let interfaceFilter = $state('all');
  let minimumBytes = $state(0);

  let autoRefresh = $state(false);
  let refreshSeconds = $state(15);
  let showAdvanced = $state(false);

  let page = $state(1);
  let pageSize = $state('100');
  let totalRows = $state(0);

  let flushing = $state(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  const presetColumns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'search', label: 'Search' },
    { key: 'protocol', label: 'Protocol' },
    { key: 'state', label: 'State' },
    { key: 'interface', label: 'Interface' },
    { key: 'minimumBytes', label: 'Min Bytes' },
    { key: 'autoRefresh', label: 'Auto Refresh' }
  ];

  const presetFields = $derived.by((): FormField[] => [
    {
      key: 'name',
      label: 'Preset Name',
      type: 'text',
      required: true,
      hint: 'Use explicit names to communicate intent and speed team handoffs. Example: High-byte TCP on WAN2 for after-hours transfer investigations.'
    },
    {
      key: 'search',
      label: 'Search Term',
      type: 'text',
      hint: 'Persist commonly used text searches for known subnets or service ports. Example: save 10.0.0.0/24 derived host filter values for repeated branch diagnostics.'
    },
    {
      key: 'protocol',
      label: 'Protocol',
      type: 'select',
      options: protocolOptions,
      hint: 'Protocol presetting removes repetitive clicks during incident drills and recurring checks. Example: lock to UDP when investigating DNS amplification concerns.'
    },
    {
      key: 'state',
      label: 'State',
      type: 'select',
      options: stateOptions,
      hint: 'State presets make it easier to compare healthy steady-state behavior against anomalies. Example: save established-only baseline and compare to sudden time_wait growth.'
    },
    {
      key: 'interface',
      label: 'Interface',
      type: 'select',
      options: interfaceOptions,
      hint: 'Preset interface values to quickly isolate specific uplinks or overlay networks during diagnostics. Example: select pppoe0 for consumer fiber troubleshooting and wg0 for remote users.'
    },
    {
      key: 'minimumBytes',
      label: 'Minimum Bytes',
      type: 'number',
      hint: 'Store byte threshold when you only care about heavy-volume sessions. Example: 1000000 to prioritize flows most likely to affect egress congestion or billing.'
    },
    {
      key: 'autoRefresh',
      label: 'Preset Auto-refresh',
      type: 'boolean',
      hint: 'Useful for operations centers that keep saved views open for long periods. Example: enable for NOC dashboards showing persistent high-risk traffic patterns.'
    }
  ]);

  function splitAddressPort(value: string) {
    if (!value || value === '-') return { address: '-', port: '-' };
    const ipv6 = value.match(/^\[([^\]]+)\]:(\d+)$/);
    if (ipv6) return { address: ipv6[1], port: ipv6[2] };
    const idx = value.lastIndexOf(':');
    if (idx > -1 && value.indexOf(':') === idx) {
      return { address: value.slice(0, idx), port: value.slice(idx + 1) };
    }
    return { address: value, port: '-' };
  }

  function normalizeTranslation(raw: Record<string, unknown>): TranslationRow {
    const source = splitAddressPort(String(raw.source ?? raw.original_src ?? raw.src ?? '-'));
    const destination = splitAddressPort(String(raw.destination ?? raw.original_dst ?? raw.dst ?? '-'));
    const translated = splitAddressPort(String(raw.translated ?? raw.translated_src ?? raw.nat_src ?? '-'));

    return {
      id: String(raw.id ?? raw.uuid ?? `${raw.protocol ?? 'proto'}-${source.address}-${destination.address}`),
      protocol: String(raw.protocol ?? '-').toLowerCase(),
      sourceAddress: source.address,
      sourcePort: source.port,
      destinationAddress: destination.address,
      destinationPort: destination.port,
      translatedAddress: translated.address,
      translatedPort: translated.port,
      state: String(raw.state ?? raw.status ?? 'unknown').toLowerCase(),
      ageSeconds: Number(raw.ageSeconds ?? raw.age ?? 0),
      bytes: Number(raw.bytes ?? 0),
      packets: Number(raw.packets ?? 0),
      interface: String(raw.interface ?? raw.iface ?? 'any')
    };
  }

  function bytesHuman(value: number) {
    const abs = Math.abs(value);
    if (abs >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (abs >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    if (abs >= 1024) return `${(value / 1024).toFixed(2)} KB`;
    return `${value} B`;
  }

  function numberWithCommas(value: number) {
    return new Intl.NumberFormat().format(value);
  }

  function stateTone(state: string) {
    if (state.includes('time_wait') || state.includes('closing')) return 'border-amber-400/30 bg-amber-500/20 text-amber-200';
    if (state.includes('syn') || state.includes('reset')) return 'border-red-400/30 bg-red-500/20 text-red-200';
    return 'border-cyan-400/30 bg-cyan-500/20 text-cyan-200';
  }

  async function loadInterfaces() {
    try {
      const payload = await api.get<unknown[]>('/interfaces');
      const rows = Array.isArray(payload)
        ? payload
            .map((item) => {
              const row = (item ?? {}) as Record<string, unknown>;
              const value = String(row.name ?? row.id ?? '').trim();
              const label = String((row.description ?? value) || 'Interface');
              return { value, label: `${value} — ${label}` };
            })
            .filter((item) => item.value.length > 0)
        : [];
      interfaceOptions = [{ value: 'all', label: 'All interfaces' }, ...rows];
    } catch {
      interfaceOptions = [{ value: 'all', label: 'All interfaces' }];
      toasts.warning($_('nat_translations.toast_interface_list_unavailable'));
    }
  }

  function buildTranslationsQuery() {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', pageSize);
    if (interfaceFilter !== 'all') params.set('interface', interfaceFilter);
    if (protocolFilter !== 'all') params.set('protocol', protocolFilter);
    if (stateFilter !== 'all') params.set('state', stateFilter);
    return params;
  }

  async function loadTranslations() {
    loadingTranslations = true;
    loadingError = '';
    try {
      const payload = await api.get<Record<string, unknown> | unknown[]>(`/nat/translations?${buildTranslationsQuery().toString()}`);
      let rows: TranslationRow[] = [];
      if (Array.isArray(payload)) {
        rows = payload.map((item) => normalizeTranslation((item ?? {}) as Record<string, unknown>));
        totalRows = rows.length;
      } else {
        const items = Array.isArray(payload.rows) ? (payload.rows as unknown[]) : [];
        rows = items.map((item) => normalizeTranslation((item ?? {}) as Record<string, unknown>));
        totalRows = Number(payload.total ?? rows.length);
      }
      translations = rows;
    } catch (error) {
      translations = [];
      totalRows = 0;
      loadingError = error instanceof Error ? error.message : 'Failed to load translation table';
      toasts.error(loadingError);
    } finally {
      loadingTranslations = false;
    }
  }

  async function flushTranslations() {
    flushing = true;
    try {
      await api.del('/nat/translations');
      toasts.success($_('nat_translations.toast_translation_table_flushed'));
      await loadTranslations();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to flush translations');
    } finally {
      flushing = false;
    }
  }

  function applyPreset(preset: Record<string, any>) {
    search = String(preset.search ?? '');
    protocolFilter = String(preset.protocol ?? 'all');
    stateFilter = String(preset.state ?? 'all');
    interfaceFilter = String(preset.interface ?? 'all');
    minimumBytes = Number(preset.minimumBytes ?? 0);
    autoRefresh = Boolean(preset.autoRefresh);
    page = 1;
    void loadTranslations();
    toasts.success(`Applied preset: ${preset.name}`);
  }

  const totalPages = $derived.by(() => {
    const perPage = Number(pageSize);
    if (perPage <= 0) return 1;
    return Math.max(1, Math.ceil(totalRows / perPage));
  });

  const filteredRows = $derived.by(() =>
    translations.filter((row) => {
      if (protocolFilter !== 'all' && row.protocol !== protocolFilter) return false;
      if (stateFilter !== 'all' && row.state !== stateFilter) return false;
      if (interfaceFilter !== 'all' && row.interface !== interfaceFilter) return false;
      if (row.bytes < minimumBytes) return false;
      if (!search.trim()) return true;

      const haystack = [
        row.protocol,
        row.sourceAddress,
        row.sourcePort,
        row.destinationAddress,
        row.destinationPort,
        row.translatedAddress,
        row.translatedPort,
        row.state,
        row.interface
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    })
  );

  const establishedCount = $derived.by(() => filteredRows.filter((row) => row.state === 'established').length);
  const totalBytes = $derived.by(() => filteredRows.reduce((sum, row) => sum + row.bytes, 0));
  const totalPackets = $derived.by(() => filteredRows.reduce((sum, row) => sum + row.packets, 0));

  onMount(() => {
    void Promise.all([loadInterfaces(), loadTranslations()]);
  });

  $effect(() => {
    if (timer) clearInterval(timer);
    if (autoRefresh && refreshSeconds > 0) {
      timer = setInterval(() => {
        void loadTranslations();
      }, refreshSeconds * 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('nat_translations.active_nat_translation_viewer')}</CardTitle>
          <p class="mt-1 text-sm text-slate-400">{$_('nat_translations.inspect_live_source_and_destination_mappings_with_')}</p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={() => void loadTranslations()} disabled={loadingTranslations}>
            <RefreshCwIcon class="mr-2 h-4 w-4" /> {loadingTranslations ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="outline" class="border-red-500/40 text-red-200 hover:bg-red-950/30" onclick={() => void flushTranslations()} disabled={flushing}>
            <Trash2Icon class="mr-2 h-4 w-4" /> {flushing ? 'Flushing...' : 'Flush table'}
          </Button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('nat_translations.visible_sessions')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{numberWithCommas(filteredRows.length)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('nat_translations.established_states')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{numberWithCommas(establishedCount)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('nat_translations.traffic_volume')}</p>
          <p class="mt-1 text-xl font-semibold text-slate-100">{bytesHuman(totalBytes)} / {numberWithCommas(totalPackets)} pkts</p>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      {#if loadingError}
        <div class="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{loadingError}</div>
      {/if}

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3 xl:col-span-2">
          <FieldLabel label="Search" hint="Search traverses protocol, addresses, ports, states, and interfaces for rapid flow hunting. Example: search 10.20.30.44 to inspect all sessions from a suspicious endpoint." />
          <div class="relative mt-2">
            <SearchIcon class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <Input class="border-slate-700 bg-slate-950 pl-8 text-slate-100" bind:value={search} placeholder="IP, port, protocol, interface" />
          </div>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Protocol" hint="Use protocol filters to isolate classes with different timeout behavior and state churn. Example: TCP for long-lived sessions, UDP for bursty DNS or media traffic." />
          <Select.Root type="single" value={protocolFilter} onValueChange={(value) => value && (protocolFilter = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{protocolOptions.find((option) => option.value === protocolFilter)?.label ?? 'Select protocol'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each protocolOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="State" hint="Connection state filtering helps focus on stale or unstable flows quickly. Example: inspect time_wait spikes after reverse proxy redeployments to validate timeout policy." />
          <Select.Root type="single" value={stateFilter} onValueChange={(value) => value && (stateFilter = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{stateOptions.find((option) => option.value === stateFilter)?.label ?? 'Select state'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each stateOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Interface" hint="Interface narrowing separates LAN-originated sessions from DMZ or VPN sourced traffic. Example: isolate wg0 to verify NAT behavior for remote-access users." />
          <Select.Root type="single" value={interfaceFilter} onValueChange={(value) => value && (interfaceFilter = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{interfaceOptions.find((option) => option.value === interfaceFilter)?.label ?? 'Select interface'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each interfaceOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Minimum bytes" hint="Ignore low-volume noise to highlight heavy translations that may drive queue pressure or billing impact. Example: set 500000 to inspect only large file transfer sessions." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="0" bind:value={minimumBytes} />
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Rows per page" hint="Choose lower page sizes when doing packet-level triage and larger sizes for broad trend scans. Example: 50 for deep analysis, 250 for mass session review during outages." />
          <Select.Root type="single" value={pageSize} onValueChange={(value) => value && (pageSize = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{pageSizeOptions.find((option) => option.value === pageSize)?.label ?? 'Select page size'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each pageSizeOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Auto-refresh" hint="Auto-refresh is ideal while validating timeout and state recycle behavior in real traffic. Example: 15-second refresh during load test to see translation churn without manual polling." />
          <div class="mt-2 flex items-center justify-between">
            <span class="text-xs text-slate-400">{autoRefresh ? `Enabled (${refreshSeconds}s)` : 'Disabled'}</span>
            <Switch checked={autoRefresh} onCheckedChange={(checked) => (autoRefresh = checked)} />
          </div>
        </div>
      </div>

      <Collapsible.Root bind:open={showAdvanced}>
        <Collapsible.Trigger class="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-left">
          <span class="text-sm font-medium text-slate-200">{$_('nat_translations.advanced_translation_controls')}</span>
          <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="mt-3 grid gap-4 md:grid-cols-2">
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Refresh interval seconds" hint="Tune interval to balance responsiveness and API utilization. Example: 10 seconds for troubleshooting packet loss, 60 seconds for routine watch mode." />
            <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="5" max="300" bind:value={refreshSeconds} />
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Re-query table" hint="Fetches fresh backend state with active filters and pagination. Example: re-query after policy updates to validate old translation entries have drained correctly." />
            <Button class="mt-2 bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void loadTranslations()}>Run query now</Button>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </CardContent>
  </Card>

  <ResourceTable
    title="{$_('nat_translations.saved_filter_presets')}"
    description={$_('nat_translations.descriptionmanage_commonly_used_filter_combination')}
    endpoint="/nat/translations/presets"
    columns={presetColumns}
    fields={presetFields}
    idKey="id"
    addLabel={$_('nat_translations.addlabelcreate_preset')}
    selectable
    
  />

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('nat_translations.active_translation_table')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-950/60">
            <TableRow class="border-slate-700 hover:bg-slate-900/70">
              <TableHead class="text-slate-300">{$_('common.protocol')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_translations.source_addr_port')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_translations.dest_addr_port')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_translations.translated_addr_port')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_translations.state')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_translations.age')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_translations.bytes')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_translations.packets')}</TableHead>
              <TableHead class="text-slate-300">{$_('common.interface')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if loadingTranslations}
              <TableRow class="border-slate-800 hover:bg-transparent">
                <TableCell colspan={9} class="py-8 text-center text-slate-400">Loading active translations...</TableCell>
              </TableRow>
            {:else if filteredRows.length === 0}
              <TableRow class="border-slate-800 hover:bg-transparent">
                <TableCell colspan={9} class="py-8 text-center text-slate-500">No translations match current filters.</TableCell>
              </TableRow>
            {:else}
              {#each filteredRows as row}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  <TableCell class="uppercase text-slate-300">{row.protocol}</TableCell>
                  <TableCell class="font-mono text-xs text-slate-300">{row.sourceAddress}:{row.sourcePort}</TableCell>
                  <TableCell class="font-mono text-xs text-slate-300">{row.destinationAddress}:{row.destinationPort}</TableCell>
                  <TableCell class="font-mono text-xs text-slate-300">{row.translatedAddress}:{row.translatedPort}</TableCell>
                  <TableCell><Badge class={stateTone(row.state)}>{row.state}</Badge></TableCell>
                  <TableCell class="text-right text-slate-300">{numberWithCommas(row.ageSeconds)}s</TableCell>
                  <TableCell class="text-right text-slate-300">{bytesHuman(row.bytes)}</TableCell>
                  <TableCell class="text-right text-slate-300">{numberWithCommas(row.packets)}</TableCell>
                  <TableCell class="text-slate-300">{row.interface}</TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-400">Page {page} of {totalPages} · {numberWithCommas(totalRows)} total rows</p>
        <div class="flex gap-2">
          <Button
            variant="outline"
            class="border-slate-700 text-slate-100 hover:bg-slate-800"
            disabled={page <= 1 || loadingTranslations}
            onclick={() => {
              page -= 1;
              void loadTranslations();
            }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            class="border-slate-700 text-slate-100 hover:bg-slate-800"
            disabled={page >= totalPages || loadingTranslations}
            onclick={() => {
              page += 1;
              void loadTranslations();
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</div>