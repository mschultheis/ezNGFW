<!-- Route view for `/routing/ospf` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  type OspfArea = { area_id: string; networks: string[]; area_type?: string | null };
  type OspfVirtualLink = {
    area_id: string;
    neighbor_router_id: string;
    hello_interval: number;
    dead_interval: number;
    retransmit_interval: number;
    transmit_delay: number;
  };

  let loading = $state(true);
  let saving = $state(false);
  let ospfEnabled = $state(false);
  let routerId = $state('');
  let areas = $state<OspfArea[]>([]);
  let virtualLinks = $state<OspfVirtualLink[]>([]);

  let areaForm = $state({ area_id: '0.0.0.0', networks: '', area_type: 'normal' });
  let linkForm = $state<OspfVirtualLink>({
    area_id: '0.0.0.0',
    neighbor_router_id: '',
    hello_interval: 10,
    dead_interval: 40,
    retransmit_interval: 5,
    transmit_delay: 1
  });

  async function load() {
    loading = true;
    try {
      const [routing, areaData, linkData] = await Promise.all([
        api.get('/routing'),
        api.get('/routing/ospf/areas'),
        api.get('/routing/ospf/virtual-links').catch(() => [])
      ]);
      const r = (routing ?? {}) as Record<string, unknown>;
      ospfEnabled = Boolean(r.ospf_enabled ?? false);
      routerId = String(r.router_id ?? '');
      areas = Array.isArray(areaData) ? areaData : [];
      virtualLinks = Array.isArray(linkData) ? linkData : [];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load OSPF config');
    } finally {
      loading = false;
    }
  }

  function addArea() {
    if (!areaForm.area_id.trim()) return;
    areas = [
      ...areas,
      {
        area_id: areaForm.area_id,
        networks: areaForm.networks.split(',').map((v) => v.trim()).filter(Boolean),
        area_type: areaForm.area_type
      }
    ];
    areaForm = { area_id: '0.0.0.0', networks: '', area_type: 'normal' };
  }

  function addVirtualLink() {
    if (!linkForm.neighbor_router_id.trim()) return;
    virtualLinks = [...virtualLinks, { ...linkForm }];
    linkForm = {
      area_id: '0.0.0.0',
      neighbor_router_id: '',
      hello_interval: 10,
      dead_interval: 40,
      retransmit_interval: 5,
      transmit_delay: 1
    };
  }

  async function save() {
    saving = true;
    try {
      await api.patch('/routing', { ospf_enabled: ospfEnabled, router_id: routerId });
      await api.patch('/routing/ospf/areas', areas);
      await api.patch('/routing/ospf/virtual-links', virtualLinks);
      toasts.success($_('routing_ospf.toastospf_configuration_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save OSPF configuration');
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('routing_ospf.ospfv2_configuration')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('routing_ospf.configure_ospf_areas_and_virtual_links_for_nonback')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <p class="text-sm text-slate-400">{$_('routing_ospf.loading_ospf_data')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel label="OSPF Enabled" hint="Enable OSPFv2 process to exchange IPv4 link-state routes with adjacent routers. Disable this when migrating to static-only paths to avoid stale adjacency noise. Example: enabled on core and distribution routers." />
            <div class="mt-2"><Switch bind:checked={ospfEnabled} /></div>
          </div>
          <div>
            <FieldLabel label="Router ID" hint="Use a stable router identifier in IPv4 dotted format for SPF consistency and troubleshooting. Keep this value fixed across reboots and address reassignments. Example: 10.255.255.1." />
            <Input class="mt-2 border-slate-700 bg-slate-950" bind:value={routerId} />
          </div>
        </div>

        <div class="rounded border border-slate-800 p-4">
          <h3 class="mb-3 text-sm font-semibold text-slate-100">{$_('routing_ospf.areas')}</h3>
          <div class="grid gap-3 md:grid-cols-3">
            <div><FieldLabel label="Area ID" hint="Set the OSPF area identifier for route flooding scope and ABR behavior. Use 0.0.0.0 for backbone and non-zero values for non-backbone areas. Example: 0.0.0.1." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={areaForm.area_id} /></div>
            <div><FieldLabel label="Area Type" hint="Choose area behavior such as normal, stub, or NSSA to control external LSA handling and scale. Keep area policy aligned with topology design and summarization goals. Example: stub for branch area without transit." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={areaForm.area_type}><option value="normal">normal</option><option value="stub">stub</option><option value="nssa">nssa</option></select></div>
            <div><FieldLabel label="Networks" hint="Enter comma-separated CIDR prefixes matched into the target area for advertisement and adjacency logic. Ensure these match interface subnets to avoid empty area assignments. Example: 10.10.0.0/16,10.10.1.0/24." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={areaForm.networks} /></div>
          </div>
          <Button class="mt-3 bg-cyan-600 text-white hover:bg-cyan-500" onclick={addArea}>Add Area</Button>
          <div class="mt-3 space-y-2">
            {#each areas as area, i}
              <div class="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                <span>{area.area_id} ({area.area_type ?? 'normal'}) - {area.networks.join(', ')}</span>
                <Button variant="outline" class="border-slate-700" onclick={() => (areas = areas.filter((_, idx) => idx !== i))}>Remove</Button>
              </div>
            {/each}
          </div>
        </div>

        <div class="rounded border border-slate-800 p-4">
          <h3 class="mb-3 text-sm font-semibold text-slate-100">{$_('routing_ospf.virtual_links')}</h3>
          <div class="grid gap-3 md:grid-cols-3">
            <div><FieldLabel label="Transit Area ID" hint="Specify the non-backbone transit area that carries this virtual link to backbone reachability. This is required when two backbone routers are separated by a non-backbone area. Example: 0.0.0.5." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={linkForm.area_id} /></div>
            <div><FieldLabel label="Neighbor Router ID" hint="Set the remote ABR router-id that terminates the virtual link endpoint. Router IDs must be stable and reachable through the transit area. Example: 10.255.255.22." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={linkForm.neighbor_router_id} /></div>
            <div><FieldLabel label="Hello Interval" hint="Control hello packet interval used on the virtual link to maintain adjacency state. Keep timers matched on both endpoints to avoid flapping neighbors. Example: 10 seconds." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={linkForm.hello_interval} /></div>
            <div><FieldLabel label="Dead Interval" hint="Set hold timer before declaring virtual-link neighbor down when hellos stop. This should be at least four times hello interval in common designs. Example: 40 seconds." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={linkForm.dead_interval} /></div>
            <div><FieldLabel label="Retransmit Interval" hint="Tune LSA retransmission interval over the virtual link path to balance reliability and overhead. Higher latency paths may require larger values to prevent unnecessary retries. Example: 5 seconds." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={linkForm.retransmit_interval} /></div>
            <div><FieldLabel label="Transmit Delay" hint="Model serialization delay to age LSAs correctly when forwarding over slower links. Keep this low on modern links but non-zero for correctness. Example: 1 second." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={linkForm.transmit_delay} /></div>
          </div>
          <Button class="mt-3 bg-cyan-600 text-white hover:bg-cyan-500" onclick={addVirtualLink}>Add Virtual Link</Button>
          <div class="mt-3 space-y-2">
            {#each virtualLinks as link, i}
              <div class="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                <span>area {link.area_id} -> {link.neighbor_router_id}</span>
                <Button variant="outline" class="border-slate-700" onclick={() => (virtualLinks = virtualLinks.filter((_, idx) => idx !== i))}>Remove</Button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={save} disabled={saving || loading}>{saving ? 'Saving...' : 'Save OSPF'}</Button>
    </CardContent>
  </Card>
</div>
