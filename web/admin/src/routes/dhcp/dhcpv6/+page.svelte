<!-- Route view for `/dhcp/dhcpv6` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
  import { _ } from '$lib/i18n';

  const endpoint = '/dhcpv6';

  const columns: TableColumn[] = [
    { key: 'name', label: 'Pool Name' },
    { key: 'interface', label: 'Interface' },
    { key: 'prefix', label: 'Prefix', mono: true },
    { key: 'rangeStart', label: 'Start', mono: true },
    { key: 'rangeEnd', label: 'End', mono: true },
    { key: 'enabled', label: 'Enabled' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);

  const fields = $derived.by((): FormField[] => [
    { key: 'id', label: 'Pool ID', type: 'text', required: true, hint: 'Unique identifier.' },
    { key: 'name', label: 'Pool Name', type: 'text', required: true, hint: 'Descriptive pool name.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Enable lease allocation.' },
    { key: 'interface', label: 'Interface', type: 'select', required: true, options: interfaceOptions, hint: 'Interface for DHCPv6 service.' },
    { key: 'prefix', label: 'Delegated Prefix', type: 'text', required: true, hint: 'IPv6 prefix assigned to this scope.' },
    { key: 'rangeStart', label: 'Range Start', type: 'text', required: true, hint: 'First assignable address.' },
    { key: 'rangeEnd', label: 'Range End', type: 'text', required: true, hint: 'Last assignable address.' },
    { key: 'dnsServers', label: 'DNS Servers', type: 'text', required: true, hint: 'Comma-separated IPv6 resolver addresses.' },
    { key: 'domainSearch', label: 'Domain Search', type: 'text', hint: 'Search domain suffix list.' },
    { key: 'leaseTime', label: 'Lease Time Seconds', type: 'number', required: true, hint: 'Lease duration.' },
    { key: 'rapidCommit', label: 'Rapid Commit', type: 'boolean', hint: 'Allow two-message DHCPv6 rapid commit.' },
    { key: 'preferredLifetime', label: 'Preferred Lifetime', type: 'number', hint: 'Preferred lifetime in seconds.' },
    { key: 'validLifetime', label: 'Valid Lifetime', type: 'number', hint: 'Maximum validity lifetime.' },
    { key: 'guardPolicy', label: 'Guard Policy', type: 'select', options: [{label: 'None', value: 'none'}, {label: 'Strict', value: 'strict'}, {label: 'Balanced', value: 'balanced'}], hint: 'Anti-spoof and prefix consistency checks.' },
    { key: 'notes', label: 'Operational Notes', type: 'textarea', hint: 'Maintenance context and notes.' }
  ]);

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      interfaceOptions = list.map((entry: any) => {
        const name = String(entry.name || entry.interface || '');
        return { label: name, value: name };
      }).filter(o => o.value);
    } catch {}
  }

  onMount(() => {
    void loadInterfaces();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <ResourceTable
    title={$_('dhcp_dhcpv6.titledhcpv6_subnet_pools')}
    description={$_('dhcp_dhcpv6.descriptionconfigure_ipv6_address_allocation_pools')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('dhcp_dhcpv6.addlabeladd_dhcpv6_pool')}
  />
</div>
