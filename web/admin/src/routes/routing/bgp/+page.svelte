<!-- Route view for `/routing/bgp` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import UnderlineTabs from '$lib/components/admin/UnderlineTabs.svelte';
  import { _ } from '$lib/i18n';

  type Neighbor = {
    address: string;
    remote_asn: number;
    description: string;
    enabled: boolean;
    route_reflector_client: boolean;
    confederation_member: boolean;
    address_family: string;
  };

  let loading = $state(true);
  let saving = $state(false);
  let families = ['ipv4-unicast', 'ipv6-unicast', 'vpnv4-unicast', 'evpn'];
  const familyTabs = families.map(f => ({ id: f, label: f }));
  let selectedFamily = $state('ipv4-unicast');

  let bgp = $state({
    bgp_enabled: false,
    bgp_asn: 65000,
    router_id: '',
    bgp_route_reflector: false,
    bgp_confederation_id: null as number | null,
    bgp_confederation_peers: [] as number[],
    bgp_address_families: ['ipv4-unicast'] as string[],
    bgp_graceful_restart: false
  });

  let neighbors = $state<Neighbor[]>([]);
  let neighborForm = $state<Neighbor>({
    address: '',
    remote_asn: 65000,
    description: '',
    enabled: true,
    route_reflector_client: false,
    confederation_member: false,
    address_family: 'ipv4-unicast'
  });

  function parsePeers(input: string): number[] {
    return input
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
  }

  async function load() {
    loading = true;
    try {
      const [routing, n] = await Promise.all([api.get('/routing'), api.get('/routing/bgp/neighbors')]);
      const r = (routing ?? {}) as Record<string, unknown>;
      bgp = {
        bgp_enabled: Boolean(r.bgp_enabled ?? false),
        bgp_asn: Number(r.bgp_asn ?? 65000),
        router_id: String(r.router_id ?? ''),
        bgp_route_reflector: Boolean(r.bgp_route_reflector ?? false),
        bgp_confederation_id: r.bgp_confederation_id ? Number(r.bgp_confederation_id) : null,
        bgp_confederation_peers: Array.isArray(r.bgp_confederation_peers) ? (r.bgp_confederation_peers as number[]) : [],
        bgp_address_families: Array.isArray(r.bgp_address_families) && (r.bgp_address_families as string[]).length > 0 ? (r.bgp_address_families as string[]) : ['ipv4-unicast'],
        bgp_graceful_restart: Boolean(r.bgp_graceful_restart ?? false)
      };
      neighbors = Array.isArray(n)
        ? n.map((item) => ({
            address: String(item.address ?? ''),
            remote_asn: Number(item.remote_asn ?? 65000),
            description: String(item.description ?? ''),
            enabled: Boolean(item.enabled ?? true),
            route_reflector_client: Boolean(item.route_reflector_client ?? false),
            confederation_member: Boolean(item.confederation_member ?? false),
            address_family: String(item.address_family ?? 'ipv4-unicast')
          }))
        : [];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load BGP configuration');
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      await api.patch('/routing', {
        ...bgp,
        bgp_address_families: bgp.bgp_address_families.length > 0 ? bgp.bgp_address_families : ['ipv4-unicast']
      });
      await api.patch('/routing/bgp/confederation', {
        bgp_confederation_id: bgp.bgp_confederation_id,
        bgp_confederation_peers: bgp.bgp_confederation_peers,
        bgp_route_reflector: bgp.bgp_route_reflector,
        bgp_address_families: bgp.bgp_address_families
      });
      await api.patch('/routing/bgp/neighbors', neighbors);
      toasts.success($_('routing_bgp.toastbgp_configuration_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save BGP configuration');
    } finally {
      saving = false;
    }
  }

  function toggleFamily(family: string, enabled: boolean) {
    if (enabled) {
      if (!bgp.bgp_address_families.includes(family)) bgp.bgp_address_families = [...bgp.bgp_address_families, family];
    } else {
      bgp.bgp_address_families = bgp.bgp_address_families.filter((f) => f !== family);
    }
  }

  function addNeighbor() {
    if (!neighborForm.address.trim()) {
      toasts.error($_('routing_bgp.toastneighbor_address_is_required'));
      return;
    }
    neighbors = [...neighbors, { ...neighborForm }];
    neighborForm = {
      address: '',
      remote_asn: 65000,
      description: '',
      enabled: true,
      route_reflector_client: false,
      confederation_member: false,
      address_family: selectedFamily
    };
  }

  function removeNeighbor(index: number) {
    neighbors = neighbors.filter((_, i) => i !== index);
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('routing_bgp.bgp_enterprise_configuration')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('routing_bgp.route_reflector_confederation_extended_communities')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-5">
      {#if loading}
        <p class="text-sm text-slate-400">{$_('routing_bgp.loading_bgp_data')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel label="BGP Enabled" hint="Enable BGP process on this firewall so it can establish peering sessions and exchange routes. Disable it during maintenance windows to stop announcements cleanly. Example: enabled for WAN edge and disabled on isolated lab boxes." />
            <div class="mt-2"><Switch bind:checked={bgp.bgp_enabled} /></div>
          </div>
          <div>
            <FieldLabel label="Local ASN" hint="Set the local autonomous system number used in BGP OPEN messages and policy logic. Use your assigned public ASN or a private ASN in internal designs. Example: 65010 for private edge testing." />
            <Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={bgp.bgp_asn} />
          </div>
          <div>
            <FieldLabel label="Router ID" hint="Choose a stable 32-bit identifier in IPv4 dotted format for deterministic cluster and peer behavior. This should usually match a loopback-like value that never changes. Example: 10.255.255.10." />
            <Input class="mt-2 border-slate-700 bg-slate-950" bind:value={bgp.router_id} />
          </div>
          <div>
            <FieldLabel label="Graceful Restart" hint="Keep forwarding traffic temporarily when the control plane restarts to reduce packet loss. Peers keep stale routes while BGP recovers according to timers. Example: enabled on production edges where short daemon restarts are expected." />
            <div class="mt-2"><Switch bind:checked={bgp.bgp_graceful_restart} /></div>
          </div>
          <div>
            <FieldLabel label="Route Reflector" hint="Enable route reflector behavior so iBGP clients do not require a full mesh of sessions. This centralizes route distribution in larger topologies. Example: set true on core route reflectors in each region." />
            <div class="mt-2"><Switch bind:checked={bgp.bgp_route_reflector} /></div>
          </div>
          <div>
            <FieldLabel label="Confederation ID" hint="Configure a parent ASN for BGP confederation deployments that split internal ASNs by region. Keep this empty when confederation is not used. Example: 65000 as confederation identifier with member ASNs 65010 and 65020." />
            <Input type="number" class="mt-2 border-slate-700 bg-slate-950" value={bgp.bgp_confederation_id ?? ''} oninput={(e) => (bgp.bgp_confederation_id = Number((e.currentTarget as HTMLInputElement).value) || null)} />
          </div>
        </div>

        <div>
          <FieldLabel label="Confederation Peers" hint="List all member ASNs participating as confederation peers in comma-separated format. These values are used for internal AS path handling and policy. Example: 65010,65020,65030." />
          <Input class="mt-2 border-slate-700 bg-slate-950" value={bgp.bgp_confederation_peers.join(',')} oninput={(e) => (bgp.bgp_confederation_peers = parsePeers((e.currentTarget as HTMLInputElement).value))} />
        </div>

        <div>
          <UnderlineTabs tabs={familyTabs} bind:activeTab={selectedFamily} />
          {#each families as family}
            {#if selectedFamily === family}<div class="mt-3 rounded border border-slate-800 p-3">
              <FieldLabel label="Address Family Enabled" hint="Enable specific MP-BGP families for IPv4, IPv6, VPNv4, or EVPN route exchange. Use only families required by your design to reduce control-plane noise. Example: enable ipv4-unicast plus evpn for VXLAN fabrics." />
              <div class="mt-2"><Switch checked={bgp.bgp_address_families.includes(family)} onCheckedChange={(v) => toggleFamily(family, Boolean(v))} /></div>
            </div>{/if}
          {/each}
        </div>

        <div class="space-y-3 rounded border border-slate-800 p-4">
          <h3 class="text-sm font-semibold text-slate-100">{$_('routing_bgp.bgp_neighbors')}</h3>
          <div class="grid gap-3 md:grid-cols-4">
            <div>
              <FieldLabel label="Neighbor Address" hint="Set the neighbor peer IP address used for BGP TCP session establishment. This must match the remote side source address or update-source design. Example: 192.0.2.2." />
              <Input class="mt-2 border-slate-700 bg-slate-950" bind:value={neighborForm.address} />
            </div>
            <div>
              <FieldLabel label="Remote ASN" hint="Specify the peer autonomous system number to enforce expected session identity. Mismatched values cause OPEN failure and no adjacency. Example: 64512 for private upstream." />
              <Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={neighborForm.remote_asn} />
            </div>
            <div>
              <FieldLabel label="Address Family" hint="Pin each neighbor to the correct MP-BGP family so only valid NLRI is activated. This helps avoid accidental family activation. Example: evpn for leaf-spine EVPN peers." />
              <select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={neighborForm.address_family}>
                {#each families as family}<option value={family}>{family}</option>{/each}
              </select>
            </div>
            <div>
              <FieldLabel label="Description" hint="Add a short operational note for faster troubleshooting and peer identification in audits. Include site or circuit details for on-call use. Example: DC2 upstream transit A." />
              <Input class="mt-2 border-slate-700 bg-slate-950" bind:value={neighborForm.description} />
            </div>
            <div><FieldLabel label="Enabled" hint="Enable this neighbor entry to allow session establishment and route exchange. Disable it for maintenance without deleting policy and metadata. Example: set false during upstream migration tests." /><div class="mt-2"><Switch bind:checked={neighborForm.enabled} /></div></div>
            <div><FieldLabel label="RR Client" hint="Mark the peer as route reflector client when this router is a route reflector. Client routes are reflected to other clients according to RR rules. Example: true on access routers peering to core RR." /><div class="mt-2"><Switch bind:checked={neighborForm.route_reflector_client} /></div></div>
            <div><FieldLabel label="Confed Member" hint="Flag the neighbor as part of your BGP confederation member-AS topology for policy context. Use only where confederation is explicitly designed. Example: true for inter-region confed peering sessions." /><div class="mt-2"><Switch bind:checked={neighborForm.confederation_member} /></div></div>
          </div>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={addNeighbor}>Add Neighbor</Button>

          <div class="space-y-2">
            {#each neighbors as neighbor, i}
              <div class="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                <span>{neighbor.address} AS{neighbor.remote_asn} ({neighbor.address_family})</span>
                <Button variant="outline" class="border-slate-700" onclick={() => removeNeighbor(i)}>Remove</Button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={save} disabled={saving || loading}>{saving ? 'Saving...' : 'Save BGP'}</Button>
    </CardContent>
  </Card>
</div>
