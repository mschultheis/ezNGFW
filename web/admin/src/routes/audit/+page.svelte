<!-- Route view for `/audit` in the ezNGFW admin GUI. -->

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
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SaveIcon from '@lucide/svelte/icons/save';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import SearchIcon from '@lucide/svelte/icons/search';
  import { _ } from '$lib/i18n';

  type AuditEntry = {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    resource: string;
    detail: string;
    severity: 'info' | 'warning' | 'critical';
    sourceIp: string;
    state: string;
    bytes: number;
  };

  type SavedView = {
    id: string;
    name: string;
    user: string;
    action: string;
    severity: string;
    from: string;
    to: string;
    query: string;
    autoRefresh: boolean;
  };

  const severityOptions = [
    { value: 'all', label: 'All severities' },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'critical', label: 'Critical' }
  ];

  const actionOptions = [
    { value: 'all', label: 'All actions' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'create', label: 'Create' },
    { value: 'update', label: 'Update' },
    { value: 'delete', label: 'Delete' },
    { value: 'policy', label: 'Policy change' },
    { value: 'service', label: 'Service control' }
  ];

  const pageSizeOptions = [
    { value: '25', label: '25 rows' },
    { value: '50', label: '50 rows' },
    { value: '100', label: '100 rows' }
  ];

  let entries = $state<AuditEntry[]>([]);
  let loadingEntries = $state(true);
  let entriesError = $state('');

  let savedViews = $state<SavedView[]>([]);
  let loadingViews = $state(true);

  let from = $state('');
  let to = $state('');
  let userFilter = $state('');
  let actionFilter = $state('all');
  let severityFilter = $state('all');
  let queryFilter = $state('');
  let includeDetails = $state(true);

  let autoRefresh = $state(false);
  let refreshSeconds = $state(15);
  let caseSensitive = $state(false);
  let showAdvanced = $state(false);

  let page = $state(1);
  let pageSize = $state('25');
  let totalRows = $state(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  let savingView = $state(false);
  let deletingView = $state(false);
  let editingViewId = $state<string | null>(null);
  let viewDraft = $state<SavedView>({
    id: '',
    name: '',
    user: '',
    action: 'all',
    severity: 'all',
    from: '',
    to: '',
    query: '',
    autoRefresh: false
  });

  function normalizeEntry(raw: Record<string, unknown>): AuditEntry {
    const severityRaw = String(raw.severity ?? raw.level ?? 'info').toLowerCase();
    const severity: AuditEntry['severity'] =
      severityRaw === 'critical' || severityRaw === 'error'
        ? 'critical'
        : severityRaw === 'warning'
          ? 'warning'
          : 'info';

    return {
      id: String(raw.id ?? raw.uuid ?? crypto.randomUUID()),
      timestamp: String(raw.timestamp ?? raw.time ?? '-'),
      user: String(raw.user ?? raw.actor ?? '-'),
      action: String(raw.action ?? raw.type ?? '-'),
      resource: String(raw.resource ?? raw.target ?? '-'),
      detail: String(raw.detail ?? raw.details ?? raw.message ?? '-'),
      severity,
      sourceIp: String(raw.sourceIp ?? raw.source ?? '-'),
      state: String(raw.state ?? raw.result ?? '-'),
      bytes: Number(raw.bytes ?? raw.size ?? 0)
    };
  }

  function normalizeView(raw: Record<string, unknown>): SavedView {
    return {
      id: String(raw.id ?? raw.uuid ?? crypto.randomUUID()),
      name: String(raw.name ?? 'Unnamed view'),
      user: String(raw.user ?? ''),
      action: String(raw.action ?? 'all'),
      severity: String(raw.severity ?? 'all'),
      from: String(raw.from ?? ''),
      to: String(raw.to ?? ''),
      query: String(raw.query ?? ''),
      autoRefresh: Boolean(raw.autoRefresh)
    };
  }

  function numberWithCommas(value: number) {
    return new Intl.NumberFormat().format(value);
  }

  function severityClasses(severity: AuditEntry['severity']) {
    if (severity === 'critical') return 'border-red-400/30 bg-red-500/20 text-red-200';
    if (severity === 'warning') return 'border-amber-400/30 bg-amber-500/20 text-amber-200';
    return 'border-cyan-400/30 bg-cyan-500/20 text-cyan-200';
  }

  function buildQueryParams() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (userFilter.trim()) params.set('user', userFilter.trim());
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (queryFilter.trim()) params.set('query', queryFilter.trim());
    params.set('includeDetails', String(includeDetails));
    params.set('page', String(page));
    params.set('pageSize', pageSize);
    return params;
  }

  async function loadEntries() {
    loadingEntries = true;
    entriesError = '';
    try {
      const payload = await api.get<Record<string, unknown> | Record<string, unknown>[]>(`/audit?${buildQueryParams().toString()}`);
      if (Array.isArray(payload)) {
        entries = payload.map((item) => normalizeEntry(item as Record<string, unknown>));
        totalRows = entries.length;
      } else {
        const rows = Array.isArray(payload.rows) ? (payload.rows as Record<string, unknown>[]) : [];
        entries = rows.map((item) => normalizeEntry(item));
        totalRows = Number(payload.total ?? rows.length);
      }
    } catch (error) {
      entries = [];
      totalRows = 0;
      entriesError = error instanceof Error ? error.message : 'Failed to load audit events';
      toasts.error(entriesError);
    } finally {
      loadingEntries = false;
    }
  }

  async function loadViews() {
    loadingViews = true;
    try {
      const payload = await api.get<unknown[]>('/audit/views');
      savedViews = Array.isArray(payload)
        ? payload.map((item) => normalizeView((item ?? {}) as Record<string, unknown>))
        : [];
    } catch {
      savedViews = [];
      toasts.warning('Saved audit views are unavailable');
    } finally {
      loadingViews = false;
    }
  }

  function resetDraft() {
    viewDraft = {
      id: '',
      name: '',
      user: '',
      action: 'all',
      severity: 'all',
      from: '',
      to: '',
      query: '',
      autoRefresh: false
    };
    editingViewId = null;
  }

  function useView(view: SavedView) {
    from = view.from;
    to = view.to;
    userFilter = view.user;
    actionFilter = view.action;
    severityFilter = view.severity;
    queryFilter = view.query;
    autoRefresh = view.autoRefresh;
    page = 1;
    void loadEntries();
    toasts.success(`Applied view: ${view.name}`);
  }

  function editView(view: SavedView) {
    viewDraft = { ...view };
    editingViewId = view.id;
  }

  async function saveView() {
    if (!viewDraft.name.trim()) {
      toasts.warning('View name is required');
      return;
    }
    savingView = true;
    try {
      const payload = {
        name: viewDraft.name.trim(),
        user: viewDraft.user.trim(),
        action: viewDraft.action,
        severity: viewDraft.severity,
        from: viewDraft.from,
        to: viewDraft.to,
        query: viewDraft.query.trim(),
        autoRefresh: viewDraft.autoRefresh
      };
      if (editingViewId) {
        await api.put(`/audit/views/${editingViewId}`, payload);
      } else {
        await api.post('/audit/views', payload);
      }
      toasts.success(editingViewId ? 'Saved view updated' : 'Saved view created');
      resetDraft();
      await loadViews();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save view');
    } finally {
      savingView = false;
    }
  }

  async function removeView(id: string) {
    deletingView = true;
    try {
      await api.del(`/audit/views/${id}`);
      if (editingViewId === id) resetDraft();
      toasts.success($_('audit.toastsaved_view_deleted'));
      await loadViews();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to delete view');
    } finally {
      deletingView = false;
    }
  }

  function clearFilters() {
    from = '';
    to = '';
    userFilter = '';
    actionFilter = 'all';
    severityFilter = 'all';
    queryFilter = '';
    includeDetails = true;
    page = 1;
  }

  function exportCurrentPage() {
    if (entries.length === 0) {
      toasts.warning('No audit rows to export');
      return;
    }

    const headers = ['timestamp', 'user', 'action', 'resource', 'detail', 'severity', 'sourceIp', 'state', 'bytes'];
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = entries.map((entry) =>
      [
        entry.timestamp,
        entry.user,
        entry.action,
        entry.resource,
        entry.detail,
        entry.severity,
        entry.sourceIp,
        entry.state,
        entry.bytes
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-page-${page}-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = $derived.by(() => {
    const size = Number(pageSize);
    if (size <= 0) return 1;
    return Math.max(1, Math.ceil(totalRows / size));
  });

  const criticalCount = $derived.by(() => entries.filter((entry) => entry.severity === 'critical').length);
  const warningCount = $derived.by(() => entries.filter((entry) => entry.severity === 'warning').length);
  const uniqueUsers = $derived.by(() => new Set(entries.map((entry) => entry.user)).size);

  onMount(() => {
    void loadEntries();
    void loadViews();
  });

  $effect(() => {
    if (timer) clearInterval(timer);
    if (autoRefresh && refreshSeconds > 0) {
      timer = setInterval(() => {
        void loadEntries();
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
          <CardTitle class="text-slate-100">{$_('audit.audit_log_explorer')}</CardTitle>
          <p class="mt-1 text-sm text-slate-400">{$_('audit.trace_administrative_actions_with_source_context_s')}</p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={() => void loadEntries()} disabled={loadingEntries}>
            <RefreshCwIcon class="mr-2 h-4 w-4" />
            {loadingEntries ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={exportCurrentPage}>
            <DownloadIcon class="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('audit.rows_on_page')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{numberWithCommas(entries.length)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('audit.critical_warning')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{criticalCount} / {warningCount}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('audit.unique_users')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{uniqueUsers}</p>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="From date" hint="Use start date to focus on a deployment window or incident interval. Example: set From to 09:00 before applying a firewall policy so you only review post-change events." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="datetime-local" bind:value={from} />
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="To date" hint="Use end date to cap investigation scope and reduce noisy older entries. Example: set To at 11:30 to isolate failed login bursts seen during morning operations." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="datetime-local" bind:value={to} />
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="User filter" hint="Filter by operator account to quickly audit privilege usage and policy edits. Example: search for netops-admin to review every NAT rule deletion made during a maintenance window." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={userFilter} placeholder="admin" />
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Search term" hint="Search detail payload and resource names for fast forensics. Example: query blocked-country to locate policy pushes that changed geographic filtering." />
          <div class="relative mt-2">
            <SearchIcon class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <Input class="border-slate-700 bg-slate-950 pl-8 text-slate-100" bind:value={queryFilter} placeholder="contains text" />
          </div>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Action type" hint="Action categories distinguish authentication, object CRUD, and policy management workflows. Example: choose Delete to audit who removed aliases or route rules before service impact." />
          <Select.Root type="single" value={actionFilter} onValueChange={(value) => value && (actionFilter = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{actionOptions.find((option) => option.value === actionFilter)?.label ?? 'Select action'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each actionOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Severity" hint="Severity helps prioritize operator focus when triaging a crowded audit stream. Example: set Critical to quickly identify denied service restarts or repeated authentication failures." />
          <Select.Root type="single" value={severityFilter} onValueChange={(value) => value && (severityFilter = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{severityOptions.find((option) => option.value === severityFilter)?.label ?? 'Select severity'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each severityOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Rows per page" hint="Page size balances operator readability and API load. Example: use 25 while investigating details, then move to 100 for quick high-level trend scanning." />
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
          <FieldLabel label="Auto-refresh" hint="Enable periodic reload during incident response so new entries appear without manual action. Example: use a 15 second interval while validating brute-force lockout controls in real time." />
          <div class="mt-2 flex items-center justify-between">
            <span class="text-xs text-slate-400">{autoRefresh ? `Enabled (${refreshSeconds}s)` : 'Disabled'}</span>
            <Switch checked={autoRefresh} onCheckedChange={(checked) => (autoRefresh = checked)} />
          </div>
        </div>
      </div>

      <Collapsible.Root bind:open={showAdvanced}>
        <Collapsible.Trigger class="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-left">
          <span class="text-sm font-medium text-slate-200">{$_('audit.advanced_query_options')}</span>
          <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="mt-3 grid gap-4 md:grid-cols-3">
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Include full detail" hint="Enable full details to retain original backend message context. Example: when disabled you only see compact summaries, useful for faster scrolling on busy systems." />
            <div class="mt-2 flex items-center justify-between">
              <span class="text-xs text-slate-400">{includeDetails ? 'Verbose details' : 'Compact details'}</span>
              <Switch checked={includeDetails} onCheckedChange={(checked) => (includeDetails = checked)} />
            </div>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Case sensitive search" hint="Case sensitivity can narrow broad terms that overmatch. Example: searching for Rule-Prod with case enabled avoids matching lowercase test labels from temporary objects." />
            <div class="mt-2 flex items-center justify-between">
              <span class="text-xs text-slate-400">{caseSensitive ? 'Sensitive' : 'Insensitive'}</span>
              <Switch checked={caseSensitive} onCheckedChange={(checked) => (caseSensitive = checked)} />
            </div>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Refresh interval" hint="Short intervals improve situational awareness but increase API pressure. Example: 10 seconds for active troubleshooting, 30 seconds for passive monitoring during routine operations." />
            <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="5" max="300" bind:value={refreshSeconds} />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => { page = 1; void loadEntries(); }}>
          <CalendarClockIcon class="mr-2 h-4 w-4" /> Apply filters
        </Button>
        <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={() => { clearFilters(); void loadEntries(); }}>
          Reset filters
        </Button>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('audit.saved_filter_views')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="View name" hint="Name views by investigation intent so handoffs stay clear. Example: Last 24h critical config changes gives operations teams a one-click compliance baseline." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={viewDraft.name} placeholder={$_('audit.placeholdercritical_policy_edits')} />
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="User" hint="Store user criteria in a view when you repeatedly audit privileged accounts. Example: pre-save user root-admin for weekly privileged activity review." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={viewDraft.user} placeholder="admin" />
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Action" hint="Persisting action type makes recurring post-change checks faster and more consistent. Example: save Delete action to quickly inspect potentially risky object removals." />
          <Select.Root type="single" value={viewDraft.action} onValueChange={(value) => value && (viewDraft.action = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{actionOptions.find((option) => option.value === viewDraft.action)?.label ?? 'Select action'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each actionOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Severity" hint="Severity presets reduce manual clicks during pressure events. Example: save a Critical-only view for on-call triage when alert volume spikes." />
          <Select.Root type="single" value={viewDraft.severity} onValueChange={(value) => value && (viewDraft.severity = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{severityOptions.find((option) => option.value === viewDraft.severity)?.label ?? 'Select severity'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each severityOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveView} disabled={savingView}>
          <SaveIcon class="mr-2 h-4 w-4" /> {savingView ? 'Saving...' : editingViewId ? 'Update view' : 'Create view'}
        </Button>
        {#if editingViewId}
          <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={resetDraft}>Cancel edit</Button>
        {/if}
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-950/60">
            <TableRow class="border-slate-700 hover:bg-slate-900/70">
              <TableHead class="text-slate-300">{$_('audit.name')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.user')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.action')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.severity')}</TableHead>
              <TableHead class="text-slate-300">Auto-refresh</TableHead>
              <TableHead class="text-slate-300">{$_('audit.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if loadingViews}
              <TableRow class="border-slate-800 hover:bg-transparent">
                <TableCell colspan={6} class="py-6 text-center text-slate-400">Loading saved views...</TableCell>
              </TableRow>
            {:else if savedViews.length === 0}
              <TableRow class="border-slate-800 hover:bg-transparent">
                <TableCell colspan={6} class="py-6 text-center text-slate-500">No saved views yet.</TableCell>
              </TableRow>
            {:else}
              {#each savedViews as view}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  <TableCell class="text-slate-100">{view.name}</TableCell>
                  <TableCell class="text-slate-300">{view.user || '-'}</TableCell>
                  <TableCell class="text-slate-300">{view.action}</TableCell>
                  <TableCell class="text-slate-300">{view.severity}</TableCell>
                  <TableCell class="text-slate-300">{view.autoRefresh ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <div class="flex gap-2">
                      <Button size="sm" variant="outline" class="border-cyan-700 text-cyan-200 hover:bg-cyan-950/40" onclick={() => useView(view)}>Use</Button>
                      <Button size="sm" variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => editView(view)}>
                        <PencilIcon class="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" class="border-red-500/40 text-red-300 hover:bg-red-950/30" onclick={() => void removeView(view.id)} disabled={deletingView}>
                        <Trash2Icon class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('audit.audit_event_table')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if entriesError}
        <div class="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{entriesError}</div>
      {/if}

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-950/60">
            <TableRow class="border-slate-700 hover:bg-slate-900/70">
              <TableHead class="text-slate-300">{$_('audit.timestamp')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.user_1')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.action_1')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.resource')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.detail')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.severity_1')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.source')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.state')}</TableHead>
              <TableHead class="text-slate-300">{$_('audit.bytes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if loadingEntries}
              <TableRow class="border-slate-800 hover:bg-transparent">
                <TableCell colspan={9} class="py-8 text-center text-slate-400">Loading audit data...</TableCell>
              </TableRow>
            {:else if entries.length === 0}
              <TableRow class="border-slate-800 hover:bg-transparent">
                <TableCell colspan={9} class="py-8 text-center text-slate-500">No events match the current filter set.</TableCell>
              </TableRow>
            {:else}
              {#each entries as entry}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  <TableCell class="text-xs text-slate-300">{entry.timestamp}</TableCell>
                  <TableCell class="text-slate-100">{entry.user}</TableCell>
                  <TableCell class="text-slate-300">{entry.action}</TableCell>
                  <TableCell class="text-slate-300">{entry.resource}</TableCell>
                  <TableCell class="max-w-80 text-xs text-slate-300">{entry.detail}</TableCell>
                  <TableCell>
                    <Badge class={severityClasses(entry.severity)}>{entry.severity}</Badge>
                  </TableCell>
                  <TableCell class="text-xs text-slate-300">{entry.sourceIp}</TableCell>
                  <TableCell class="text-xs text-slate-300">{entry.state}</TableCell>
                  <TableCell class="text-right text-xs text-slate-300">{numberWithCommas(entry.bytes)}</TableCell>
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
            disabled={page <= 1 || loadingEntries}
            onclick={() => {
              page -= 1;
              void loadEntries();
            }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            class="border-slate-700 text-slate-100 hover:bg-slate-800"
            disabled={page >= totalPages || loadingEntries}
            onclick={() => {
              page += 1;
              void loadEntries();
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
