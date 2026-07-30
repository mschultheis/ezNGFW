<!-- Route view for `/dyndns` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asList, asObject, asString } from '$lib/utils/api-data';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import { _ } from '$lib/i18n';

  const providerOptions: SelectOption[] = [
    { label: 'Cloudflare', value: 'cloudflare' },
    { label: 'No-IP', value: 'noip' },
    { label: 'DynDNS', value: 'dyndns' },
    { label: 'DuckDNS', value: 'duckdns' },
    { label: 'Dynu', value: 'dynu' },
    { label: 'FreeDNS (afraid.org)', value: 'freedns' },
    { label: 'Namecheap', value: 'namecheap' },
    { label: 'Google Domains', value: 'google' },
    { label: 'Desec.io', value: 'desec' },
    { label: 'Custom URL', value: 'custom' }
  ];

  const ipVersionOptions: SelectOption[] = [
    { label: 'IPv4 Only', value: 'ipv4' },
    { label: 'IPv6 Only', value: 'ipv6' },
    { label: 'IPv4 + IPv6 (Dual Stack)', value: 'both' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);
  let stats = $state<Record<string, unknown>>({});
  let statsLoading = $state(true);
  let refreshing = $state(false);

  const columns: TableColumn[] = [
    { key: 'hostname', label: 'Hostname' },
    { key: 'enabled', label: 'Enabled' },
    { key: 'status', label: 'Status' },
    { key: 'provider', label: 'Provider' },
    { key: 'interface', label: 'Interface' },
    { key: 'lastIp', label: 'Last IP', mono: true },
    { key: 'lastUpdate', label: 'Updated' },
    { key: 'description', label: 'Description' }
  ];

  const fields = $derived.by((): FormField[] => [
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Enable this DDNS entry to start automatic IP updates.' },
    { key: 'hostname', label: 'Hostname', type: 'text', required: true, hint: 'FQDN that will be updated.' },
    { key: 'provider', label: 'Provider', type: 'select', options: providerOptions, hint: 'Dynamic DNS provider.' },
    { key: 'interface', label: 'Interface', type: 'select', options: interfaceOptions, hint: 'Network interface whose public IP will be reported.' },
    { key: 'ipVersion', label: 'IP Version', type: 'select', options: ipVersionOptions, hint: 'Which IP address type to detect and report.' },
    { key: 'username', label: 'Username / API Key', type: 'text', hint: 'Authentication username or API key.' },
    { key: 'password', label: 'Password / API Secret', type: 'password', hint: 'Authentication password or API secret.' },
    { key: 'updateIntervalMin', label: 'Check Interval (minutes)', type: 'number', hint: 'How often to check if the public IP has changed.' },
    { key: 'description', label: 'Description', type: 'text', hint: 'Optional note describing the purpose.' },
    { key: 'useCustomUrl', label: 'Use Custom URL', type: 'boolean', hint: 'Override the provider default API.' },
    { key: 'customUrl', label: 'Custom Update URL', type: 'text', hint: 'Full URL for the DDNS update request.' },
    { key: 'ttl', label: 'DNS TTL (seconds)', type: 'number', hint: 'Time-to-live value requested for the DNS record.' },
    { key: 'forceIntervalHours', label: 'Force Update (hours)', type: 'number', hint: "Send an update even if the IP hasn't changed." },
    { key: 'proxyEnabled', label: 'Use Proxy', type: 'boolean', hint: 'Route DDNS update requests through a proxy.' },
    { key: 'proxyUrl', label: 'Proxy URL', type: 'text', hint: 'Full proxy URL including protocol, host, and port.' },
    { key: 'customHeaders', label: 'Custom HTTP Headers', type: 'textarea', hint: 'Additional HTTP headers, one per line.' }
  ]);

  async function loadStats() {
    statsLoading = true;
    try {
      const payload = await api.get('/dyndns/stats');
      stats = asObject(payload);
    } catch {
      stats = {};
    } finally {
      statsLoading = false;
    }
  }

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      interfaceOptions = asList(payload).map((iface: any) => {
        const value = String(iface.name ?? iface.id ?? iface ?? '');
        return { label: value, value };
      });
    } catch {
      interfaceOptions = [];
    }
  }

  async function forceUpdateAll() {
    refreshing = true;
    try {
      await api.post('/dyndns/force-update');
      toasts.success($_('dyndns.toastforce_update_triggered'));
      await loadStats();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to force update');
    } finally {
      refreshing = false;
    }
  }

  function statusClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('ok') || s.includes('success') || s.includes('updated')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (s.includes('pending') || s.includes('warn')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (s.includes('error') || s.includes('fail')) return 'bg-red-500/20 text-red-300 border-red-500/40';
    return 'bg-slate-700/50 text-slate-400 border-slate-600/40';
  }

  onMount(() => { void loadStats(); void loadInterfaces(); });
</script>

<div class="space-y-6">
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {#if statsLoading}
      <Skeleton class="h-24 bg-slate-800" /><Skeleton class="h-24 bg-slate-800" /><Skeleton class="h-24 bg-slate-800" /><Skeleton class="h-24 bg-slate-800" />
    {:else}
      <Card class="border-slate-800 bg-slate-900">
        <CardContent class="pt-6">
          <p class="text-xs text-slate-500">{$_('dyndns.active_entries')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{asString(stats.activeEntries ?? stats.active ?? '-')}</p>
        </CardContent>
      </Card>
      <Card class="border-slate-800 bg-slate-900">
        <CardContent class="pt-6">
          <p class="text-xs text-slate-500">{$_('dyndns.last_update')}</p>
          <p class="mt-1 text-lg font-mono text-slate-100">{asString(stats.lastUpdateTime ?? stats.lastUpdate ?? '-')}</p>
        </CardContent>
      </Card>
      <Card class="border-slate-800 bg-slate-900">
        <CardContent class="pt-6">
          <p class="text-xs text-slate-500">{$_('dyndns.last_status')}</p>
          <p class="mt-1">
            {#if stats.lastStatus}<Badge class={statusClass(String(stats.lastStatus))}>{asString(stats.lastStatus)}</Badge>{:else}<span class="text-slate-500">—</span>{/if}
          </p>
        </CardContent>
      </Card>
    {/if}
  </div>

  <div class="flex justify-end">
    <Button variant="outline" class="cursor-pointer border-slate-700 text-slate-100" onclick={forceUpdateAll} disabled={refreshing}>
      <RefreshCwIcon class="mr-2 size-4" /> {refreshing ? 'Updating...' : 'Force Update All'}
    </Button>
  </div>

  <ResourceTable
    title={$_('dyndns.titledynamic_dns_entries')}
    description={$_('dyndns.descriptionmanage_ddns_provider_entries_with_inter')}
    endpoint="/dyndns/entries"
    columns={columns}
    fields={fields}
    idKey="hostname"
    addLabel={$_('dyndns.addlabeladd_entry')}
  />
</div>
