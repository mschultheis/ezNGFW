<!-- Route view for `/routing/ospfv3` in the ezNGFW admin GUI. -->

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

  type Area = { area_id: string; area_type: string; networks: string[] };
  let loading = $state(true);
  let saving = $state(false);
  let cfg = $state({ enabled: false, router_id: '', areas: [] as Area[], redistribute: [] as string[], passive_interfaces: [] as string[] });
  let form = $state({ area_id: '0.0.0.0', area_type: 'normal', networks: '' });
  let redistribute = $state('');
  let passiveInterfaces = $state('');

  async function load() {
    loading = true;
    try {
      const data = (await api.get('/routing/ospfv3')) as Record<string, unknown>;
      cfg = {
        enabled: Boolean(data.enabled ?? false),
        router_id: String(data.router_id ?? ''),
        areas: Array.isArray(data.areas) ? (data.areas as Area[]) : [],
        redistribute: Array.isArray(data.redistribute) ? (data.redistribute as string[]) : [],
        passive_interfaces: Array.isArray(data.passive_interfaces) ? (data.passive_interfaces as string[]) : []
      };
      redistribute = cfg.redistribute.join(',');
      passiveInterfaces = cfg.passive_interfaces.join(',');
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load OSPFv3 config');
    } finally {
      loading = false;
    }
  }

  function addArea() {
    if (!form.area_id.trim()) return;
    cfg.areas = [...cfg.areas, { area_id: form.area_id, area_type: form.area_type, networks: form.networks.split(',').map((v) => v.trim()).filter(Boolean) }];
    form = { area_id: '0.0.0.0', area_type: 'normal', networks: '' };
  }

  async function save() {
    saving = true;
    try {
      cfg.redistribute = redistribute.split(',').map((v) => v.trim()).filter(Boolean);
      cfg.passive_interfaces = passiveInterfaces.split(',').map((v) => v.trim()).filter(Boolean);
      await api.patch('/routing/ospfv3', cfg);
      toasts.success($_('routing_ospfv3.toastospfv3_configuration_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save OSPFv3 config');
    } finally {
      saving = false;
    }
  }

  onMount(() => void load());
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <CardTitle class="text-slate-100">{$_('routing_ospfv3.ospfv3_ipv6_configuration')}</CardTitle>
    <CardDescription class="text-slate-400">{$_('routing_ospfv3.configure_ipv6_ospf_process_areas_redistribution_a')}</CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    {#if loading}
      <p class="text-sm text-slate-400">{$_('routing_ospfv3.loading_ospfv3_data')}</p>
    {:else}
      <div class="grid gap-4 md:grid-cols-2">
        <div><FieldLabel label="Enabled" hint="Enable OSPFv3 for IPv6 link-state exchange across participating interfaces and areas. Disable this when IPv6 routing is static-only or intentionally isolated. Example: enabled in dual-stack campus deployments." /><div class="mt-2"><Switch bind:checked={cfg.enabled} /></div></div>
        <div><FieldLabel label="Router ID" hint="Set a stable 32-bit router-id used internally by OSPFv3 even though the protocol carries IPv6 reachability. Use an IPv4-style dotted value for consistency with operations tooling. Example: 10.255.255.3." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.router_id} /></div>
        <div><FieldLabel label="Redistribute Protocols" hint="List protocols to redistribute into OSPFv3 using comma-separated values for controlled external route injection. Keep this explicit to avoid route leaks in multi-protocol designs. Example: connected,static." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={redistribute} /></div>
        <div><FieldLabel label="Passive Interfaces" hint="Set interfaces that should advertise connected prefixes but not form OSPF adjacencies. This is useful on user-facing VLANs where neighbor formation is not expected. Example: lan0.20,lan0.30." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={passiveInterfaces} /></div>
      </div>

      <div class="rounded border border-slate-800 p-4">
        <h3 class="mb-3 text-sm font-semibold text-slate-100">{$_('routing_ospfv3.areas')}</h3>
        <div class="grid gap-3 md:grid-cols-3">
          <div><FieldLabel label="Area ID" hint="Area identifier for OSPFv3 flooding domain boundaries and ABR logic. Use consistent numbering with your IPv4 OSPF design when possible for operator clarity. Example: 0.0.0.10." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={form.area_id} /></div>
          <div><FieldLabel label="Area Type" hint="Select area behavior profile to tune external route processing and LSDB size characteristics. Match type with network function requirements and summarization plans. Example: nssa for branch with controlled externals." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={form.area_type}><option value="normal">normal</option><option value="stub">stub</option><option value="nssa">nssa</option></select></div>
          <div><FieldLabel label="Networks" hint="Provide IPv6 prefixes attached to this area so they are included in SPF computation and advertisements. Use comma-separated CIDR notation and keep prefixes precise for clean policy. Example: 2001:db8:10::/64,2001:db8:11::/64." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={form.networks} /></div>
        </div>
        <Button class="mt-3 bg-cyan-600 text-white hover:bg-cyan-500" onclick={addArea}>Add Area</Button>
        <div class="mt-3 space-y-2">
          {#each cfg.areas as area, i}
            <div class="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"><span>{area.area_id} ({area.area_type}) - {area.networks.join(', ')}</span><Button variant="outline" class="border-slate-700" onclick={() => (cfg.areas = cfg.areas.filter((_, idx) => idx !== i))}>Remove</Button></div>
          {/each}
        </div>
      </div>
    {/if}
    <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={save} disabled={saving || loading}>{saving ? 'Saving...' : 'Save OSPFv3'}</Button>
  </CardContent>
</Card>
