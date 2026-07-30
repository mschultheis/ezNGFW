<!-- Generic CRUD data-grid used across admin pages for listing, editing, and deleting resources. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { get } from 'svelte/store';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { stagedMode, queueChange } from '$lib/stores/staged';
  import { asList, asString, resolveId } from '$lib/utils/api-data';
  import { cn } from '$lib/utils';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Switch } from '$lib/components/ui/switch';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import FieldLabel from './FieldLabel.svelte';

  /* ── Props ─────────────────────────────────────────────────── */

  let {
    title,
    description = '',
    endpoint,
    columns,
    fields,
    idKey = 'id',
    addLabel = 'Add Item',
    compact = false,
    searchable = true,
    sortable = true,
    selectable = true,
    pageSize = 25
  }: {
    title: string;
    description?: string;
    endpoint: string;
    columns: TableColumn[];
    fields: FormField[];
    idKey?: string;
    addLabel?: string;
    compact?: boolean;
    searchable?: boolean;
    sortable?: boolean;
    selectable?: boolean;
    pageSize?: number;
  } = $props();

  /* ── Core State ────────────────────────────────────────────── */

  let loading = $state(true);
  let saving = $state(false);
  let deleting = $state(false);
  let bulkDeleting = $state(false);
  let error = $state('');
  let rows = $state<Record<string, unknown>[]>([]);
  let isEditorOpen = $state(false);
  let editing: Record<string, unknown> | null = $state(null);
  let toDelete: Record<string, unknown> | null = $state(null);
  let model = $state<Record<string, unknown>>({});

  /* ── Search State ──────────────────────────────────────────── */

  let searchQuery = $state('');

  /* ── Sort State ────────────────────────────────────────────── */

  let sortKey = $state('');
  let sortDir = $state<'asc' | 'desc' | ''>('');

  /* ── Pagination State ──────────────────────────────────────── */

  let currentPage = $state(1);
  let itemsPerPage = $state(25);
  // Sync itemsPerPage with the pageSize prop
  $effect(() => { itemsPerPage = pageSize; });

  /* ── Selection State ───────────────────────────────────────── */

  let selectedIds = $state<Set<string>>(new Set());

  /* ── Derived: filtered, sorted, paginated rows ─────────────── */

  /** Rows after global search filter */
  let filteredRows = $derived.by(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((row) =>
      columns.some((col) => {
        const val = asString(row[col.key]);
        return val.toLowerCase().includes(q);
      })
    );
  });

  /** Rows after sorting */
  let sortedRows = $derived.by(() => {
    if (!sortKey || !sortDir) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = asString(a[sortKey]).toLowerCase();
      const bv = asString(b[sortKey]).toLowerCase();
      // Try numeric comparison first
      const an = Number(av);
      const bn = Number(bv);
      if (!isNaN(an) && !isNaN(bn)) {
        return sortDir === 'asc' ? an - bn : bn - an;
      }
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  });

  /** Total pages */
  let totalPages = $derived(Math.max(1, Math.ceil(sortedRows.length / itemsPerPage)));

  /** Current page rows */
  let pageRows = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedRows.slice(start, start + itemsPerPage);
  });

  /** Whether all rows on current page are selected */
  let allPageSelected = $derived.by(() => {
    if (pageRows.length === 0) return false;
    return pageRows.every((row) => {
      const id = resolveId(row, idKey);
      return id && selectedIds.has(String(id));
    });
  });

  /** Count of selected items */
  let selectedCount = $derived(selectedIds.size);

  /* ── Form Helpers ──────────────────────────────────────────── */

  function getText(key: string) {
    const value = model[key];
    return value === null || value === undefined ? '' : String(value);
  }

  function getMulti(key: string) {
    const value = model[key];
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  function setText(key: string, value: string) {
    model[key] = value;
  }

  function setBool(key: string, value: boolean) {
    model[key] = value;
  }

  function setMulti(key: string, values: string[]) {
    model[key] = values;
  }

  function defaultModel() {
    const next: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === 'boolean') next[field.key] = false;
      else if (field.type === 'multiselect') next[field.key] = [];
      else next[field.key] = '';
    }
    return next;
  }

  function shouldShow(field: FormField) {
    return field.showWhen ? field.showWhen(model) : true;
  }

  /* ── Sort Handler ──────────────────────────────────────────── */

  function toggleSort(key: string) {
    if (!sortable) return;
    if (sortKey !== key) {
      sortKey = key;
      sortDir = 'asc';
    } else if (sortDir === 'asc') {
      sortDir = 'desc';
    } else {
      sortKey = '';
      sortDir = '';
    }
    currentPage = 1;
  }

  /** Return sort indicator for column header */
  function sortIcon(key: string): string {
    if (sortKey !== key || !sortDir) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  function isStatusValue(val: unknown): boolean {
    if (typeof val === 'boolean') return true;
    if (typeof val !== 'string') return false;
    return ['enabled', 'disabled', 'running', 'stopped', 'up', 'down', 'active', 'inactive', 'online', 'offline', 'true', 'false'].includes(val.toLowerCase());
  }

  function getStatusClasses(val: unknown): string {
    const s = String(val).toLowerCase();
    if (['true', 'enabled', 'running', 'up', 'active', 'online'].includes(s))
      return 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30';
    if (['false', 'disabled', 'stopped', 'down', 'inactive', 'offline'].includes(s))
      return 'bg-red-900/15 text-red-400 border-red-500/30';
    if (['warning', 'degraded', 'pending'].includes(s))
      return 'bg-amber-900/15 text-amber-400 border-amber-500/30';
    return 'bg-slate-700/15 text-slate-400 border-slate-500/30';
  }

  function getStatusLabel(val: unknown): string {
    if (val === true) return 'Enabled';
    if (val === false) return 'Disabled';
    const s = String(val);
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /* ── Selection Handlers ────────────────────────────────────── */

  function toggleSelectAll() {
    if (allPageSelected) {
      for (const row of pageRows) {
        const id = resolveId(row, idKey);
        if (id) selectedIds.delete(String(id));
      }
    } else {
      for (const row of pageRows) {
        const id = resolveId(row, idKey);
        if (id) selectedIds.add(String(id));
      }
    }
    selectedIds = new Set(selectedIds);
  }

  function toggleSelectRow(row: Record<string, unknown>) {
    const id = resolveId(row, idKey);
    if (!id) return;
    const sid = String(id);
    if (selectedIds.has(sid)) {
      selectedIds.delete(sid);
    } else {
      selectedIds.add(sid);
    }
    selectedIds = new Set(selectedIds);
  }

  function isRowSelected(row: Record<string, unknown>): boolean {
    const id = resolveId(row, idKey);
    return id ? selectedIds.has(String(id)) : false;
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  /* ── Pagination Handlers ───────────────────────────────────── */

  function goToPage(page: number) {
    currentPage = Math.max(1, Math.min(page, totalPages));
  }

  function changePageSize(newSize: number) {
    itemsPerPage = newSize;
    currentPage = 1;
  }

  /* ── CRUD Operations ───────────────────────────────────────── */

  async function load() {
    loading = true;
    error = '';
    try {
      const payload = await api.get<unknown>(endpoint);
      rows = asList(payload);
    } catch (e) {
      error = e instanceof Error ? e.message : `Unable to load ${title.toLowerCase()}`;
    } finally {
      loading = false;
    }
  }

  function createItem() {
    editing = null;
    toDelete = null;
    model = defaultModel();
    isEditorOpen = true;
  }

  function editItem(row: Record<string, unknown>) {
    editing = row;
    toDelete = null;
    model = { ...defaultModel(), ...row };
    isEditorOpen = true;
  }

  function cancelEditor() {
    isEditorOpen = false;
    editing = null;
  }

  async function saveItem() {
    saving = true;
    try {
      if (get(stagedMode)) {
        const label = editing ? `Update ${title}` : `Create ${title}`;
        const snapshot = { ...model };
        const ed = editing;
        queueChange(label, async () => {
          if (ed) {
            const id = resolveId(ed, idKey);
            if (!id) throw new Error('Cannot resolve row ID');
            await api.put(`${endpoint}/${id}`, snapshot);
          } else {
            await api.post(endpoint, snapshot);
          }
        });
        isEditorOpen = false;
        editing = null;
        saving = false;
        return;
      }

      if (editing) {
        const id = resolveId(editing, idKey);
        if (!id) throw new Error('Cannot resolve row ID for update');
        await api.put(`${endpoint}/${id}`, model);
        toasts.success(`${title} updated`);
      } else {
        await api.post(endpoint, model);
        toasts.success(`${title} created`);
      }
      isEditorOpen = false;
      editing = null;
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      saving = false;
    }
  }

  async function deleteItem() {
    if (!toDelete) return;
    deleting = true;
    try {
      if (get(stagedMode)) {
        const id = resolveId(toDelete, idKey);
        if (!id) throw new Error('Cannot resolve row ID');
        const delEndpoint = `${endpoint}/${id}`;
        queueChange(`Delete ${title}`, async () => {
          await api.del(delEndpoint);
        });
        toDelete = null;
        deleting = false;
        return;
      }

      const id = resolveId(toDelete, idKey);
      if (!id) throw new Error('Cannot resolve row ID for delete');
      await api.del(`${endpoint}/${id}`);
      toasts.success(`${title} deleted`);
      toDelete = null;
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      deleting = false;
    }
  }

  /* ── Bulk Operations ───────────────────────────────────────── */

  async function bulkDelete() {
    if (selectedCount === 0) return;
    bulkDeleting = true;
    let successCount = 0;
    let failCount = 0;
    try {
      const ids = Array.from(selectedIds);
      if (get(stagedMode)) {
        for (const id of ids) {
          const delEndpoint = `${endpoint}/${id}`;
          queueChange(`Delete ${title} ${id}`, async () => {
            await api.del(delEndpoint);
          });
        }
        clearSelection();
        bulkDeleting = false;
        return;
      }

      for (const id of ids) {
        try {
          await api.del(`${endpoint}/${id}`);
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) toasts.success(`Deleted ${successCount} item${successCount > 1 ? 's' : ''}`);
      if (failCount > 0) toasts.error(`Failed to delete ${failCount} item${failCount > 1 ? 's' : ''}`);
      clearSelection();
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Bulk delete failed');
    } finally {
      bulkDeleting = false;
    }
  }

  async function bulkDuplicate() {
    if (selectedCount === 0) return;
    let successCount = 0;
    let failCount = 0;
    try {
      const selectedRows = rows.filter((row) => {
        const id = resolveId(row, idKey);
        return id && selectedIds.has(String(id));
      });

      for (const row of selectedRows) {
        try {
          const clone = { ...row };
          delete clone[idKey];
          if (get(stagedMode)) {
            queueChange(`Duplicate ${title}`, async () => {
              await api.post(endpoint, clone);
            });
            successCount++;
          } else {
            await api.post(endpoint, clone);
            successCount++;
          }
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) toasts.success(`Duplicated ${successCount} item${successCount > 1 ? 's' : ''}`);
      if (failCount > 0) toasts.error(`Failed to duplicate ${failCount} item${failCount > 1 ? 's' : ''}`);
      clearSelection();
      if (!get(stagedMode)) await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Bulk duplicate failed');
    }
  }

  /* ── Lifecycle ─────────────────────────────────────────────── */

  onMount(() => {
    load();
  });

  /** Generate visible page numbers for pagination controls */
  function getPageNumbers(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  }
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader class={compact ? 'pb-3' : ''}>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <CardTitle class="text-slate-100">{title}</CardTitle>
        {#if description}
          <CardDescription class="text-slate-400">{description}</CardDescription>
        {/if}
      </div>
      <Button class="cursor-pointer bg-cyan-500 text-white hover:bg-cyan-600" onclick={createItem}>{addLabel}</Button>
    </div>

    <!-- Toolbar: Search + Bulk Actions -->
    {#if !loading && !error}
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <!-- Global Search -->
        {#if searchable}
          <div class="relative flex-1 min-w-[200px] max-w-sm">
            <svg class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              class="border-slate-700 bg-slate-950 pl-9 text-sm"
              placeholder="Search {title.toLowerCase()}..."
              bind:value={searchQuery}
              oninput={() => { currentPage = 1; }}
            />
            {#if searchQuery}
              <button
                class="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-slate-500 hover:text-slate-300"
                onclick={() => { searchQuery = ''; currentPage = 1; }}
                aria-label="Clear search"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            {/if}
          </div>
        {/if}

        <!-- Bulk Action Toolbar (visible when items selected) -->
        {#if selectable && selectedCount > 0}
          <div class="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5" transition:slide={{ duration: 150, axis: 'x' }}>
            <span class="text-sm font-medium text-cyan-300">{selectedCount} selected</span>
            <div class="mx-1 h-4 w-px bg-slate-700"></div>
            <Button
              size="sm"
              variant="outline"
              class="h-7 cursor-pointer border-red-500/40 px-2 text-xs text-red-300 hover:bg-red-500/10"
              onclick={bulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="h-7 cursor-pointer border-slate-700 px-2 text-xs"
              onclick={bulkDuplicate}
            >
              Duplicate Selected
            </Button>
            <button
              class="cursor-pointer rounded p-0.5 text-slate-500 hover:text-slate-300"
              onclick={clearSelection}
              aria-label="Clear selection"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/if}

        <!-- Result count -->
        {#if searchQuery && filteredRows.length !== rows.length}
          <span class="text-xs text-slate-500">
            {filteredRows.length} of {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </span>
        {:else if rows.length > 0}
          <span class="text-xs text-slate-500">
            {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </span>
        {/if}
      </div>
    {/if}
  </CardHeader>

  <CardContent>
    <!-- Inline Editor Form -->
    {#if isEditorOpen}
      <section
        class="mb-4 rounded-lg border border-cyan-500/30 bg-slate-800/50 p-4"
        transition:slide={{ duration: 180, axis: 'y' }}
      >
        <h3 class="mb-1 text-sm font-semibold text-slate-200">{editing ? `Edit ${title}` : `New ${title}`}</h3>
        <p class="mb-3 text-xs text-slate-400">Update settings and save to apply.</p>
        <div class="grid gap-3 sm:grid-cols-2">
          {#each fields as field}
            {#if shouldShow(field)}
              <label class={cn('space-y-1 text-sm', field.type === 'textarea' && 'sm:col-span-2')}>
                <FieldLabel label={field.label} hint={field.hint} />
                {#if field.type === 'textarea'}
                  <Textarea
                    value={getText(field.key)}
                    class="border-slate-700 bg-slate-950"
                    oninput={(e) => setText(field.key, (e.currentTarget as HTMLTextAreaElement).value)}
                  />
                {:else if field.type === 'boolean'}
                  <div class="flex items-center gap-2 pt-1">
                    <Switch checked={Boolean(model[field.key])} onCheckedChange={(checked) => setBool(field.key, checked)} />
                    <span class="text-xs text-slate-400">{Boolean(model[field.key]) ? 'Enabled' : 'Disabled'}</span>
                  </div>
                {:else if field.type === 'select'}
                  <select
                    class="flex h-9 w-full cursor-pointer rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100"
                    value={getText(field.key)}
                    onchange={(e) => setText(field.key, (e.currentTarget as HTMLSelectElement).value)}
                    required={field.required}
                  >
                    {#each field.options ?? [] as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                {:else if field.type === 'multiselect'}
                  <select
                    class="min-h-28 w-full cursor-pointer rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    multiple
                    value={getMulti(field.key)}
                    onchange={(e) => {
                      const values = Array.from((e.currentTarget as HTMLSelectElement).selectedOptions).map((option) => option.value);
                      setMulti(field.key, values);
                    }}
                  >
                    {#each field.options ?? [] as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                {:else}
                  <Input
                    value={getText(field.key)}
                    oninput={(e) => setText(field.key, (e.currentTarget as HTMLInputElement).value)}
                    type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    class="border-slate-700 bg-slate-950"
                    placeholder={field.placeholder}
                    required={field.required}
                    pattern={field.pattern}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                  />
                {/if}
              </label>
            {/if}
          {/each}
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <Button class="cursor-pointer bg-cyan-500 text-white hover:bg-cyan-600" onclick={saveItem} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" class="cursor-pointer border-slate-700" onclick={cancelEditor} disabled={saving}>Cancel</Button>
        </div>
      </section>
    {/if}

    <!-- Loading Skeleton -->
    {#if loading}
      <div class="space-y-2">
        <Skeleton class="h-9 bg-slate-800" />
        <Skeleton class="h-9 bg-slate-800" />
        <Skeleton class="h-9 bg-slate-800" />
      </div>

    <!-- Error State -->
    {:else if error}
      <p class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>

    <!-- Data Table -->
    {:else}
      <div class="overflow-x-auto rounded-lg border border-slate-700/50">
        <Table>
          <TableHeader class="bg-slate-800">
            <TableRow class="border-slate-700 hover:bg-slate-800">
              <!-- Select-all checkbox -->
              {#if selectable}
                <TableHead class="w-10 text-center uppercase tracking-[0.08em] text-[0.68rem] text-slate-400 font-semibold">
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900 accent-cyan-500"
                    checked={allPageSelected}
                    onchange={toggleSelectAll}
                    aria-label="Select all rows on this page"
                  />
                </TableHead>
              {/if}
              {#each columns as column}
                <TableHead
                  class={cn('uppercase tracking-[0.08em] text-[0.68rem] text-slate-400 font-semibold', sortable && 'cursor-pointer select-none hover:text-slate-100')}
                  onclick={() => toggleSort(column.key)}
                >
                  <span class="inline-flex items-center gap-1">
                    {column.label}
                    {#if sortable}
                      <span class={cn('text-xs', sortKey === column.key && sortDir ? 'text-cyan-400' : 'text-slate-600')}>
                        {sortIcon(column.key)}
                      </span>
                    {/if}
                  </span>
                </TableHead>
              {/each}
              <TableHead class="uppercase tracking-[0.08em] text-[0.68rem] text-slate-400 font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if pageRows.length === 0}
              <TableRow class="border-slate-800 hover:bg-slate-900">
                <TableCell
                  colspan={columns.length + (selectable ? 2 : 1)}
                  class="py-8 text-center text-slate-500"
                >
                  {searchQuery ? 'No matching records' : 'No records found'}
                </TableCell>
              </TableRow>
            {:else}
              {#each pageRows as row}
                {@const selected = isRowSelected(row)}
                <TableRow
                  class={cn(
                    'border-slate-800 odd:bg-slate-950/90 even:bg-slate-950/55 hover:bg-slate-800/95 transition-colors',
                    editing === row && 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/30',
                    selected && 'bg-cyan-500/5'
                  )}
                >
                  <!-- Row checkbox -->
                  {#if selectable}
                    <TableCell class="w-10 text-center">
                      <input
                        type="checkbox"
                        class="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900 accent-cyan-500"
                        checked={selected}
                        onchange={() => toggleSelectRow(row)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  {/if}
                  {#each columns as column}
                    {@const value = row[column.key]}
                    <TableCell class={column.mono ? 'font-mono text-xs' : ''}>
                      {#if isStatusValue(value)}
                        <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {getStatusClasses(value)}">
                          {getStatusLabel(value)}
                        </span>
                      {:else}
                        {asString(value)}
                      {/if}
                    </TableCell>
                  {/each}
                  <TableCell>
                    {#if toDelete === row}
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-sm text-red-300">Confirm delete?</span>
                        <Button size="sm" class="cursor-pointer bg-red-500 text-white hover:bg-red-600" onclick={deleteItem} disabled={deleting}>
                          {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                        <Button size="sm" variant="outline" class="cursor-pointer border-slate-700" onclick={() => (toDelete = null)} disabled={deleting}>
                          Cancel
                        </Button>
                      </div>
                    {:else}
                      <div class="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" class="cursor-pointer border-slate-700" onclick={() => editItem(row)}>Edit</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          class="cursor-pointer border-red-500/40 text-red-300 hover:bg-red-500/10"
                          onclick={() => { toDelete = row; }}
                        >
                          Delete
                        </Button>
                      </div>
                    {/if}
                  </TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>

      <!-- Pagination Footer -->
      {#if sortedRows.length > 10}
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <!-- Page size selector -->
          <div class="flex items-center gap-2 text-slate-400">
            <span>Show</span>
            <select
              class="cursor-pointer rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              value={String(itemsPerPage)}
              onchange={(e) => changePageSize(Number((e.currentTarget as HTMLSelectElement).value))}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span>per page</span>
          </div>

          <!-- Page info + navigation -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, sortedRows.length)} of {sortedRows.length}
            </span>
            <div class="flex items-center gap-1">
              <button
                class="cursor-pointer rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                onclick={() => goToPage(1)}
                disabled={currentPage === 1}
                aria-label="First page"
              >«</button>
              <button
                class="cursor-pointer rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                onclick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >‹</button>

              {#each getPageNumbers() as page}
                {#if page === '...'}
                  <span class="px-1 text-xs text-slate-600">…</span>
                {:else}
                  <button
                    class={cn(
                      'cursor-pointer rounded border px-2 py-1 text-xs',
                      page === currentPage
                        ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    )}
                    onclick={() => goToPage(page as number)}
                  >{page}</button>
                {/if}
              {/each}

              <button
                class="cursor-pointer rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                onclick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >›</button>
              <button
                class="cursor-pointer rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                onclick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Last page"
              >»</button>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </CardContent>
</Card>
