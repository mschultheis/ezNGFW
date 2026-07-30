<!-- Route view for `/vpn/gre` in the ezNGFW admin GUI. -->

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

  type Gre = {
    id: string; name: string; enabled: boolean; local_address: string; remote_address: string;
    tunnel_address: string; tunnel_netmask: string; ttl: number; mtu: number; key: number | null;
    keepalive_interval: number; keepalive_retries: number; description: string;
  };

  const empty: Gre = { id: '', name: '', enabled: true, local_address: '', remote_address: '', tunnel_address: '', tunnel_netmask: '255.255.255.252', ttl: 64, mtu: 1476, key: null, keepalive_interval: 10, keepalive_retries: 3, description: '' };
  let loading = $state(true);
  let items = $state<Gre[]>([]);
  let draft = $state<Gre>({ ...empty });

  async function load() {
    try { items = await api.get<Gre[]>('/vpn/gre'); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load GRE tunnels'); }
    finally { loading = false; }
  }

  async function add() {
    try {
      const created = await api.post<Gre>('/vpn/gre', draft);
      items = [...items, created];
      draft = { ...empty };
      toasts.success($_('vpn_gre.toastgre_tunnel_added'));
    } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add GRE tunnel'); }
  }

  async function saveOne(item: Gre) {
    try { await api.put<Gre>(`/vpn/gre/${item.id}`, item); toasts.success(`Saved ${item.id}`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save GRE tunnel'); }
  }

  async function remove(id: string) {
    try { await api.del(`/vpn/gre/${id}`); items = items.filter((x) => x.id !== id); toasts.success(`Removed ${id}`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to remove GRE tunnel'); }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('vpn_gre.gre_tunnels')}</CardTitle><CardDescription class="text-slate-400">{$_('vpn_gre.configure_pointtopoint_gre_overlays_with_keepalive')}</CardDescription></CardHeader><CardContent>
    <div class="grid gap-3 md:grid-cols-4">
      <label class="space-y-1 text-sm"><FieldLabel label="ID" hint="Unique GRE tunnel identifier." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.id} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Human-readable tunnel name." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.name} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Local Address" hint="Local transport endpoint address." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.local_address} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Remote Address" hint="Remote GRE endpoint address." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.remote_address} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Address" hint="Logical GRE interface IP address." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.tunnel_address} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Netmask" hint="IPv4 netmask for tunnel interface." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.tunnel_netmask} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="TTL" hint="GRE packet time-to-live value." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={draft.ttl} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="MTU" hint="GRE tunnel interface MTU." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={draft.mtu} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Key" hint="Optional GRE key for tunnel matching." /><Input type="number" class="border-slate-700 bg-slate-950" value={draft.key ?? ''} oninput={(e) => (draft.key = Number((e.currentTarget as HTMLInputElement).value) || null)} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Keepalive Interval" hint="Seconds between GRE keepalive packets." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={draft.keepalive_interval} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Keepalive Retries" hint="Failed keepalive retry count before down." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={draft.keepalive_retries} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable this GRE tunnel profile." /><div class="flex h-9 items-center"><Switch checked={draft.enabled} onCheckedChange={(v) => (draft.enabled = v)} /></div></label>
      <label class="space-y-1 text-sm md:col-span-4"><FieldLabel label="Description" hint="Change-control notes for this GRE tunnel." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.description} /></label>
    </div>
    <div class="mt-4"><Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={add}><Plus class="mr-2 size-4" />Add GRE Tunnel</Button></div>
  </CardContent></Card>

  {#if !loading}
    {#each items as item}
      <Card class="border-slate-800 bg-slate-900"><CardContent class="pt-6">
        <div class="grid gap-3 md:grid-cols-4">
          <label class="space-y-1 text-sm"><FieldLabel label="ID" hint="Immutable tunnel identifier used by API routes." /><Input class="border-slate-700 bg-slate-950" bind:value={item.id} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Display name shown in operations views." /><Input class="border-slate-700 bg-slate-950" bind:value={item.name} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Local Address" hint="Source transport endpoint for tunnel packets." /><Input class="border-slate-700 bg-slate-950" bind:value={item.local_address} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Remote Address" hint="Destination transport endpoint for tunnel packets." /><Input class="border-slate-700 bg-slate-950" bind:value={item.remote_address} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Address" hint="Assigned tunnel interface IP address." /><Input class="border-slate-700 bg-slate-950" bind:value={item.tunnel_address} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Netmask" hint="Tunnel interface subnet mask." /><Input class="border-slate-700 bg-slate-950" bind:value={item.tunnel_netmask} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="TTL" hint="GRE transport packet TTL value." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={item.ttl} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="MTU" hint="Interface MTU for encapsulated traffic." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={item.mtu} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Key" hint="Optional GRE session key." /><Input type="number" class="border-slate-700 bg-slate-950" value={item.key ?? ''} oninput={(e) => (item.key = Number((e.currentTarget as HTMLInputElement).value) || null)} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Keepalive Interval" hint="Seconds between keepalive probes." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={item.keepalive_interval} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Keepalive Retries" hint="Retry attempts before declaring tunnel down." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={item.keepalive_retries} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable/disable this tunnel profile." /><div class="flex h-9 items-center"><Switch checked={item.enabled} onCheckedChange={(v) => (item.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm md:col-span-4"><FieldLabel label="Description" hint="Operational context and owner notes." /><Input class="border-slate-700 bg-slate-950" bind:value={item.description} /></label>
        </div>
        <div class="mt-4 flex gap-2"><Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={() => saveOne(item)}><Save class="mr-2 size-4" />Save</Button><Button variant="destructive" onclick={() => remove(item.id)}><Trash class="mr-2 size-4" />Remove</Button></div>
      </CardContent></Card>
    {/each}
  {/if}
</div>
