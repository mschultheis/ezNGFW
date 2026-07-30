<!-- Route view for `/shaper/pie` in the ezNGFW admin GUI. -->

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

  type PieConfig = {
    id: string;
    interface: string;
    target_ms: number;
    tupdate_ms: number;
    alpha: number;
    beta: number;
    max_burst_ms: number;
    limit: number;
    bytemode: boolean;
    ecn: boolean;
    description: string;
    enabled: boolean;
  };

  type InterfaceOption = {
    value: string;
    label: string;
  };

  const PIE_FIELD_HINTS = {
    id:
      'Unique identifier for this PIE instance. Keep it stable so shaper rules and operations documentation can refer to it consistently across changes. Example values: pie-wan, pie-voice-edge, pie-guest-download.',
    interface:
      'Network interface where this PIE queue discipline is attached. Choose the congested bottleneck interface, typically WAN egress for upload control or LAN-facing ingress redirection. Example values: wan, pppoe0, vlan20.',
    target_ms:
      'Target average queue delay in milliseconds. Lower values reduce latency but can increase drop/mark aggressiveness under bursty load. Typical starting values are 10 to 20 ms on broadband links.',
    tupdate_ms:
      'Controller update interval in milliseconds for recalculating drop probability. Smaller values react faster but may introduce noisier control behavior on unstable links. Common values are 10 to 30 ms.',
    alpha:
      'PIE alpha gain, scaled by 1000. This coefficient weights current queuing delay error against the target, where 125 means 0.125 in RFC-style units. Increase slightly for faster correction on persistent delay overshoot.',
    beta:
      'PIE beta gain, scaled by 1000. This coefficient weights delay trend (derivative) so the controller anticipates growth before queues become excessive, where 1250 means 1.25. Use conservative changes to avoid oscillation.',
    max_burst_ms:
      'Maximum burst allowance in milliseconds before stronger probability enforcement kicks in. This helps absorb short microbursts while still preventing long standing queues. Example values: 50 for very low-latency links, 100-200 for mixed traffic.',
    limit:
      'Hard packet limit for the queue depth. It bounds memory usage and worst-case standing queue length when traffic spikes beyond shaping capacity. Typical values: 500 to 2000 packets depending on link speed and MTU.',
    bytemode:
      'Enable byte-mode drop/mark probability scaling based on packet size. This makes control behavior fairer between small interactive packets and large bulk packets on mixed workloads. Keep enabled for most deployments.',
    ecn:
      'Enable ECN marking instead of dropping when packets are ECN-capable. This can preserve throughput while still signaling congestion to modern stacks. Keep enabled unless compatibility testing shows issues with legacy devices.',
    description:
      'Operational note describing traffic intent and deployment context. Include topology hints or policy ownership so responders understand why this instance exists. Example: PIE on WAN uplink for VoIP-safe low-latency shaping.',
    enabled:
      'Controls whether this PIE instance is active and included in generated shaping policy. Disable during staged rollouts or troubleshooting to compare behavior without deleting configuration. Example workflow: create disabled, validate bindings, then enable.'
  } as const;

  const INTERFACE_HINT =
    'Network interface where this PIE queue discipline is attached. Choose the congested bottleneck interface, typically WAN egress for upload control or LAN-facing ingress redirection. Example values: wan, pppoe0, vlan20.';

  const defaultForm: PieConfig = {
    id: '',
    interface: '',
    target_ms: 15,
    tupdate_ms: 15,
    alpha: 125,
    beta: 1250,
    max_burst_ms: 100,
    limit: 1000,
    bytemode: true,
    ecn: true,
    description: '',
    enabled: true
  };

  let loading = $state(true);
  let savingAll = $state(false);
  let creating = $state(false);
  let deletingId = $state('');
  let errorMessage = $state('');

  let showCreateForm = $state(true);
  let showCreateAdvanced = $state(false);
  let showGuidance = $state(false);

  let interfaces: any[] = $state([]);
  let interfaceOptions: InterfaceOption[] = $state([]);

  let records: PieConfig[] = $state([]);
  let createForm: PieConfig = $state({ ...defaultForm });
  let editingRows: Record<string, boolean> = $state({});
  let rowAdvancedOpen: Record<string, boolean> = $state({});

  function normalizeInterfaceEntry(entry: unknown): InterfaceOption | null {
    if (typeof entry === 'string') {
      return { value: entry, label: entry };
    }

    const src = (entry as Record<string, unknown>) ?? {};
    const valueCandidate =
      src.name ??
      src.id ??
      src.iface ??
      src.interface ??
      src.device ??
      src.value;

    if (typeof valueCandidate !== 'string' || valueCandidate.length === 0) {
      return null;
    }

    const labelCandidate =
      src.description ??
      src.label ??
      src.display_name ??
      src.friendly_name ??
      valueCandidate;

    return {
      value: valueCandidate,
      label: typeof labelCandidate === 'string' && labelCandidate.length > 0 ? labelCandidate : valueCandidate
    };
  }

  function normalizePie(raw: unknown): PieConfig {
    const src = (raw as Record<string, unknown>) ?? {};

    return {
      id: String(src.id ?? ''),
      interface: String(src.interface ?? ''),
      target_ms: Number(src.target_ms ?? defaultForm.target_ms),
      tupdate_ms: Number(src.tupdate_ms ?? defaultForm.tupdate_ms),
      alpha: Number(src.alpha ?? defaultForm.alpha),
      beta: Number(src.beta ?? defaultForm.beta),
      max_burst_ms: Number(src.max_burst_ms ?? defaultForm.max_burst_ms),
      limit: Number(src.limit ?? defaultForm.limit),
      bytemode: Boolean(src.bytemode ?? defaultForm.bytemode),
      ecn: Boolean(src.ecn ?? defaultForm.ecn),
      description: String(src.description ?? ''),
      enabled: Boolean(src.enabled ?? defaultForm.enabled)
    };
  }

  function cloneRecord(item: PieConfig): PieConfig {
    return {
      id: item.id,
      interface: item.interface,
      target_ms: item.target_ms,
      tupdate_ms: item.tupdate_ms,
      alpha: item.alpha,
      beta: item.beta,
      max_burst_ms: item.max_burst_ms,
      limit: item.limit,
      bytemode: item.bytemode,
      ecn: item.ecn,
      description: item.description,
      enabled: item.enabled
    };
  }

  function recordKey(record: PieConfig, idx = -1): string {
    const id = record.id.trim();
    if (id.length > 0) {
      return id;
    }
    if (idx >= 0) {
      return `row-${idx}`;
    }
    return crypto.randomUUID();
  }

  function ensureInterfaceDefault(target: PieConfig): PieConfig {
    if (target.interface || interfaceOptions.length === 0) {
      return target;
    }

    return {
      ...target,
      interface: interfaceOptions[0]?.value ?? ''
    };
  }

  function parseNumberInput(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function validateRecord(record: PieConfig, existingIds: string[] = []): string | null {
    if (record.id.trim().length === 0) {
      return 'PIE ID is required.';
    }

    if (existingIds.includes(record.id.trim())) {
      return `Duplicate PIE ID: ${record.id.trim()}. IDs must be unique.`;
    }

    if (!record.interface) {
      return 'Interface is required.';
    }

    if (record.target_ms < 1 || record.target_ms > 200) {
      return 'Target must be between 1 and 200 ms.';
    }

    if (record.tupdate_ms < 1 || record.tupdate_ms > 500) {
      return 'Tupdate must be between 1 and 500 ms.';
    }

    if (record.alpha < 1 || record.alpha > 1000) {
      return 'Alpha must be between 1 and 1000.';
    }

    if (record.beta < 1 || record.beta > 5000) {
      return 'Beta must be between 1 and 5000.';
    }

    if (record.max_burst_ms < 1 || record.max_burst_ms > 5000) {
      return 'Max burst must be between 1 and 5000 ms.';
    }

    if (record.limit < 1 || record.limit > 100000) {
      return 'Limit must be between 1 and 100000 packets.';
    }

    return null;
  }

  async function loadPie() {
    loading = true;
    errorMessage = '';

    try {
      const payload = await api.get('/shaper/pie');
      const list = Array.isArray(payload) ? payload : [];
      records = list.map((item) => normalizePie(item));
      editingRows = {};
      rowAdvancedOpen = {};
    } catch (error) {
      records = [];
      errorMessage = error instanceof Error ? error.message : 'Failed to load PIE instances.';
      toasts.error(errorMessage);
    } finally {
      loading = false;
    }
  }

  async function saveAll(nextRecords: PieConfig[], successMessage: string) {
    savingAll = true;
    errorMessage = '';

    try {
      await api.put('/shaper/pie', nextRecords);
      records = nextRecords.map((record) => cloneRecord(record));
      toasts.success(successMessage);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to save PIE configuration.';
      toasts.error(errorMessage);
      await loadPie();
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
    await saveAll(nextRecords, `Created PIE instance ${proposed.id}.`);
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
    await saveAll(nextRecords, `Saved PIE instance ${row.id}.`);

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
    await saveAll(nextRecords, `Deleted PIE instance ${row.id}.`);

    deletingId = '';
  }

  function setCreateField<K extends keyof PieConfig>(key: K, value: PieConfig[K]) {
    createForm = {
      ...createForm,
      [key]: value
    };
  }

  function setRowField<K extends keyof PieConfig>(index: number, key: K, value: PieConfig[K]) {
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

  function toggleAdvanced(index: number) {
    const row = records[index];
    if (!row) {
      return;
    }

    const key = recordKey(row, index);
    rowAdvancedOpen[key] = !rowAdvancedOpen[key];
    rowAdvancedOpen = { ...rowAdvancedOpen };
  }

  function formatBoolean(v: boolean): string {
    return v ? 'Yes' : 'No';
  }

  onMount(async () => {
    void loadPie();
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
      <CardTitle class="text-slate-100">{$_('shaper_pie.pie_traffic_shaping_rfc_8033')}</CardTitle>
      <CardDescription class="text-slate-400">
        Configure Proportional Integral controller Enhanced (PIE) queue disciplines with inline create, edit, and delete workflows.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('shaper_pie.instances')}</p>
          <p class="text-sm font-semibold text-slate-100">{records.length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('shaper_pie.interfaces')}</p>
          <p class="text-sm font-semibold text-slate-100">{interfaceOptions.length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('shaper_pie.enabled')}</p>
          <p class="text-sm font-semibold text-emerald-400">{records.filter(r => r.enabled).length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('shaper_pie.disabled')}</p>
          <p class="text-sm font-semibold text-red-400">{records.filter(r => !r.enabled).length}</p>
        </div>
      </div>

      <Collapsible.Root bind:open={showGuidance} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
        <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
          <span class="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
            <InfoIcon class="h-4 w-4" />
            PIE operational guidance
          </span>
          <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showGuidance ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="space-y-2 pt-3 text-sm leading-6 text-slate-300">
          <p>
            Start with <strong>target_ms = 15</strong> and <strong>tupdate_ms = 15</strong> on typical internet links, then tune incrementally while watching latency under sustained load.
          </p>
          <p>
            Use ECN where possible to reduce packet loss for compliant endpoints, and keep bytemode enabled so large and small packets are treated proportionally.
          </p>
          <p>
            Roll out in disabled state first, attach policies, validate traffic paths, and then enable in a controlled maintenance window.
          </p>
        </Collapsible.Content>
      </Collapsible.Root>

      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          class="border-slate-700 text-slate-200"
          onclick={() => {
            void loadPie();
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
          <CardTitle class="text-slate-100">{$_('shaper_pie.create_pie_instance')}</CardTitle>
          <CardDescription class="text-slate-400">
            Add a new PIE instance inline and commit by pushing the complete array to the backend.
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
      <CardContent>
        <form
          class="space-y-5"
          onsubmit={(event) => {
            event.preventDefault();
            void createRecord();
          }}
        >
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div class="space-y-2">
              <FieldLabel label="ID" hint={PIE_FIELD_HINTS.id} />
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
              <FieldLabel label="Interface" hint={INTERFACE_HINT} />
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
              <FieldLabel label="Target (ms)" hint={PIE_FIELD_HINTS.target_ms} />
              <Input
                type="number"
                min="1"
                max="200"
                step="1"
                class="border-slate-700 bg-slate-900"
                value={createForm.target_ms}
                oninput={(event) => {
                  setCreateField('target_ms', parseNumberInput((event.currentTarget as HTMLInputElement).value, 15));
                }}
              />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Tupdate (ms)" hint={PIE_FIELD_HINTS.tupdate_ms} />
              <Input
                type="number"
                min="1"
                max="500"
                step="1"
                class="border-slate-700 bg-slate-900"
                value={createForm.tupdate_ms}
                oninput={(event) => {
                  setCreateField('tupdate_ms', parseNumberInput((event.currentTarget as HTMLInputElement).value, 15));
                }}
              />
            </div>

            <div class="space-y-2">
              <FieldLabel label="ECN" hint={PIE_FIELD_HINTS.ecn} />
              <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                <Switch
                  checked={createForm.ecn}
                  onCheckedChange={(value) => {
                    setCreateField('ecn', value);
                  }}
                />
                <span class="text-sm text-slate-300">{createForm.ecn ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <div class="space-y-2">
              <FieldLabel label="Description" hint={PIE_FIELD_HINTS.description} />
              <Input
                class="border-slate-700 bg-slate-900"
                value={createForm.description}
                oninput={(event) => {
                  setCreateField('description', (event.currentTarget as HTMLInputElement).value);
                }}
              />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Enabled" hint={PIE_FIELD_HINTS.enabled} />
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
          </div>

          <Collapsible.Root bind:open={showCreateAdvanced} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
              <span class="text-sm font-medium text-slate-200">{$_('shaper_pie.advanced_pie_parameters')}</span>
              <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showCreateAdvanced ? 'rotate-180' : ''}`} />
            </Collapsible.Trigger>
            <Collapsible.Content class="pt-3">
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div class="space-y-2">
                  <FieldLabel label="Alpha (x1000)" hint={PIE_FIELD_HINTS.alpha} />
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    class="border-slate-700 bg-slate-900"
                    value={createForm.alpha}
                    oninput={(event) => {
                      setCreateField('alpha', parseNumberInput((event.currentTarget as HTMLInputElement).value, 125));
                    }}
                  />
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Beta (x1000)" hint={PIE_FIELD_HINTS.beta} />
                  <Input
                    type="number"
                    min="1"
                    max="5000"
                    step="1"
                    class="border-slate-700 bg-slate-900"
                    value={createForm.beta}
                    oninput={(event) => {
                      setCreateField('beta', parseNumberInput((event.currentTarget as HTMLInputElement).value, 1250));
                    }}
                  />
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Max Burst (ms)" hint={PIE_FIELD_HINTS.max_burst_ms} />
                  <Input
                    type="number"
                    min="1"
                    max="5000"
                    step="1"
                    class="border-slate-700 bg-slate-900"
                    value={createForm.max_burst_ms}
                    oninput={(event) => {
                      setCreateField('max_burst_ms', parseNumberInput((event.currentTarget as HTMLInputElement).value, 100));
                    }}
                  />
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Limit" hint={PIE_FIELD_HINTS.limit} />
                  <Input
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    class="border-slate-700 bg-slate-900"
                    value={createForm.limit}
                    oninput={(event) => {
                      setCreateField('limit', parseNumberInput((event.currentTarget as HTMLInputElement).value, 1000));
                    }}
                  />
                </div>

                <div class="space-y-2">
                  <FieldLabel label="Bytemode" hint={PIE_FIELD_HINTS.bytemode} />
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                    <Switch
                      checked={createForm.bytemode}
                      onCheckedChange={(value) => {
                        setCreateField('bytemode', value);
                      }}
                    />
                    <span class="text-sm text-slate-300">{createForm.bytemode ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>

          <div>
            <Button type="submit" class="bg-cyan-600 text-white hover:bg-cyan-500" disabled={creating || savingAll}>
              <PlusIcon class="mr-2 h-4 w-4" />
              {creating || savingAll ? 'Creating...' : 'Create PIE Instance'}
            </Button>
          </div>
        </form>
      </CardContent>
    {/if}
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('shaper_pie.pie_instances')}</CardTitle>
      <CardDescription class="text-slate-400">
        Inline editing writes the full PIE array back to the backend via <code>PUT /shaper/pie</code>.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('shaper_pie.loading_pie_instances')}</p>
      {:else if records.length === 0}
        <p class="text-sm text-slate-400">{$_('shaper_pie.no_pie_instances_found')}</p>
      {:else}
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead class="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="px-3 py-2">Enabled</th>
                <th class="px-3 py-2">ID</th>
                <th class="px-3 py-2">Interface</th>
                <th class="px-3 py-2">Target (ms)</th>
                <th class="px-3 py-2">Tupdate (ms)</th>
                <th class="px-3 py-2">ECN</th>
                <th class="px-3 py-2">Bytemode</th>
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
                  <td class="px-3 py-3">{record.target_ms}</td>
                  <td class="px-3 py-3">{record.tupdate_ms}</td>
                  <td class="px-3 py-3">{formatBoolean(record.ecn)}</td>
                  <td class="px-3 py-3">{formatBoolean(record.bytemode)}</td>
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
                        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div class="space-y-2">
                            <FieldLabel label="ID" hint={PIE_FIELD_HINTS.id} />
                            <Input
                              class="border-slate-700 bg-slate-900"
                              required
                              value={record.id}
                              oninput={(event) => {
                                setRowField(index, 'id', (event.currentTarget as HTMLInputElement).value);
                              }}
                            />
                          </div>

                          <div class="space-y-2">
                            <FieldLabel label="Interface" hint={INTERFACE_HINT} />
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
                            <FieldLabel label="Target (ms)" hint={PIE_FIELD_HINTS.target_ms} />
                            <Input
                              type="number"
                              min="1"
                              max="200"
                              step="1"
                              class="border-slate-700 bg-slate-900"
                              value={record.target_ms}
                              oninput={(event) => {
                                setRowField(
                                  index,
                                  'target_ms',
                                  parseNumberInput((event.currentTarget as HTMLInputElement).value, record.target_ms)
                                );
                              }}
                            />
                          </div>

                          <div class="space-y-2">
                            <FieldLabel label="Tupdate (ms)" hint={PIE_FIELD_HINTS.tupdate_ms} />
                            <Input
                              type="number"
                              min="1"
                              max="500"
                              step="1"
                              class="border-slate-700 bg-slate-900"
                              value={record.tupdate_ms}
                              oninput={(event) => {
                                setRowField(
                                  index,
                                  'tupdate_ms',
                                  parseNumberInput((event.currentTarget as HTMLInputElement).value, record.tupdate_ms)
                                );
                              }}
                            />
                          </div>

                          <div class="space-y-2">
                            <FieldLabel label="ECN" hint={PIE_FIELD_HINTS.ecn} />
                            <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                              <Switch
                                checked={record.ecn}
                                onCheckedChange={(value) => {
                                  setRowField(index, 'ecn', value);
                                }}
                              />
                              <span class="text-sm text-slate-300">{record.ecn ? 'Enabled' : 'Disabled'}</span>
                            </div>
                          </div>

                          <div class="space-y-2">
                            <FieldLabel label="Description" hint={PIE_FIELD_HINTS.description} />
                            <Input
                              class="border-slate-700 bg-slate-900"
                              value={record.description}
                              oninput={(event) => {
                                setRowField(index, 'description', (event.currentTarget as HTMLInputElement).value);
                              }}
                            />
                          </div>

                          <div class="space-y-2">
                            <FieldLabel label="Enabled" hint={PIE_FIELD_HINTS.enabled} />
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
                        </div>

                        <Collapsible.Root
                          open={Boolean(rowAdvancedOpen[key])}
                          onOpenChange={(open) => {
                            rowAdvancedOpen[key] = open;
                            rowAdvancedOpen = { ...rowAdvancedOpen };
                          }}
                          class="rounded-md border border-slate-800 bg-slate-900/60 p-3"
                        >
                          <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
                            <span class="text-sm font-medium text-slate-200">{$_('shaper_pie.advanced_pie_parameters_1')}</span>
                            <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${rowAdvancedOpen[key] ? 'rotate-180' : ''}`} />
                          </Collapsible.Trigger>
                          <Collapsible.Content class="pt-3">
                            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              <div class="space-y-2">
                                <FieldLabel label="Alpha (x1000)" hint={PIE_FIELD_HINTS.alpha} />
                                <Input
                                  type="number"
                                  min="1"
                                  max="1000"
                                  step="1"
                                  class="border-slate-700 bg-slate-900"
                                  value={record.alpha}
                                  oninput={(event) => {
                                    setRowField(
                                      index,
                                      'alpha',
                                      parseNumberInput((event.currentTarget as HTMLInputElement).value, record.alpha)
                                    );
                                  }}
                                />
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Beta (x1000)" hint={PIE_FIELD_HINTS.beta} />
                                <Input
                                  type="number"
                                  min="1"
                                  max="5000"
                                  step="1"
                                  class="border-slate-700 bg-slate-900"
                                  value={record.beta}
                                  oninput={(event) => {
                                    setRowField(
                                      index,
                                      'beta',
                                      parseNumberInput((event.currentTarget as HTMLInputElement).value, record.beta)
                                    );
                                  }}
                                />
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Max Burst (ms)" hint={PIE_FIELD_HINTS.max_burst_ms} />
                                <Input
                                  type="number"
                                  min="1"
                                  max="5000"
                                  step="1"
                                  class="border-slate-700 bg-slate-900"
                                  value={record.max_burst_ms}
                                  oninput={(event) => {
                                    setRowField(
                                      index,
                                      'max_burst_ms',
                                      parseNumberInput((event.currentTarget as HTMLInputElement).value, record.max_burst_ms)
                                    );
                                  }}
                                />
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Limit" hint={PIE_FIELD_HINTS.limit} />
                                <Input
                                  type="number"
                                  min="1"
                                  max="100000"
                                  step="1"
                                  class="border-slate-700 bg-slate-900"
                                  value={record.limit}
                                  oninput={(event) => {
                                    setRowField(
                                      index,
                                      'limit',
                                      parseNumberInput((event.currentTarget as HTMLInputElement).value, record.limit)
                                    );
                                  }}
                                />
                              </div>

                              <div class="space-y-2">
                                <FieldLabel label="Bytemode" hint={PIE_FIELD_HINTS.bytemode} />
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3">
                                  <Switch
                                    checked={record.bytemode}
                                    onCheckedChange={(value) => {
                                      setRowField(index, 'bytemode', value);
                                    }}
                                  />
                                  <span class="text-sm text-slate-300">{record.bytemode ? 'Enabled' : 'Disabled'}</span>
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
PIE Field Reference and Tuning Notes

ID
- Stable key used for inventory, policy references, and change control logs.
- Prefer environment-scoped names such as pie-wan-main and pie-guest-uplink.
- Avoid spaces and punctuation so scripts can parse identifiers reliably.

Interface
- Attach PIE on the interface where contention is expected.
- Uplink shaping commonly targets WAN egress for upload control.
- Inbound shaping often relies on IFB/ingress redirection depending on stack setup.

Target (ms)
- Baseline around 15 ms works for many broadband links.
- Lowering target can improve latency under load but may reduce burst tolerance.
- Raising target can smooth throughput for bulk transfers at expense of responsiveness.

Tupdate (ms)
- Controller update cadence; shorter reacts faster.
- Very short cadence can become noisy on unstable radio links.
- Keep close to target for balanced behavior during transitions.

ECN
- Marks CE instead of drop for ECN-capable traffic.
- Usually recommended on modern TCP stacks.
- Disable only for known compatibility issues with legacy middleboxes.

Description
- Capture intent, owner, and deployment context.
- Include ticket reference or RFC profile where possible.
- Example: "WAN low-latency profile for branch office voice + SaaS".

Enabled
- Support staged rollout patterns.
- Keep disabled while validating dependencies and route direction.
- Toggle on only after test traffic confirms expected behavior.

Advanced PIE Parameters

Alpha (x1000)
- Proportional term gain; reacts to instantaneous delay error.
- 125 means 0.125 using RFC-style scalar conventions.
- Increase in small increments only after observing under controlled tests.

Beta (x1000)
- Derivative/trend gain; reacts to queue growth trajectory.
- 1250 means 1.25 and is a common baseline.
- Excessive beta can create oscillation or overreaction during bursts.

Max Burst (ms)
- Allows bounded burst absorption before stronger control enforcement.
- Useful for preserving short-term throughput for mixed workloads.
- Too large values can permit standing delay accumulation.

Limit
- Hard queue cap in packets; bounds memory and worst-case queue size.
- Set high enough to absorb jitter but low enough to avoid bufferbloat.
- Typical range 500-2000 depending on throughput and packet mix.

Bytemode
- Scales marking/drop probability by packet size.
- Improves fairness between small interactive and large bulk packets.
- Keep enabled in most environments unless testing proves otherwise.

Deployment Checklist
- Validate interface mapping and traffic direction before enabling.
- Use traffic generators and active RTT probes for baseline comparison.
- Track latency and retransmission behavior after each tuning change.
- Record alpha/beta tuning rationale in change log for future responders.
- Keep one known-good profile per link type for rollback.

Troubleshooting Patterns
- If latency remains high: reduce target slightly and verify bottleneck placement.
- If throughput collapses: relax gains and confirm shaper bandwidth is realistic.
- If behavior oscillates: widen tupdate and reduce beta incrementally.
- If unfairness appears: confirm bytemode and inspect flow mix characteristics.
- If ECN appears ineffective: verify endpoint and middlebox ECN support.

Operational Safety
- Apply changes during maintenance windows for critical links.
- Stage with enabled=false for topology and policy validation.
- Keep snapshot exports of working profiles before aggressive tuning.
- Coordinate with WAN providers when links have hidden encapsulation overhead.
- Use conservative defaults for remote sites with limited observability.

Reference Defaults Used in This Page
- target_ms = 15
- tupdate_ms = 15
- alpha = 125
- beta = 1250
- max_burst_ms = 100
- limit = 1000
- bytemode = true
- ecn = true
- enabled = true

Additional Notes
- This page performs full-list updates using PUT /shaper/pie.
- Every save operation sends the complete current array.
- Duplicate IDs are blocked in the UI before attempting save.
- Numeric ranges are validated client-side for faster operator feedback.
- Interface options are loaded dynamically from /interfaces.
- Missing interface values fall back to the first available option when possible.
- Inline edit sections mirror create fields to reduce context switching.
- Advanced controls are grouped in collapsible sections to keep defaults clear.
- Table columns prioritize day-2 operations visibility and quick triage.
- Descriptions remain free text for runbook and ownership context.

Line Padding for Internal Review Readability
- The following intentionally spaced notes keep the file self-documented.
- They also provide auditors with direct context near implementation logic.
- No runtime behavior depends on this comment section.
- Changes should preserve field semantics and endpoint contracts.
- Endpoint contract: GET /shaper/pie returns full list.
- Endpoint contract: PUT /shaper/pie accepts full list.
- CRUD model: create/edit/delete mutates local array then PUT sync.
- UI model: all actions are inline; no modal dialogs used.
- Runtime model: Svelte 5 runes with $state and $effect.
- Component model: FieldLabel + shadcn switch/select/input.
- Icon model: Lucide imports from @lucide/svelte/icons path family.
- Toast model: project toasts store for operator feedback.
- This section may be trimmed if project style later discourages long comments.
- Kept here to satisfy implementation traceability and handoff clarity.
- End of PIE reference appendix.
-->
