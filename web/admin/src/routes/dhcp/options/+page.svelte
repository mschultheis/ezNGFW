<!-- Route view for `/dhcp/options` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, SelectOption, TableColumn } from '$lib/types/admin';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { _ } from '$lib/i18n';

  const rowsEndpoint = '/dhcp/options';

  const columns: TableColumn[] = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'option_type', label: 'Type' },
    { key: 'value', label: 'Value' }
  ];

  const fields: FormField[] = [
    {
      key: 'code',
      label: 'Option Code',
      type: 'number',
      required: true,
      hint: 'The DHCP option number as defined in RFC 2132. Common codes: 6 (DNS servers), 15 (domain name), 42 (NTP servers), 66 (TFTP server), 150 (TFTP server address for VoIP phones).'
    },
    {
      key: 'name',
      label: 'Option Name',
      type: 'text',
      required: true,
      placeholder: 'dns-servers',
      hint: 'A human-readable name for this option. Used for identification in the UI and logs. Examples: dns-servers, ntp-server, tftp-boot-server.'
    },
    {
      key: 'option_type',
      label: 'Value Type',
      type: 'select',
      required: true,
      options: [
        { value: 'String', label: 'String / Text' },
        { value: 'Ip', label: 'IP Address' },
        { value: 'Uint8', label: 'Uint8 (0–255)' },
        { value: 'Uint16', label: 'Uint16 (0–65535)' },
        { value: 'Uint32', label: 'Uint32 (0–4B)' },
        { value: 'Boolean', label: 'Boolean' },
        { value: 'Hex', label: 'Hex' },
      ],
      hint: 'The data type of this DHCP option value. Must match the option code specification from RFC 2132. IP for addresses, Text for strings, Integer for numeric values.'
    },
    {
      key: 'value',
      label: 'Value',
      type: 'text',
      required: true,
      placeholder: '8.8.8.8,8.8.4.4',
      hint: 'The value for this DHCP option. Format depends on the type: IP addresses comma-separated, text as plain string, integers as decimal numbers, hex as 0x-prefixed.'
    }
  ];

  const secondaryTables = [
    {
      "endpoint": "/dhcp/status",
      "title": "DHCP Service Status",
      "description": "Service health indicators to verify option changes were applied.",
      "columns": [
        "service",
        "status",
        "leases",
        "lastReload"
      ]
    }
  ];

  let secondaryData = $state<Record<string, Record<string, unknown>[]>>({});
  let loading = $state(true);
  let lastRefreshAt = $state('');
  let lastError = $state('');
  let rowCount = $state(0);

  async function loadSecondary() {
    const next: Record<string, Record<string, unknown>[]> = {};
    for (const section of secondaryTables) {
      try {
        const payload = await api.get<unknown[]>(section.endpoint);
        next[section.endpoint] = Array.isArray(payload) ? payload.map((e) => (typeof e === 'object' && e !== null ? (e as Record<string, unknown>) : {})) : [];
      } catch {
        next[section.endpoint] = [];
      }
    }
    secondaryData = next;
  }

  async function loadStats() {
    try {
      const payload = await api.get<unknown[]>(rowsEndpoint);
      rowCount = Array.isArray(payload) ? payload.length : 0;
    } catch {
      rowCount = 0;
    }
  }

  async function loadAll() {
    loading = true;
    lastError = '';
    try {
      await Promise.all([loadStats(), loadSecondary()]);
      lastRefreshAt = new Date().toISOString();
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Failed to load data';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadAll();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-925 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('dhcp_options.custom_dhcp_options')}</CardTitle>
          <CardDescription class="text-slate-400">
            Define custom DHCP options (RFC 2132) to deliver additional configuration data to DHCP clients.
          </CardDescription>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadAll()} disabled={loading}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('dhcp_options.total_options')}</p>
          <p class="text-lg font-semibold text-slate-100">{rowCount}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('dhcp_options.last_refresh')}</p>
          <p class="truncate text-sm text-slate-200">{lastRefreshAt || 'Not yet'}</p>
        </div>
      </div>
      {#if lastError}
        <div class="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{lastError}</div>
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('dhcp_options.titlecustom_dhcp_options')}
    description={$_('dhcp_options.descriptionbuild_review_and_edit_records_without_m')}
    endpoint={rowsEndpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('dhcp_options.addlabeladd_dhcp_option')}
  />

  {#each secondaryTables as section}
    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle class="text-slate-100">{section.title}</CardTitle>
            <CardDescription class="text-slate-400">{section.description}</CardDescription>
          </div>
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadSecondary()}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {#each section.columns as column}
                  <th class="px-3 py-2 text-left">{column}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No DHCP options found.</td></tr>
              {:else}
                {#each secondaryData[section.endpoint] ?? [] as row}
                  <tr class="border-t border-slate-800/80 text-slate-200">
                    {#each section.columns as column}
                      <td class="px-3 py-2 text-xs">{String(row[column] ?? '-')}</td>
                    {/each}
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  {/each}
</div>
