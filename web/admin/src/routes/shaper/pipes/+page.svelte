<!-- Route view for `/shaper/pipes` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
  import { _ } from '$lib/i18n';

  const endpoint = '/shaper/pipes';

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'interface', label: 'Interface' },
    { key: 'enabled', label: 'Enabled' },
    { key: 'priority', label: 'Priority' },
    { key: 'description', label: 'Description' },
    { key: 'mode', label: 'Mode' },
    { key: 'rateLimit', label: 'Rate' },
    { key: 'rateUnit', label: 'Unit' }
  ];

  const modeOptions = [
    { label: 'Balanced', value: 'balanced' },
    { label: 'Aggressive', value: 'aggressive' },
    { label: 'Conservative', value: 'conservative' }
  ];

  const unitOptions = [
    { label: 'Kbps', value: 'kbps' },
    { label: 'Mbps', value: 'mbps' },
    { label: 'Gbps', value: 'gbps' }
  ];

  const schedulerOptions = [
    { label: 'FQ-CoDel', value: 'fq_codel' },
    { label: 'PRIQ', value: 'priq' },
    { label: 'WF2Q+', value: 'wf2q+' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);

  const fields = $derived.by((): FormField[] => [
    { key: 'name', label: 'Name', type: 'text', required: true, hint: 'Unique name used in references and automation.' },
    { key: 'interface', label: 'Interface', type: 'select', options: interfaceOptions, required: true, hint: 'Interface where this record applies.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Switch that controls whether this record is active.' },
    { key: 'priority', label: 'Priority', type: 'number', required: true, min: 1, max: 1000, hint: 'Relative order or preference value.' },
    { key: 'description', label: 'Description', type: 'text', required: true, hint: 'Operational summary describing purpose and owner.' },
    { key: 'mode', label: 'Mode', type: 'select', options: modeOptions, required: true, hint: 'Primary operating mode.' },
    { key: 'rateLimit', label: 'Rate Limit', type: 'number', required: true, min: 0, hint: 'Numeric limit applied to throughput.' },
    { key: 'rateUnit', label: 'Rate Unit', type: 'select', options: unitOptions, required: true, hint: 'Unit paired with the rate limit.' },
    { key: 'tag', label: 'Tag', type: 'text', hint: 'Short metadata tag used for filtering.' },
    { key: 'timeoutIdle', label: 'Idle Timeout', type: 'number', min: 0, max: 86400, hint: 'Time of inactivity before reset.' },
    { key: 'timeoutHard', label: 'Hard Timeout', type: 'number', min: 0, max: 604800, hint: 'Maximum lifetime regardless of activity.' },
    { key: 'burst', label: 'Burst Allowance', type: 'number', min: 0, hint: 'Short-term burst budget.' },
    { key: 'scheduler', label: 'Scheduler', type: 'select', options: schedulerOptions, hint: 'Underlying algorithm for fairness.' },
    { key: 'logMatches', label: 'Log Events', type: 'boolean', hint: 'Enables detailed logging for this record.' },
    { key: 'logPrefix', label: 'Log Prefix', type: 'text', hint: 'Prefix attached to related log entries.' },
    { key: 'monitorTarget', label: 'Monitor Target', type: 'text', hint: 'Host or service name for health validation.' },
    { key: 'retryLimit', label: 'Retry Limit', type: 'number', min: 0, max: 20, hint: 'Maximum remediation attempts.' },
    { key: 'strictOrder', label: 'Strict Ordering', type: 'boolean', hint: 'Forces deterministic processing order.' }
  ]);

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      interfaceOptions = list.map((entry) => {
        const src = (entry as Record<string, unknown>) ?? {};
        const value = String(src.name ?? src.id ?? src.interface ?? src.device ?? src.value ?? '').trim();
        const label = String(src.description ?? src.label ?? src.friendly_name ?? value).trim() || value;
        return value ? { label, value } : null;
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
    title={$_('shaper_pipes.titletraffic_shaper_pipes')}
    description={$_('shaper_pipes.descriptionpipelevel_shaping_controls_with_inline')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('shaper_pipes.addlabeladd_pipe')}
  />
</div>
