<!-- Route view for `/vpn/vti` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import Plus from '@lucide/svelte/icons/plus';
  import Save from '@lucide/svelte/icons/save';
  import Trash from '@lucide/svelte/icons/trash-2';
  import { _ } from '$lib/i18n';

  type Vti = {
    id: string; name: string; enabled: boolean; local_address: string; remote_address: string;
    tunnel_address: string; tunnel_netmask: string; ipsec_policy: string; mtu: number; description: string;
  };

  const empty: Vti = { id: '', name: '', enabled: true, local_address: '', remote_address: '', tunnel_address: '', tunnel_netmask: '255.255.255.252', ipsec_policy: '', mtu: 1436, description: '' };
  let loading = $state(true);
  let items = $state<Vti[]>([]);
  let draft = $state<Vti>({ ...empty });

  async function load() {
    try { items = await api.get<Vti[]>('/vpn/vti'); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load VTI list'); }
    finally { loading = false; }
  }

  async function add() {
    try { const created = await api.post<Vti>('/vpn/vti', draft); items = [...items, created]; draft = { ...empty }; toasts.success($_('vpn_vti.toastvti_added')); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add VTI'); }
  }

  async function saveOne(item: Vti) {
    try { await api.put<Vti>(`/vpn/vti/${item.id}`, item); toasts.success(`Saved ${item.id}`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save VTI'); }
  }

  async function remove(id: string) {
    try { await api.del(`/vpn/vti/${id}`); items = items.filter((x) => x.id !== id); toasts.success(`Removed ${id}`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to remove VTI'); }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('vpn_vti.virtual_tunnel_interfaces_vti')}</CardTitle><CardDescription class="text-slate-400">{$_('vpn_vti.routebased_tunnel_interfaces_mapped_to_ipsec_polic')}</CardDescription></CardHeader><CardContent>
    <div class="grid gap-3 md:grid-cols-4">
      <label class="space-y-1 text-sm"><FieldLabel label="ID" hint="Unique VTI identifier." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.id} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Display name for this VTI." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.name} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Local Address" hint="Local transport endpoint IP." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.local_address} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Remote Address" hint="Remote transport endpoint IP." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.remote_address} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Address" hint="Layer-3 address configured on VTI interface." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.tunnel_address} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Netmask" hint="Netmask for the VTI tunnel address." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.tunnel_netmask} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="IPsec Policy" hint="Reference to the IPsec policy/profile bound to this VTI." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.ipsec_policy} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="MTU" hint="VTI interface MTU value." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={draft.mtu} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Administrative state of this virtual interface." /><div class="flex h-9 items-center"><Switch checked={draft.enabled} onCheckedChange={(v) => (draft.enabled = v)} /></div></label>
      <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Description" hint="Operational notes and ownership details." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.description} /></label>
    </div>
    <div class="mt-4"><Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={add}><Plus class="mr-2 size-4" />Add VTI</Button></div>
  </CardContent></Card>

  {#if !loading}
    {#each items as item}
      <Card class="border-slate-800 bg-slate-900"><CardContent class="pt-6">
        <div class="grid gap-3 md:grid-cols-4">
          <label class="space-y-1 text-sm"><FieldLabel label="ID" hint="API identifier used for updates/removals." /><Input class="border-slate-700 bg-slate-950" bind:value={item.id} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Display name for operators." /><Input class="border-slate-700 bg-slate-950" bind:value={item.name} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Local Address" hint="Local outer tunnel endpoint." /><Input class="border-slate-700 bg-slate-950" bind:value={item.local_address} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Remote Address" hint="Remote outer tunnel endpoint." /><Input class="border-slate-700 bg-slate-950" bind:value={item.remote_address} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Address" hint="IP address assigned to this VTI." /><Input class="border-slate-700 bg-slate-950" bind:value={item.tunnel_address} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Netmask" hint="Subnet mask for VTI address." /><Input class="border-slate-700 bg-slate-950" bind:value={item.tunnel_netmask} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="IPsec Policy" hint="Mapped route-based IPsec profile." /><Input class="border-slate-700 bg-slate-950" bind:value={item.ipsec_policy} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="MTU" hint="Interface MTU for encapsulated traffic." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={item.mtu} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Administrative enable/disable toggle." /><div class="flex h-9 items-center"><Switch checked={item.enabled} onCheckedChange={(v) => (item.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Description" hint="Runbook details and purpose." /><Input class="border-slate-700 bg-slate-950" bind:value={item.description} /></label>
        </div>
        <div class="mt-4 flex gap-2"><Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={() => saveOne(item)}><Save class="mr-2 size-4" />Save</Button><Button variant="destructive" onclick={() => remove(item.id)}><Trash class="mr-2 size-4" />Remove</Button></div>
      </CardContent></Card>
    {/each}
  {/if}
</div>
