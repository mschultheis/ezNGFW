<!-- Route view for `/ids/overview` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
  import { _ } from '$lib/i18n';

  const endpoint = '/ids/overview';

  const columns: TableColumn[] = [
    { key: 'id', label: 'Profile ID', mono: true },
    { key: 'name', label: 'Name' },
    { key: 'enabled', label: 'Enabled' },
    { key: 'interface', label: 'Interface' },
    { key: 'action', label: 'Default Action' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);

  const fields = $derived.by((): FormField[] => [
    { key: 'id', label: 'Profile ID', type: 'text', required: true, hint: 'Persistent profile identifier.' },
    { key: 'name', label: 'Profile Name', type: 'text', required: true, hint: 'Descriptive name for this IDS profile.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Enable inspection for this profile.' },
    { key: 'interface', label: 'Interface', type: 'select', options: interfaceOptions, required: true, hint: 'Interface to monitor.' },
    { key: 'action', label: 'Default Action', type: 'select', options: [{label: 'Alert', value: 'alert'}, {label: 'Drop', value: 'drop'}, {label: 'Pass', value: 'pass'}], hint: 'Default behavior for matched signatures.' },
    { key: 'promisc', label: 'Promiscuous Mode', type: 'boolean', hint: 'Enable promiscuous capture on interface.' },
    { key: 'logPayload', label: 'Log Payload', type: 'boolean', hint: 'Include packet payload in alerts.' },
    { key: 'homeNet', label: 'Home Network', type: 'text', hint: 'CIDR list for HOME_NET variable.' },
    { key: 'externalNet', label: 'External Network', type: 'text', hint: 'CIDR list for EXTERNAL_NET variable.' }
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
    title={$_('ids_overview.titleids_profiles')}
    description={$_('ids_overview.descriptionmanage_intrusion_detection_and_preventi')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('ids_overview.addlabeladd_ids_profile')}
  />
</div>
