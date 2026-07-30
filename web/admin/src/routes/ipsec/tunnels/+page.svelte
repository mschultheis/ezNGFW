<!-- Route view for `/ipsec/tunnels` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
  import { _ } from '$lib/i18n';

  const endpoint = '/ipsec/tunnels';

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'interface', label: 'Interface' },
    { key: 'remote', label: 'Remote Gateway', mono: true },
    { key: 'enabled', label: 'Enabled' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);

  const fields = $derived.by((): FormField[] => [
    { key: 'name', label: 'Tunnel Name', type: 'text', required: true, hint: 'Unique tunnel name.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Enable this tunnel.' },
    { key: 'interface', label: 'Interface', type: 'select', options: interfaceOptions, required: true, hint: 'Local interface for tunnel.' },
    { key: 'remote', label: 'Remote Gateway', type: 'text', required: true, hint: 'Remote IP or hostname.' },
    { key: 'psk', label: 'Pre-Shared Key', type: 'password', hint: 'Authentication key.' },
    { key: 'encryption', label: 'Encryption', type: 'select', options: [{label: 'AES-128', value: 'aes128'}, {label: 'AES-256', value: 'aes256'}], hint: 'Phase 1 encryption.' }
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
    title={$_('ipsec_tunnels.titleipsec_tunnels')}
    description={$_('ipsec_tunnels.descriptionconfigure_sitetosite_and_mobile_ipsec_t')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('ipsec_tunnels.addlabeladd_ipsec_tunnel')}
  />
</div>
