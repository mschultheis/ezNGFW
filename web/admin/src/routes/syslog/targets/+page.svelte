<!-- Route view for `/syslog/targets` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import StatusPill from '$lib/components/admin/StatusPill.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import Play from '@lucide/svelte/icons/play';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { _ } from '$lib/i18n';

  const endpoint = '/syslog/targets';
  const settingsEndpoint = '/syslog/targets/settings';
  const testEndpoint = '/syslog/targets/test';

  const columns: TableColumn[] = [
    { key: 'hostname', label: 'Hostname' },
    { key: 'port', label: 'Port' },
    { key: 'transport', label: 'Transport' },
    { key: 'facility', label: 'Facility' },
    { key: 'level_filter', label: 'Level' },
    { key: 'enabled', label: 'Enabled' }
  ];

  const fields: FormField[] = [
    { key: 'hostname', label: 'Hostname', type: 'text', required: true, hint: 'The hostname or IP address of the remote syslog collector.' },
    { key: 'port', label: 'Port', type: 'number', required: true, hint: 'The port number of the remote syslog collector.' },
    { key: 'transport', label: 'Transport', type: 'select', required: true, options: [
      { value: 'udp', label: 'UDP' },
      { value: 'tcp', label: 'TCP' },
      { value: 'tls', label: 'TLS' }
    ], hint: 'The transport protocol to use.' },
    { key: 'format', label: 'Format', type: 'select', required: true, options: [
      { value: 'rfc3164', label: 'RFC 3164' },
      { value: 'rfc5424', label: 'RFC 5424' }
    ], hint: 'The syslog message format to use.' },
    { key: 'facility', label: 'Facility', type: 'select', required: true, options: [
      { value: 'local0', label: 'local0' }, { value: 'local1', label: 'local1' }, { value: 'local2', label: 'local2' },
      { value: 'local3', label: 'local3' }, { value: 'local4', label: 'local4' }, { value: 'local5', label: 'local5' },
      { value: 'local6', label: 'local6' }, { value: 'local7', label: 'local7' }, { value: 'daemon', label: 'daemon' }
    ], hint: 'The syslog facility to use.' },
    { key: 'level_filter', label: 'Level Filter', type: 'select', required: true, options: [
      { value: 'emerg', label: 'Emergency' }, { value: 'alert', label: 'Alert' }, { value: 'crit', label: 'Critical' },
      { value: 'err', label: 'Error' }, { value: 'warning', label: 'Warning' }, { value: 'notice', label: 'Notice' },
      { value: 'info', label: 'Info' }, { value: 'debug', label: 'Debug' }
    ], hint: 'The minimum severity level of logs to send.' },
    { key: 'certificate', label: 'Certificate', type: 'text', hint: 'The TLS certificate reference.' },
    { key: 'description', label: 'Description', type: 'text', hint: 'A brief description of this target.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Whether this target is active.' }
  ];

  let settings = $state<Record<string, any>>({});
  let testDraft = $state<Record<string, any>>({ protocol: 'udp', facility: 'local0', severity: 'info' });
  let loading = $state(true);
  let saving = $state(false);
  let testing = $state(false);
  let testOutput = $state('');
  let secondaryData = $state<Record<string, any[]>>({});

  async function loadSettings() {
    try {
      const payload = await api.get(settingsEndpoint);
      settings = typeof payload === 'object' && payload !== null ? payload : {};
    } catch {
      toasts.error($_('syslog_targets.toastfailed_to_load_settings'));
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.put(settingsEndpoint, settings);
      toasts.success($_('syslog_targets.toastsettings_saved'));
    } catch {
      toasts.error($_('syslog_targets.toastfailed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  async function runTest() {
    testing = true;
    testOutput = 'Running test...';
    try {
      const res = await api.post(testEndpoint, testDraft);
      testOutput = JSON.stringify(res, null, 2);
      toasts.success($_('syslog_targets.toasttest_completed'));
    } catch {
      testOutput = 'Test failed';
      toasts.error($_('syslog_targets.toasttest_failed'));
    } finally {
      testing = false;
    }
  }

  async function loadSecondary() {
    try {
      const payload = await api.get('/syslog/queue');
      secondaryData['/syslog/queue'] = Array.isArray(payload) ? payload : [];
    } catch {
      secondaryData['/syslog/queue'] = [];
    }
  }

  onMount(async () => {
    loading = true;
    await Promise.all([loadSettings(), loadSecondary()]);
    loading = false;
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-925 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('syslog_targets.syslog_settings')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('syslog_targets.configure_global_behavior_for_remote_syslog_forwar')}</CardDescription>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={loadSettings} disabled={loading || saving}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={saving}>
            <Save class="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <div class="py-8 text-center text-slate-400">Loading settings...</div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Auto Refresh" hint="Auto refresh targets and queue health." />
            <div class="mt-2 flex items-center justify-between">
              <span class="text-xs text-slate-400">{settings.autoRefresh ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={!!settings.autoRefresh} onCheckedChange={(v) => settings.autoRefresh = v} />
            </div>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Default Protocol" hint="Default protocol for new targets." />
            <Select.Root type="single" value={String(settings.defaultProtocol ?? 'udp')} onValueChange={(v) => settings.defaultProtocol = v}>
              <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                <span>{settings.defaultProtocol ?? 'udp'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                <Select.Item value="udp" label="UDP" />
                <Select.Item value="tcp" label="TCP" />
                <Select.Item value="tls" label="TLS" />
              </Select.Content>
            </Select.Root>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Require TLS Cert" hint="Enforce certificate selection for TLS targets." />
            <div class="mt-2 flex items-center justify-between">
              <span class="text-xs text-slate-400">{settings.requireTlsCert ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={!!settings.requireTlsCert} onCheckedChange={(v) => settings.requireTlsCert = v} />
            </div>
          </div>
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-slate-100">{$_('syslog_targets.target_delivery_test')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('syslog_targets.send_test_payloads_to_verify_connectivity')}</CardDescription>
        </div>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={runTest} disabled={testing}>
          <Play class="mr-2 h-4 w-4" /> {testing ? 'Testing...' : 'Run Test'}
        </Button>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-3">
        <div class="space-y-2">
          <FieldLabel label="Target Host" hint="Hostname or IP to test." />
          <Input class="border-slate-700 bg-slate-950 text-slate-100" bind:value={testDraft.target} />
        </div>
        <div class="space-y-2">
          <FieldLabel label="Port" hint="Port to test." />
          <Input type="number" class="border-slate-700 bg-slate-950 text-slate-100" bind:value={testDraft.port} />
        </div>
        <div class="space-y-2">
          <FieldLabel label="Protocol" hint="Protocol to test." />
          <Select.Root type="single" value={testDraft.protocol} onValueChange={(v) => testDraft.protocol = v}>
            <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{testDraft.protocol}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              <Select.Item value="udp" label="UDP" />
              <Select.Item value="tcp" label="TCP" />
              <Select.Item value="tls" label="TLS" />
            </Select.Content>
          </Select.Root>
        </div>
      </div>
      <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <p class="mb-2 text-xs uppercase text-slate-400">{$_('syslog_targets.test_output')}</p>
        <pre class="max-h-32 overflow-auto text-xs text-slate-200">{testOutput || 'No output yet.'}</pre>
      </div>
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('syslog_targets.titlesyslog_targets')}
    description={$_('syslog_targets.descriptionmanage_remote_syslog_collector_endpoint')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    addLabel={$_('syslog_targets.addlabeladd_syslog_target')}
  />

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-slate-100">{$_('syslog_targets.queue_health')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('syslog_targets.monitor_forwarding_queue_and_retry_status')}</CardDescription>
        </div>
        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={loadSecondary}>
          <RefreshCw class="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th class="px-3 py-2 text-left">Target</th>
              <th class="px-3 py-2 text-left">Queued</th>
              <th class="px-3 py-2 text-left">Retries</th>
              <th class="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each secondaryData['/syslog/queue'] ?? [] as row}
              <tr class="border-t border-slate-800/80 text-slate-200">
                <td class="px-3 py-2">{row.target}</td>
                <td class="px-3 py-2">{row.queued}</td>
                <td class="px-3 py-2">{row.retries}</td>
                <td class="px-3 py-2"><StatusPill status={String(row.status ?? '')} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</div>
