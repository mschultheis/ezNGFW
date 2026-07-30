<!-- Route view for `/vpn/vxlan` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import Plus from '@lucide/svelte/icons/plus';
  import Save from '@lucide/svelte/icons/save';
  import Trash from '@lucide/svelte/icons/trash-2';
  import { _ } from '$lib/i18n';

  type Vxlan = {
    id: string; name: string; enabled: boolean; vni: number; local_address: string; group_address: string;
    remote_peers: string[]; learning: boolean; port: number; interface: string; mtu: number; description: string;
  };

  const empty: Vxlan = { id: '', name: '', enabled: true, vni: 1000, local_address: '', group_address: '239.1.1.1', remote_peers: [], learning: true, port: 4789, interface: '', mtu: 1450, description: '' };
  let loading = $state(true);
  let items = $state<Vxlan[]>([]);
  let draft = $state<Vxlan>({ ...empty });
  let interfaces = $state<string[]>([]);

  const asCsv = (v: string[]) => v.join(', ');
  const fromCsv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const normalizeInterfaces = (payload: unknown) => Array.isArray(payload) ? payload.map((x: any) => String(x?.name ?? x?.id ?? x?.interface ?? '')).filter(Boolean) : [];

  async function load() {
    try {
      const [vx, ifaces] = await Promise.all([api.get<Vxlan[]>('/vpn/vxlan'), api.get('/interfaces').catch(() => [])]);
      items = vx;
      interfaces = normalizeInterfaces(ifaces);
    } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load VXLAN tunnels'); }
    finally { loading = false; }
  }

  async function add() {
    try { const created = await api.post<Vxlan>('/vpn/vxlan', draft); items = [...items, created]; draft = { ...empty }; toasts.success($_('vpn_vxlan.toastvxlan_tunnel_added')); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add VXLAN tunnel'); }
  }

  async function saveOne(item: Vxlan) {
    try { await api.put<Vxlan>(`/vpn/vxlan/${item.id}`, item); toasts.success(`Saved ${item.id}`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save VXLAN tunnel'); }
  }

  async function remove(id: string) {
    try { await api.del(`/vpn/vxlan/${id}`); items = items.filter((x) => x.id !== id); toasts.success(`Removed ${id}`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to remove VXLAN tunnel'); }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('vpn_vxlan.vxlan_tunnels')}</CardTitle><CardDescription class="text-slate-400">{$_('vpn_vxlan.overlay_segments_with_vni_multicast_group_and_stat')}</CardDescription></CardHeader><CardContent>
    <div class="grid gap-3 md:grid-cols-4">
      <label class="space-y-1 text-sm"><FieldLabel label="ID" hint="Unique VXLAN tunnel identifier." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.id} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Operational label for this VXLAN segment." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.name} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="VNI" hint="VXLAN Network Identifier for L2 segment separation." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={draft.vni} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Underlying Interface" hint="Physical/logical source interface for encapsulation." /><Select.Root type="single" value={draft.interface} onValueChange={(v) => v && (draft.interface = v)}><Select.Trigger class="w-full border-slate-700 bg-slate-950"><span>{interfaces.find(o => o === draft.interface) ?? draft.interface}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each interfaces as iface}<Select.Item value={iface} label={iface} />{/each}</Select.Content></Select.Root></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Local Address" hint="Local VTEP source IP address." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.local_address} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Multicast Group" hint="Multicast group used for BUM replication." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.group_address} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="UDP Port" hint="VXLAN destination UDP port, default 4789." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={draft.port} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="MTU" hint="VXLAN interface MTU accounting for encapsulation overhead." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={draft.mtu} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable or disable this VXLAN tunnel." /><div class="flex h-9 items-center"><Switch checked={draft.enabled} onCheckedChange={(v) => (draft.enabled = v)} /></div></label>
      <label class="space-y-1 text-sm"><FieldLabel label="MAC Learning" hint="Enable dynamic MAC learning on VXLAN bridge interface." /><div class="flex h-9 items-center"><Switch checked={draft.learning} onCheckedChange={(v) => (draft.learning = v)} /></div></label>
      <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Remote VTEP Peers" hint="Comma-separated static unicast VTEP peers." /><Input class="border-slate-700 bg-slate-950" value={asCsv(draft.remote_peers)} oninput={(e) => (draft.remote_peers = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
      <label class="space-y-1 text-sm md:col-span-4"><FieldLabel label="Description" hint="Design intent and ownership notes for the VXLAN." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.description} /></label>
    </div>
    <div class="mt-4"><Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={add}><Plus class="mr-2 size-4" />Add VXLAN Tunnel</Button></div>
  </CardContent></Card>

  {#if !loading}
    {#each items as item}
      <Card class="border-slate-800 bg-slate-900"><CardContent class="pt-6">
        <div class="grid gap-3 md:grid-cols-4">
          <label class="space-y-1 text-sm"><FieldLabel label="ID" hint="Stable tunnel identifier used by API updates." /><Input class="border-slate-700 bg-slate-950" bind:value={item.id} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Display name for this overlay segment." /><Input class="border-slate-700 bg-slate-950" bind:value={item.name} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="VNI" hint="VXLAN segment identifier." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={item.vni} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Underlying Interface" hint="Interface used for VTEP encapsulation." /><Select.Root type="single" value={item.interface} onValueChange={(v) => v && (item.interface = v)}><Select.Trigger class="w-full border-slate-700 bg-slate-950"><span>{interfaces.find(o => o === item.interface) ?? item.interface}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each interfaces as iface}<Select.Item value={iface} label={iface} />{/each}</Select.Content></Select.Root></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Local Address" hint="Source VTEP IP address." /><Input class="border-slate-700 bg-slate-950" bind:value={item.local_address} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Multicast Group" hint="BUM multicast destination group." /><Input class="border-slate-700 bg-slate-950" bind:value={item.group_address} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="UDP Port" hint="Destination UDP port for VXLAN packets." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={item.port} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="MTU" hint="Overlay interface MTU setting." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={item.mtu} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Administrative state for this tunnel." /><div class="flex h-9 items-center"><Switch checked={item.enabled} onCheckedChange={(v) => (item.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="MAC Learning" hint="Dynamic learning behavior for remote MAC addresses." /><div class="flex h-9 items-center"><Switch checked={item.learning} onCheckedChange={(v) => (item.learning = v)} /></div></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Remote VTEP Peers" hint="Static unicast peers for VXLAN replication." /><Input class="border-slate-700 bg-slate-950" value={asCsv(item.remote_peers)} oninput={(e) => (item.remote_peers = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
          <label class="space-y-1 text-sm md:col-span-4"><FieldLabel label="Description" hint="Operational notes and change ticket references." /><Input class="border-slate-700 bg-slate-950" bind:value={item.description} /></label>
        </div>
        <div class="mt-4 flex gap-2"><Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={() => saveOne(item)}><Save class="mr-2 size-4" />Save</Button><Button variant="destructive" onclick={() => remove(item.id)}><Trash class="mr-2 size-4" />Remove</Button></div>
      </CardContent></Card>
    {/each}
  {/if}
</div>
