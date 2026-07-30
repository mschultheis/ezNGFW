<!-- Route view for `/dhcp/pools` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';

  import { _ } from '$lib/i18n';
  const endpoint = '/dhcp/pools';

  const columns: TableColumn[] = [
    { key: 'id', label: 'ID', mono: true },
    { key: 'name', label: 'Name' },
    { key: 'interface', label: 'Interface' },
    { key: 'subnet', label: 'Subnet', mono: true },
    { key: 'rangeStart', label: 'Start', mono: true },
    { key: 'rangeEnd', label: 'End', mono: true },
    { key: 'enabled', label: 'Enabled' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);

  const fields = $derived.by((): FormField[] => [
    { key: 'id', label: 'Pool ID', type: 'text', required: true, hint: 'Persistent identifier for this pool.' },
    { key: 'name', label: 'Pool Name', type: 'text', required: true, hint: 'Friendly name for the scope.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Enable or disable lease assignment.' },
    { key: 'interface', label: 'Interface', type: 'select', required: true, options: interfaceOptions, hint: 'Interface where this DHCP scope serves requests.' },
    { key: 'subnet', label: 'Subnet CIDR', type: 'text', required: true, hint: 'Subnet boundary in CIDR notation.' },
    { key: 'rangeStart', label: 'Range Start', type: 'text', required: true, hint: 'First assignable IPv4 address.' },
    { key: 'rangeEnd', label: 'Range End', type: 'text', required: true, hint: 'Last assignable IPv4 address.' },
    { key: 'gateway', label: 'Default Gateway', type: 'text', required: true, hint: 'Gateway option delivered to clients.' },
    { key: 'dnsServers', label: 'DNS Servers', type: 'text', required: true, hint: 'Comma-separated DNS resolver addresses.' },
    { key: 'leaseTime', label: 'Lease Time', type: 'number', required: true, hint: 'Lease duration in seconds.' },
    { key: 'ntpServers', label: 'NTP Servers', type: 'text', hint: 'Optional NTP server list.' },
    { key: 'domainName', label: 'Domain Name', type: 'text', hint: 'Domain suffix advertised to clients.' },
    { key: 'bootServer', label: 'Boot Server', type: 'text', hint: 'Optional PXE or provisioning server.' },
    { key: 'denyUnknown', label: 'Deny Unknown', type: 'boolean', hint: 'Reject clients without static mappings.' },
    { key: 'failoverMode', label: 'Failover Mode', type: 'select', options: [
      { label: 'Disabled', value: 'disabled' },
      { label: 'Hot standby', value: 'hot-standby' },
      { label: 'Load balance', value: 'load-balance' }
    ], hint: 'Failover strategy for coordinated pools.' },
    { key: 'notes', label: 'Notes', type: 'textarea', hint: 'Operational notes and ownership details.' }
  ]);

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      interfaceOptions = list.map((entry) => {
        const row = (entry as Record<string, unknown>) ?? {};
        const name = String(row.name ?? row.interface ?? row.iface ?? '').trim();
        return name ? { value: name, label: name } : null;
      }).filter((o): o is SelectOption => o !== null);
    } catch {
      interfaceOptions = [];
    }
  }

  onMount(() => {
    void loadInterfaces();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <ResourceTable
    title="{$_('dhcp_pools.dhcp_address_pools')}"
    description={$_('dhcp_pools.descriptionmanage_dhcpv4_address_pools_with_rich_o')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    addLabel={$_('dhcp_pools.addlabeladd_dhcp_pool')}
  />
</div>
