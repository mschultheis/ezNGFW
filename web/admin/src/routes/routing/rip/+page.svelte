<!-- Route view for `/routing/rip` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  let loading = $state(true);
  let saving = $state(false);
  let cfg = $state({
    enabled: false,
    version: 2,
    networks: [] as string[],
    passive_interfaces: [] as string[],
    redistribute: [] as string[],
    default_metric: 1,
    update_timer: 30,
    timeout_timer: 180,
    garbage_timer: 120,
    authentication_type: 'none',
    authentication_key: ''
  });

  let networks = $state('');
  let passiveInterfaces = $state('');
  let redistribute = $state('');

  async function load() {
    loading = true;
    try {
      const data = (await api.get('/routing/rip')) as Record<string, unknown>;
      cfg = {
        enabled: Boolean(data.enabled ?? false),
        version: Number(data.version ?? 2),
        networks: Array.isArray(data.networks) ? (data.networks as string[]) : [],
        passive_interfaces: Array.isArray(data.passive_interfaces) ? (data.passive_interfaces as string[]) : [],
        redistribute: Array.isArray(data.redistribute) ? (data.redistribute as string[]) : [],
        default_metric: Number(data.default_metric ?? 1),
        update_timer: Number(data.update_timer ?? 30),
        timeout_timer: Number(data.timeout_timer ?? 180),
        garbage_timer: Number(data.garbage_timer ?? 120),
        authentication_type: String(data.authentication_type ?? 'none'),
        authentication_key: String(data.authentication_key ?? '')
      };
      networks = cfg.networks.join(',');
      passiveInterfaces = cfg.passive_interfaces.join(',');
      redistribute = cfg.redistribute.join(',');
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load RIP config');
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      cfg.networks = networks.split(',').map((v) => v.trim()).filter(Boolean);
      cfg.passive_interfaces = passiveInterfaces.split(',').map((v) => v.trim()).filter(Boolean);
      cfg.redistribute = redistribute.split(',').map((v) => v.trim()).filter(Boolean);
      await api.patch('/routing/rip', cfg);
      toasts.success($_('routing_rip.toastrip_configuration_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save RIP config');
    } finally {
      saving = false;
    }
  }

  onMount(() => void load());
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <CardTitle class="text-slate-100">{$_('routing_rip.rip_configuration')}</CardTitle>
    <CardDescription class="text-slate-400">{$_('routing_rip.full_rip_integration_including_networks_passive_in')}</CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    {#if loading}
      <p class="text-sm text-slate-400">{$_('routing_rip.loading_rip_data')}</p>
    {:else}
      <div class="grid gap-4 md:grid-cols-3">
        <div><FieldLabel label="Enabled" hint="Enable RIP process for dynamic routing on smaller or legacy environments where hop-count metrics are acceptable. Disable it if protocol is not needed to avoid unnecessary broadcasts. Example: enabled on branch routers with simple topologies." /><div class="mt-2"><Switch bind:checked={cfg.enabled} /></div></div>
        <div><FieldLabel label="RIP Version" hint="Set RIP version according to interoperability requirements with neighboring routers. Version 2 supports CIDR and authentication and is recommended in most modern setups. Example: version 2 for private IP campus routing." /><select
              bind:value={cfg.version}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select></div>
        <div><FieldLabel label="Default Metric" hint="Specify metric assigned to redistributed routes when no explicit metric is provided. Lower values are preferred by RIP route selection logic. Example: default metric 2 for static redistribution." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.default_metric} /></div>
        <div><FieldLabel label="Networks" hint="List RIP-enabled networks as comma-separated prefixes or classful statements depending on deployment style. Keep this tight to avoid advertising unintended segments. Example: 10.0.0.0,172.16.0.0." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={networks} /></div>
        <div><FieldLabel label="Passive Interfaces" hint="Set interfaces to passive mode so networks are advertised without sending RIP updates out those ports. This reduces unnecessary routing chatter on user segments. Example: lan0,lan1." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={passiveInterfaces} /></div>
        <div><FieldLabel label="Redistribute" hint="Choose protocols to redistribute into RIP as comma-separated values while controlling external route volume. Pair this with route filtering where possible to avoid excessive announcements. Example: connected,static." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={redistribute} /></div>
        <div><FieldLabel label="Update Timer" hint="Periodic interval for RIP update advertisements to neighbors that keeps topology state current. Keep standard values unless optimizing for special link conditions. Example: 30 seconds." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.update_timer} /></div>
        <div><FieldLabel label="Timeout Timer" hint="Route timeout for stale entries when updates are no longer received from neighbors. This should exceed several update intervals for stability. Example: 180 seconds." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.timeout_timer} /></div>
        <div><FieldLabel label="Garbage Timer" hint="Flush timer controlling how long invalid routes remain before deletion and cleanup. Balance failure visibility and table churn when tuning this setting. Example: 120 seconds." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.garbage_timer} /></div>
        <div><FieldLabel label="Authentication Type" hint="Set RIP authentication mode to secure update exchanges against unauthorized routing advertisements. Match this exactly across neighbors before enabling to avoid session issues. Example: md5 for inter-router links." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={cfg.authentication_type}><option value="none">none</option><option value="text">text</option><option value="md5">md5</option></select></div>
        <div><FieldLabel label="Authentication Key" hint="Provide shared key material or key-chain name associated with selected RIP authentication type. Rotate this carefully to avoid adjacency interruption across domains. Example: RIP-EDGE-KEY-01." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.authentication_key} /></div>
      </div>
    {/if}

    <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={save} disabled={saving || loading}>{saving ? 'Saving...' : 'Save RIP'}</Button>
  </CardContent>
</Card>
