<!-- Route view for `/routing/policy` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
  import { _ } from '$lib/i18n';

  const endpoint = '/routing/policy';

  const columns: TableColumn[] = [
    { key: 'id', label: 'ID', mono: true },
    { key: 'interface', label: 'Interface' },
    { key: 'source', label: 'Source', mono: true },
    { key: 'destination', label: 'Destination', mono: true },
    { key: 'gateway', label: 'Gateway' },
    { key: 'enabled', label: 'Enabled' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);

  const fields = $derived.by((): FormField[] => [
    { key: 'id', label: 'Rule ID', type: 'text', required: true, hint: 'Unique identifier.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Enable this policy rule.' },
    { key: 'interface', label: 'Interface', type: 'select', options: interfaceOptions, required: true, hint: 'Ingress interface.' },
    { key: 'source', label: 'Source Network', type: 'text', required: true, hint: 'Source CIDR.' },
    { key: 'destination', label: 'Destination Network', type: 'text', required: true, hint: 'Destination CIDR.' },
    { key: 'gateway', label: 'Gateway', type: 'text', required: true, hint: 'Target gateway for matched traffic.' }
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
    title={$_('routing_policy.titlepolicy_based_routing')}
    description={$_('routing_policy.descriptionconfigure_pbr_rules_to_override_default')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('routing_policy.addlabeladd_pbr_rule')}
  />
</div>
