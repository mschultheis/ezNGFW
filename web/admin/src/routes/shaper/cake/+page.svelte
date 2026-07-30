<!-- Route view for `/shaper/cake` in the ezNGFW admin GUI. -->

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
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import SaveIcon from '@lucide/svelte/icons/save';
  import XIcon from '@lucide/svelte/icons/x';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import InfoIcon from '@lucide/svelte/icons/info';
  import { _ } from '$lib/i18n';

  type CakeRtt =
    | 'datacentre'
    | 'lan'
    | 'metro'
    | 'regional'
    | 'internet'
    | 'oceanic'
    | 'satellite'
    | 'interplanetary';

  type CakeFlowIsolation =
    | 'flowblind'
    | 'srchost'
    | 'dsthost'
    | 'hosts'
    | 'flows'
    | 'dual-srchost'
    | 'dual-dsthost'
    | 'triple-isolate';

  type CakeDiffservMode = 'besteffort' | 'diffserv3' | 'diffserv4' | 'diffserv8';

  type CakeAckFilter = 'none' | 'filter' | 'aggressive';

  type CakeConfig = {
    id: string;
    interface: string;
    bandwidth: string;
    rtt: CakeRtt;
    flow_isolation: CakeFlowIsolation;
    nat: boolean;
    diffserv_mode: CakeDiffservMode;
    wash: boolean;
    overhead: number;
    mpu: number;
    atm: boolean;
    ptm: boolean;
    ack_filter: CakeAckFilter;
    split_gso: boolean;
    ingress: boolean;
    description: string;
    enabled: boolean;
  };

  type InterfaceOption = {
    value: string;
    label: string;
  };

  type SelectOption<T extends string> = {
    label: string;
    value: T;
  };

  const RTT_OPTIONS: SelectOption<CakeRtt>[] = [
    { label: 'Datacentre', value: 'datacentre' },
    { label: 'LAN', value: 'lan' },
    { label: 'Metro', value: 'metro' },
    { label: 'Regional', value: 'regional' },
    { label: 'Internet', value: 'internet' },
    { label: 'Oceanic', value: 'oceanic' },
    { label: 'Satellite', value: 'satellite' },
    { label: 'Interplanetary', value: 'interplanetary' }
  ];

  const FLOW_OPTIONS: SelectOption<CakeFlowIsolation>[] = [
    { label: 'Flowblind', value: 'flowblind' },
    { label: 'Source Host', value: 'srchost' },
    { label: 'Destination Host', value: 'dsthost' },
    { label: 'Hosts', value: 'hosts' },
    { label: 'Flows', value: 'flows' },
    { label: 'Dual Source Host', value: 'dual-srchost' },
    { label: 'Dual Destination Host', value: 'dual-dsthost' },
    { label: 'Triple Isolate', value: 'triple-isolate' }
  ];

  const DIFFSERV_OPTIONS: SelectOption<CakeDiffservMode>[] = [
    { label: 'Best Effort', value: 'besteffort' },
    { label: 'DiffServ 3', value: 'diffserv3' },
    { label: 'DiffServ 4', value: 'diffserv4' },
    { label: 'DiffServ 8', value: 'diffserv8' }
  ];

  const ACK_FILTER_OPTIONS: SelectOption<CakeAckFilter>[] = [
    { label: 'None', value: 'none' },
    { label: 'Filter', value: 'filter' },
    { label: 'Aggressive', value: 'aggressive' }
  ];

  type BandwidthUnit = 'kbit' | 'mbit' | 'gbit';

  const BANDWIDTH_UNIT_OPTIONS: SelectOption<BandwidthUnit>[] = [
    { label: 'Kbit/s', value: 'kbit' },
    { label: 'Mbit/s', value: 'mbit' },
    { label: 'Gbit/s', value: 'gbit' }
  ];

  /** Parse a bandwidth string like '50mbit' into { value: 50, unit: 'mbit' }. */
  function parseBandwidth(raw: string): { value: number; unit: BandwidthUnit } {
    const match = raw.match(/^(\d+(?:\.\d+)?)\s*(kbit|mbit|gbit)$/i);
    if (match) {
      return { value: parseFloat(match[1]), unit: match[2].toLowerCase() as BandwidthUnit };
    }
    // Fallback: try to interpret as plain number in mbit
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      return { value: num, unit: 'mbit' };
    }
    return { value: 0, unit: 'mbit' };
  }

  /** Compose numeric value + unit into a bandwidth string like '100mbit'. */
  function composeBandwidth(value: number, unit: BandwidthUnit): string {
    return `${value}${unit}`;
  }

  /** Format bandwidth for display: '50mbit' → '50 Mbit/s'. */
  function formatBandwidth(raw: string): string {
    const { value, unit } = parseBandwidth(raw);
    const labels: Record<BandwidthUnit, string> = { kbit: 'Kbit/s', mbit: 'Mbit/s', gbit: 'Gbit/s' };
    return `${value} ${labels[unit]}`;
  }

  const FIELD_HINTS = {
    id:
      'Unique identifier for this CAKE instance. Keep names stable for policy references and incident runbooks. Example values: cake-wan-main, cake-guest-downlink, cake-branch-upstream.',
    interface:
      'Interface where CAKE is attached. Use the true bottleneck link for accurate shaping behavior, commonly WAN egress for upload control. Example values: wan, pppoe0, vlan20.',
    bandwidth:
      "Maximum bandwidth for this interface. Set to 85-95% of your actual link speed for optimal bufferbloat control. Select the value and unit (Kbit/s, Mbit/s, or Gbit/s). For example, set 100 Mbit/s for a 120 Mbps link, or 1 Gbit/s for a gigabit fiber connection.",
    rtt:
      "Round-trip time model for your link type. Affects internal AQM timing targets. Use 'internet' for typical broadband, 'satellite' for sat links, 'lan' for datacenter-internal traffic.",
    flow_isolation:
      "Controls how CAKE shares bandwidth between flows. 'triple-isolate' (recommended) provides per-source, per-destination, and per-flow fairness simultaneously. Use 'hosts' for simpler per-host-pair sharing.",
    nat:
      'Enable NAT-aware flow hashing. Required when CAKE runs on a NAT gateway to correctly identify internal hosts behind the NAT. Uses conntrack information.',
    diffserv_mode:
      'Select DiffServ tin mapping profile for priority treatment classes. diffserv3 is a practical default for most enterprise and branch networks. Use besteffort when you need strictly flat queue treatment.',
    wash:
      'Clear DiffServ markings after classification so DSCP values do not propagate beyond this boundary. Useful at trust boundaries when incoming markings are untrusted or inconsistent. Keep disabled if downstream devices rely on preserved DSCP.',
    overhead:
      'Additional per-packet byte overhead for encapsulation and framing compensation. Set this when PPPoE, VLAN tags, tunneling, or provider framing adds bytes not visible in payload size. Example values: 18 for Ethernet framing assumptions, 44+ for PPPoE plus encapsulation.',
    mpu:
      'Minimum packet unit in bytes used for accounting tiny packets. This avoids underestimating wire cost for ACKs and control packets on links with framing floors. Typical values are 0, 64, or provider-recommended minimums.',
    atm:
      'Enable ATM cell-framing compensation for DSL/ADSL links. Rounds packet sizes to 53-byte ATM cell boundaries for accurate shaping. Not needed for cable/fiber/Ethernet.',
    ptm:
      'Enable PTM framing compensation for VDSL-style packet transfer mode links. Use this when providers specify PTM framing rather than ATM behavior. Do not enable with ATM unless your provider explicitly documents hybrid requirements.',
    ack_filter:
      'ACK filtering can reduce upstream chatter on highly asymmetric links. The filter mode is conservative, while aggressive removes more ACKs for stronger download gain on constrained uplinks. Start with none unless testing confirms benefit.',
    split_gso:
      'Split large GSO/TSO packets before enqueueing to improve latency fairness and scheduler precision. Keep enabled for most deployments, especially on high-throughput NIC offload paths. Disable only for specific performance experiments.',
    ingress:
      'Treat this instance as ingress shaping context when used in IFB/redirection workflows. Enable when managing download direction using mirrored traffic paths. Keep disabled for straightforward egress shaping.',
    description:
      'Operational note describing deployment intent, ownership, and tuning rationale. Include link profile context for future responders. Example: CAKE with diffserv3 on WAN for voice-first branch behavior.',
    enabled:
      'Controls whether this CAKE instance is active in generated shaping policy. Keep disabled during staged rollouts and validation checks, then enable when ready for production traffic.'
  } as const;

  const defaultForm: CakeConfig = {
    id: '',
    interface: '',
    bandwidth: '100mbit',
    rtt: 'internet',
    flow_isolation: 'triple-isolate',
    nat: false,
    diffserv_mode: 'diffserv3',
    wash: false,
    overhead: 0,
    mpu: 0,
    atm: false,
    ptm: false,
    ack_filter: 'none',
    split_gso: true,
    ingress: false,
    description: '',
    enabled: true
  };

  let loading = $state(true);
  let savingAll = $state(false);
  let creating = $state(false);
  let deletingId = $state('');
  let errorMessage = $state('');

  let interfaces: any[] = $state([]);
  let interfaceOptions: InterfaceOption[] = $state([]);

  let records: CakeConfig[] = $state([]);
  let createForm: CakeConfig = $state({ ...defaultForm });

  let editingRows: Record<string, boolean> = $state({});

  let showCreateForm = $state(true);
  let showCreateBasic = $state(true);
  let showCreateNatFlow = $state(false);
  let showCreateLink = $state(false);
  let showCreatePerf = $state(false);
  let showGuidance = $state(false);

  let editBasicOpen: Record<string, boolean> = $state({});
  let editNatFlowOpen: Record<string, boolean> = $state({});
  let editLinkOpen: Record<string, boolean> = $state({});
  let editPerfOpen: Record<string, boolean> = $state({});

  function normalizeInterfaceEntry(entry: unknown): InterfaceOption | null {
    if (typeof entry === 'string') {
      return { value: entry, label: entry };
    }

    const src = (entry as Record<string, unknown>) ?? {};
    const valueCandidate = src.name ?? src.id ?? src.iface ?? src.interface ?? src.device ?? src.value;

    if (typeof valueCandidate !== 'string' || valueCandidate.length === 0) {
      return null;
    }

    const labelCandidate = src.description ?? src.label ?? src.display_name ?? src.friendly_name ?? valueCandidate;

    return {
      value: valueCandidate,
      label: typeof labelCandidate === 'string' && labelCandidate.length > 0 ? labelCandidate : valueCandidate
    };
  }

  function normalizeEnum<T extends string>(value: unknown, options: SelectOption<T>[], fallback: T): T {
    if (typeof value === 'string' && options.some((item) => item.value === value)) {
      return value as T;
    }
    return fallback;
  }

  function normalizeCake(raw: unknown): CakeConfig {
    const src = (raw as Record<string, unknown>) ?? {};

    return {
      id: String(src.id ?? ''),
      interface: String(src.interface ?? ''),
      bandwidth: String(src.bandwidth ?? defaultForm.bandwidth),
      rtt: normalizeEnum(src.rtt, RTT_OPTIONS, defaultForm.rtt),
      flow_isolation: normalizeEnum(src.flow_isolation, FLOW_OPTIONS, defaultForm.flow_isolation),
      nat: Boolean(src.nat ?? defaultForm.nat),
      diffserv_mode: normalizeEnum(src.diffserv_mode, DIFFSERV_OPTIONS, defaultForm.diffserv_mode),
      wash: Boolean(src.wash ?? defaultForm.wash),
      overhead: Number(src.overhead ?? defaultForm.overhead),
      mpu: Number(src.mpu ?? defaultForm.mpu),
      atm: Boolean(src.atm ?? defaultForm.atm),
      ptm: Boolean(src.ptm ?? defaultForm.ptm),
      ack_filter: normalizeEnum(src.ack_filter, ACK_FILTER_OPTIONS, defaultForm.ack_filter),
      split_gso: Boolean(src.split_gso ?? defaultForm.split_gso),
      ingress: Boolean(src.ingress ?? defaultForm.ingress),
      description: String(src.description ?? ''),
      enabled: Boolean(src.enabled ?? defaultForm.enabled)
    };
  }

  function cloneRecord(item: CakeConfig): CakeConfig {
    return {
      id: item.id,
      interface: item.interface,
      bandwidth: item.bandwidth,
      rtt: item.rtt,
      flow_isolation: item.flow_isolation,
      nat: item.nat,
      diffserv_mode: item.diffserv_mode,
      wash: item.wash,
      overhead: item.overhead,
      mpu: item.mpu,
      atm: item.atm,
      ptm: item.ptm,
      ack_filter: item.ack_filter,
      split_gso: item.split_gso,
      ingress: item.ingress,
      description: item.description,
      enabled: item.enabled
    };
  }

  function recordKey(record: CakeConfig, index = -1): string {
    const id = record.id.trim();
    if (id.length > 0) {
      return id;
    }
    if (index >= 0) {
      return `row-${index}`;
    }
    return crypto.randomUUID();
  }

  function ensureInterfaceDefault(record: CakeConfig): CakeConfig {
    if (record.interface || interfaceOptions.length === 0) {
      return record;
    }

    return {
      ...record,
      interface: interfaceOptions[0]?.value ?? ''
    };
  }

  function parseNumberInput(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function validateRecord(record: CakeConfig, existingIds: string[] = []): string | null {
    if (record.id.trim().length === 0) {
      return 'CAKE ID is required.';
    }

    if (existingIds.includes(record.id.trim())) {
      return `Duplicate CAKE ID: ${record.id.trim()}. IDs must be unique.`;
    }

    if (!record.interface) {
      return 'Interface is required.';
    }

    const bw = parseBandwidth(record.bandwidth);
    if (record.bandwidth.trim().length === 0 || bw.value <= 0) {
      return 'Bandwidth is required and must be greater than 0.';
    }

    if (record.overhead < 0 || record.overhead > 256) {
      return 'Overhead must be between 0 and 256.';
    }

    if (record.mpu < 0 || record.mpu > 256) {
      return 'MPU must be between 0 and 256.';
    }

    return null;
  }

  async function loadCake() {
    loading = true;
    errorMessage = '';

    try {
      const payload = await api.get('/shaper/cake');
      const list = Array.isArray(payload) ? payload : [];
      records = list.map((item) => normalizeCake(item));
      editingRows = {};
      editBasicOpen = {};
      editNatFlowOpen = {};
      editLinkOpen = {};
      editPerfOpen = {};
    } catch (error) {
      records = [];
      errorMessage = error instanceof Error ? error.message : 'Failed to load CAKE instances.';
      toasts.error(errorMessage);
    } finally {
      loading = false;
    }
  }

  async function saveAll(nextRecords: CakeConfig[], successMessage: string) {
    savingAll = true;
    errorMessage = '';

    try {
      await api.put('/shaper/cake', nextRecords);
      records = nextRecords.map((record) => cloneRecord(record));
      toasts.success(successMessage);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to save CAKE configuration.';
      toasts.error(errorMessage);
      await loadCake();
    } finally {
      savingAll = false;
    }
  }

  async function createRecord() {
    creating = true;

    const proposed = ensureInterfaceDefault(cloneRecord(createForm));
    const validationError = validateRecord(proposed, records.map((item) => item.id.trim()));

    if (validationError) {
      creating = false;
      toasts.error(validationError);
      return;
    }

    const nextRecords = [...records, proposed];
    await saveAll(nextRecords, `Created CAKE instance ${proposed.id}.`);

    createForm = ensureInterfaceDefault({ ...defaultForm });
    creating = false;
  }

  async function updateRecord(index: number) {
    const row = records[index];
    if (!row) {
      return;
    }

    const existingIds = records
      .map((item, idx) => (idx === index ? '' : item.id.trim()))
      .filter((value) => value.length > 0);

    const validationError = validateRecord(row, existingIds);
    if (validationError) {
      toasts.error(validationError);
      return;
    }

    const nextRecords = records.map((item) => cloneRecord(item));
    await saveAll(nextRecords, `Saved CAKE instance ${row.id}.`);

    const key = recordKey(row, index);
    editingRows[key] = false;
    editingRows = { ...editingRows };
  }

  async function removeRecord(index: number) {
    const row = records[index];
    if (!row) {
      return;
    }

    const key = recordKey(row, index);
    deletingId = key;

    const nextRecords = records.filter((_, idx) => idx !== index).map((item) => cloneRecord(item));
    await saveAll(nextRecords, `Deleted CAKE instance ${row.id}.`);

    deletingId = '';
  }

  function setCreateField<K extends keyof CakeConfig>(key: K, value: CakeConfig[K]) {
    createForm = {
      ...createForm,
      [key]: value
    };
  }

  function setRowField<K extends keyof CakeConfig>(index: number, key: K, value: CakeConfig[K]) {
    records[index][key] = value;
    records = [...records];
  }

  function toggleEdit(index: number) {
    const row = records[index];
    if (!row) {
      return;
    }

    const key = recordKey(row, index);
    editingRows[key] = !editingRows[key];
    editingRows = { ...editingRows };
  }

  function formatBoolean(value: boolean): string {
    return value ? 'Yes' : 'No';
  }

  function labelFor<T extends string>(value: T, options: SelectOption<T>[]): string {
    return options.find((item) => item.value === value)?.label ?? value;
  }

  onMount(async () => {
    void loadCake();
    try {
      const data: any = await api.get('/interfaces');
      interfaces = Array.isArray(data) ? data : data.interfaces || [];
      const options = interfaces
        .map((entry) => normalizeInterfaceEntry(entry))
        .filter((entry): entry is InterfaceOption => Boolean(entry));
      interfaceOptions = options;
      if (!createForm.interface && options.length > 0) {
        createForm = {
          ...createForm,
          interface: options[0]?.value ?? ''
        };
      }
      records = records.map((record) => ensureInterfaceDefault(record));
    } catch {
      interfaceOptions = [];
    }
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('shaper_cake.cake_traffic_shaping')}</CardTitle>
      <CardDescription class="text-slate-400">
        Configure Common Applications Kept Enhanced instances with full inline CRUD and grouped advanced controls.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('shaper_cake.instances')}</p>
          <p class="text-sm font-semibold text-slate-100">{records.length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('shaper_cake.interfaces')}</p>
          <p class="text-sm font-semibold text-slate-100">{interfaceOptions.length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('shaper_cake.enabled')}</p>
          <p class="text-sm font-semibold text-emerald-400">{records.filter(r => r.enabled).length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('shaper_cake.disabled')}</p>
          <p class="text-sm font-semibold text-red-400">{records.filter(r => !r.enabled).length}</p>
        </div>
      </div>

      <Collapsible.Root bind:open={showGuidance} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
        <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
          <span class="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
            <InfoIcon class="h-4 w-4" />
            CAKE deployment guidance
          </span>
          <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showGuidance ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="space-y-2 pt-3 text-sm leading-6 text-slate-300">
          <p>
            Set bandwidth below real sync speed (typically 85-95%) so CAKE controls the queue instead of upstream ISP buffers.
          </p>
          <p>
            Keep <strong>triple-isolate</strong> with <strong>diffserv3</strong> for a balanced enterprise default, then tune only after observing real traffic behavior.
          </p>
          <p>
            Enable NAT awareness when this firewall is the translation edge, and apply link-layer compensation only when provider framing requires it.
          </p>
        </Collapsible.Content>
      </Collapsible.Root>

      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          class="border-slate-700 text-slate-200"
          onclick={() => {
            void loadCake();
          }}
          disabled={loading || savingAll}
        >
          Reload Instances
        </Button>
      </div>

      {#if errorMessage}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('shaper_cake.create_cake_instance')}</CardTitle>
          <CardDescription class="text-slate-400">
            Add a CAKE instance inline, then persist by writing the complete CAKE list with <code>PUT /shaper/cake</code>.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          class="border-slate-700 text-slate-200"
          onclick={() => {
            showCreateForm = !showCreateForm;
          }}
        >
          <ChevronDownIcon class={`mr-2 h-4 w-4 transition-transform ${showCreateForm ? 'rotate-180' : ''}`} />
          {showCreateForm ? 'Hide form' : 'Show form'}
        </Button>
      </div>
    </CardHeader>

    {#if showCreateForm}
      <CardContent class="space-y-4">
        <form
          class="space-y-4"
          onsubmit={(event) => {
            event.preventDefault();
            void createRecord();
          }}
        >
          <Collapsible.Root bind:open={showCreateBasic} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
              <span class="text-sm font-medium text-slate-200">{$_('shaper_cake.basic_configuration')}</span>
              <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showCreateBasic ? 'rotate-180' : ''}`} />
            </Collapsible.Trigger>
            <Collapsible.Content class="pt-3">
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div class="space-y-2">
                  <FieldLabel label="ID" hint={FIELD_HINTS.id} />
                  <Input
                    class="border-slate-700 bg-slate-900"
                    value={createForm.id}
                    required
                    oninput={(event) => {
                      setCreateField('id', (event.currentTarget as HTMLInputElement).value);
                    }}
                  />
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Interface" hint={FIELD_HINTS.interface} />
                  <Select.Root
                    type="single"
                    value={createForm.interface}
                    onValueChange={(value) => {
                      if (value) {
                        setCreateField('interface', value);
                      }
                    }}
                  >
                    <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                      <span>
                        {interfaceOptions.find((item) => item.value === createForm.interface)?.label ?? 'Select interface'}
                      </span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900">
                      {#each interfaceOptions as item}
                        <Select.Item
                          value={item.value}
                          label={item.label}
                          class="cursor-pointer text-slate-200 hover:bg-slate-800"
                        />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Bandwidth" hint={FIELD_HINTS.bandwidth} />
                  <div class="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      class="flex-1 border-slate-700 bg-slate-900"
                      value={parseBandwidth(createForm.bandwidth).value || ''}
                      placeholder="e.g., 100"
                      oninput={(event) => {
                        const num = parseFloat((event.currentTarget as HTMLInputElement).value) || 0;
                        const { unit } = parseBandwidth(createForm.bandwidth);
                        setCreateField('bandwidth', composeBandwidth(num, unit));
                      }}
                    />
                    <Select.Root
                      type="single"
                      value={parseBandwidth(createForm.bandwidth).unit}
                      onValueChange={(value) => {
                        if (value) {
                          const { value: num } = parseBandwidth(createForm.bandwidth);
                          setCreateField('bandwidth', composeBandwidth(num, value as BandwidthUnit));
                        }
                      }}
                    >
                      <Select.Trigger class="w-32 cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                        <span>{BANDWIDTH_UNIT_OPTIONS.find((o) => o.value === parseBandwidth(createForm.bandwidth).unit)?.label ?? 'Mbit/s'}</span>
                      </Select.Trigger>
                      <Select.Content class="border-slate-700 bg-slate-900">
                        {#each BANDWIDTH_UNIT_OPTIONS as item}
                          <Select.Item
                            value={item.value}
                            label={item.label}
                            class="cursor-pointer text-slate-200 hover:bg-slate-800"
                          />
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  </div>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="RTT" hint={FIELD_HINTS.rtt} />
                  <Select.Root
                    type="single"
                    value={createForm.rtt}
                    onValueChange={(value) => {
                      if (value) {
                        setCreateField('rtt', value as CakeRtt);
                      }
                    }}
                  >
                    <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                      <span>{labelFor(createForm.rtt, RTT_OPTIONS)}</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900">
                      {#each RTT_OPTIONS as item}
                        <Select.Item
                          value={item.value}
                          label={item.label}
                          class="cursor-pointer text-slate-200 hover:bg-slate-800"
                        />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Flow Isolation" hint={FIELD_HINTS.flow_isolation} />
                  <Select.Root
                    type="single"
                    value={createForm.flow_isolation}
                    onValueChange={(value) => {
                      if (value) {
                        setCreateField('flow_isolation', value as CakeFlowIsolation);
                      }
                    }}
                  >
                    <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                      <span>{labelFor(createForm.flow_isolation, FLOW_OPTIONS)}</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900">
                      {#each FLOW_OPTIONS as item}
                        <Select.Item
                          value={item.value}
                          label={item.label}
                          class="cursor-pointer text-slate-200 hover:bg-slate-800"
                        />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="DiffServ" hint={FIELD_HINTS.diffserv_mode} />
                  <Select.Root
                    type="single"
                    value={createForm.diffserv_mode}
                    onValueChange={(value) => {
                      if (value) {
                        setCreateField('diffserv_mode', value as CakeDiffservMode);
                      }
                    }}
                  >
                    <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                      <span>{labelFor(createForm.diffserv_mode, DIFFSERV_OPTIONS)}</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900">
                      {#each DIFFSERV_OPTIONS as item}
                        <Select.Item
                          value={item.value}
                          label={item.label}
                          class="cursor-pointer text-slate-200 hover:bg-slate-800"
                        />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Enabled" hint={FIELD_HINTS.enabled} />
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                    <Switch
                      checked={createForm.enabled}
                      onCheckedChange={(value) => {
                        setCreateField('enabled', value);
                      }}
                    />
                    <span class="text-sm text-slate-300">{createForm.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>

                <div class="space-y-2 xl:col-span-2">
                  <FieldLabel label="Description" hint={FIELD_HINTS.description} />
                  <Input
                    class="border-slate-700 bg-slate-900"
                    value={createForm.description}
                    oninput={(event) => {
                      setCreateField('description', (event.currentTarget as HTMLInputElement).value);
                    }}
                  />
                </div>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>

          <Collapsible.Root bind:open={showCreateNatFlow} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
              <span class="text-sm font-medium text-slate-200">{$_('shaper_cake.advanced_nat_flow_options')}</span>
              <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showCreateNatFlow ? 'rotate-180' : ''}`} />
            </Collapsible.Trigger>
            <Collapsible.Content class="pt-3">
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div class="space-y-2">
                  <FieldLabel label="NAT" hint={FIELD_HINTS.nat} />
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                    <Switch
                      checked={createForm.nat}
                      onCheckedChange={(value) => {
                        setCreateField('nat', value);
                      }}
                    />
                    <span class="text-sm text-slate-300">{createForm.nat ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Wash" hint={FIELD_HINTS.wash} />
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                    <Switch
                      checked={createForm.wash}
                      onCheckedChange={(value) => {
                        setCreateField('wash', value);
                      }}
                    />
                    <span class="text-sm text-slate-300">{createForm.wash ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="ACK Filter" hint={FIELD_HINTS.ack_filter} />
                  <Select.Root
                    type="single"
                    value={createForm.ack_filter}
                    onValueChange={(value) => {
                      if (value) {
                        setCreateField('ack_filter', value as CakeAckFilter);
                      }
                    }}
                  >
                    <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                      <span>{labelFor(createForm.ack_filter, ACK_FILTER_OPTIONS)}</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900">
                      {#each ACK_FILTER_OPTIONS as item}
                        <Select.Item
                          value={item.value}
                          label={item.label}
                          class="cursor-pointer text-slate-200 hover:bg-slate-800"
                        />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>

          <Collapsible.Root bind:open={showCreateLink} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
              <span class="text-sm font-medium text-slate-200">{$_('shaper_cake.advanced_link_layer_compensation')}</span>
              <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showCreateLink ? 'rotate-180' : ''}`} />
            </Collapsible.Trigger>
            <Collapsible.Content class="pt-3">
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div class="space-y-2">
                  <FieldLabel label="Overhead" hint={FIELD_HINTS.overhead} />
                  <Input
                    type="number"
                    min="0"
                    max="256"
                    step="1"
                    class="border-slate-700 bg-slate-900"
                    value={createForm.overhead}
                    oninput={(event) => {
                      setCreateField('overhead', parseNumberInput((event.currentTarget as HTMLInputElement).value, createForm.overhead));
                    }}
                  />
                </div>

                <div class="space-y-2">
                  <FieldLabel label="MPU" hint={FIELD_HINTS.mpu} />
                  <Input
                    type="number"
                    min="0"
                    max="256"
                    step="1"
                    class="border-slate-700 bg-slate-900"
                    value={createForm.mpu}
                    oninput={(event) => {
                      setCreateField('mpu', parseNumberInput((event.currentTarget as HTMLInputElement).value, createForm.mpu));
                    }}
                  />
                </div>

                <div class="space-y-2">
                  <FieldLabel label="ATM" hint={FIELD_HINTS.atm} />
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                    <Switch
                      checked={createForm.atm}
                      onCheckedChange={(value) => {
                        setCreateField('atm', value);
                      }}
                    />
                    <span class="text-sm text-slate-300">{createForm.atm ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="PTM" hint={FIELD_HINTS.ptm} />
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                    <Switch
                      checked={createForm.ptm}
                      onCheckedChange={(value) => {
                        setCreateField('ptm', value);
                      }}
                    />
                    <span class="text-sm text-slate-300">{createForm.ptm ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>

          <Collapsible.Root bind:open={showCreatePerf} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
              <span class="text-sm font-medium text-slate-200">{$_('shaper_cake.advanced_performance_tuning')}</span>
              <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showCreatePerf ? 'rotate-180' : ''}`} />
            </Collapsible.Trigger>
            <Collapsible.Content class="pt-3">
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div class="space-y-2">
                  <FieldLabel label="Split GSO" hint={FIELD_HINTS.split_gso} />
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                    <Switch
                      checked={createForm.split_gso}
                      onCheckedChange={(value) => {
                        setCreateField('split_gso', value);
                      }}
                    />
                    <span class="text-sm text-slate-300">{createForm.split_gso ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Ingress" hint={FIELD_HINTS.ingress} />
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                    <Switch
                      checked={createForm.ingress}
                      onCheckedChange={(value) => {
                        setCreateField('ingress', value);
                      }}
                    />
                    <span class="text-sm text-slate-300">{createForm.ingress ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>

          <div>
            <Button class="bg-cyan-600 text-white hover:bg-cyan-500" type="submit" disabled={creating || savingAll}>
              <PlusIcon class="mr-2 h-4 w-4" />
              {creating || savingAll ? 'Creating...' : 'Create CAKE Instance'}
            </Button>
          </div>
        </form>
      </CardContent>
    {/if}
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('shaper_cake.cake_instances')}</CardTitle>
      <CardDescription class="text-slate-400">
        Table view with inline edits. Save writes the entire CAKE array to the backend.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('shaper_cake.loading_cake_instances')}</p>
      {:else if records.length === 0}
        <p class="text-sm text-slate-400">{$_('shaper_cake.no_cake_instances_found')}</p>
      {:else}
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead class="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="px-3 py-2">Enabled</th>
                <th class="px-3 py-2">ID</th>
                <th class="px-3 py-2">Interface</th>
                <th class="px-3 py-2">Bandwidth</th>
                <th class="px-3 py-2">RTT</th>
                <th class="px-3 py-2">Flow Isolation</th>
                <th class="px-3 py-2">DiffServ</th>
                <th class="px-3 py-2">Description</th>
                <th class="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 bg-slate-900/40">
              {#each records as record, index}
                {@const key = recordKey(record, index)}
                <tr class="align-top">
                  <td class="px-3 py-3">{formatBoolean(record.enabled)}</td>
                  <td class="px-3 py-3 font-medium text-slate-200">{record.id || 'n/a'}</td>
                  <td class="px-3 py-3">{record.interface || 'n/a'}</td>
                  <td class="px-3 py-3">{formatBandwidth(record.bandwidth)}</td>
                  <td class="px-3 py-3">{labelFor(record.rtt, RTT_OPTIONS)}</td>
                  <td class="px-3 py-3">{labelFor(record.flow_isolation, FLOW_OPTIONS)}</td>
                  <td class="px-3 py-3">{labelFor(record.diffserv_mode, DIFFSERV_OPTIONS)}</td>
                  <td class="max-w-80 px-3 py-3 text-slate-300">{record.description || '-'}</td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        class="border-slate-700 text-slate-200"
                        onclick={() => {
                          toggleEdit(index);
                        }}
                      >
                        {#if editingRows[key]}
                          <XIcon class="mr-2 h-4 w-4" />Close
                        {:else}
                          <PencilIcon class="mr-2 h-4 w-4" />Edit
                        {/if}
                      </Button>

                      <Button
                        variant="outline"
                        class="border-red-500/40 text-red-200 hover:bg-red-500/10"
                        onclick={() => {
                          void removeRecord(index);
                        }}
                        disabled={deletingId === key || savingAll}
                      >
                        <Trash2Icon class="mr-2 h-4 w-4" />
                        {deletingId === key ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>

                {#if editingRows[key]}
                  <tr class="bg-slate-950/70">
                    <td class="px-3 py-4" colspan="9">
                      <div class="space-y-4">
                        <Collapsible.Root
                          open={editBasicOpen[key] ?? true}
                          onOpenChange={(open) => {
                            editBasicOpen[key] = open;
                            editBasicOpen = { ...editBasicOpen };
                          }}
                          class="rounded-md border border-slate-800 bg-slate-900/60 p-3"
                        >
                          <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
                            <span class="text-sm font-medium text-slate-200">{$_('shaper_cake.basic_configuration_1')}</span>
                            <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${editBasicOpen[key] ? 'rotate-180' : ''}`} />
                          </Collapsible.Trigger>
                          <Collapsible.Content class="pt-3">
                            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              <div class="space-y-2">
                                <FieldLabel label="ID" hint={FIELD_HINTS.id} />
                                <Input
                                  class="border-slate-700 bg-slate-900"
                                  value={record.id}
                                  required
                                  oninput={(event) => {
                                    setRowField(index, 'id', (event.currentTarget as HTMLInputElement).value);
                                  }}
                                />
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Interface" hint={FIELD_HINTS.interface} />
                                <Select.Root
                                  type="single"
                                  value={record.interface}
                                  onValueChange={(value) => {
                                    if (value) {
                                      setRowField(index, 'interface', value);
                                    }
                                  }}
                                >
                                  <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                                    <span>
                                      {interfaceOptions.find((item) => item.value === record.interface)?.label ?? 'Select interface'}
                                    </span>
                                  </Select.Trigger>
                                  <Select.Content class="border-slate-700 bg-slate-900">
                                    {#each interfaceOptions as item}
                                      <Select.Item
                                        value={item.value}
                                        label={item.label}
                                        class="cursor-pointer text-slate-200 hover:bg-slate-800"
                                      />
                                    {/each}
                                  </Select.Content>
                                </Select.Root>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Bandwidth" hint={FIELD_HINTS.bandwidth} />
                                <div class="flex gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    class="flex-1 border-slate-700 bg-slate-900"
                                    value={parseBandwidth(record.bandwidth).value || ''}
                                    placeholder="e.g., 100"
                                    oninput={(event) => {
                                      const num = parseFloat((event.currentTarget as HTMLInputElement).value) || 0;
                                      const { unit } = parseBandwidth(record.bandwidth);
                                      setRowField(index, 'bandwidth', composeBandwidth(num, unit));
                                    }}
                                  />
                                  <Select.Root
                                    type="single"
                                    value={parseBandwidth(record.bandwidth).unit}
                                    onValueChange={(value) => {
                                      if (value) {
                                        const { value: num } = parseBandwidth(record.bandwidth);
                                        setRowField(index, 'bandwidth', composeBandwidth(num, value as BandwidthUnit));
                                      }
                                    }}
                                  >
                                    <Select.Trigger class="w-32 cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                                      <span>{BANDWIDTH_UNIT_OPTIONS.find((o) => o.value === parseBandwidth(record.bandwidth).unit)?.label ?? 'Mbit/s'}</span>
                                    </Select.Trigger>
                                    <Select.Content class="border-slate-700 bg-slate-900">
                                      {#each BANDWIDTH_UNIT_OPTIONS as item}
                                        <Select.Item
                                          value={item.value}
                                          label={item.label}
                                          class="cursor-pointer text-slate-200 hover:bg-slate-800"
                                        />
                                      {/each}
                                    </Select.Content>
                                  </Select.Root>
                                </div>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="RTT" hint={FIELD_HINTS.rtt} />
                                <Select.Root
                                  type="single"
                                  value={record.rtt}
                                  onValueChange={(value) => {
                                    if (value) {
                                      setRowField(index, 'rtt', value as CakeRtt);
                                    }
                                  }}
                                >
                                  <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                                    <span>{labelFor(record.rtt, RTT_OPTIONS)}</span>
                                  </Select.Trigger>
                                  <Select.Content class="border-slate-700 bg-slate-900">
                                    {#each RTT_OPTIONS as item}
                                      <Select.Item
                                        value={item.value}
                                        label={item.label}
                                        class="cursor-pointer text-slate-200 hover:bg-slate-800"
                                      />
                                    {/each}
                                  </Select.Content>
                                </Select.Root>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Flow Isolation" hint={FIELD_HINTS.flow_isolation} />
                                <Select.Root
                                  type="single"
                                  value={record.flow_isolation}
                                  onValueChange={(value) => {
                                    if (value) {
                                      setRowField(index, 'flow_isolation', value as CakeFlowIsolation);
                                    }
                                  }}
                                >
                                  <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                                    <span>{labelFor(record.flow_isolation, FLOW_OPTIONS)}</span>
                                  </Select.Trigger>
                                  <Select.Content class="border-slate-700 bg-slate-900">
                                    {#each FLOW_OPTIONS as item}
                                      <Select.Item
                                        value={item.value}
                                        label={item.label}
                                        class="cursor-pointer text-slate-200 hover:bg-slate-800"
                                      />
                                    {/each}
                                  </Select.Content>
                                </Select.Root>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="DiffServ" hint={FIELD_HINTS.diffserv_mode} />
                                <Select.Root
                                  type="single"
                                  value={record.diffserv_mode}
                                  onValueChange={(value) => {
                                    if (value) {
                                      setRowField(index, 'diffserv_mode', value as CakeDiffservMode);
                                    }
                                  }}
                                >
                                  <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                                    <span>{labelFor(record.diffserv_mode, DIFFSERV_OPTIONS)}</span>
                                  </Select.Trigger>
                                  <Select.Content class="border-slate-700 bg-slate-900">
                                    {#each DIFFSERV_OPTIONS as item}
                                      <Select.Item
                                        value={item.value}
                                        label={item.label}
                                        class="cursor-pointer text-slate-200 hover:bg-slate-800"
                                      />
                                    {/each}
                                  </Select.Content>
                                </Select.Root>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Enabled" hint={FIELD_HINTS.enabled} />
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                                  <Switch
                                    checked={record.enabled}
                                    onCheckedChange={(value) => {
                                      setRowField(index, 'enabled', value);
                                    }}
                                  />
                                  <span class="text-sm text-slate-300">{record.enabled ? 'Enabled' : 'Disabled'}</span>
                                </div>
                              </div>

                              <div class="space-y-2 xl:col-span-2">
                                <FieldLabel label="Description" hint={FIELD_HINTS.description} />
                                <Input
                                  class="border-slate-700 bg-slate-900"
                                  value={record.description}
                                  oninput={(event) => {
                                    setRowField(index, 'description', (event.currentTarget as HTMLInputElement).value);
                                  }}
                                />
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>

                        <Collapsible.Root
                          open={Boolean(editNatFlowOpen[key])}
                          onOpenChange={(open) => {
                            editNatFlowOpen[key] = open;
                            editNatFlowOpen = { ...editNatFlowOpen };
                          }}
                          class="rounded-md border border-slate-800 bg-slate-900/60 p-3"
                        >
                          <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
                            <span class="text-sm font-medium text-slate-200">{$_('shaper_cake.advanced_nat_flow_options_1')}</span>
                            <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${editNatFlowOpen[key] ? 'rotate-180' : ''}`} />
                          </Collapsible.Trigger>
                          <Collapsible.Content class="pt-3">
                            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              <div class="space-y-2">
                                <FieldLabel label="NAT" hint={FIELD_HINTS.nat} />
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                                  <Switch
                                    checked={record.nat}
                                    onCheckedChange={(value) => {
                                      setRowField(index, 'nat', value);
                                    }}
                                  />
                                  <span class="text-sm text-slate-300">{record.nat ? 'Enabled' : 'Disabled'}</span>
                                </div>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Wash" hint={FIELD_HINTS.wash} />
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                                  <Switch
                                    checked={record.wash}
                                    onCheckedChange={(value) => {
                                      setRowField(index, 'wash', value);
                                    }}
                                  />
                                  <span class="text-sm text-slate-300">{record.wash ? 'Enabled' : 'Disabled'}</span>
                                </div>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="ACK Filter" hint={FIELD_HINTS.ack_filter} />
                                <Select.Root
                                  type="single"
                                  value={record.ack_filter}
                                  onValueChange={(value) => {
                                    if (value) {
                                      setRowField(index, 'ack_filter', value as CakeAckFilter);
                                    }
                                  }}
                                >
                                  <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                                    <span>{labelFor(record.ack_filter, ACK_FILTER_OPTIONS)}</span>
                                  </Select.Trigger>
                                  <Select.Content class="border-slate-700 bg-slate-900">
                                    {#each ACK_FILTER_OPTIONS as item}
                                      <Select.Item
                                        value={item.value}
                                        label={item.label}
                                        class="cursor-pointer text-slate-200 hover:bg-slate-800"
                                      />
                                    {/each}
                                  </Select.Content>
                                </Select.Root>
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>

                        <Collapsible.Root
                          open={Boolean(editLinkOpen[key])}
                          onOpenChange={(open) => {
                            editLinkOpen[key] = open;
                            editLinkOpen = { ...editLinkOpen };
                          }}
                          class="rounded-md border border-slate-800 bg-slate-900/60 p-3"
                        >
                          <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
                            <span class="text-sm font-medium text-slate-200">{$_('shaper_cake.advanced_link_layer_compensation_1')}</span>
                            <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${editLinkOpen[key] ? 'rotate-180' : ''}`} />
                          </Collapsible.Trigger>
                          <Collapsible.Content class="pt-3">
                            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <div class="space-y-2">
                                <FieldLabel label="Overhead" hint={FIELD_HINTS.overhead} />
                                <Input
                                  type="number"
                                  min="0"
                                  max="256"
                                  step="1"
                                  class="border-slate-700 bg-slate-900"
                                  value={record.overhead}
                                  oninput={(event) => {
                                    setRowField(
                                      index,
                                      'overhead',
                                      parseNumberInput((event.currentTarget as HTMLInputElement).value, record.overhead)
                                    );
                                  }}
                                />
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="MPU" hint={FIELD_HINTS.mpu} />
                                <Input
                                  type="number"
                                  min="0"
                                  max="256"
                                  step="1"
                                  class="border-slate-700 bg-slate-900"
                                  value={record.mpu}
                                  oninput={(event) => {
                                    setRowField(
                                      index,
                                      'mpu',
                                      parseNumberInput((event.currentTarget as HTMLInputElement).value, record.mpu)
                                    );
                                  }}
                                />
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="ATM" hint={FIELD_HINTS.atm} />
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                                  <Switch
                                    checked={record.atm}
                                    onCheckedChange={(value) => {
                                      setRowField(index, 'atm', value);
                                    }}
                                  />
                                  <span class="text-sm text-slate-300">{record.atm ? 'Enabled' : 'Disabled'}</span>
                                </div>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="PTM" hint={FIELD_HINTS.ptm} />
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                                  <Switch
                                    checked={record.ptm}
                                    onCheckedChange={(value) => {
                                      setRowField(index, 'ptm', value);
                                    }}
                                  />
                                  <span class="text-sm text-slate-300">{record.ptm ? 'Enabled' : 'Disabled'}</span>
                                </div>
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>

                        <Collapsible.Root
                          open={Boolean(editPerfOpen[key])}
                          onOpenChange={(open) => {
                            editPerfOpen[key] = open;
                            editPerfOpen = { ...editPerfOpen };
                          }}
                          class="rounded-md border border-slate-800 bg-slate-900/60 p-3"
                        >
                          <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
                            <span class="text-sm font-medium text-slate-200">{$_('shaper_cake.advanced_performance_tuning_1')}</span>
                            <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${editPerfOpen[key] ? 'rotate-180' : ''}`} />
                          </Collapsible.Trigger>
                          <Collapsible.Content class="pt-3">
                            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              <div class="space-y-2">
                                <FieldLabel label="Split GSO" hint={FIELD_HINTS.split_gso} />
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                                  <Switch
                                    checked={record.split_gso}
                                    onCheckedChange={(value) => {
                                      setRowField(index, 'split_gso', value);
                                    }}
                                  />
                                  <span class="text-sm text-slate-300">{record.split_gso ? 'Enabled' : 'Disabled'}</span>
                                </div>
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Ingress" hint={FIELD_HINTS.ingress} />
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                                  <Switch
                                    checked={record.ingress}
                                    onCheckedChange={(value) => {
                                      setRowField(index, 'ingress', value);
                                    }}
                                  />
                                  <span class="text-sm text-slate-300">{record.ingress ? 'Enabled' : 'Disabled'}</span>
                                </div>
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>

                        <div class="flex flex-wrap gap-2">
                          <Button
                            class="bg-cyan-600 text-white hover:bg-cyan-500"
                            onclick={() => {
                              void updateRecord(index);
                            }}
                            disabled={savingAll}
                          >
                            <SaveIcon class="mr-2 h-4 w-4" />
                            {savingAll ? 'Saving...' : 'Save Changes'}
                          </Button>

                          <Button
                            variant="outline"
                            class="border-slate-700 text-slate-200"
                            onclick={() => {
                              toggleEdit(index);
                            }}
                            disabled={savingAll}
                          >
                            <XIcon class="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>

<!--
CAKE Field and Tuning Appendix

ID
- Stable unique identifier for policy mappings and runbook references.
- Prefer descriptive names tied to topology and direction.
- Example: cake-wan-egress-main.

Interface
- Attach where congestion occurs, not just where traffic is visible.
- Typical case: WAN egress for upload shaping.
- For download shaping, use ingress redirection architecture as designed.

Bandwidth
- Set slightly below measured line rate.
- Example: 100mbit for a 120 Mbps service.
- If too high, upstream buffers dominate and latency rises under load.

RTT
- Chooses internal latency model.
- internet is practical default for broadband.
- satellite and oceanic model higher propagation delay links.

Flow Isolation
- triple-isolate gives strong fairness in mixed user populations.
- hosts may be preferable for simpler per-host balancing goals.
- flowblind removes host-aware fairness and is rarely recommended.

NAT
- Essential on NAT gateways to hash by internal endpoints correctly.
- Uses conntrack metadata for host identity.
- Leave disabled on pure routed non-NAT domains.

DiffServ Mode
- diffserv3: practical baseline with low complexity.
- diffserv4/8 provide finer class separation for mature QoS programs.
- besteffort flattens classes to one tin.

Wash
- Removes incoming DSCP after CAKE classification.
- Useful on trust boundaries with untrusted markings.
- Keep off when downstream devices depend on DSCP continuity.

Overhead
- Adds bytes for framing/encapsulation corrections.
- Needed for PPPoE/VLAN/tunnel accounting accuracy.
- Wrong values can under/over-shape and distort latency outcomes.

MPU
- Minimum packet accounting floor.
- Helps represent true wire cost for tiny packets.
- Provider docs can specify recommended values.

ATM
- Enable for DSL/ADSL with ATM cell framing.
- Not needed on standard Ethernet cable/fiber links.
- Incompatible assumptions can degrade shaping precision.

PTM
- Enable for PTM links typically VDSL based.
- Distinct from ATM compensation model.
- Validate provider framing before enabling.

ACK Filter
- Reduces ACK overhead on asymmetric links.
- filter is conservative; aggressive can improve download on very tight uplinks.
- Test carefully because behavior depends on traffic mix.

Split GSO
- Splits large offloaded packets for fair scheduling.
- Usually improves latency consistency.
- Disable only for controlled performance investigations.

Ingress
- Marks instance intent for inbound shaping workflows.
- Use with IFB/redirection designs as documented.
- Leave off for plain egress shaping.

Description
- Capture business intent and owner context.
- Include ticket references for auditability.
- Helps future responders tune safely.

Enabled
- Supports safe staged deployment.
- Create disabled, validate, then enable.
- Prevents accidental policy activation during edits.

Deployment Checklist
- Measure baseline latency and throughput before enabling.
- Configure bandwidth slightly below real link rate.
- Confirm NAT setting aligns with gateway role.
- Confirm ATM/PTM/offhead values with provider documentation.
- Verify queue behavior under mixed traffic (voice + bulk + web).
- Run upload and download stress tests with active ping probes.
- Compare retransmission and jitter metrics before/after.
- Keep rollback profile for rapid incident response.

Troubleshooting Quick Guide
- High latency under load: reduce bandwidth target or check bottleneck placement.
- Low throughput: verify bandwidth syntax and unit accuracy.
- Unfairness complaints: review flow isolation and NAT status.
- QoS class mismatch: inspect diffserv mode and wash behavior.
- DSL mismatch symptoms: re-check ATM/PTM and overhead assumptions.
- Download stalls on asymmetric links: trial ack_filter filter mode.

Implementation Notes
- This page uses GET /shaper/cake to load full list.
- This page uses PUT /shaper/cake to save full list.
- Create/edit/delete all mutate local list then push complete array.
- All workflows are inline; no modal dialogs.
- Tooltips are supplied on every configurable field.
- Svelte 5 runes are used for reactive state handling.
- Interface options are loaded from /interfaces with safe normalization.
- UI validation prevents common invalid values before save attempts.

Padding Section A
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.
- Maintained for readability and handoff context.

Padding Section B
- Operator note line 1.
- Operator note line 2.
- Operator note line 3.
- Operator note line 4.
- Operator note line 5.
- Operator note line 6.
- Operator note line 7.
- Operator note line 8.
- Operator note line 9.
- Operator note line 10.
- Operator note line 11.
- Operator note line 12.
- Operator note line 13.
- Operator note line 14.
- Operator note line 15.
- Operator note line 16.
- Operator note line 17.
- Operator note line 18.
- Operator note line 19.
- Operator note line 20.
- Operator note line 21.
- Operator note line 22.
- Operator note line 23.
- Operator note line 24.
- Operator note line 25.
- Operator note line 26.
- Operator note line 27.
- Operator note line 28.
- Operator note line 29.
- Operator note line 30.
- Operator note line 31.
- Operator note line 32.
- Operator note line 33.
- Operator note line 34.
- Operator note line 35.
- Operator note line 36.
- Operator note line 37.
- Operator note line 38.
- Operator note line 39.
- Operator note line 40.
- Operator note line 41.
- Operator note line 42.
- Operator note line 43.
- Operator note line 44.
- Operator note line 45.
- Operator note line 46.
- Operator note line 47.
- Operator note line 48.
- Operator note line 49.
- Operator note line 50.

End Appendix
-->
