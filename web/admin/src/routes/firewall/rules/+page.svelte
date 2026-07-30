<!-- Route view for `/firewall/rules` in the ezNGFW admin GUI. -->

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
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SaveIcon from '@lucide/svelte/icons/save';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import ArrowUpToLineIcon from '@lucide/svelte/icons/arrow-up-to-line';

  import { _ } from '$lib/i18n';
  type Option = { label: string; value: string };
  type FieldType = 'text' | 'number' | 'boolean' | 'select';
  type SortDirection = 'asc' | 'desc';
  type SortKey =
    | 'sequence'
    | 'enabled'
    | 'action'
    | 'protocol'
    | 'source'
    | 'destination'
    | 'port'
    | 'interface'
    | 'description';

  type RuleField = {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    advanced?: boolean;
    hint: string;
    options?: Option[];
  };

  type RuleModel = {
    id?: string;
    enabled: boolean;
    action: string;
    direction: string;
    interface: string;
    protocol: string;
    source_cidr: string;
    source_port: string;
    destination_cidr: string;
    destination_port: string;
    log: boolean;
    description: string;
    sequence: number;
    stateful_tracking: string;
    gateway: string;
    schedule: string;
    quick_match: boolean;
    tag: string;
    tagged: string;
  };

  const fields: RuleField[] = [
    {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      required: false,
      advanced: false,
      hint:
        'Enable or disable rule evaluation without deleting it. Keep emergency bypass rules disabled until needed.'
    },
    {
      key: 'action',
      label: 'Action',
      type: 'select',
      required: true,
      advanced: false,
      hint:
        'Pass allows, Block silently drops, Reject drops with response. Pick behavior based on visibility needs.',
      options: [
        { label: 'Pass', value: 'pass' },
        { label: 'Block', value: 'block' },
        { label: 'Reject', value: 'reject' }
      ]
    },
    {
      key: 'direction',
      label: 'Direction',
      type: 'select',
      required: true,
      advanced: false,
      hint:
        'Use in for ingress filtering and out for explicit egress control. Inbound is usually easier to reason about.',
      options: [
        { label: 'In', value: 'in' },
        { label: 'Out', value: 'out' }
      ]
    },
    {
      key: 'interface',
      label: 'Interface',
      type: 'select',
      required: true,
      advanced: false,
      hint: 'Bind rule to ingress interface. This list is loaded from /interfaces to reflect real ports and VLANs.',
      options: []
    },
    {
      key: 'protocol',
      label: 'Protocol',
      type: 'select',
      required: true,
      advanced: false,
      hint: 'Restrict to a specific protocol whenever possible to preserve least-privilege filtering.',
      options: [
        { label: 'Any', value: 'any' },
        { label: 'TCP', value: 'tcp' },
        { label: 'UDP', value: 'udp' },
        { label: 'ICMP', value: 'icmp' }
      ]
    },
    {
      key: 'source_cidr',
      label: 'Source CIDR',
      type: 'text',
      required: true,
      advanced: false,
      hint: 'Match source host or network in CIDR notation. Use aliases or precise prefixes for maintainability.'
    },
    {
      key: 'source_port',
      label: 'Source Port',
      type: 'text',
      required: false,
      advanced: false,
      hint: 'Optional source port or range such as 53 or 1024-65535. Leave blank for ephemeral clients.'
    },
    {
      key: 'destination_cidr',
      label: 'Destination CIDR',
      type: 'text',
      required: true,
      advanced: false,
      hint: 'Match destination host or network. Keep destination scope tight to prevent lateral movement.'
    },
    {
      key: 'destination_port',
      label: 'Destination Port',
      type: 'text',
      required: false,
      advanced: false,
      hint: 'Service destination port or range. Explicit ports make review and auditing significantly easier.'
    },
    {
      key: 'log',
      label: 'Log',
      type: 'boolean',
      required: false,
      advanced: false,
      hint: 'Enable rule-hit logging during rollout and incident response. Disable noisy stable flows when baselined.'
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      required: false,
      advanced: false,
      hint: 'Human-readable rationale with owner and ticket. Treat this as operational documentation.'
    },
    {
      key: 'sequence',
      label: 'Sequence',
      type: 'number',
      required: true,
      advanced: false,
      hint: 'Lower sequence evaluates earlier. Leave numbering gaps to allow fast insertion during incidents.'
    },
    {
      key: 'stateful_tracking',
      label: 'Stateful Tracking',
      type: 'select',
      required: false,
      advanced: true,
      hint: 'Choose state policy for connection tracking: keep, sloppy, synproxy, or none for stateless patterns.',
      options: [
        { label: 'Keep state', value: 'keep state' },
        { label: 'Sloppy state', value: 'sloppy state' },
        { label: 'Synproxy state', value: 'synproxy state' },
        { label: 'None', value: 'none' }
      ]
    },
    {
      key: 'gateway',
      label: 'Gateway',
      type: 'select',
      required: false,
      advanced: true,
      hint: 'Optional policy-based routing gateway. Leave as default unless steering traffic intentionally.',
      options: []
    },
    {
      key: 'schedule',
      label: 'Schedule',
      type: 'text',
      required: false,
      advanced: true,
      hint: 'Optional named schedule controlling rule activation windows such as business-hours blocks.'
    },
    {
      key: 'quick_match',
      label: 'Quick Match',
      type: 'boolean',
      required: false,
      advanced: true,
      hint: 'Stop rule processing once this rule matches. Useful for high-priority deterministic rules.'
    },
    {
      key: 'tag',
      label: 'Tag',
      type: 'text',
      required: false,
      advanced: true,
      hint: 'Assign packet tag for downstream matching and advanced policy chaining patterns.'
    },
    {
      key: 'tagged',
      label: 'Tagged',
      type: 'text',
      required: false,
      advanced: true,
      hint: 'Require packet to already carry a tag from a previous rule before matching this rule.'
    }
  ];

  const defaultRule = (): RuleModel => ({
    enabled: true,
    action: 'pass',
    direction: 'in',
    interface: 'any',
    protocol: 'any',
    source_cidr: 'any',
    source_port: '',
    destination_cidr: 'any',
    destination_port: '',
    log: false,
    description: '',
    sequence: 100,
    stateful_tracking: 'keep state',
    gateway: 'default',
    schedule: '',
    quick_match: true,
    tag: '',
    tagged: ''
  });

  let loading = $state(false);
  let creating = $state(false);
  let savingId = $state('');
  let deletingId = $state('');
  let interfacesLoading = $state(false);
  let lastLoaded = $state('never');
  let bulkBusy = $state(false);
  let reorderBusy = $state(false);

  let interfaceOptions = $state<Option[]>([{ label: 'Any', value: 'any' }]);
  let gatewayOptions = $state<Option[]>([{ label: 'Default', value: 'default' }]);

  let rules = $state<RuleModel[]>([]);
  let createModel = $state<RuleModel>(defaultRule());
  let editing = $state<Record<string, boolean>>({});
  let advancedOpen = $state<Record<string, boolean>>({ create: true });
  let selected = $state<Record<string, boolean>>({});

  let searchQuery = $state('');
  let actionFilter = $state('all');
  let protocolFilter = $state('all');
  let interfaceFilter = $state('all');
  let sortKey = $state<SortKey>('sequence');
  let sortDirection = $state<SortDirection>('asc');

  function toRule(raw: unknown): RuleModel {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const rawAction = String(row.action ?? 'pass').toLowerCase();
    const action = rawAction === 'drop' ? 'block' : rawAction;
    return {
      id: String(row.id ?? row.uuid ?? row.rule_id ?? ''),
      enabled: Boolean(row.enabled ?? true),
      action,
      direction: String(row.direction ?? 'in'),
      interface: String(row.interface ?? row.interface_name ?? 'any'),
      protocol: String(row.protocol ?? 'any'),
      source_cidr: String(row.source_cidr ?? row.src_cidr ?? row.source ?? 'any'),
      source_port: String(row.source_port ?? row.src_port ?? row.sport ?? ''),
      destination_cidr: String(row.destination_cidr ?? row.dst_cidr ?? row.destination ?? 'any'),
      destination_port: String(row.destination_port ?? row.dst_port ?? row.dport ?? ''),
      log: Boolean(row.log ?? row.logging ?? false),
      description: String(row.description ?? ''),
      sequence: Number(row.sequence ?? row.seq ?? row.id ?? 100),
      stateful_tracking: String(row.stateful_tracking ?? row.state_type ?? row.statetype ?? 'keep state'),
      gateway: String(row.gateway ?? 'default'),
      schedule: String(row.schedule ?? ''),
      quick_match: Boolean(row.quick_match ?? row.quick ?? true),
      tag: String(row.tag ?? ''),
      tagged: String(row.tagged ?? '')
    };
  }

  function modelId(model: RuleModel) {
    return model.id && model.id.length > 0
      ? model.id
      : `${model.sequence}:${model.interface}:${model.action}:${model.source_cidr}:${model.destination_cidr}`;
  }

  function getRuleIdentifier(rule: RuleModel) {
    return encodeURIComponent(rule.id ?? modelId(rule));
  }

  function sourceLabel(rule: RuleModel) {
    return `${rule.source_cidr}${rule.source_port ? `:${rule.source_port}` : ''}`;
  }

  function destinationLabel(rule: RuleModel) {
    return `${rule.destination_cidr}${rule.destination_port ? `:${rule.destination_port}` : ''}`;
  }

  function portLabel(rule: RuleModel) {
    if (rule.source_port && rule.destination_port) return `${rule.source_port} -> ${rule.destination_port}`;
    if (rule.destination_port) return rule.destination_port;
    if (rule.source_port) return rule.source_port;
    return 'any';
  }

  function setCreateField(key: keyof RuleModel, value: string | boolean | number) {
    (createModel as Record<string, string | boolean | number>)[key] = value;
    createModel = { ...createModel };
  }

  function setRuleField(rule: RuleModel, key: keyof RuleModel, value: string | boolean | number) {
    (rule as Record<string, string | boolean | number>)[key] = value;
    rules = [...rules];
  }

  function parsePortToken(value: string) {
    const token = value.trim();
    if (!token) return true;
    if (/^\d{1,5}$/.test(token)) return Number(token) <= 65535;
    if (/^\d{1,5}-\d{1,5}$/.test(token)) {
      const [start, end] = token.split('-').map((item) => Number(item));
      return start <= 65535 && end <= 65535 && start <= end;
    }
    return false;
  }

  function validateRule(rule: RuleModel) {
    if (!rule.interface) return 'Interface is required';
    if (!rule.action) return 'Action is required';
    if (!rule.direction) return 'Direction is required';
    if (!rule.protocol) return 'Protocol is required';
    if (!rule.source_cidr.trim()) return 'Source CIDR is required';
    if (!rule.destination_cidr.trim()) return 'Destination CIDR is required';
    if (!Number.isFinite(rule.sequence) || rule.sequence < 1) return 'Sequence must be a positive number';
    if (!parsePortToken(rule.source_port)) return 'Source port must be empty, a port, or a range';
    if (!parsePortToken(rule.destination_port)) return 'Destination port must be empty, a port, or a range';
    return '';
  }

  async function loadInterfaces() {
    interfacesLoading = true;
    try {
      const payload = await api.get<unknown[]>('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      const parsed = list
        .map((item) => {
          const row = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
          const value = String(row.name ?? row.id ?? item ?? '').trim();
          return { label: value, value };
        })
        .filter((item) => item.value.length > 0);
      interfaceOptions = [{ label: 'Any', value: 'any' }, ...parsed];
      const ifaceField = fields.find((field) => field.key === 'interface');
      if (ifaceField) ifaceField.options = interfaceOptions;
    } catch {
      interfaceOptions = [{ label: 'Any', value: 'any' }];
    } finally {
      interfacesLoading = false;
    }
  }

  async function loadGateways() {
    try {
      const payload = await api.get<Record<string, unknown>>('/routing');
      const candidates = [payload.gateways, payload.gateway_list, payload.wans, payload.static_routes].find((candidate) =>
        Array.isArray(candidate)
      );
      const list = Array.isArray(candidates) ? candidates : [];
      const parsed = list
        .map((item) => {
          const row = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
          const value = String(row.name ?? row.gateway ?? row.id ?? item ?? '').trim();
          return { label: value, value };
        })
        .filter((item) => item.value.length > 0);
      gatewayOptions = [{ label: 'Default', value: 'default' }, ...parsed];
      const gatewayField = fields.find((field) => field.key === 'gateway');
      if (gatewayField) gatewayField.options = gatewayOptions;
    } catch {
      gatewayOptions = [{ label: 'Default', value: 'default' }];
    }
  }

  async function loadRules() {
    loading = true;
    try {
      const payload = await api.get<unknown>('/firewall/rules');
      const list = Array.isArray(payload) ? payload : [];
      const nextRules = list.map((item) => toRule(item));
      const currentSelection = { ...selected };
      selected = Object.fromEntries(nextRules.map((rule) => [modelId(rule), Boolean(currentSelection[modelId(rule)])]));
      rules = nextRules;
      lastLoaded = new Date().toLocaleTimeString();
    } catch (error) {
      rules = [];
      selected = {};
      toasts.error(error instanceof Error ? error.message : 'Failed to load firewall rules');
    } finally {
      loading = false;
    }
  }

  function toPayload(rule: RuleModel): Record<string, unknown> {
    const srcPort = rule.source_port ? parseInt(rule.source_port, 10) : null;
    const dstPort = rule.destination_port ? parseInt(rule.destination_port, 10) : null;
    return {
      src_cidr: rule.source_cidr || 'any',
      dst_cidr: rule.destination_cidr || 'any',
      protocol: rule.protocol || 'any',
      src_port: !isNaN(srcPort as number) && srcPort ? srcPort : null,
      dst_port: !isNaN(dstPort as number) && dstPort ? dstPort : null,
      action: rule.action || 'pass',
      description: rule.description || undefined,
      enabled: rule.enabled,
      direction: rule.direction || undefined,
      interface: rule.interface || undefined,
      state_type: rule.stateful_tracking || undefined,
      gateway: rule.gateway === 'default' ? undefined : rule.gateway || undefined,
      schedule: rule.schedule || undefined,
      quick: rule.quick_match,
      tag: rule.tag || undefined,
      log: rule.log,
      sequence: rule.sequence
    };
  }

  async function createRule() {
    const problem = validateRule(createModel);
    if (problem) {
      toasts.error(problem);
      return;
    }
    creating = true;
    try {
      await api.post('/firewall/rules', toPayload(createModel));
      createModel = defaultRule();
      toasts.success($_('firewall.toast_firewall_rule_created'));
      await loadRules();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to create firewall rule');
    } finally {
      creating = false;
    }
  }

  async function duplicateRule(rule: RuleModel) {
    creating = true;
    const clone: RuleModel = {
      ...rule,
      id: undefined,
      sequence: rule.sequence + 1,
      description: rule.description ? `${rule.description} (copy)` : 'Copied rule'
    };
    try {
      await api.post('/firewall/rules', toPayload(clone));
      toasts.success($_('firewall.toast_firewall_rule_duplicated'));
      await loadRules();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to duplicate firewall rule');
    } finally {
      creating = false;
    }
  }

  async function saveRule(rule: RuleModel) {
    const problem = validateRule(rule);
    if (problem) {
      toasts.error(problem);
      return;
    }
    const id = getRuleIdentifier(rule);
    savingId = id;
    try {
      await api.put(`/firewall/rules/${id}`, toPayload(rule));
      toasts.success($_('firewall.toast_firewall_rule_updated'));
      editing[modelId(rule)] = false;
      editing = { ...editing };
      await loadRules();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save firewall rule');
    } finally {
      savingId = '';
    }
  }

  async function setRuleEnabled(rule: RuleModel, enabled: boolean) {
    const id = getRuleIdentifier(rule);
    const previous = rule.enabled;
    rule.enabled = enabled;
    rules = [...rules];
    savingId = id;
    try {
      await api.put(`/firewall/rules/${id}`, toPayload(rule));
      toasts.success(`Rule ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      rule.enabled = previous;
      rules = [...rules];
      toasts.error(error instanceof Error ? error.message : 'Failed to update rule status');
    } finally {
      savingId = '';
    }
  }

  async function deleteRule(rule: RuleModel) {
    const id = getRuleIdentifier(rule);
    deletingId = id;
    try {
      await api.del(`/firewall/rules/${id}`);
      toasts.success($_('firewall.toast_firewall_rule_deleted'));
      await loadRules();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to delete firewall rule');
    } finally {
      deletingId = '';
    }
  }

  /**
   * OPNsense-style reorder: move all currently selected rules so they appear
   * immediately before the given target rule. All affected rules are
   * re-sequenced with gaps of 10 to leave room for future insertions.
   */
  async function moveSelectedBefore(targetRule: RuleModel) {
    const selectedRules = rules
      .filter((r) => selected[modelId(r)])
      .sort((a, b) => a.sequence - b.sequence);
    if (selectedRules.length === 0) return;

    const ordered = [...rules].sort((a, b) => a.sequence - b.sequence);
    const selectedIds = new Set(selectedRules.map((r) => modelId(r)));
    const targetId = modelId(targetRule);

    // Build new order: non-selected rules in original order, with selected
    // rules spliced in right before the target.
    const newOrder: RuleModel[] = [];
    for (const rule of ordered) {
      if (selectedIds.has(modelId(rule))) continue;   // skip selected, we insert them later
      if (modelId(rule) === targetId) {
        // Insert all selected rules before target
        for (const sel of selectedRules) newOrder.push(sel);
      }
      newOrder.push(rule);
    }

    // Re-sequence with gaps of 10
    const updates: { rule: RuleModel; oldSeq: number; newSeq: number }[] = [];
    for (let i = 0; i < newOrder.length; i++) {
      const newSeq = (i + 1) * 10;
      if (newOrder[i].sequence !== newSeq) {
        updates.push({ rule: newOrder[i], oldSeq: newOrder[i].sequence, newSeq });
      }
    }

    if (updates.length === 0) return;

    // Optimistic update
    for (const u of updates) u.rule.sequence = u.newSeq;
    rules = [...rules];

    reorderBusy = true;
    try {
      for (const u of updates) {
        await api.put(`/firewall/rules/\${getRuleIdentifier(u.rule)}`, toPayload(u.rule));
      }
      toasts.success(`Moved \${selectedRules.length} rule\${selectedRules.length > 1 ? 's' : ''}`);
      clearSelection();
      await loadRules();
    } catch (error) {
      // Rollback
      for (const u of updates) u.rule.sequence = u.oldSeq;
      rules = [...rules];
      toasts.error(error instanceof Error ? error.message : 'Failed to reorder rules');
    } finally {
      reorderBusy = false;
    }
  }

  function toggleEdit(rule: RuleModel) {
    const id = modelId(rule);
    editing[id] = !editing[id];
    editing = { ...editing };
  }

  function toggleAdvanced(id: string) {
    advancedOpen[id] = !advancedOpen[id];
    advancedOpen = { ...advancedOpen };
  }

  function getOptions(field: RuleField): Option[] {
    if (field.key === 'interface') return interfaceOptions;
    if (field.key === 'gateway') return gatewayOptions;
    return field.options ?? [];
  }

  function updateSort(column: SortKey) {
    if (sortKey === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }
    sortKey = column;
    sortDirection = 'asc';
  }

  function sortIndicator(column: SortKey) {
    if (sortKey !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  function toggleSelectAll(checked: boolean) {
    const next = { ...selected };
    for (const rule of sortedFilteredRules) next[modelId(rule)] = checked;
    selected = next;
  }

  function toggleRowSelection(rule: RuleModel, checked: boolean) {
    selected[modelId(rule)] = checked;
    selected = { ...selected };
  }

  function clearSelection() {
    selected = {};
  }

  async function runBulkDelete() {
    const targetRules = rules.filter((rule) => selected[modelId(rule)]);
    if (targetRules.length === 0) return;
    bulkBusy = true;
    try {
      for (const rule of targetRules) await api.del(`/firewall/rules/${getRuleIdentifier(rule)}`);
      toasts.success(`Deleted ${targetRules.length} rule${targetRules.length === 1 ? '' : 's'}`);
      clearSelection();
      await loadRules();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Bulk delete failed');
    } finally {
      bulkBusy = false;
    }
  }

  async function runBulkEnabled(nextEnabled: boolean) {
    const targetRules = rules.filter((rule) => selected[modelId(rule)]);
    if (targetRules.length === 0) return;
    bulkBusy = true;
    try {
      for (const rule of targetRules) {
        rule.enabled = nextEnabled;
        await api.put(`/firewall/rules/${getRuleIdentifier(rule)}`, toPayload(rule));
      }
      toasts.success(`${nextEnabled ? 'Enabled' : 'Disabled'} ${targetRules.length} selected rule${targetRules.length === 1 ? '' : 's'}`);
      await loadRules();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Bulk enable/disable failed');
    } finally {
      bulkBusy = false;
    }
  }

  async function runBulkDuplicate() {
    const targetRules = rules
      .filter((rule) => selected[modelId(rule)])
      .sort((a, b) => a.sequence - b.sequence);
    if (targetRules.length === 0) return;

    bulkBusy = true;
    try {
      for (let index = 0; index < targetRules.length; index += 1) {
        const rule = targetRules[index];
        const clone: RuleModel = {
          ...rule,
          id: undefined,
          sequence: rule.sequence + index + 1,
          description: rule.description ? `${rule.description} (copy)` : 'Copied rule'
        };
        await api.post('/firewall/rules', toPayload(clone));
      }
      toasts.success(`Duplicated ${targetRules.length} selected rule${targetRules.length === 1 ? '' : 's'}`);
      clearSelection();
      await loadRules();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Bulk duplicate failed');
    } finally {
      bulkBusy = false;
    }
  }

  function actionBadgeClass(action: string) {
    if (action === 'pass') return 'border-transparent bg-emerald-500/20 text-emerald-200';
    if (action === 'reject') return 'border-transparent bg-amber-500/20 text-amber-200';
    return 'border-transparent bg-red-500/20 text-red-200';
  }

  function stringifyForSearch(rule: RuleModel) {
    return [
      rule.sequence,
      rule.enabled ? 'enabled' : 'disabled',
      rule.action,
      rule.protocol,
      sourceLabel(rule),
      destinationLabel(rule),
      portLabel(rule),
      rule.interface,
      rule.description,
      rule.direction
    ]
      .join(' ')
      .toLowerCase();
  }

  const activeCount = $derived.by(() => rules.filter((rule) => rule.enabled).length);
  const loggingCount = $derived.by(() => rules.filter((rule) => rule.log).length);

  const filteredRules = $derived.by(() => {
    const needle = searchQuery.trim().toLowerCase();
    return rules.filter((rule) => {
      if (actionFilter !== 'all' && rule.action !== actionFilter) return false;
      if (protocolFilter !== 'all' && rule.protocol !== protocolFilter) return false;
      if (interfaceFilter !== 'all' && rule.interface !== interfaceFilter) return false;
      if (!needle) return true;
      return stringifyForSearch(rule).includes(needle);
    });
  });

  const sortedFilteredRules = $derived.by(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const list = [...filteredRules];
    list.sort((left, right) => {
      const resolveValue = (rule: RuleModel) => {
        if (sortKey === 'sequence') return rule.sequence;
        if (sortKey === 'enabled') return rule.enabled ? 1 : 0;
        if (sortKey === 'action') return rule.action;
        if (sortKey === 'protocol') return rule.protocol;
        if (sortKey === 'source') return sourceLabel(rule);
        if (sortKey === 'destination') return destinationLabel(rule);
        if (sortKey === 'port') return portLabel(rule);
        if (sortKey === 'interface') return rule.interface;
        return rule.description;
      };

      const leftValue = resolveValue(left);
      const rightValue = resolveValue(right);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        const delta = (leftValue - rightValue) * direction;
        if (delta !== 0) return delta;
      } else {
        const delta = String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: 'base'
        });
        if (delta !== 0) return delta * direction;
      }

      return (left.sequence - right.sequence) * direction;
    });

    return list;
  });

  const selectedCount = $derived.by(() => rules.filter((rule) => selected[modelId(rule)]).length);
  const allVisibleSelected = $derived.by(
    () => sortedFilteredRules.length > 0 && sortedFilteredRules.every((rule) => selected[modelId(rule)])
  );

  onMount(() => {
    void loadInterfaces();
    void loadGateways();
    void loadRules();
  });
</script>

<div class="space-y-6 p-4 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <ShieldIcon class="h-5 w-5 text-cyan-300" />
        <CardTitle class="text-slate-100">{$_('firewall.firewall_rules')}</CardTitle>
      </div>
      <CardDescription class="text-slate-400">
        Table-first policy management with sorting, filtering, bulk actions, and inline editing.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('firewall.loaded_rules')}</p>
          <p class="text-lg font-semibold text-slate-100">{rules.length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('common.enabled')}</p>
          <p class="text-lg font-semibold text-emerald-300">{activeCount}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('firewall.logging_enabled')}</p>
          <p class="text-lg font-semibold text-amber-300">{loggingCount}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('firewall.last_refresh')}</p>
          <p class="text-sm font-medium text-slate-200">{lastLoaded}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          class="cursor-pointer border-slate-700 text-slate-100"
          onclick={() => void loadRules()}
          disabled={loading}
        >
          <RefreshCwIcon class="mr-2 h-4 w-4" />
          {loading ? 'Refreshing...' : 'Refresh rules'}
        </Button>
        <Badge class="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">Interfaces: {interfaceOptions.length}</Badge>
        <Badge class="border-amber-500/30 bg-amber-500/10 text-amber-200">Gateways: {gatewayOptions.length}</Badge>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('firewall.create_rule_inline')}</CardTitle>
      <CardDescription class="text-slate-400">
        Required and advanced fields are editable directly on this page.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <form
        class="space-y-4"
        onsubmit={(event) => {
          event.preventDefault();
          void createRule();
        }}
      >
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {#each fields.filter((field) => !field.advanced) as field}
            <div class="space-y-2">
              <FieldLabel label={field.label} hint={field.hint} />
              {#if field.type === 'boolean'}
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch
                    class="cursor-pointer"
                    checked={Boolean((createModel as Record<string, unknown>)[field.key])}
                    onCheckedChange={(checked) => setCreateField(field.key as keyof RuleModel, checked)}
                  />
                  <span class="text-sm text-slate-300"
                    >{Boolean((createModel as Record<string, unknown>)[field.key]) ? 'Enabled' : 'Disabled'}</span
                  >
                </div>
              {:else if field.type === 'select'}
                <Select.Root
                  type="single"
                  value={String((createModel as Record<string, unknown>)[field.key] ?? '')}
                  onValueChange={(value) => {
                    if (value) setCreateField(field.key as keyof RuleModel, value);
                  }}
                >
                  <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                    <span
                      >{getOptions(field).find(
                        (option) => option.value === String((createModel as Record<string, unknown>)[field.key])
                      )?.label ?? `Select ${field.label}`}</span
                    >
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-950 text-slate-100">
                    {#each getOptions(field) as option}
                      <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else if field.type === 'number'}
                <Input
                  type="number"
                  min="1"
                  class="border-slate-700 bg-slate-950 text-slate-100"
                  value={Number((createModel as Record<string, unknown>)[field.key] ?? 0)}
                  oninput={(event) =>
                    setCreateField(
                      field.key as keyof RuleModel,
                      Number((event.currentTarget as HTMLInputElement).value || 0)
                    )}
                />
              {:else}
                <Input
                  class="border-slate-700 bg-slate-950 text-slate-100"
                  value={String((createModel as Record<string, unknown>)[field.key] ?? '')}
                  oninput={(event) =>
                    setCreateField(field.key as keyof RuleModel, (event.currentTarget as HTMLInputElement).value)}
                />
              {/if}
            </div>
          {/each}
        </div>

        <Collapsible.Root open={advancedOpen.create} class="rounded-md border border-slate-800 bg-slate-950/60 p-4">
          <Collapsible.Trigger
            class="flex w-full cursor-pointer items-center justify-between text-left"
            onclick={() => toggleAdvanced('create')}
          >
            <span class="text-sm font-medium text-slate-100">{$_('common.advanced')}</span>
            <ChevronDownIcon
              class={`h-4 w-4 text-slate-400 transition-transform ${advancedOpen.create ? 'rotate-180' : ''}`}
            />
          </Collapsible.Trigger>
          <Collapsible.Content class="pt-4">
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {#each fields.filter((field) => field.advanced) as field}
                <div class="space-y-2">
                  <FieldLabel label={field.label} hint={field.hint} />
                  {#if field.type === 'boolean'}
                    <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                      <Switch
                        class="cursor-pointer"
                        checked={Boolean((createModel as Record<string, unknown>)[field.key])}
                        onCheckedChange={(checked) => setCreateField(field.key as keyof RuleModel, checked)}
                      />
                      <span class="text-sm text-slate-300"
                        >{Boolean((createModel as Record<string, unknown>)[field.key]) ? 'Enabled' : 'Disabled'}</span
                      >
                    </div>
                  {:else if field.type === 'select'}
                    <Select.Root
                      type="single"
                      value={String((createModel as Record<string, unknown>)[field.key] ?? '')}
                      onValueChange={(value) => {
                        if (value) setCreateField(field.key as keyof RuleModel, value);
                      }}
                    >
                      <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                        <span
                          >{getOptions(field).find(
                            (option) => option.value === String((createModel as Record<string, unknown>)[field.key])
                          )?.label ?? `Select ${field.label}`}</span
                        >
                      </Select.Trigger>
                      <Select.Content class="border-slate-700 bg-slate-950 text-slate-100">
                        {#each getOptions(field) as option}
                          <Select.Item
                            value={option.value}
                            label={option.label}
                            class="cursor-pointer hover:bg-slate-800"
                          />
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  {:else if field.type === 'number'}
                    <Input
                      type="number"
                      class="border-slate-700 bg-slate-950 text-slate-100"
                      value={Number((createModel as Record<string, unknown>)[field.key] ?? 0)}
                      oninput={(event) =>
                        setCreateField(
                          field.key as keyof RuleModel,
                          Number((event.currentTarget as HTMLInputElement).value || 0)
                        )}
                    />
                  {:else}
                    <Input
                      class="border-slate-700 bg-slate-950 text-slate-100"
                      value={String((createModel as Record<string, unknown>)[field.key] ?? '')}
                      oninput={(event) =>
                        setCreateField(field.key as keyof RuleModel, (event.currentTarget as HTMLInputElement).value)}
                    />
                  {/if}
                </div>
              {/each}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>

        <div class="flex justify-end">
          <Button class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-500" type="submit" disabled={creating}>
            <PlusIcon class="mr-2 h-4 w-4" />
            {creating ? 'Creating...' : 'Create firewall rule'}
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader class="space-y-3">
      <div>
        <CardTitle class="text-slate-100">{$_('firewall.existing_rules')}</CardTitle>
        <CardDescription class="text-slate-400">
          {rules.length} rules, {selectedCount} selected
        </CardDescription>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          class="border-slate-700 bg-slate-950 text-slate-100"
          placeholder="Search rules across all columns"
          value={searchQuery}
          oninput={(event) => (searchQuery = (event.currentTarget as HTMLInputElement).value)}
        />

        <Select.Root type="single" value={actionFilter} onValueChange={(value) => value && (actionFilter = value)}>
          <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
            <span>{actionFilter === 'all' ? 'All Actions' : actionFilter.toUpperCase()}</span>
          </Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-950 text-slate-100">
            <Select.Item value="all" label="All Actions" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="pass" label="Pass" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="block" label="Block" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="reject" label="Reject" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>

        <Select.Root type="single" value={protocolFilter} onValueChange={(value) => value && (protocolFilter = value)}>
          <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
            <span>{protocolFilter === 'all' ? 'All Protocols' : protocolFilter.toUpperCase()}</span>
          </Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-950 text-slate-100">
            <Select.Item value="all" label="All Protocols" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="any" label="Any" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="tcp" label="TCP" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="udp" label="UDP" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="icmp" label="ICMP" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>

        <Select.Root type="single" value={interfaceFilter} onValueChange={(value) => value && (interfaceFilter = value)}>
          <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
            <span>{interfaceFilter === 'all' ? 'All Interfaces' : interfaceFilter}</span>
          </Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-950 text-slate-100">
            <Select.Item value="all" label="All Interfaces" class="cursor-pointer hover:bg-slate-800" />
            {#each interfaceOptions as option}
              <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </CardHeader>
    <CardContent class="space-y-3">
      {#if selectedCount > 0}
        <div class="flex flex-wrap items-center gap-2 rounded-md border border-cyan-700/50 bg-cyan-950/20 p-3">
          <span class="text-sm text-cyan-100">{selectedCount} selected</span>
          <span class="mx-1 h-4 w-px bg-cyan-700/50"></span>
          <span class="text-xs text-cyan-300/60">Click the arrow on a target row to move selected before it</span>
          <Button
            variant="outline"
            class="cursor-pointer border-red-500/40 text-red-200 hover:bg-red-500/10"
            onclick={() => void runBulkDelete()}
            disabled={bulkBusy}
          >
            <Trash2Icon class="mr-2 h-4 w-4" />
            Delete Selected
          </Button>
          <Button
            variant="outline"
            class="cursor-pointer border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
            onclick={() => void runBulkEnabled(true)}
            disabled={bulkBusy}
          >
            Enable Selected
          </Button>
          <Button
            variant="outline"
            class="cursor-pointer border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
            onclick={() => void runBulkEnabled(false)}
            disabled={bulkBusy}
          >
            Disable Selected
          </Button>
          <Button
            variant="outline"
            class="cursor-pointer border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
            onclick={() => void runBulkDuplicate()}
            disabled={bulkBusy}
          >
            Duplicate Selected
          </Button>

        </div>
      {/if}

      {#if loading}
        <p class="text-sm text-slate-400">{$_('firewall.loading_rules')}</p>
      {:else if sortedFilteredRules.length === 0}
        <p class="text-sm text-slate-400">{$_('firewall.no_firewall_rules_match_the_current_filters')}</p>
      {:else}
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="min-w-full border-collapse text-sm">
            <thead class="bg-slate-950/80 text-slate-200">
              <tr class="border-b border-slate-800">
                <th class="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900"
                    checked={allVisibleSelected}
                    onchange={(event) => toggleSelectAll((event.currentTarget as HTMLInputElement).checked)}
                  />
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('sequence')}
                    ># {sortIndicator('sequence')}</button
                  >
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('enabled')}
                    >Enabled {sortIndicator('enabled')}</button
                  >
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('action')}
                    >Action {sortIndicator('action')}</button
                  >
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('protocol')}
                    >Protocol {sortIndicator('protocol')}</button
                  >
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('source')}
                    >Source {sortIndicator('source')}</button
                  >
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('destination')}
                    >Destination {sortIndicator('destination')}</button
                  >
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('port')}
                    >Port {sortIndicator('port')}</button
                  >
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('interface')}
                    >Interface {sortIndicator('interface')}</button
                  >
                </th>
                <th class="px-3 py-2 text-left">
                  <button class="cursor-pointer text-left" onclick={() => updateSort('description')}
                    >Description {sortIndicator('description')}</button
                  >
                </th>
              </tr>
            </thead>
            <tbody>
              {#each sortedFilteredRules as rule, index}
                {@const id = modelId(rule)}

                <tr class="border-b border-slate-800/70 bg-slate-950/30 align-top text-slate-200">
                  <td class="px-3 py-3">
                    <input
                      type="checkbox"
                      class="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900"
                      checked={Boolean(selected[id])}
                      onchange={(event) => toggleRowSelection(rule, (event.currentTarget as HTMLInputElement).checked)}
                    />
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex items-center gap-2">
                      {#if selectedCount > 0 && !selected[id]}
                        <button
                          class="inline-flex cursor-pointer items-center justify-center rounded border border-cyan-500/40 bg-cyan-500/10 p-1 text-cyan-300 transition-colors hover:bg-cyan-500/20 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Move {selectedCount} selected rule{selectedCount > 1 ? 's' : ''} before this rule"
                          onclick={() => void moveSelectedBefore(rule)}
                          disabled={reorderBusy}
                        >
                          <ArrowUpToLineIcon class="size-3.5" />
                        </button>
                      {/if}
                      <span class="font-medium">{rule.sequence}</span>
                    </div>
                  </td>
                  <td class="px-3 py-3">
                    <Switch
                      class="cursor-pointer"
                      checked={rule.enabled}
                      onCheckedChange={(checked) => void setRuleEnabled(rule, checked)}
                      disabled={savingId === getRuleIdentifier(rule)}
                    />
                  </td>
                  <td class="px-3 py-3">
                    <Badge class={actionBadgeClass(rule.action)}>{rule.action.toUpperCase()}</Badge>
                  </td>
                  <td class="px-3 py-3 uppercase">{rule.protocol}</td>
                  <td class="px-3 py-3">{sourceLabel(rule)}</td>
                  <td class="px-3 py-3">{destinationLabel(rule)}</td>
                  <td class="px-3 py-3">{portLabel(rule)}</td>
                  <td class="px-3 py-3">{rule.interface}</td>
                  <td class="px-3 py-3">
                    <div class="space-y-2">
                      <p class="text-slate-100">{rule.description || '-'}</p>
                      <p class="text-xs text-slate-400">Direction: {rule.direction}</p>
                      <div class="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          class="cursor-pointer border-slate-700 text-slate-200"
                          onclick={() => toggleEdit(rule)}
                        >
                          {editing[id] ? 'Close editor' : 'Edit'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          class="cursor-pointer border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
                          onclick={() => void duplicateRule(rule)}
                          disabled={creating}
                        >
                          Duplicate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          class="cursor-pointer border-red-500/40 text-red-200 hover:bg-red-500/10"
                          onclick={() => void deleteRule(rule)}
                          disabled={deletingId === getRuleIdentifier(rule)}
                        >
                          <Trash2Icon class="mr-1 h-3 w-3" />
                          {deletingId === getRuleIdentifier(rule) ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>

                {#if editing[id]}
                  <tr class="border-b border-slate-800 bg-slate-950/40">
                    <td colspan="10" class="px-3 py-4">
                      <div class="space-y-3">
                        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {#each fields.filter((field) => !field.advanced) as field}
                            <div class="space-y-2">
                              <FieldLabel label={field.label} hint={field.hint} />
                              {#if field.type === 'boolean'}
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                                  <Switch
                                    class="cursor-pointer"
                                    checked={Boolean((rule as Record<string, unknown>)[field.key])}
                                    onCheckedChange={(checked) =>
                                      setRuleField(rule, field.key as keyof RuleModel, checked)}
                                  />
                                  <span class="text-sm text-slate-300"
                                    >{Boolean((rule as Record<string, unknown>)[field.key]) ? 'Enabled' : 'Disabled'}</span
                                  >
                                </div>
                              {:else if field.type === 'select'}
                                <Select.Root
                                  type="single"
                                  value={String((rule as Record<string, unknown>)[field.key] ?? '')}
                                  onValueChange={(value) => {
                                    if (value) setRuleField(rule, field.key as keyof RuleModel, value);
                                  }}
                                >
                                  <Select.Trigger
                                    class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"
                                  >
                                    <span
                                      >{getOptions(field).find(
                                        (option) => option.value === String((rule as Record<string, unknown>)[field.key])
                                      )?.label ?? `Select ${field.label}`}</span
                                    >
                                  </Select.Trigger>
                                  <Select.Content class="border-slate-700 bg-slate-950 text-slate-100">
                                    {#each getOptions(field) as option}
                                      <Select.Item
                                        value={option.value}
                                        label={option.label}
                                        class="cursor-pointer hover:bg-slate-800"
                                      />
                                    {/each}
                                  </Select.Content>
                                </Select.Root>
                              {:else if field.type === 'number'}
                                <Input
                                  type="number"
                                  min="1"
                                  class="border-slate-700 bg-slate-950 text-slate-100"
                                  value={Number((rule as Record<string, unknown>)[field.key] ?? 0)}
                                  oninput={(event) =>
                                    setRuleField(
                                      rule,
                                      field.key as keyof RuleModel,
                                      Number((event.currentTarget as HTMLInputElement).value || 0)
                                    )}
                                />
                              {:else}
                                <Input
                                  class="border-slate-700 bg-slate-950 text-slate-100"
                                  value={String((rule as Record<string, unknown>)[field.key] ?? '')}
                                  oninput={(event) =>
                                    setRuleField(rule, field.key as keyof RuleModel, (event.currentTarget as HTMLInputElement).value)}
                                />
                              {/if}
                            </div>
                          {/each}
                        </div>

                        <Collapsible.Root
                          open={advancedOpen[id] ?? false}
                          class="rounded-md border border-slate-800 bg-slate-950/60 p-4"
                        >
                          <Collapsible.Trigger
                            class="flex w-full cursor-pointer items-center justify-between"
                            onclick={() => toggleAdvanced(id)}
                          >
                            <span class="text-sm font-medium text-slate-100">{$_('common.advanced')}</span>
                            <ChevronDownIcon
                              class={`h-4 w-4 text-slate-400 transition-transform ${advancedOpen[id] ? 'rotate-180' : ''}`}
                            />
                          </Collapsible.Trigger>
                          <Collapsible.Content class="pt-4">
                            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              {#each fields.filter((field) => field.advanced) as field}
                                <div class="space-y-2">
                                  <FieldLabel label={field.label} hint={field.hint} />
                                  {#if field.type === 'boolean'}
                                    <div
                                      class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3"
                                    >
                                      <Switch
                                        class="cursor-pointer"
                                        checked={Boolean((rule as Record<string, unknown>)[field.key])}
                                        onCheckedChange={(checked) =>
                                          setRuleField(rule, field.key as keyof RuleModel, checked)}
                                      />
                                      <span class="text-sm text-slate-300"
                                        >{Boolean((rule as Record<string, unknown>)[field.key]) ? 'Enabled' : 'Disabled'}</span
                                      >
                                    </div>
                                  {:else if field.type === 'select'}
                                    <Select.Root
                                      type="single"
                                      value={String((rule as Record<string, unknown>)[field.key] ?? '')}
                                      onValueChange={(value) => {
                                        if (value) setRuleField(rule, field.key as keyof RuleModel, value);
                                      }}
                                    >
                                      <Select.Trigger
                                        class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"
                                      >
                                        <span
                                          >{getOptions(field).find(
                                            (option) =>
                                              option.value === String((rule as Record<string, unknown>)[field.key])
                                          )?.label ?? `Select ${field.label}`}</span
                                        >
                                      </Select.Trigger>
                                      <Select.Content class="border-slate-700 bg-slate-950 text-slate-100">
                                        {#each getOptions(field) as option}
                                          <Select.Item
                                            value={option.value}
                                            label={option.label}
                                            class="cursor-pointer hover:bg-slate-800"
                                          />
                                        {/each}
                                      </Select.Content>
                                    </Select.Root>
                                  {:else}
                                    <Input
                                      class="border-slate-700 bg-slate-950 text-slate-100"
                                      value={String((rule as Record<string, unknown>)[field.key] ?? '')}
                                      oninput={(event) =>
                                        setRuleField(
                                          rule,
                                          field.key as keyof RuleModel,
                                          (event.currentTarget as HTMLInputElement).value
                                        )}
                                    />
                                  {/if}
                                </div>
                              {/each}
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>

                        <div class="flex justify-end">
                          <Button
                            class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-500"
                            onclick={() => void saveRule(rule)}
                            disabled={savingId === getRuleIdentifier(rule)}
                          >
                            <SaveIcon class="mr-2 h-4 w-4" />
                            {savingId === getRuleIdentifier(rule) ? 'Saving...' : 'Save changes'}
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

      <p class="text-xs text-slate-500">
        Showing {sortedFilteredRules.length} filtered rule{sortedFilteredRules.length === 1 ? '' : 's'}.
        {interfacesLoading ? ' Interface list is still loading.' : ''}
      </p>
    </CardContent>
  </Card>
</div>
