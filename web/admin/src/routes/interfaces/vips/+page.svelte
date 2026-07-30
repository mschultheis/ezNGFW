<!-- Route view for `/interfaces/vips` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, SelectOption, TableColumn } from '$lib/types/admin';

  import { _ } from '$lib/i18n';
  const PAGE_TITLE = 'Virtual IPs';
  const PAGE_DESCRIPTION = 'Configure virtual IP addresses for CARP redundancy, IP aliasing, and Proxy ARP.';
  const ENDPOINT = '/interfaces/vips';
  const ID_KEY = 'id';

  const columns: TableColumn[] = [
    { key: 'mode', label: 'Mode' },
    { key: 'interface', label: 'Interface' },
    { key: 'address', label: 'Address', mono: true },
    { key: 'subnet_bits', label: 'Subnet Bits' },
    { key: 'description', label: 'Description' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);

  const fields = $derived.by(
    (): FormField[] => [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        required: true,
        options: [
          { label: 'IP Alias', value: 'IpAlias' },
          { label: 'CARP', value: 'Carp' },
          { label: 'Proxy ARP', value: 'ProxyArp' }
        ],
        hint: 'Virtual IP type. IP Alias adds an address to an interface. CARP provides redundancy via shared virtual addresses. Proxy ARP makes the firewall answer ARP requests for other addresses.'
      },
      {
        key: 'interface',
        label: 'Interface',
        type: 'select',
        required: true,
        options: interfaceOptions,
        hint: 'Network interface to assign this virtual IP to.'
      },
      {
        key: 'address',
        label: 'Address',
        type: 'text',
        required: true,
        placeholder: '192.168.1.100',
        hint: 'The virtual IP address. For CARP, this is the shared address. For IP Alias, this is the additional address on the interface.'
      },
      {
        key: 'subnet_bits',
        label: 'Subnet Bits',
        type: 'number',
        required: true,
        min: 1,
        max: 128,
        hint: 'Subnet prefix length (CIDR notation). Common values: 24 for /24, 32 for a single host address, 128 for IPv6 single address.'
      },
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        hint: 'Optional description for identifying this virtual IP.'
      }
    ]
  );

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      const options = list
        .map((entry) => {
          if (typeof entry === 'string') return { label: entry, value: entry };
          const src = (entry as Record<string, unknown>) ?? {};
          const value = String(src.name ?? src.id ?? src.interface ?? src.device ?? src.value ?? '').trim();
          if (!value) return null;
          const label = String(src.description ?? src.label ?? src.friendly_name ?? value).trim() || value;
          return { label, value };
        })
        .filter((entry): entry is SelectOption => entry !== null);

      const deduped = new Map<string, SelectOption>();
      for (const option of options) {
        if (!deduped.has(option.value)) deduped.set(option.value, option);
      }
      interfaceOptions = [...deduped.values()].sort((a, b) => a.label.localeCompare(b.label));
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
    title={PAGE_TITLE}
    description={PAGE_DESCRIPTION}
    endpoint={ENDPOINT}
    columns={columns}
    fields={fields}
    idKey={ID_KEY}
    addLabel={$_('interfaces_vips.addlabeladd_virtual_ip')}
  />
</div>
